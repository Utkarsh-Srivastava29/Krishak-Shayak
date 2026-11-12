const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const { fetchSchemes } = require("../services/schemeDataService");

/**
 * Topic tags used as metadata filters at retrieval time. A scheme gets every
 * category whose keywords appear in its text.
 */
const CATEGORY_KEYWORDS = {
  income_support: ["kisan samman", "income support", "pm-kisan", "direct benefit", "pension", "maandhan"],
  insurance: ["insurance", "bima", "crop loss"],
  credit: ["credit", "loan", "interest subvention", "kcc"],
  irrigation: ["irrigation", "sinchai", "drip", "sprinkler", "water", "per drop"],
  soil: ["soil", "fertili", "nutrient"],
  organic: ["organic", "natural farming", "paramparagat"],
  mechanization: ["mechani", "machinery", "equipment", "tractor", "custom hiring"],
  marketing: ["market", "e-nam", "enam", "agmarknet", "mandi", "price"],
  horticulture: ["horticulture", "fruit", "vegetable", "bamboo", "midh"],
  fisheries: ["fish", "matsya", "aquaculture"],
  dairy_livestock: ["dairy", "milk", "bovine", "cattle", "livestock", "gokul", "animal husbandry"],
  solar_energy: ["solar", "kusum", "renewable"],
  food_processing: ["food processing", "processing", "value chain", "sampada", "pm-fme"],
  seeds: ["seed"],
  farmer_groups: ["fpo", "producer organisation", "producer organization", "cooperative"],
  beekeeping: ["bee", "honey"],
  oilseeds_pulses: ["oil palm", "edible oil", "oilseed", "pulses", "dalhan"],
};

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal",
];

/**
 * Entity resolution for duplicate catalogue rows: "PMMSY (repeat)",
 * "National Mission for Sustainable Agriculture (repeat NMSA)" and
 * "Agriculture Infrastructure Fund (AIF)" listed twice all collapse to one key.
 */
const canonicalSchemeKey = (name = "") =>
  name
    .toLowerCase()
    .replace(/\((?:repeat|repeated)[^)]*\)/g, "")
    .replace(/\(([^)]*)\)/g, " ")
    .replace(/[^a-z0-9ऀ-ॿ]+/g, " ")
    .replace(/\b(the|of|for|and|scheme|schemes|yojana|mission|national|programme|program)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const detectCategories = (text) => {
  const lower = text.toLowerCase();
  return Object.entries(CATEGORY_KEYWORDS)
    .filter(([, words]) => words.some((word) => lower.includes(word)))
    .map(([category]) => category);
};

const detectStates = (text) => {
  const lower = text.toLowerCase();
  const states = INDIAN_STATES.filter((state) => lower.includes(state.toLowerCase()));
  return states.length ? states : ["ALL"];
};

const hashText = (text) => crypto.createHash("sha256").update(text).digest("hex");

/** Turn one scheme row into a retrievable document with metadata. */
const schemeToDocument = (scheme) => {
  const text = [
    `Scheme: ${scheme.name}`,
    `Department: ${scheme.department}`,
    `Launched: ${scheme.launch_date}`,
    `Description: ${scheme.description}`,
    `Eligibility: ${scheme.eligibility}`,
    `Benefits: ${scheme.benefits}`,
    `Official link: ${scheme.official_link}`,
  ].join("\n");

  return {
    docId: `scheme:${canonicalSchemeKey(scheme.name)}`,
    type: "scheme",
    title: scheme.name,
    url: scheme.official_link || "",
    text,
    metadata: {
      states: detectStates(`${scheme.name} ${scheme.department} ${scheme.eligibility}`),
      categories: detectCategories(text),
      department: scheme.department,
    },
    contentHash: hashText(text),
  };
};

/**
 * Merge duplicate rows: keep the most detailed text, union their categories.
 */
const dedupeDocuments = (docs) => {
  const byId = new Map();
  for (const doc of docs) {
    const existing = byId.get(doc.docId);
    if (!existing) {
      byId.set(doc.docId, doc);
      continue;
    }
    const keep = doc.text.length > existing.text.length ? doc : existing;
    keep.metadata.categories = [
      ...new Set([...existing.metadata.categories, ...doc.metadata.categories]),
    ];
    byId.set(doc.docId, keep);
  }
  return [...byId.values()];
};

const loadBundledSchemes = () =>
  JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "schemes.json"), "utf8"));

/**
 * The knowledge base: the live scheme sheet when configured, otherwise the
 * bundled copy shipped with the repo.
 */
const loadKnowledgeDocuments = async () => {
  let schemes;
  try {
    schemes = await fetchSchemes();
  } catch {
    schemes = loadBundledSchemes();
  }
  return dedupeDocuments(schemes.map(schemeToDocument));
};

module.exports = {
  CATEGORY_KEYWORDS,
  INDIAN_STATES,
  canonicalSchemeKey,
  detectCategories,
  detectStates,
  schemeToDocument,
  dedupeDocuments,
  loadBundledSchemes,
  loadKnowledgeDocuments,
  hashText,
};
