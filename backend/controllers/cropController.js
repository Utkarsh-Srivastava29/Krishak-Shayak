const crypto = require("crypto");
const { Type } = require("@google/genai");
const { getGeminiClient, isGeminiConfigured, MODEL } = require("../services/geminiClient");
const { getCropRecommendations } = require("../services/cropRecommendationService");
const { getCache, setCache } = require("../config/redisClient");

const CACHE_TTL = 60 * 60; // weather and mandi data change slowly within an hour

const loadProfile = async (user) => {
  if (!user?._id) return {};
  try {
    const { getFarmerProfile } = require("../memory/memoryService");
    return await getFarmerProfile(user._id);
  } catch (err) {
    console.warn("[CROPS] Memory unavailable:", err.message);
    return {};
  }
};

/**
 * A short summary written only from the computed result, so it can't
 * introduce numbers the data doesn't contain. Returns null on any failure.
 */
const summarize = async (result, lang) => {
  if (!isGeminiConfigured() || result.recommendations.length === 0) return null;
  try {
    const language = lang === "hi" ? "Hindi (हिन्दी, Devanagari script)" : "English";
    const facts = {
      place: result.location,
      month: result.month,
      conditions: result.conditions,
      farmer: result.personalisedWith,
      crops: result.recommendations.map((r) => ({
        crop: r.nameEn,
        score: r.score,
        sowNow: r.sowNow,
        water: r.water,
        durationDays: r.durationDays,
        reasons: r.reasons.map((x) => x.code),
        mandiAvgPerQuintal: r.mandi?.averageModalPrice ?? null,
      })),
    };
    const response = await getGeminiClient().models.generateContent({
      model: MODEL,
      contents: JSON.stringify(facts),
      config: {
        systemInstruction: `You explain crop recommendations to an Indian farmer. The JSON contains crops already ranked by the app from live weather, soil moisture, the crop calendar and today's mandi prices.
Write 2 or 3 short sentences in ${language}: which crop to consider first and why, and one practical caution (water, temperature or price). Use only facts in the JSON. Do not invent numbers, varieties or scheme names. Plain words, no lists.`,
        responseMimeType: "application/json",
        responseSchema: { type: Type.OBJECT, properties: { summary: { type: Type.STRING } }, required: ["summary"] },
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 512,
      },
    });
    return JSON.parse(response.text).summary || null;
  } catch (err) {
    console.error("[CROPS] Summary failed:", err.message);
    return null;
  }
};

// @desc    Crop recommendations for a place (personalised when signed in)
// @route   GET /api/crops/recommendations?location=<place>&lang=<en|hi>
// @access  Public (optional auth)
exports.getRecommendations = async (req, res) => {
  try {
    const lang = req.query.lang === "hi" ? "hi" : "en";
    const profile = await loadProfile(req.user);
    const location = (req.query.location || profile.district || profile.village || req.user?.location || "").trim();
    if (!location) {
      return res.status(400).json({ message: "Location query parameter is required" });
    }
    if (location.length > 100) {
      return res.status(400).json({ message: "Location is too long" });
    }

    // Cache key includes every profile field that changes the result, so a
    // personalised answer is never served to another farmer.
    const key = crypto
      .createHash("sha1")
      .update(JSON.stringify({ location: location.toLowerCase(), lang, s: profile.state, d: profile.district, i: profile.irrigation, t: profile.soil_type, c: profile.crops }))
      .digest("hex");
    const cacheKey = `crops:rec:${key}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const result = await getCropRecommendations({ location, profile });
    if (!result) return res.status(404).json({ message: "Location not found" });

    const body = { ...result, summary: await summarize(result, lang), language: lang };
    await setCache(cacheKey, body, CACHE_TTL);
    res.json(body);
  } catch (error) {
    console.error("Crop recommendation error:", error.message);
    res.status(500).json({ message: "Failed to build crop recommendations" });
  }
};
