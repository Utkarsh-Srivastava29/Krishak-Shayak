const { ApiError } = require("@google/genai");
const { getGeminiClient, isGeminiConfigured, MODEL } = require("../services/geminiClient");
const { runAgent } = require("../agent/agentLoop");
const { toolSpecs } = require("../agent/tools");
const { verifyAction } = require("../agent/actionTokens");
const { buildAgentInstructions } = require("../agent/prompts");

const MAX_HISTORY = 20;
const MAX_MESSAGE_CHARS = 2000;

const LANGUAGE_NAMES = { en: "English", hi: "Hindi (हिन्दी)" };

// Client-supplied paths are matched against this map rather than interpolated,
// so the page hint can never carry arbitrary text into the prompt.
const PAGE_LABELS = {
  "/": "Home",
  "/govt-schemes": "Government Schemes",
  "/market-price": "Market Prices",
  "/weather": "Weather",
  "/crop-recommendation": "Crop Guide",
  "/marketplace": "Marketplace",
  "/cart": "Shopping Cart",
  "/farmer-dashboard": "Farmer Dashboard",
  "/seller-dashboard": "Seller Dashboard",
  "/farm-memory": "My Farm Memory",
};

const memoryEnabled = () => process.env.AGENT_MEMORY_ENABLED !== "false";

const validateMessages = (messages) => {
  if (!Array.isArray(messages) || messages.length === 0) {
    return "messages must be a non-empty array";
  }
  if (messages.length > MAX_HISTORY) {
    return `conversation is too long (max ${MAX_HISTORY} messages)`;
  }
  for (const message of messages) {
    if (!message || (message.role !== "user" && message.role !== "assistant")) {
      return "each message needs a role of 'user' or 'assistant'";
    }
    if (typeof message.content !== "string" || message.content.trim() === "") {
      return "each message needs non-empty text content";
    }
    if (message.content.length > MAX_MESSAGE_CHARS) {
      return `each message must be under ${MAX_MESSAGE_CHARS} characters`;
    }
  }
  if (messages[messages.length - 1].role !== "user") {
    return "the last message must be from the user";
  }
  return null;
};

const loadMemory = async (userId) => {
  if (!userId || !memoryEnabled()) return { context: "", profile: {} };
  try {
    const { getActiveMemories } = require("../memory/memoryService");
    const { formatMemoryContext, profileFromMemories } = require("../memory/memoryMerge");
    const memories = await getActiveMemories(userId);
    return { context: formatMemoryContext(memories), profile: profileFromMemories(memories) };
  } catch (error) {
    console.error("Chat: could not load memory:", error.message);
    return { context: "", profile: {} };
  }
};

// @desc    Stream an agent answer: tool calls over live weather, mandi prices,
//          schemes (hybrid RAG) and the marketplace, personalised with
//          long-term farmer memory when signed in.
// @route   POST /api/chat
// @access  Public (memory and write actions need a signed-in user)
exports.chat = async (req, res) => {
  const { messages, language, page } = req.body || {};

  const validationError = validateMessages(messages);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  if (!isGeminiConfigured()) {
    console.error("Chat error: GEMINI_API_KEY is not configured");
    return res.status(503).json({ message: "The assistant is not configured on this server." });
  }

  const lang = language === "hi" ? "hi" : "en";
  const userId = req.user?._id ? String(req.user._id) : null;
  const memory = await loadMemory(userId);

  const systemInstruction = buildAgentInstructions({
    language: LANGUAGE_NAMES[lang],
    pageLabel: PAGE_LABELS[page],
    memoryContext: memory.context,
  });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (payload) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const controller = new AbortController();
  // 'close' also fires on normal completion; abort must never throw here,
  // since an uncaught error in this handler kills the process.
  req.on("close", () => {
    if (res.writableEnded) return;
    try {
      controller.abort();
    } catch {
      /* already settled */
    }
  });

  try {
    const result = await runAgent({
      client: getGeminiClient(),
      model: MODEL,
      systemInstruction,
      // Gemini names the assistant role "model", not "assistant".
      contents: messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      ctx: { userId, profile: memory.profile, language: lang },
      emit: send,
      signal: controller.signal,
    });

    if (!result.text.trim() && result.actions.length === 0) {
      send({
        error: result.blockReason
          ? "I can't answer that one. Please ask something else."
          : "I couldn't produce an answer. Please try rephrasing.",
      });
    }

    const citations = [...new Map(result.citations.filter((c) => c.url).map((c) => [c.url, c])).values()];
    if (citations.length) send({ citations: citations.slice(0, 4) });
    send({ done: true, tools: result.toolCalls.map((t) => t.name) });

    if (userId && memoryEnabled() && result.text) {
      // After the reply: learn from what the farmer shared. Never blocks or
      // fails the chat.
      const { rememberFromConversation } = require("../memory/memoryService");
      rememberFromConversation(userId, [...messages, { role: "assistant", content: result.text }]).catch(
        (error) => console.error("Memory update failed:", error.message)
      );
    }
  } catch (error) {
    if (res.writableEnded || controller.signal.aborted) return;
    console.error("Chat agent error:", error.message);
    const message =
      error instanceof ApiError && error.status === 429
        ? "Too many questions right now. Please wait a moment and try again."
        : "Something went wrong while answering. Please try again.";
    send({ error: message });
  } finally {
    if (!res.writableEnded) res.end();
  }
};

// @desc    Execute a write action the agent proposed, after the farmer taps
//          Confirm. Only signed proposals for this user are accepted.
// @route   POST /api/chat/actions/confirm
// @access  Private
exports.confirmAction = async (req, res) => {
  try {
    const action = verifyAction(req.body?.token, { userId: req.user._id });
    const spec = toolSpecs[action.type];
    if (!spec?.confirm) return res.status(400).json({ message: "Unknown action" });

    if (spec.executor === "client") {
      // e.g. the cart lives in the browser; the server only validates.
      return res.json({ ok: true, executeOnClient: true, type: action.type, args: action.args });
    }

    const result = await spec.execute(action.args, { userId: req.user._id });
    res.json({ ok: true, type: action.type, result });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
