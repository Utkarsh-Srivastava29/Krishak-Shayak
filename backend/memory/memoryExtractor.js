const { Type } = require("@google/genai");
const { getGeminiClient, isGeminiConfigured } = require("../services/geminiClient");

const EXTRACT_MODEL = process.env.GEMINI_MEMORY_MODEL || "gemini-2.5-flash-lite";

const SYSTEM = `You maintain a long-term memory of an Indian farmer for a farming assistant.
From the conversation, extract only facts the FARMER stated about themselves, their farm, or their farm work.

Semantic facts (stable): use key one of
state, district, village, land_size, irrigation, soil_type, preferred_language, farming_type, crop, livestock, equipment, interest, other.
For key "crop" put just the crop name in value (e.g. "mustard"). One crop per fact.

Episodic facts (events): something the farmer did or plans to do on the farm, e.g. sprayed pesticide, sowed wheat, applied urea, plans to irrigate.
Give eventDate as YYYY-MM-DD when it can be worked out from the conversation and today's date; set isPlanned true for future plans.

Rules:
- Never extract anything the assistant said, general farming knowledge, or questions.
- Never extract Aadhaar, phone, bank, OTP, password or other personal identifiers.
- Write "text" as one short English sentence in third person, e.g. "Grows mustard on 2 acres."
- Return an empty list if there is nothing worth remembering.`;

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    facts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          kind: { type: Type.STRING, enum: ["semantic", "episodic"] },
          key: { type: Type.STRING },
          value: { type: Type.STRING },
          text: { type: Type.STRING },
          eventDate: { type: Type.STRING },
          isPlanned: { type: Type.BOOLEAN },
        },
        required: ["kind", "text"],
      },
    },
  },
  required: ["facts"],
};

/**
 * Extract memory-worthy facts from the latest turns of a conversation.
 * Only the last few messages are sent: older ones were processed already.
 */
const extractFacts = async (messages, { now = new Date(), client } = {}) => {
  const gemini = client || (isGeminiConfigured() ? getGeminiClient() : null);
  if (!gemini) return [];

  const recent = messages.slice(-4);
  if (!recent.some((m) => m.role === "user")) return [];

  const transcript = recent
    .map((m) => `${m.role === "user" ? "Farmer" : "Assistant"}: ${m.content}`)
    .join("\n");

  const result = await gemini.models.generateContent({
    model: EXTRACT_MODEL,
    contents: `Today's date: ${now.toISOString().slice(0, 10)}\n\nConversation:\n${transcript}`,
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: "application/json",
      responseSchema: SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
      maxOutputTokens: 800,
    },
  });

  const parsed = JSON.parse(result.text || "{}");
  return (parsed.facts || [])
    .filter((f) => f && typeof f.text === "string" && f.text.trim())
    .map((f) => ({
      kind: f.kind === "episodic" ? "episodic" : "semantic",
      key: (f.key || "").trim().toLowerCase(),
      value: (f.value || "").trim(),
      text: f.text.trim().slice(0, 300),
      eventDate: f.eventDate && !Number.isNaN(Date.parse(f.eventDate)) ? new Date(f.eventDate) : undefined,
      isPlanned: Boolean(f.isPlanned),
    }));
};

module.exports = { extractFacts, EXTRACT_MODEL };
