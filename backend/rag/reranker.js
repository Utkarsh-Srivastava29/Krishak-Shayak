const { Type } = require("@google/genai");
const { getGeminiClient, isGeminiConfigured } = require("../services/geminiClient");

const RERANK_MODEL = process.env.GEMINI_RERANK_MODEL || "gemini-2.5-flash-lite";

/**
 * LLM reranker: asks a small, free Gemini model to order candidate passages
 * by how well they answer the farmer's question. Falls back to the incoming
 * order if the model is unavailable or answers badly.
 */
const rerank = async (query, candidates, { topK = 4, client } = {}) => {
  if (candidates.length <= 1) return candidates.slice(0, topK);
  const gemini = client || (isGeminiConfigured() ? getGeminiClient() : null);
  if (!gemini) return candidates.slice(0, topK);

  const passages = candidates
    .map((c, i) => `[${i}] ${c.doc.title}\n${c.doc.text.slice(0, 600)}`)
    .join("\n\n");

  try {
    const result = await gemini.models.generateContent({
      model: RERANK_MODEL,
      contents: `Farmer's question: ${query}\n\nPassages:\n${passages}`,
      config: {
        systemInstruction:
          "Rank the passages by how directly they help answer the farmer's question. " +
          "Return the indexes of relevant passages only, most relevant first. Leave out irrelevant passages.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { ranking: { type: Type.ARRAY, items: { type: Type.INTEGER } } },
          required: ["ranking"],
        },
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 200,
      },
    });

    const { ranking } = JSON.parse(result.text);
    const seen = new Set();
    const ordered = (Array.isArray(ranking) ? ranking : [])
      .filter((i) => Number.isInteger(i) && i >= 0 && i < candidates.length && !seen.has(i) && seen.add(i))
      .map((i) => ({ ...candidates[i], reranked: true }));

    return ordered.length ? ordered.slice(0, topK) : candidates.slice(0, topK);
  } catch (error) {
    console.error("[RAG] Rerank failed, using fused order:", error.message);
    return candidates.slice(0, topK);
  }
};

module.exports = { rerank, RERANK_MODEL };
