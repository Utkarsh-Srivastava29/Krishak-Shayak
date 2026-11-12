const { normalizeText, SINGLE_VALUED } = require("./memoryMerge");

const DAY_MS = 24 * 60 * 60 * 1000;
const SUMMARIZE_AFTER_DAYS = parseInt(process.env.MEMORY_SUMMARIZE_AFTER_DAYS || "30", 10);
const STALE_PLAN_DAYS = 14;
const SUMMARY_MODEL = process.env.GEMINI_MEMORY_MODEL || "gemini-2.5-flash-lite";

const monthKey = (date) => new Date(date).toISOString().slice(0, 7);

/**
 * Nightly memory consolidation plan for one farmer. Pure: returns what to
 * change, the job applies it.
 *
 *   archive      duplicate facts, extra values for single-valued keys,
 *                plans whose date passed long ago
 *   summarize    old episodes grouped by month, to be compressed into one
 *                "summary" memory each
 */
const planConsolidation = (memories, now = new Date()) => {
  const active = memories.filter((m) => m.status === "active");
  const archive = new Set();

  // Duplicate semantic facts: keep the most recently seen.
  const seen = new Map();
  const semantic = active
    .filter((m) => m.kind === "semantic")
    .sort((a, b) => new Date(b.lastSeenAt || b.updatedAt) - new Date(a.lastSeenAt || a.updatedAt));
  for (const m of semantic) {
    const id = SINGLE_VALUED.has(m.key) ? `key:${m.key}` : `val:${m.key}:${normalizeText(m.value || m.text)}`;
    if (seen.has(id)) archive.add(String(m._id));
    else seen.set(id, m);
  }

  const summarize = {};
  for (const m of active.filter((x) => x.kind === "episodic")) {
    const when = new Date(m.eventDate || m.createdAt);
    const age = (now - when) / DAY_MS;
    if (m.isPlanned && age > STALE_PLAN_DAYS) {
      archive.add(String(m._id));
    } else if (!m.isPlanned && age > SUMMARIZE_AFTER_DAYS) {
      (summarize[monthKey(when)] ||= []).push(m);
    }
  }

  // A single old event is not worth a summary row.
  for (const [month, list] of Object.entries(summarize)) {
    if (list.length < 2) delete summarize[month];
  }

  return { archive: [...archive], summarize };
};

const fallbackSummary = (month, episodes) =>
  `${month}: ${episodes.map((e) => e.text.replace(/\.$/, "")).join("; ")}.`.slice(0, 300);

/** One-sentence summary of a month of farm activity. */
const summarizeEpisodes = async (month, episodes, { client } = {}) => {
  const { getGeminiClient, isGeminiConfigured } = require("../services/geminiClient");
  const gemini = client || (isGeminiConfigured() ? getGeminiClient() : null);
  if (!gemini) return fallbackSummary(month, episodes);
  try {
    const result = await gemini.models.generateContent({
      model: SUMMARY_MODEL,
      contents: episodes.map((e) => `- ${new Date(e.eventDate || e.createdAt).toISOString().slice(0, 10)}: ${e.text}`).join("\n"),
      config: {
        systemInstruction: `Summarise this farmer's farm activity for ${month} in one plain English sentence under 40 words, starting with "In ${month}". Keep crops, inputs and counts. Do not add anything not listed.`,
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 120,
      },
    });
    return (result.text || "").trim().slice(0, 300) || fallbackSummary(month, episodes);
  } catch {
    return fallbackSummary(month, episodes);
  }
};

/** Apply consolidation for one farmer. */
const consolidateUser = async (userId, { now = new Date() } = {}) => {
  const FarmerMemory = require("../models/FarmerMemory");
  const memories = await FarmerMemory.find({ user: userId, status: "active" }).lean();
  const plan = planConsolidation(memories, now);

  if (plan.archive.length) {
    await FarmerMemory.updateMany({ _id: { $in: plan.archive }, user: userId }, { $set: { status: "archived" } });
  }

  let summaries = 0;
  for (const [month, episodes] of Object.entries(plan.summarize)) {
    const text = await summarizeEpisodes(month, episodes);
    await FarmerMemory.create({
      user: userId,
      kind: "summary",
      key: `month:${month}`,
      text,
      eventDate: new Date(`${month}-01T00:00:00Z`),
      source: "consolidation",
      consolidatedAt: now,
    });
    await FarmerMemory.updateMany(
      { _id: { $in: episodes.map((e) => e._id) } },
      { $set: { status: "archived", consolidatedAt: now } }
    );
    summaries++;
  }
  return { archived: plan.archive.length, summaries };
};

/** Every farmer whose memory changed since the last run. */
const consolidateAll = async ({ now = new Date() } = {}) => {
  const FarmerMemory = require("../models/FarmerMemory");
  const users = await FarmerMemory.distinct("user", {
    status: "active",
    updatedAt: { $gte: new Date(now - (SUMMARIZE_AFTER_DAYS + 2) * DAY_MS) },
  });
  const totals = { users: users.length, archived: 0, summaries: 0 };
  for (const userId of users) {
    const result = await consolidateUser(userId, { now });
    totals.archived += result.archived;
    totals.summaries += result.summaries;
  }
  return totals;
};

module.exports = { planConsolidation, summarizeEpisodes, consolidateUser, consolidateAll };
