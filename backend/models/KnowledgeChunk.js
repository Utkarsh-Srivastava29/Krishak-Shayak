const mongoose = require("mongoose");

/**
 * One retrievable piece of knowledge (currently: one government scheme),
 * with its Gemini embedding and the metadata used for filtered retrieval.
 */
const knowledgeChunkSchema = new mongoose.Schema(
  {
    docId: { type: String, required: true, unique: true },
    type: { type: String, default: "scheme" },
    title: { type: String, required: true },
    url: { type: String, default: "" },
    text: { type: String, required: true },
    metadata: {
      states: { type: [String], default: ["ALL"] },
      categories: { type: [String], default: [] },
      department: { type: String, default: "" },
    },
    contentHash: { type: String, required: true },
    embedding: { type: [Number], default: undefined, select: false },
    embeddingModel: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("KnowledgeChunk", knowledgeChunkSchema);
