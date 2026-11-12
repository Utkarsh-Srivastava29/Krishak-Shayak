/** Cosine similarity between two equal-length vectors. */
const cosineSimilarity = (a, b) => {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
};

/**
 * Reciprocal Rank Fusion: merges ranked lists without needing their scores
 * to be on the same scale (BM25 scores vs cosine similarities).
 * score(doc) = Σ 1 / (k + rank)
 */
const reciprocalRankFusion = (rankedLists, { k = 60, idOf = (item) => item.doc.docId } = {}) => {
  const fused = new Map();
  for (const list of rankedLists) {
    list.forEach((item, index) => {
      const id = idOf(item);
      const entry = fused.get(id) || { doc: item.doc, score: 0, sources: [] };
      entry.score += 1 / (k + index + 1);
      entry.sources.push(item.source);
      fused.set(id, entry);
    });
  }
  return [...fused.values()].sort((a, b) => b.score - a.score);
};

module.exports = { cosineSimilarity, reciprocalRankFusion };
