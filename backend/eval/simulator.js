const { Type } = require("@google/genai");
const { runSystem } = require("./system");
const { JUDGE_MODEL } = require("./judge");

const USER_MODEL = process.env.GEMINI_SIM_USER_MODEL || "gemini-2.5-flash-lite";
const TURNS = parseInt(process.env.EVAL_SIM_TURNS || "3", 10);

/**
 * Behavioural simulation: an LLM plays the farmer persona and chats with the
 * assistant for a few turns towards the persona's goal. The farmer only
 * reveals details if asked, so we can see whether memory stops the assistant
 * re-asking things it should already know.
 */
const nextFarmerMessage = async (client, persona, transcript) => {
  const result = await client.models.generateContent({
    model: USER_MODEL,
    contents:
      transcript.length === 0
        ? "Start the conversation."
        : transcript.map((m) => `${m.role === "user" ? "You" : "Assistant"}: ${m.content}`).join("\n"),
    config: {
      systemInstruction: `You are role-playing ${persona.name}, an Indian farmer, chatting with a farming assistant app on a phone.
About you: ${persona.description}
Your goal: ${persona.goal}
Write only your next short message (one or two sentences) in ${persona.language === "hi" ? "Hindi" : "simple English"}.
Do not volunteer your district, crops or land size unless the assistant asks. If your goal has been fully answered, reply exactly DONE.`,
      thinkingConfig: { thinkingBudget: 0 },
      maxOutputTokens: 120,
      temperature: 0.7,
    },
  });
  return (result.text || "").trim();
};

const CONVERSATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    goalAchieved: { type: Type.INTEGER },
    personalisation: { type: Type.INTEGER },
    repeatedQuestions: { type: Type.INTEGER },
    groundedness: { type: Type.INTEGER },
    reason: { type: Type.STRING },
  },
  required: ["goalAchieved", "personalisation", "repeatedQuestions", "groundedness", "reason"],
};

const judgeConversation = async (client, persona, transcript, memoryAvailable) => {
  const result = await client.models.generateContent({
    model: JUDGE_MODEL,
    contents: `FARMER GOAL: ${persona.goal}
FARMER PROFILE (${memoryAvailable ? "known to the assistant from memory" : "NOT known to the assistant"}):
${persona.memories.map((m) => `- ${m.text}`).join("\n")}

CONVERSATION:
${transcript.map((m) => `${m.role === "user" ? "Farmer" : "Assistant"}: ${m.content}`).join("\n")}`,
    config: {
      systemInstruction: `Evaluate this conversation between a farmer and a farming assistant.
goalAchieved 1-5: how fully the farmer's goal was met.
personalisation 1-5: how well answers fit this specific farmer.
repeatedQuestions: number of times the assistant asked for information that was already in the profile AND known to it. If the profile was NOT known to the assistant, count 0.
groundedness 1-5: specific numbers and schemes look plausible and are not invented.
Give a one-sentence reason.`,
      responseMimeType: "application/json",
      responseSchema: CONVERSATION_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
      maxOutputTokens: 300,
      temperature: 0,
    },
  });
  return JSON.parse(result.text);
};

const simulatePersona = async ({ client, config, persona, corpus, embed }) => {
  const transcript = [];
  const tools = [];
  for (let turn = 0; turn < TURNS; turn++) {
    const message = await nextFarmerMessage(client, persona, transcript);
    if (!message || message.toUpperCase().startsWith("DONE")) break;
    transcript.push({ role: "user", content: message });
    const run = await runSystem({ client, config, persona, messages: transcript, corpus, embed });
    tools.push(...run.toolCalls.map((t) => t.name));
    transcript.push({ role: "assistant", content: run.text || "(no answer)" });
  }
  const scores = await judgeConversation(client, persona, transcript, Boolean(config.memory));
  return { persona: persona.id, turns: transcript.length / 2, tools, transcript, scores };
};

module.exports = { simulatePersona };
