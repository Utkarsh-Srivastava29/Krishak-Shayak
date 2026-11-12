const mongoose = require("mongoose");
const { BM25Index } = require("./bm25");
const { cosineSimilarity, reciprocalRankFusion } = require("./fusion");
const { embedText } = require("./embeddings");
const { rerank } = require("./reranker");
const { loadKnowledgeDocuments } = require("./knowledgeSource");

const CORPUS_TTL_MS = 10 * 60 * 1000;
const CANDIDATES = 20;
const RERANK_POOL = 10;

// "atlas" uses MongoDB Atlas $vectorSearch (free on M0 clusters, needs the
// index in AI_AGENT.md); "local" computes cosine similarity in process.
const VECTOR_MODE = () => (process.env.VECTOR_SEARCH_MODE || "local").toLowerCase();
const VECTOR_INDEX = () => process.env.ATLAS_VECTOR_INDEX || "knowledge_vector_index";

let corpusCache = { docs: null, index: null, loadedAt: 0 };

const loadCorpus = async () => {
  if (corpusCache.docs && Date.now() - corpusCache.loadedAt < CORPUS_TTL_MS) return corpusCache;

  let docs = [];
  if (mongoose.connection.readyState === 1) {
    const KnowledgeChunk = require("../models/KnowledgeChunk");
    docs = await KnowledgeChunk.find({}).select("+embedding").lean();
  }
  // Before `npm run rag:ingest` has run, fall back to keyword search over the
  // scheme catalogue so the assistant still works.
  if (docs.length === 0) docs = await loadKnowledgeDocuments();

  corpusCache = { docs, index: new BM25Index(docs), loadedAt: Date.now() };
  return corpusCache;
};

const clearCorpusCache = () => {
  corpusCache = { docs: null, index: null, loadedAt: 0 };
};

const buildFilter = ({ state, category } = {}) => {
  const wantedState = state ? state.trim().toLowerCase() : null;
  return (doc) => {
    const states = (doc.metadata?.states || ["ALL"]).map((s) => s.toLowerCase());
    if (wantedState && !states.includes("all") && !states.includes(wantedState)) return false;
    if (!wantedState && !states.includes("all")) {
      // No state known: keep state-specific schemes out rather than offer
      // a scheme the farmer may not be eligible for.
      return false;
    }
    if (category && !(doc.metadata?.categories || []).includes(category)) return false;
    return true;
  };
};

const atlasVectorSearch = async (queryVector, { state, category }) => {
  const KnowledgeChunk = require("../models/KnowledgeChunk");
  const filter = { "metadata.states": { $in: ["ALL", ...(state ? [state] : [])] } };
  if (category) filter["metadata.categories"] = category;

  const rows = await KnowledgeChunk.aggregate([
    {
      $vectorSearch: {
        index: VECTOR_INDEX(),
        path: "embedding",
        queryVector,
        numCandidates: CANDIDATES * 5,
        limit: CANDIDATES,
        filter,
      },
    },
    // Exclusion and computed fields cannot share one $project.
    { $addFields: { score: { $meta: "vectorSearchScore" } } },
    { $project: { embedding: 0 } },
  ]);
  return rows.map((doc) => ({ doc, score: doc.score, source: "vector" }));
};

const localVectorSearch = (queryVector, docs, filter) =>
  docs
    .filter((doc) => Array.isArray(doc.embedding) && doc.embedding.length && filter(doc))
    .map((doc) => ({ doc, score: cosineSimilarity(queryVector, doc.embedding), source: "vector" }))
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATES);

/**
 * Hybrid retrieval: BM25 keyword search + vector search, both restricted by
 * metadata filters (state, category), merged with Reciprocal Rank Fusion,
 * then reranked by a small LLM.
 *
 * options.useVector / options.useRerank exist so the evaluation can ablate
 * each stage.
 */
const hybridSearch = async (
  query,
  { state, category, topK = 4, useVector = true, useRerank = true, deps = {} } = {}
) => {
  const corpus = deps.corpus || (await loadCorpus());
  const filter = buildFilter({ state, category });

  const keywordHits = corpus.index
    .search(query, { limit: CANDIDATES, filter })
    .map((hit) => ({ ...hit, source: "keyword" }));

  let vectorHits = [];
  const hasEmbeddings = corpus.docs.some((d) => Array.isArray(d.embedding) && d.embedding.length);
  if (useVector && hasEmbeddings) {
    try {
      const queryVector = await (deps.embed || embedText)(query, "RETRIEVAL_QUERY");
      vectorHits =
        VECTOR_MODE() === "atlas" && !deps.corpus
          ? await atlasVectorSearch(queryVector, { state, category })
          : localVectorSearch(queryVector, corpus.docs, filter);
    } catch (error) {
      console.error("[RAG] Vector search failed, keyword only:", error.message);
    }
  }

  const fused = reciprocalRankFusion(
    [keywordHits, vectorHits].filter((list) => list.length)
  );
  const pool = fused.slice(0, RERANK_POOL);
  const ranked = useRerank
    ? await (deps.rerank || rerank)(query, pool, { topK })
    : pool.slice(0, topK);

  return {
    mode: vectorHits.length ? "hybrid" : "keyword",
    results: ranked.map((item) => ({
      title: item.doc.title,
      url: item.doc.url,
      text: item.doc.text,
      categories: item.doc.metadata?.categories || [],
      retrievedBy: [...new Set(item.sources || [])],
    })),
  };
};

module.exports = { hybridSearch, buildFilter, loadCorpus, clearCorpusCache };
