/**
 * English -> Hindi translation for dynamic content (scheme catalogue, news
 * headlines) that has no Hindi source. The UI itself is translated by i18n.
 *
 * Uses Gemini; every translated string is cached in Redis for 30 days, so
 * each unique text is translated once. Never throws: on any failure the
 * original English text is returned with translated = false.
 */
const crypto = require("crypto");
const { Type } = require("@google/genai");
const { getGeminiClient, isGeminiConfigured, MODEL } = require("./geminiClient");
const { getCache, setCache } = require("../config/redisClient");

const CACHE_TTL = 30 * 24 * 3600;
const BATCH = 25;
const MAX_CHARS = 2000;

const cacheKey = (text) => `tr:hi:${crypto.createHash("sha1").update(text).digest("hex")}`;
const DEVANAGARI = /[ऀ-ॿ]/;

const SYSTEM = `Translate each English text into simple, natural Hindi (Devanagari script) that a farmer can easily read.
Rules:
- Keep scheme acronyms and brand names as they are (PM-KISAN, PMFBY, KCC, e-NAM, PM-KUSUM), and keep official Hindi scheme names where one exists (e.g. "प्रधानमंत्री फसल बीमा योजना").
- Keep numbers, ₹ amounts, percentages, dates and URLs exactly as written.
- Do not add or remove information. Do not explain.
Return exactly one translation per input, in the same order.`;

/** Default translator: one Gemini call for a batch of strings. */
const geminiTranslate = async (texts) => {
  const response = await getGeminiClient().models.generateContent({
    model: MODEL,
    contents: JSON.stringify(texts),
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: { translations: { type: Type.ARRAY, items: { type: Type.STRING } } },
        required: ["translations"],
      },
      thinkingConfig: { thinkingBudget: 0 },
      maxOutputTokens: 8192,
      temperature: 0,
    },
  });
  return JSON.parse(response.text).translations;
};

/**
 * @param {string[]} texts
 * @param {object} [o]
 * @param {Function} [o.translate]  injectable batch translator (tests)
 * @returns {Promise<{ texts: string[], translated: boolean }>}
 *   translated = true only if every non-empty text was translated
 */
const translateToHindi = async (texts, { translate } = {}) => {
  const translator = translate || (isGeminiConfigured() ? geminiTranslate : null);
  const out = texts.map((t) => (typeof t === "string" ? t : ""));
  const todo = [];

  await Promise.all(
    out.map(async (text, i) => {
      if (!text.trim() || DEVANAGARI.test(text)) return; // empty or already Hindi
      const hit = await getCache(cacheKey(text));
      if (hit) out[i] = hit;
      else todo.push(i);
    })
  );

  if (!todo.length) return { texts: out, translated: true };
  if (!translator) return { texts: out, translated: false };

  let complete = true;
  for (let b = 0; b < todo.length; b += BATCH) {
    const idx = todo.slice(b, b + BATCH);
    try {
      const result = await translator(idx.map((i) => out[i].slice(0, MAX_CHARS)));
      if (!Array.isArray(result) || result.length !== idx.length) throw new Error("translation count mismatch");
      await Promise.all(
        idx.map(async (i, k) => {
          const hi = typeof result[k] === "string" ? result[k].trim() : "";
          if (!hi) { complete = false; return; }
          await setCache(cacheKey(out[i]), hi, CACHE_TTL);
          out[i] = hi;
        })
      );
    } catch (err) {
      console.error("[TRANSLATE] Batch failed:", err.message);
      complete = false;
    }
  }
  return { texts: out, translated: complete };
};

/**
 * Translate selected string fields of each object. Adds `translated` per item.
 * @returns {Promise<object[]>}
 */
const translateFields = async (items, fields, opts) => {
  const flat = items.flatMap((it) => fields.map((f) => it[f] || ""));
  const { texts } = await translateToHindi(flat, opts);
  return items.map((it, n) => {
    const copy = { ...it };
    let ok = true;
    fields.forEach((f, k) => {
      const value = texts[n * fields.length + k];
      if (it[f] && value === it[f] && !DEVANAGARI.test(it[f])) ok = false;
      copy[f] = value;
    });
    copy.translated = ok;
    return copy;
  });
};

module.exports = { translateToHindi, translateFields };
