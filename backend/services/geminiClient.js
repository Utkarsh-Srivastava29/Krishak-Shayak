const { GoogleGenAI } = require("@google/genai");

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let client = null;

const getGeminiClient = () => {
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
};

const isGeminiConfigured = () => Boolean(process.env.GEMINI_API_KEY);

module.exports = { getGeminiClient, isGeminiConfigured, MODEL };
