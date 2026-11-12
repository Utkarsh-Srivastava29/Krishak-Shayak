# Krishak Sahayak — Agentic AI advisor

The in-app assistant is a bilingual (Hindi/English) **AI agent**. It looks up live data before it answers, remembers each farmer's farm, sends proactive alerts, and comes with an evaluation harness. Everything runs on **free tiers**.

```
Farmer ──SSE──► /api/chat ──► ReAct agent loop (Gemini function calling)
                                 │  reason → call tools (in parallel) → observe → … → answer
                                 ├── get_weather_forecast   OpenWeatherMap
                                 ├── get_mandi_prices       data.gov.in Agmarknet (+ own price history)
                                 ├── search_knowledge       Hybrid RAG over the scheme catalogue
                                 ├── get_soil_moisture      Open-Meteo
                                 ├── recommend_crops        crop calendar + forecast + soil + mandi prices
                                 ├── search_marketplace     MongoDB products
                                 ├── add_to_cart            ┐ write actions: proposed only,
                                 └── log_farm_activity      ┘ executed after the farmer taps Confirm
                                 ▲
             long-term memory ───┘ (profile + farm diary injected into the prompt)

Upstash QStash (daily) ──► /api/jobs/:name ──► BullMQ queue (Redis) ──► worker
                                                 ├── memory-consolidation (nightly)
                                                 └── proactive-alerts → user-alerts (fan-out)
```

## 1. Agent (`agent/`)

- **`agentLoop.js`**: a ReAct-style loop over Gemini function calling. Each step streams the model's output. When the model calls tools, they run in parallel (15 s timeout each) and the results go back to the model. On the final step tool use is switched off (`mode: NONE`), so the model has to answer. `AGENT_MAX_STEPS` defaults to 4.
- **Streaming (SSE)**: `/api/chat` sends these events:
  - `{status, tool}`: e.g. "Checking mandi prices…"
  - `{text}`: answer chunks
  - `{action}`: a proposed write action
  - `{citations}`: official scheme links
  - `{done, tools}`: end of the answer
- **Human confirmation**: `add_to_cart` and `log_farm_activity` are never run by the agent. The proposal is HMAC-signed (`actionTokens.js`) for that user, with a 15-minute expiry. It runs only when the farmer taps **Confirm**, through `POST /api/chat/actions/confirm`.
- **Tools** (`tools.js`): when the farmer doesn't give a district, state or crop, the tool uses the one stored in memory.
- **Guests**: the assistant still works, but it has no memory and can't run actions.

## 2. Hybrid RAG (`rag/`)

1. `knowledgeSource.js` turns each scheme into a document with metadata:
   - **states**: central schemes are tagged `ALL`; state schemes such as Rajiv Gandhi Kisan Nyay Yojana are tagged with their state.
   - **categories**: insurance, credit, irrigation, solar, dairy, and so on.
   - **Entity resolution**: duplicate catalogue rows like "PMMSY (repeat)" are merged into one document.
2. `npm run rag:ingest` embeds each document with **Gemini Embedding** (`gemini-embedding-001`, 768 dimensions, one request at a time because batch embedding isn't free) and upserts it into MongoDB. Unchanged documents, detected by content hash, are skipped.
3. `retriever.js` runs these stages:
   - **BM25 keyword search** (in-process; handles Devanagari).
   - **Vector search**: cosine similarity in process, or MongoDB Atlas `$vectorSearch`.
   - Both searches apply the **metadata filters** (state, category).
   - The two result lists are merged with **Reciprocal Rank Fusion**.
   - **LLM reranking** with `gemini-2.5-flash-lite` (free) picks the top 4.
4. Before ingestion has run, retrieval falls back to keyword-only search over the bundled catalogue.

**Atlas vector search (optional, free on M0):** set `VECTOR_SEARCH_MODE=atlas` and create a Vector Search index named `knowledge_vector_index` on the `knowledgechunks` collection:

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 768, "similarity": "cosine" },
    { "type": "filter", "path": "metadata.states" },
    { "type": "filter", "path": "metadata.categories" }
  ]
}
```

That uses 1 of the free cluster's 3 search indexes. Keyword search runs in-process, so it doesn't need an index.

## 3. Long-term memory (`memory/`)

- **Semantic memory**: stable facts with a key, such as crop, district, land_size or irrigation.
  - Single-valued keys (like district) are *superseded* when they change, and the old value is kept as history.
  - Multi-valued keys (like crops) accumulate.
- **Episodic memory**: dated farm events and plans, such as "sprayed insecticide on mustard" or "plans to irrigate on Friday".
- **Extraction**: after each reply, `gemini-2.5-flash-lite` pulls out facts the farmer stated, using a JSON schema. `memoryMerge.js` then decides whether each fact is an add, a supersede or a refresh. Aadhaar, phone, bank and OTP details are filtered out, whatever the model returns.
- **Consolidation** runs as a nightly job (`consolidation.js`):
  - archives duplicate facts and stale plans;
  - compresses episodes older than 30 days into one summary per month.
- **Farmer control**: `/farm-memory` in the app (API: `GET/POST/PATCH/DELETE /api/memory`). Farmers can view, edit, add, delete, or "forget everything".

## 4. Background jobs and proactive alerts (`jobs/`, `alerts/`)

- **BullMQ** on `REDIS_URL` (Render free Key Value works).
  - Jobs retry 3 times with exponential backoff.
  - The worker starts with the server.
  - Redis holds only the queue. All data is in MongoDB, because free Key Value instances can lose data on restart.
- **Scheduling**:
  - **Render free tier** (sleeps after 15 minutes idle): use **Upstash QStash** (free: 1,000 messages/day). Run `npm run jobs:schedule` once to create the 2 daily schedules.
    - Each QStash call wakes the server.
    - `/api/jobs/:name` verifies the `Upstash-Signature` JWT (signing keys, body hash, URL, expiry), adds the job to BullMQ with a per-day id so it isn't duplicated, and returns `202`.
  - **Always-on server** (the EC2/PM2 deploy): set `JOB_SCHEDULER=bullmq` and BullMQ schedules the jobs itself.
  - **No Redis available**: jobs run inline, so nothing breaks.
- **Alert rules** (`alertRules.js`, pure functions):
  - rain before a planned spray, or right after a spray
  - rain that makes a planned irrigation unnecessary
  - heavy rain
  - frost and heat
  - weekly price moves of 8% or more for the farmer's crops (the app keeps its own price history, since the government feed only has today's prices)
  - new schemes for the farmer's state
- **At most one alert per farmer per day**, with no repeats within 3 days. Alerts appear on the Farmer Dashboard. They're also emailed if `ALERT_EMAILS_ENABLED=true`, using your existing SMTP settings.

## 5. Evaluation (`eval/`)

```bash
npm run eval                                        # 40 questions × 4 systems
npm run eval -- --configs agent_rag,agent_rag_memory --limit 10
npm run eval -- --sim                               # + multi-turn persona simulations
npm run eval -- --resume eval/results/eval-<time>.json
```

- **Dataset**: 40 questions in English and Hindi, in `eval/data/queries.json`.
  - Types: prices, weather, irrigation, schemes (including one invented scheme the agent should refuse), marketplace, actions, selling decisions, and vague questions that only memory can answer.
  - Each question lists the tools it should use and keywords the answer must contain.
- **Personas**: 4 farmer personas (UP, Maharashtra, Punjab, Chhattisgarh) with profile and diary memories, in `eval/data/personas.json`.
- **Fixtures**: `eval/fixtures.js` replaces the live APIs, so runs are repeatable and need only `GEMINI_API_KEY`.
- **Ablations** (`eval/configs.js`):

| System | Tools | Retrieval | Memory |
|---|---|---|---|
| `baseline` | none (whole catalogue in the prompt) | none | no |
| `agent` | all | BM25 only | no |
| `agent_rag` | all | hybrid + rerank | no |
| `agent_rag_memory` | all | hybrid + rerank | yes |

- **Metrics**:
  - Rule-based: tool recall and keyword hit.
  - **LLM-as-a-Judge** (`gemini-2.5-flash`, temperature 0): correctness, groundedness, personalisation and helpfulness on a 1–5 scale, plus a hallucination flag. The judge sees the same reference data the tools return, so it checks the numbers instead of guessing.
- **Behavioural simulation** (`--sim`): an LLM plays each persona for 3 turns towards a goal. Then it's judged on goal achieved, personalisation and *repeated questions* (asking for details memory already had).
- **Output**: `eval/results/eval-<time>.json` (raw results) and a Markdown report with tables per system, per question type and for the memory-dependent questions.
- **Free-tier safety**: calls are throttled (`EVAL_RPM`, default 8/min) with 429 backoff, embeddings are cached in `eval/.cache/`, and results are saved after every answer, so you can stop and resume.

## Setup checklist

**On the EC2 deployment** this is automatic. Add a `GEMINI_API_KEY` repository secret, and the deploy workflow writes it to the server's `.env`, sets `JOB_SCHEDULER=bullmq` and runs `rag:ingest`. For a manual or other setup:


1. `npm install` in `backend/`. This adds `bullmq`.
2. In `.env`, set `GEMINI_API_KEY`, `MONGODB_URI`, `REDIS_URL` and `OPENWEATHER_API_KEY`, then the new section of `.env.example`.
3. `npm run rag:ingest` builds the knowledge base. Re-run it whenever the scheme sheet changes.
4. On Render free tier: create a free Upstash QStash project and set `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` and `PUBLIC_API_URL`. Then run `npm run jobs:schedule` once.
5. `npm run test:ai` runs the 57 unit tests for the agent loop, actions, RAG, memory, jobs, alerts, SSE, crop recommendations, news, Hindi translation and the weather proxy. `npm run test:payment` runs the 12 payment tests. None need the network.
6. `npm run eval` runs the evaluation.

## Free tiers used

| Need | Service |
|---|---|
| LLM, function calling, reranking, judge | Gemini API free tier (Flash / Flash-Lite) |
| Embeddings | Gemini Embedding free tier |
| Database + vector search | MongoDB Atlas free cluster |
| Queue | BullMQ (open source) + Render free Key Value / any Redis |
| Schedules | Upstash QStash free tier |
| Weather / prices / soil | OpenWeatherMap free, data.gov.in, Open-Meteo |

Free Gemini requests may be used by Google to improve its products, so don't put real farmer data in evaluation runs.
