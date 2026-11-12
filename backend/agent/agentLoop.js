const { toolSpecs, getDeclarations } = require("./tools");
const { signAction } = require("./actionTokens");

const DEFAULT_MAX_STEPS = parseInt(process.env.AGENT_MAX_STEPS || "4", 10);
const TOOL_TIMEOUT_MS = 15000;
const MAX_RESULT_CHARS = 6000;

const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms)),
  ]);

// Keep tool results small so several steps fit in the context window.
const compact = (result) => {
  const json = JSON.stringify(result ?? {});
  if (json.length <= MAX_RESULT_CHARS) return result ?? {};
  return { truncated: true, data: json.slice(0, MAX_RESULT_CHARS) };
};

let actionCounter = 0;

/**
 * Runs one tool call. Write actions (spec.confirm) are never executed here:
 * they are turned into a signed proposal that the farmer confirms in the app.
 */
const runToolCall = async (call, ctx, emit) => {
  const spec = toolSpecs[call.name];
  const args = call.args || {};
  const started = Date.now();

  if (!spec || !ctx.enabledTools.includes(call.name)) {
    return { name: call.name, args, result: { error: `Unknown tool ${call.name}` }, ms: 0 };
  }

  emit({ status: spec.status?.[ctx.language] || spec.status?.en || "Working…", tool: call.name });

  if (spec.confirm) {
    if (spec.requiresLogin && !ctx.userId) {
      return {
        name: call.name,
        args,
        result: { error: "The farmer is not signed in. Ask them to sign in first to use this." },
        ms: 0,
      };
    }
    const action = {
      id: `act_${Date.now().toString(36)}_${(actionCounter++).toString(36)}`,
      type: call.name,
      executor: spec.executor,
      args,
      summary: spec.summarize ? spec.summarize(args) : call.name,
      token: signAction({ type: call.name, args, userId: ctx.userId }),
    };
    emit({ action });
    return {
      name: call.name,
      args,
      action,
      result: {
        status: "awaiting_farmer_confirmation",
        message: "A Confirm button is now shown to the farmer. Nothing has been done yet. Tell them to tap Confirm if they want it.",
      },
      ms: 0,
    };
  }

  try {
    const result = await withTimeout(Promise.resolve(spec.handler(args, ctx)), TOOL_TIMEOUT_MS, call.name);
    return { name: call.name, args, result: compact(result), ms: Date.now() - started };
  } catch (error) {
    console.error(`[AGENT] Tool ${call.name} failed:`, error.message);
    return {
      name: call.name,
      args,
      result: { error: `The ${call.name} service is unavailable right now.` },
      ms: Date.now() - started,
    };
  }
};

/**
 * ReAct-style loop over Gemini function calling:
 *   reason (model decides) → act (tool calls, run in parallel) →
 *   observe (results go back to the model) → repeat, up to maxSteps.
 * On the final step tool use is disabled so the model must answer.
 *
 * Text is streamed through emit({ text }) as it arrives, tool progress as
 * emit({ status }), and write-action proposals as emit({ action }).
 *
 * The Gemini client is injected so tests and the evaluation can use fakes.
 */
const runAgent = async ({
  client,
  model,
  systemInstruction,
  contents,
  ctx,
  emit = () => {},
  maxSteps = DEFAULT_MAX_STEPS,
  maxOutputTokens = 2048,
  thinkingBudget = parseInt(process.env.AGENT_THINKING_BUDGET || "0", 10),
  signal,
}) => {
  const enabledTools = ctx.enabledTools || Object.keys(toolSpecs);
  const runCtx = { ...ctx, enabledTools, citations: ctx.citations || [] };
  const history = [...contents];
  const toolCalls = [];
  const actions = [];
  let answer = "";

  for (let step = 0; step <= maxSteps; step++) {
    const finalStep = step === maxSteps;
    const useTools = enabledTools.length > 0 && !finalStep;

    const stream = await client.models.generateContentStream({
      model,
      contents: history,
      config: {
        systemInstruction,
        ...(enabledTools.length ? { tools: [{ functionDeclarations: getDeclarations(enabledTools) }] } : {}),
        ...(enabledTools.length
          ? { toolConfig: { functionCallingConfig: { mode: useTools ? "AUTO" : "NONE" } } }
          : {}),
        thinkingConfig: { thinkingBudget },
        maxOutputTokens,
        ...(signal ? { abortSignal: signal } : {}),
      },
    });

    const modelParts = [];
    const calls = [];
    let blockReason = null;

    for await (const chunk of stream) {
      blockReason = chunk.promptFeedback?.blockReason || blockReason;
      const parts = chunk.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        // Keep every part as returned (including thought signatures) so the
        // next request carries the model's own turn back unchanged.
        modelParts.push(part);
        if (part.functionCall) calls.push(part.functionCall);
        else if (part.text && !part.thought) {
          answer += part.text;
          emit({ text: part.text });
        }
      }
    }

    if (modelParts.length) history.push({ role: "model", parts: modelParts });
    if (calls.length === 0 || !useTools) {
      return { text: answer, toolCalls, actions, steps: step + 1, blockReason, citations: runCtx.citations };
    }

    const results = await Promise.all(calls.map((call) => runToolCall(call, runCtx, emit)));
    for (const r of results) {
      toolCalls.push({ name: r.name, args: r.args, ms: r.ms, error: r.result?.error });
      if (r.action) actions.push(r.action);
    }

    history.push({
      role: "user",
      parts: results.map((r, i) => ({
        functionResponse: {
          ...(calls[i].id ? { id: calls[i].id } : {}),
          name: r.name,
          response: r.result,
        },
      })),
    });
  }

  return { text: answer, toolCalls, actions, steps: maxSteps + 1, citations: runCtx.citations };
};

module.exports = { runAgent, runToolCall };
