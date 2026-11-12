require("./_setup");
const test = require("node:test");
const assert = require("node:assert/strict");
const { BM25Index, tokenize } = require("../../rag/bm25");
const { reciprocalRankFusion, cosineSimilarity } = require("../../rag/fusion");
const {
  loadBundledSchemes,
  schemeToDocument,
  dedupeDocuments,
  canonicalSchemeKey,
} = require("../../rag/knowledgeSource");
const { hybridSearch, buildFilter } = require("../../rag/retriever");

const docs = dedupeDocuments(loadBundledSchemes().map(schemeToDocument));
const corpus = { docs, index: new BM25Index(docs) };

test("duplicate catalogue rows are resolved to one document", () => {
  const raw = loadBundledSchemes();
  assert.ok(docs.length < raw.length, `expected merging, got ${docs.length}/${raw.length}`);
  assert.equal(
    canonicalSchemeKey("Pradhan Mantri Matsya Sampada Yojana (PMMSY) (repeat)"),
    canonicalSchemeKey("Pradhan Mantri Matsya Sampada Yojana (PMMSY)")
  );
  assert.equal(docs.filter((d) => /Matsya Sampada/.test(d.title)).length, 1);
});

test("tokenizer handles English and Hindi", () => {
  assert.deepEqual(tokenize("Crop insurance for wheat!"), ["crop", "insurance", "wheat"]);
  assert.ok(tokenize("मिट्टी की जांच").includes("मिट्टी"));
});

test("BM25 finds the crop insurance scheme", () => {
  const [top] = corpus.index.search("crop insurance hailstorm damage", { filter: buildFilter({ state: "Uttar Pradesh" }) });
  assert.match(top.doc.title, /Fasal Bima/);
});

test("state filter keeps state schemes to their own state", () => {
  const cg = corpus.index.search("Rajiv Gandhi Kisan Nyay paddy", { filter: buildFilter({ state: "Chhattisgarh" }) });
  assert.match(cg[0].doc.title, /Rajiv Gandhi Kisan Nyay/);
  const up = corpus.index.search("Rajiv Gandhi Kisan Nyay paddy", { filter: buildFilter({ state: "Uttar Pradesh" }) });
  assert.ok(!up.some((hit) => /Rajiv Gandhi Kisan Nyay/.test(hit.doc.title)));
});

test("category metadata filter narrows results", () => {
  const hits = corpus.index.search("pump farmers", { filter: buildFilter({ state: "Punjab", category: "solar_energy" }) });
  assert.ok(hits.length > 0);
  assert.ok(hits.every((h) => h.doc.metadata.categories.includes("solar_energy")));
});

test("reciprocal rank fusion rewards agreement between lists", () => {
  const d = (id) => ({ doc: { docId: id } });
  const fused = reciprocalRankFusion([
    [d("a"), d("b"), d("c")].map((x) => ({ ...x, source: "keyword" })),
    [d("b"), d("d"), d("a")].map((x) => ({ ...x, source: "vector" })),
  ]);
  assert.equal(fused[0].doc.docId, "b");
  assert.deepEqual(new Set(fused[0].sources), new Set(["keyword", "vector"]));
});

test("cosine similarity", () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
});

test("hybrid search fuses keyword and vector hits, then reranks", async () => {
  // Fake embeddings: put PM-KUSUM's vector next to the query vector.
  const withVectors = {
    docs: docs.map((doc) => ({ ...doc, embedding: /KUSUM/.test(doc.title) ? [1, 0, 0] : [0, 1, 0] })),
  };
  withVectors.index = new BM25Index(withVectors.docs);

  let rerankPool = null;
  const result = await hybridSearch("solar pump for irrigation", {
    state: "Punjab",
    deps: {
      corpus: withVectors,
      embed: async () => [1, 0, 0],
      rerank: async (q, pool, { topK }) => {
        rerankPool = pool;
        return pool.slice(0, topK);
      },
    },
  });
  assert.equal(result.mode, "hybrid");
  assert.match(result.results[0].title, /KUSUM/);
  assert.deepEqual(new Set(result.results[0].retrievedBy), new Set(["keyword", "vector"]));
  assert.ok(rerankPool.length <= 10);
});

test("without embeddings retrieval degrades to keyword search", async () => {
  const result = await hybridSearch("kisan credit card loan", { state: "Bihar", useRerank: false, deps: { corpus } });
  assert.equal(result.mode, "keyword");
  assert.match(result.results[0].title, /Kisan Credit Card/);
});
