#!/usr/bin/env node
/**
 * Krishak Sahayak agent evaluation.
 *
 *   npm run eval                                   # all 40 queries × 4 systems
 *   npm run eval -- --configs agent_rag,agent_rag_memory --limit 10
 *   npm run eval -- --ids q36,q37,q38
 *   npm run eval -- --sim                           # persona simulations too
 *   npm run eval -- --resume eval/results/eval-XXXX.json
 *
 * Live APIs are replaced by fixtures (eval/fixtures.js), so only
 * GEMINI_API_KEY is needed. Requests are throttled (EVAL_RPM, default 8/min)
 * to stay inside the Gemini free tier; results are saved after every answer,
 * so an interrupted run can be resumed.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");
const { CONFIGS } = require("./configs");
const { runSystem, buildCorpus, createEmbedder, MODEL } = require("./system");
const { judgeAnswer, ruleChecks, JUDGE_MODEL } = require("./judge");
const { simulatePersona } = require("./simulator");
const { referenceFacts } = require("./fixtures");
const { createThrottledClient } = require("./throttle");
const { writeReport } = require("./report");

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const queries = require("./data/queries.json");
const personas = Object.fromEntries(require("./data/personas.json").map((p) => [p.id, p]));
const schemes = require("../data/schemes.json");

const schemeExcerpt = (item) => {
  const wanted = (item.expectedSchemes || []).map((s) => s.toLowerCase());
  return schemes
    .filter((s) => wanted.some((w) => s.name.toLowerCase().includes(w.toLowerCase())))
    .map((s) => `${s.name}: ${s.description} Eligibility: ${s.eligibility} Benefits: ${s.benefits} Link: ${s.official_link}`)
    .join("\n");
};

const main = async () => {
  if (!process.env.GEMINI_API_KEY) {
    console.error("Set GEMINI_API_KEY (free key from https://aistudio.google.com/apikey).");
    process.exit(1);
  }

  const configNames = (option("configs") || Object.keys(CONFIGS).join(",")).split(",");
  for (const name of configNames) {
    if (!CONFIGS[name]) throw new Error(`Unknown config ${name}. Options: ${Object.keys(CONFIGS).join(", ")}`);
  }
  const ids = option("ids")?.split(",");
  const limit = option("limit") ? parseInt(option("limit"), 10) : undefined;
  const items = queries.filter((q) => !ids || ids.includes(q.id)).slice(0, limit);

  const client = createThrottledClient(new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));
  const needsVectors = configNames.some((n) => CONFIGS[n].useVector);
  const embed = needsVectors ? createEmbedder(client) : undefined;
  console.log(`Building corpus${needsVectors ? " with embeddings (cached after first run)" : ""}...`);
  const corpus = await buildCorpus({ embed });

  const resumeFile = option("resume");
  const outFile =
    resumeFile || path.join(__dirname, "results", `eval-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const results = resumeFile && fs.existsSync(resumeFile)
    ? JSON.parse(fs.readFileSync(resumeFile, "utf8"))
    : { startedAt: new Date().toISOString(), model: MODEL, judgeModel: JUDGE_MODEL, answers: [], simulations: [] };
  const done = new Set(results.answers.map((a) => `${a.config}:${a.id}`));
  const save = () => {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  };

  console.log(`Running ${items.length} queries × ${configNames.length} systems → ${outFile}\n`);
  for (const item of items) {
    const persona = personas[item.persona];
    for (const name of configNames) {
      if (done.has(`${name}:${item.id}`)) continue;
      const config = CONFIGS[name];
      process.stdout.write(`[${item.id}] ${name.padEnd(17)} `);
      const started = Date.now();
      try {
        const run = await runSystem({
          client,
          config,
          persona,
          messages: [{ role: "user", content: item.question }],
          corpus,
          embed,
        });
        const rules = ruleChecks(item, run);
        const judge = await judgeAnswer(client, {
          question: item.question,
          answer: run.text,
          persona,
          memoryAvailable: Boolean(config.memory),
          references: referenceFacts(persona),
          schemeExcerpt: schemeExcerpt(item),
        });
        results.answers.push({
          id: item.id,
          config: name,
          type: item.type,
          needsMemory: item.needsMemory,
          question: item.question,
          answer: run.text,
          actions: run.actions.map((a) => a.type),
          latencyMs: Date.now() - started,
          ...rules,
          judge,
        });
        console.log(`tools=${rules.toolsCalled.join("+") || "-"} recall=${rules.toolRecall.toFixed(2)} ` +
          `judge=${judge.correctness}/${judge.groundedness}/${judge.personalisation}/${judge.helpfulness}${judge.hallucination ? " HALLUCINATION" : ""}`);
      } catch (error) {
        console.log(`ERROR ${error.message}`);
        results.answers.push({ id: item.id, config: name, type: item.type, error: error.message });
      }
      save();
    }
  }

  if (flag("sim")) {
    const simConfigs = configNames.filter((n) => !CONFIGS[n].baseline);
    for (const persona of Object.values(personas)) {
      for (const name of simConfigs) {
        if (results.simulations.some((s) => s.config === name && s.persona === persona.id)) continue;
        process.stdout.write(`[sim] ${persona.id.padEnd(9)} ${name.padEnd(17)} `);
        try {
          const sim = await simulatePersona({ client, config: CONFIGS[name], persona, corpus, embed });
          results.simulations.push({ config: name, ...sim });
          console.log(`goal=${sim.scores.goalAchieved} personal=${sim.scores.personalisation} repeatedQs=${sim.scores.repeatedQuestions}`);
        } catch (error) {
          console.log(`ERROR ${error.message}`);
        }
        save();
      }
    }
  }

  results.finishedAt = new Date().toISOString();
  results.geminiCalls = (results.geminiCalls || 0) + client.calls;
  save();
  const reportFile = writeReport(results, outFile.replace(/\.json$/, ".md"));
  console.log(`\nSaved ${outFile}\nReport ${reportFile}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
