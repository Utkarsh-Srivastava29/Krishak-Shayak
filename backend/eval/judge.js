const { Type } = require("@google/genai");

const JUDGE_MODEL = process.env.GEMINI_JUDGE_MODEL || "gemini-2.5-flash";

const RUBRIC = `You are a strict evaluator of a farming assistant for Indian farmers.
Score the ASSISTANT ANSWER from 1 (very poor) to 5 (excellent) on:

- correctness: facts and advice are right given the REFERENCE FACTS (live data the assistant could look up) and the scheme catalogue excerpt.
- groundedness: every number, price, rain amount and scheme it states is supported by the reference facts or catalogue. Invented numbers or schemes score 1. Correctly saying data is unavailable is grounded.
- personalisation: uses what is known about this farmer (location, crops, recent activity) when relevant. If the question is generic and the answer is fine for this farmer, give 4. Asking for details that the FARMER PROFILE already contains lowers this score — but only if the profile was available to the assistant (see "memory available").
- helpfulness: the farmer can act on it; direct, clear, right length for a phone.

Also set hallucination = true if the answer states any specific fact (price, rainfall, scheme name, eligibility, benefit amount) that contradicts or is absent from the references.
Give a one-sentence reason.`;

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    correctness: { type: Type.INTEGER },
    groundedness: { type: Type.INTEGER },
    personalisation: { type: Type.INTEGER },
    helpfulness: { type: Type.INTEGER },
    hallucination: { type: Type.BOOLEAN },
    reason: { type: Type.STRING },
  },
  required: ["correctness", "groundedness", "personalisation", "helpfulness", "hallucination", "reason"],
};

const clamp = (n) => Math.max(1, Math.min(5, Math.round(Number(n) || 1)));

/**
 * LLM-as-a-Judge for one answer. The judge sees the same reference data the
 * tools return, so it can check numbers rather than guess.
 */
const judgeAnswer = async (client, { question, answer, persona, memoryAvailable, references, schemeExcerpt }) => {
  const prompt = `QUESTION (${persona.language}): ${question}

FARMER PROFILE (${memoryAvailable ? "memory available to the assistant" : "memory NOT available to the assistant"}):
${persona.memories.map((m) => `- ${m.text}`).join("\n")}

REFERENCE FACTS (JSON):
${JSON.stringify(references).slice(0, 6000)}

SCHEME CATALOGUE EXCERPT (relevant schemes):
${schemeExcerpt || "(none)"}

ASSISTANT ANSWER:
${answer || "(empty)"}`;

  const result = await client.models.generateContent({
    model: JUDGE_MODEL,
    contents: prompt,
    config: {
      systemInstruction: RUBRIC,
      responseMimeType: "application/json",
      responseSchema: SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
      maxOutputTokens: 400,
      temperature: 0,
    },
  });

  const parsed = JSON.parse(result.text);
  return {
    correctness: clamp(parsed.correctness),
    groundedness: clamp(parsed.groundedness),
    personalisation: clamp(parsed.personalisation),
    helpfulness: clamp(parsed.helpfulness),
    hallucination: Boolean(parsed.hallucination),
    reason: parsed.reason || "",
  };
};

/** Deterministic checks that need no LLM. */
const ruleChecks = (item, run) => {
  const answer = (run.text || "").toLowerCase();
  const called = new Set(run.toolCalls.map((t) => t.name));
  const expected = item.expectedTools || [];
  const toolRecall = expected.length ? expected.filter((t) => called.has(t)).length / expected.length : 1;
  const groups = item.mustMention || [];
  const keywordHit = groups.length
    ? groups.filter((group) => group.some((word) => answer.includes(word.toLowerCase()))).length / groups.length
    : 1;
  return { toolRecall, keywordHit, toolsCalled: [...called], steps: run.steps };
};

module.exports = { judgeAnswer, ruleChecks, JUDGE_MODEL };
