/**
 * Builds the RAG knowledge base: loads schemes, merges duplicates, embeds
 * anything new or changed with Gemini, and upserts into MongoDB.
 *
 *   npm run rag:ingest            # embed only new/changed documents
 *   npm run rag:ingest -- --force # re-embed everything
 *
 * Re-running is cheap: unchanged documents (same content hash) are skipped,
 * which keeps this inside the Gemini free tier.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const KnowledgeChunk = require("../models/KnowledgeChunk");
const { loadKnowledgeDocuments } = require("../rag/knowledgeSource");
const { embedText, EMBEDDING_MODEL } = require("../rag/embeddings");

const DELAY_MS = parseInt(process.env.INGEST_DELAY_MS || "700", 10);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async (fn, attempts = 4) => {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      const rateLimited = error.status === 429 || /429|RESOURCE_EXHAUSTED/.test(error.message);
      if (!rateLimited || i === attempts - 1) throw error;
      const wait = 2000 * 2 ** i;
      console.log(`  rate limited, waiting ${wait / 1000}s...`);
      await sleep(wait);
    }
  }
};

const main = async () => {
  const force = process.argv.includes("--force");
  await mongoose.connect(process.env.MONGODB_URI);

  const docs = await loadKnowledgeDocuments();
  console.log(`Loaded ${docs.length} documents after merging duplicates.`);

  let embedded = 0;
  let skipped = 0;
  for (const doc of docs) {
    const existing = await KnowledgeChunk.findOne({ docId: doc.docId }).select("+embedding").lean();
    const unchanged =
      existing &&
      existing.contentHash === doc.contentHash &&
      existing.embeddingModel === EMBEDDING_MODEL &&
      existing.embedding?.length;

    if (unchanged && !force) {
      skipped++;
      continue;
    }

    const embedding = await withRetry(() => embedText(`${doc.title}\n${doc.text}`, "RETRIEVAL_DOCUMENT"));
    await KnowledgeChunk.updateOne(
      { docId: doc.docId },
      { $set: { ...doc, embedding, embeddingModel: EMBEDDING_MODEL } },
      { upsert: true }
    );
    embedded++;
    console.log(`  embedded: ${doc.title}`);
    await sleep(DELAY_MS);
  }

  const liveIds = docs.map((d) => d.docId);
  const { deletedCount } = await KnowledgeChunk.deleteMany({ docId: { $nin: liveIds } });

  console.log(`Done. Embedded ${embedded}, unchanged ${skipped}, removed ${deletedCount}.`);
  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error("Ingest failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
