const { getGeminiClient, isGeminiConfigured } = require("../services/geminiClient");

const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
// 768 dimensions keeps vectors small for the 512 MB free Atlas cluster.
const EMBEDDING_DIMENSIONS = parseInt(process.env.EMBEDDING_DIMENSIONS || "768", 10);

/**
 * Embed one text. Sends one request per text on purpose: batch embedding is
 * not available on the Gemini free tier.
 * taskType: "RETRIEVAL_DOCUMENT" for knowledge, "RETRIEVAL_QUERY" for questions.
 */
const embedText = async (text, taskType = "RETRIEVAL_QUERY") => {
  if (!isGeminiConfigured()) throw new Error("GEMINI_API_KEY is not configured");
  const response = await getGeminiClient().models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: { taskType, outputDimensionality: EMBEDDING_DIMENSIONS },
  });
  const values = response.embeddings?.[0]?.values;
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Gemini returned no embedding");
  }
  return normalizeVector(values);
};

// Truncated (non-3072) Gemini embeddings are not unit length; normalise so
// cosine similarity and Atlas dotProduct/cosine agree.
const normalizeVector = (values) => {
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0)) || 1;
  return values.map((v) => v / norm);
};

module.exports = { embedText, normalizeVector, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS };
