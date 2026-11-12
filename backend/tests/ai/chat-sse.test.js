require("./_setup");
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { EventEmitter } = require("events");

// Replace the Gemini client module before the controller loads it.
const geminiPath = path.join(__dirname, "../../services/geminiClient.js");
let script = [];
require.cache[geminiPath] = {
  id: geminiPath,
  filename: geminiPath,
  loaded: true,
  exports: {
    MODEL: "fake-model",
    isGeminiConfigured: () => true,
    getGeminiClient: () => ({
      models: {
        generateContentStream: async () => {
          const parts = script.shift();
          return (async function* stream() {
            for (const part of parts) yield { candidates: [{ content: { parts: [part] } }] };
          })();
        },
      },
    }),
  },
};

const { chat } = require("../../controllers/chatController");

const fakeRes = () => {
  const res = new EventEmitter();
  res.chunks = [];
  res.headers = {};
  res.writableEnded = false;
  res.setHeader = (k, v) => (res.headers[k] = v);
  res.flushHeaders = () => {};
  res.write = (chunk) => res.chunks.push(chunk);
  res.end = () => (res.writableEnded = true);
  res.status = (code) => ({ json: (body) => Object.assign(res, { statusCode: code, body }) });
  return res;
};

const events = (res) => res.chunks.map((c) => JSON.parse(c.replace(/^data: /, "").trim()));

test("POST /api/chat streams tool status, answer text, citations and done over SSE", async () => {
  script = [
    [{ functionCall: { name: "search_knowledge", args: { query: "crop insurance", state: "Uttar Pradesh" } } }],
    [{ text: "You can use PMFBY." }],
  ];
  process.env.AGENT_MEMORY_ENABLED = "false";
  const req = new EventEmitter();
  req.body = { messages: [{ role: "user", content: "How do I insure my crop?" }], language: "en", page: "/govt-schemes" };
  const res = fakeRes();

  await chat(req, res);

  assert.equal(res.headers["Content-Type"], "text/event-stream");
  const list = events(res);
  assert.equal(list[0].tool, "search_knowledge");
  assert.ok(list.some((e) => e.text === "You can use PMFBY."));
  const citations = list.find((e) => e.citations).citations;
  assert.ok(citations.some((c) => /Fasal Bima/.test(c.title)));
  assert.deepEqual(list.at(-1), { done: true, tools: ["search_knowledge"] });
  assert.equal(res.writableEnded, true);
});

test("POST /api/chat rejects bad input before streaming", async () => {
  const req = new EventEmitter();
  req.body = { messages: [{ role: "assistant", content: "hi" }] };
  const res = fakeRes();
  await chat(req, res);
  assert.equal(res.statusCode, 400);
});
