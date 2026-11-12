const { canonicalCrop } = require("../services/commodityNames");

/** Keys where a new value replaces the old one. */
const SINGLE_VALUED = new Set([
  "state", "district", "village", "land_size", "irrigation", "soil_type", "preferred_language", "farming_type",
]);
/** Keys where values accumulate (a farmer grows several crops). */
const MULTI_VALUED = new Set(["crop", "livestock", "equipment", "interest"]);
const ALLOWED_KEYS = new Set([...SINGLE_VALUED, ...MULTI_VALUED, "other"]);

const DAY_MS = 24 * 60 * 60 * 1000;

const normalizeValue = (key, value = "") => {
  const clean = value.toString().trim().toLowerCase().replace(/\s+/g, " ");
  return key === "crop" ? canonicalCrop(clean) : clean;
};

const normalizeText = (text = "") =>
  text.toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, " ").trim();

// Personal identifiers must never enter memory, whatever the model returns.
const PII_PATTERN =
  /\b\d{12}\b|\b\d{4}\s\d{4}\s\d{4}\b|\b\d{10}\b|\b(aadhaar|aadhar|otp|password|ifsc|account number|pan card)\b|\b[A-Z]{4}0[A-Z0-9]{6}\b/i;

const containsPII = (text = "") => PII_PATTERN.test(text);

const sameDay = (a, b) => a && b && Math.abs(new Date(a) - new Date(b)) < DAY_MS;

/**
 * Decide how newly extracted facts change a farmer's memory.
 * Pure function: takes the active memories and the extracted facts, returns
 * operations for the caller to apply.
 *
 *   { op: "add", fact }                       new memory
 *   { op: "supersede", oldId, fact }          replace a single-valued fact
 *   { op: "touch", id }                       fact repeated; refresh lastSeenAt
 */
const planMemoryUpdates = (existing, extracted) => {
  const ops = [];
  const active = existing.filter((m) => m.status === "active");

  for (const raw of extracted) {
    if (!raw || !raw.text || containsPII(`${raw.text} ${raw.value || ""}`)) continue;

    if (raw.kind === "semantic") {
      const key = ALLOWED_KEYS.has(raw.key) ? raw.key : "other";
      const value = normalizeValue(key, raw.value || raw.text);
      const fact = { ...raw, key, value };
      const sameKey = active.filter((m) => m.kind === "semantic" && m.key === key);

      if (SINGLE_VALUED.has(key)) {
        const current = sameKey[0];
        if (!current) ops.push({ op: "add", fact });
        else if (normalizeValue(key, current.value) === value) ops.push({ op: "touch", id: current._id });
        else ops.push({ op: "supersede", oldId: current._id, fact });
      } else {
        const match = sameKey.find((m) =>
          key === "other"
            ? normalizeText(m.text) === normalizeText(fact.text)
            : normalizeValue(key, m.value) === value
        );
        ops.push(match ? { op: "touch", id: match._id } : { op: "add", fact });
      }
      continue;
    }

    if (raw.kind === "episodic") {
      const duplicate = active.find(
        (m) =>
          m.kind === "episodic" &&
          normalizeText(m.text) === normalizeText(raw.text) &&
          (sameDay(m.eventDate, raw.eventDate) || (!m.eventDate && !raw.eventDate))
      );
      ops.push(duplicate ? { op: "touch", id: duplicate._id } : { op: "add", fact: raw });
    }
  }

  // Two extracted facts in one batch can target the same single-valued key;
  // keep only the last one.
  const lastForKey = new Map();
  ops.forEach((op, i) => {
    if (op.fact?.kind === "semantic" && SINGLE_VALUED.has(op.fact.key)) lastForKey.set(op.fact.key, i);
  });
  return ops.filter(
    (op, i) => !(op.fact?.kind === "semantic" && SINGLE_VALUED.has(op.fact.key) && lastForKey.get(op.fact.key) !== i)
  );
};

const daysAgo = (date, now = new Date()) => Math.round((now - new Date(date)) / DAY_MS);

const describeWhen = (date, now = new Date()) => {
  const diff = daysAgo(date, now);
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff === -1) return "tomorrow";
  if (diff < 0) return `in ${-diff} days`;
  return `${diff} days ago`;
};

/**
 * Compact text block injected into the agent's system prompt.
 */
const formatMemoryContext = (memories, { now = new Date(), maxEpisodes = 8 } = {}) => {
  const active = memories.filter((m) => m.status === "active");
  if (active.length === 0) return "";

  const facts = active.filter((m) => m.kind === "semantic").map((m) => `- ${m.text}`);
  const summaries = active.filter((m) => m.kind === "summary").map((m) => `- ${m.text}`);
  const episodes = active
    .filter((m) => m.kind === "episodic")
    .sort((a, b) => new Date(b.eventDate || b.createdAt) - new Date(a.eventDate || a.createdAt))
    .slice(0, maxEpisodes)
    .map((m) => `- ${m.isPlanned ? "Planned" : "Did"}: ${m.text} (${describeWhen(m.eventDate || m.createdAt, now)})`);

  return [
    facts.length ? `Farm profile:\n${facts.join("\n")}` : "",
    episodes.length ? `Recent farm activity:\n${episodes.join("\n")}` : "",
    summaries.length ? `Earlier history:\n${summaries.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
};

/** The farmer's profile as plain fields, for alerts and tool defaults. */
const profileFromMemories = (memories) => {
  const profile = { crops: [], livestock: [] };
  for (const m of memories.filter((x) => x.status === "active" && x.kind === "semantic")) {
    if (m.key === "crop") profile.crops.push(m.value);
    else if (m.key === "livestock") profile.livestock.push(m.value);
    else if (SINGLE_VALUED.has(m.key)) profile[m.key] = m.value;
  }
  profile.crops = [...new Set(profile.crops)];
  return profile;
};

module.exports = {
  SINGLE_VALUED,
  MULTI_VALUED,
  ALLOWED_KEYS,
  planMemoryUpdates,
  formatMemoryContext,
  profileFromMemories,
  containsPII,
  describeWhen,
  normalizeText,
};
