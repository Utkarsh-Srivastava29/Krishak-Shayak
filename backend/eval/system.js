const fs = require("fs");
const path = require("path");
const { runAgent } = require("../agent/agentLoop");
const { buildAgentInstructions, buildBaselineInstructions } = require("../agent/prompts");
const { formatMemoryContext, profileFromMemories } = require("../memory/memoryMerge");
const { hybridSearch } = require("../rag/retriever");
const { rerank } = require("../rag/reranker");
const { BM25Index } = require("../rag/bm25");
const { normalizeVector, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } = require("../rag/embeddings");
const { loadBundledSchemes, schemeToDocument, dedupeDocuments } = require("../rag/knowledgeSource");
const { fixtureDeps } = require("./fixtures");

const CACHE_DIR = path.join(__dirname, ".cache");
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Persona memories as FarmerMemory-shaped rows, dated relative to today. */
const personaMemories = (persona, now = new Date()) =>
  persona.memories.map((m, i) => ({
    _id: `${persona.id}-${i}`,
    status: "active",
    kind: m.kind,
    key: m.key || "",
    value: m.value || "",
    text: m.text,
    isPlanned: Boolean(m.isPlanned),
    eventDate: m.daysFromNow !== undefined ? new Date(now.getTime() + m.daysFromNow * DAY_MS) : undefined,
    createdAt: now,
  }));

/**
 * Embeddings are cached on disk so repeated evaluation runs do not spend the
 * free embedding quota again.
 */
const createEmbedder = (client) => {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, `embeddings-${EMBEDDING_MODEL}-${EMBEDDING_DIMENSIONS}.json`);
  const cache = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};

  return async (text, taskType = "RETRIEVAL_QUERY") => {
    const key = `${taskType}:${text}`;
    if (cache[key]) return cache[key];
    const response = await client.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text,
      config: { taskType, outputDimensionality: EMBEDDING_DIMENSIONS },
    });
    const vector = normalizeVector(response.embeddings[0].values);
    cache[key] = vector;
    fs.writeFileSync(file, JSON.stringify(cache));
    return vector;
  };
};

/** The bundled scheme catalogue as an in-memory corpus, optionally embedded. */
const buildCorpus = async ({ embed } = {}) => {
  const docs = dedupeDocuments(loadBundledSchemes().map(schemeToDocument));
  if (embed) {
    for (const doc of docs) doc.embedding = await embed(`${doc.title}\n${doc.text}`, "RETRIEVAL_DOCUMENT");
  }
  return { docs, index: new BM25Index(docs) };
};

/**
 * Run one system configuration on a conversation and return the agent
 * result (text, tool calls, steps).
 */
const runSystem = async ({ client, config, persona, messages, corpus, embed, now = new Date() }) => {
  const language = persona.language === "hi" ? "Hindi (हिन्दी)" : "English";
  const memories = personaMemories(persona, now);
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  if (config.baseline) {
    return runAgent({
      client,
      model: MODEL,
      systemInstruction: buildBaselineInstructions({ schemes: loadBundledSchemes(), language }),
      contents,
      ctx: { enabledTools: [], language: persona.language },
    });
  }

  const memoryContext = config.memory ? formatMemoryContext(memories, { now }) : "";
  return runAgent({
    client,
    model: MODEL,
    systemInstruction: buildAgentInstructions({ language, memoryContext, today: now }),
    contents,
    ctx: {
      userId: "eval-user",
      language: persona.language,
      profile: config.memory ? profileFromMemories(memories) : {},
      enabledTools: config.tools,
      retrieval: { useVector: config.useVector, useRerank: config.useRerank },
      deps: {
        ...fixtureDeps,
        retriever: {
          hybridSearch: (query, opts) =>
            hybridSearch(query, {
              ...opts,
              deps: { corpus, embed, rerank: (q, pool, o) => rerank(q, pool, { ...o, client }) },
            }),
        },
      },
    },
  });
};

module.exports = { runSystem, buildCorpus, createEmbedder, personaMemories, MODEL };
