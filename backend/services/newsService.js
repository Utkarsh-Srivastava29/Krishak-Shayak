/**
 * Agriculture news for Indian farmers from NewsData.io, fetched on the
 * server so the API key never reaches the browser.
 *
 * Hindi: native Hindi articles first; if there are too few, English
 * headlines are translated (translationService) and marked translated.
 */
const axios = require("axios");
const { translateFields } = require("./translationService");

const NEWSDATA_URL = "https://newsdata.io/api/1/news";
const MIN_ITEMS = 3;
const MAX_ITEMS = 9;

const QUERIES = {
  en: { q: "agriculture OR farming OR farmers OR crop OR mandi", category: "business,science,politics" },
  hi: { q: "कृषि OR किसान OR खेती OR फसल OR मंडी" },
};

const httpError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const normalize = (article, language) => ({
  id: article.article_id,
  title: (article.title || "").trim(),
  description: (article.description || "").trim().slice(0, 300),
  link: article.link,
  source: article.source_name || article.source_id || "",
  image: article.image_url || null,
  date: article.pubDate ? new Date(`${article.pubDate.replace(" ", "T")}Z`).toISOString() : null,
  language,
});

const fetchArticles = async (language, { http = axios } = {}) => {
  const apikey = process.env.NEWSDATA_API_KEY;
  if (!apikey) throw httpError("News is not configured on the server (NEWSDATA_API_KEY)", 503);
  const { data } = await http.get(NEWSDATA_URL, {
    params: { apikey, country: "in", language, size: 10, ...QUERIES[language] },
    timeout: 10000,
  });
  if (data.status !== "success") {
    throw httpError(data.results?.message || "News provider error", 502);
  }
  return (data.results || []).filter((a) => a.title && a.link).map((a) => normalize(a, language));
};

const dedupe = (items) => {
  const seen = new Set();
  return items.filter((it) => {
    const key = it.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * @param {object} o
 * @param {"en"|"hi"} o.lang
 * @param {object} [o.http]       injectable axios (tests)
 * @param {Function} [o.translate] injectable translator (tests)
 */
const getAgriNews = async ({ lang = "en", http, translate } = {}) => {
  if (lang !== "hi") {
    return { language: "en", items: dedupe(await fetchArticles("en", { http })).slice(0, MAX_ITEMS) };
  }

  let hindi = [];
  try {
    hindi = dedupe(await fetchArticles("hi", { http }));
  } catch (err) {
    if (err.statusCode === 503) throw err;
    console.warn("[NEWS] Hindi feed failed:", err.message);
  }
  if (hindi.length >= MIN_ITEMS) return { language: "hi", items: hindi.slice(0, MAX_ITEMS) };

  const english = dedupe(await fetchArticles("en", { http })).slice(0, MAX_ITEMS - hindi.length);
  const translated = await translateFields(english, ["title", "description"], { translate });
  return {
    language: "hi",
    items: dedupe([...hindi, ...translated.map((t) => ({ ...t, translatedFrom: t.translated ? "en" : undefined }))]),
  };
};

module.exports = { getAgriNews, normalize };
