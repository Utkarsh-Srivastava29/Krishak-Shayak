const axios = require("axios");
const Papa = require("papaparse");

const CACHE_TTL_MS = 60 * 60 * 1000;

let cache = { schemes: null, fetchedAt: 0 };

const fetchSchemes = async () => {
  if (cache.schemes && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.schemes;
  }

  const sheetUrl = process.env.SCHEMES_SHEET_URL;
  if (!sheetUrl) {
    throw new Error("SCHEMES_SHEET_URL not configured on server");
  }

  const response = await axios.get(sheetUrl);

  const parsed = Papa.parse(response.data, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) =>
      header.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  const schemes = parsed.data.map((scheme, index) => ({
    id: parseInt(scheme.id) || index + 1,
    name: scheme.name || "",
    department: scheme.department || "",
    launch_date: scheme.launch_date || "Not known",
    description: scheme.description || "",
    eligibility: scheme.eligibility || "",
    benefits: scheme.benefits || "",
    official_link: scheme.official_link || "",
  }));

  cache = { schemes, fetchedAt: Date.now() };
  return schemes;
};

module.exports = { fetchSchemes };
