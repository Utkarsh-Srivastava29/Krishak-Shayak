/**
 * The four systems compared in the ablation study.
 *
 *   baseline          original assistant: whole scheme catalogue in the
 *                     prompt, no tools, no memory
 *   agent             ReAct agent with tools; scheme search is keyword-only
 *                     (BM25), no reranking, no memory
 *   agent_rag         + hybrid RAG (BM25 + vector embeddings, RRF, LLM rerank)
 *   agent_rag_memory  + long-term farmer memory in the prompt
 */
const ALL_TOOLS = [
  "get_weather_forecast",
  "get_mandi_prices",
  "search_knowledge",
  "get_soil_moisture",
  "recommend_crops",
  "search_marketplace",
  "add_to_cart",
  "log_farm_activity",
];

const CONFIGS = {
  baseline: { label: "Baseline (prompt-stuffed, no tools)", baseline: true, tools: [], useVector: false, useRerank: false, memory: false },
  agent: { label: "Agent (tools, keyword search)", tools: ALL_TOOLS, useVector: false, useRerank: false, memory: false },
  agent_rag: { label: "Agent + hybrid RAG", tools: ALL_TOOLS, useVector: true, useRerank: true, memory: false },
  agent_rag_memory: { label: "Agent + hybrid RAG + memory", tools: ALL_TOOLS, useVector: true, useRerank: true, memory: true },
};

module.exports = { CONFIGS, ALL_TOOLS };
