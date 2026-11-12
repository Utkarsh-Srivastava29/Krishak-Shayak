const fs = require("fs");
const { CONFIGS } = require("./configs");

const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const fmt = (value, digits = 2) => (value === null || value === undefined ? "–" : value.toFixed(digits));
const pct = (value) => (value === null ? "–" : `${Math.round(value * 100)}%`);

/** Aggregate metrics per system, overall or for a subset of answers. */
const summarize = (answers) => {
  const ok = answers.filter((a) => !a.error);
  return {
    n: ok.length,
    errors: answers.length - ok.length,
    toolRecall: mean(ok.map((a) => a.toolRecall)),
    keywordHit: mean(ok.map((a) => a.keywordHit)),
    correctness: mean(ok.map((a) => a.judge.correctness)),
    groundedness: mean(ok.map((a) => a.judge.groundedness)),
    personalisation: mean(ok.map((a) => a.judge.personalisation)),
    helpfulness: mean(ok.map((a) => a.judge.helpfulness)),
    hallucinationRate: ok.length ? ok.filter((a) => a.judge.hallucination).length / ok.length : null,
    latencyS: mean(ok.map((a) => a.latencyMs / 1000)),
  };
};

const table = (rows) => {
  const header = "| System | n | Tool recall | Keyword hit | Correct | Grounded | Personal | Helpful | Hallucination | Latency (s) |";
  const sep = "|---|---|---|---|---|---|---|---|---|---|";
  const lines = rows.map(
    ([name, s]) =>
      `| ${CONFIGS[name]?.label || name} | ${s.n} | ${pct(s.toolRecall)} | ${pct(s.keywordHit)} | ${fmt(s.correctness)} | ${fmt(s.groundedness)} | ${fmt(s.personalisation)} | ${fmt(s.helpfulness)} | ${pct(s.hallucinationRate)} | ${fmt(s.latencyS, 1)} |`
  );
  return [header, sep, ...lines].join("\n");
};

const byConfig = (answers) => {
  const names = [...new Set(answers.map((a) => a.config))];
  return names.map((name) => [name, summarize(answers.filter((a) => a.config === name))]);
};

const writeReport = (results, file) => {
  const answers = results.answers || [];
  const types = [...new Set(answers.map((a) => a.type))];

  const sections = [
    `# Krishak Sahayak agent evaluation`,
    `Model: \`${results.model}\` · Judge: \`${results.judgeModel}\` · ${results.startedAt} · ${results.geminiCalls || "?"} Gemini calls`,
    `Scores 1–5 from LLM-as-a-Judge (correct, grounded, personal, helpful). Tool recall and keyword hit are rule-based checks. Live APIs were replaced with fixtures so runs are repeatable.`,
    `## All questions`,
    table(byConfig(answers)),
    `## Memory-dependent questions (vague questions that need the farmer's profile)`,
    table(byConfig(answers.filter((a) => a.needsMemory))),
    `## By question type`,
    ...types.map((type) => `### ${type}\n\n${table(byConfig(answers.filter((a) => a.type === type)))}`),
  ];

  const sims = results.simulations || [];
  if (sims.length) {
    const names = [...new Set(sims.map((s) => s.config))];
    sections.push(
      `## Simulated farmer personas (multi-turn)`,
      "| System | Conversations | Goal achieved | Personalisation | Repeated questions | Grounded |",
      "|---|---|---|---|---|---|",
      ...names.map((name) => {
        const list = sims.filter((s) => s.config === name);
        return `| ${CONFIGS[name]?.label || name} | ${list.length} | ${fmt(mean(list.map((s) => s.scores.goalAchieved)))} | ${fmt(
          mean(list.map((s) => s.scores.personalisation))
        )} | ${fmt(mean(list.map((s) => s.scores.repeatedQuestions)))} | ${fmt(mean(list.map((s) => s.scores.groundedness)))} |`;
      })
    );
  }

  const worst = answers
    .filter((a) => !a.error && (a.judge.hallucination || a.judge.correctness <= 2))
    .slice(0, 15)
    .map((a) => `- **${a.id} / ${a.config}**: ${a.judge.reason}`);
  if (worst.length) sections.push(`## Failures to look at`, ...worst);

  fs.writeFileSync(file, `${sections.join("\n\n")}\n`);
  return file;
};

module.exports = { writeReport, summarize };
