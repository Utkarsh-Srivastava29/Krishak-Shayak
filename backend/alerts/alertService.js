const FarmerMemory = require("../models/FarmerMemory");
const Notification = require("../models/Notification");
const KnowledgeChunk = require("../models/KnowledgeChunk");
const User = require("../models/User");
const { profileFromMemories } = require("../memory/memoryMerge");
const { buildAlertCandidates, pickAlert } = require("./alertRules");
const { getForecast } = require("../services/weatherService");
const { getCropPrices } = require("../services/marketPriceService");
const { recordSnapshot, getPriceTrend } = require("./priceHistory");
const { buildFilter } = require("../rag/retriever");

const DAY_MS = 24 * 60 * 60 * 1000;
const DEDUPE_DAYS = 3;

const emailEnabled = () => process.env.ALERT_EMAILS_ENABLED === "true";

const sendAlertEmail = async (user, alert) => {
  const { sendEmail } = require("../services/emailService");
  await sendEmail({
    to: user.email,
    subject: `Krishak Sahayak: ${alert.title}`,
    html: `<p>Namaste ${user.name || ""},</p><p>${alert.message}</p><p>Open Krishak Sahayak to ask the assistant for more advice.</p>`,
  });
};

/**
 * Build today's data for one farmer and send at most one alert.
 * Returns the notification created, or null.
 */
const runAlertsForUser = async (userId, { now = new Date() } = {}) => {
  const memories = await FarmerMemory.find({ user: userId, status: "active" }).lean();
  const profile = profileFromMemories(memories);
  const location = profile.district || profile.village;
  if (!location && !(profile.state && profile.crops.length)) return null;

  const [forecast, priceTrends, newSchemes] = await Promise.all([
    location ? getForecast(location).catch(() => null) : null,
    Promise.all(
      profile.state
        ? profile.crops.slice(0, 3).map(async (crop) => {
            const prices = await getCropPrices({ commodity: crop, state: profile.state }).catch(() => null);
            if (!prices) return null;
            await recordSnapshot(prices, now);
            const trend = await getPriceTrend(prices.commodity, prices.state);
            return trend ? { ...trend, commodity: prices.commodity, state: prices.state } : null;
          })
        : []
    ).then((list) => list.filter(Boolean)),
    KnowledgeChunk.find({ createdAt: { $gte: new Date(now - 7 * DAY_MS) } })
      .lean()
      .then((docs) => docs.filter(buildFilter({ state: profile.state }))),
  ]);

  const candidates = buildAlertCandidates({
    profile,
    daily: forecast?.daily || [],
    episodes: memories.filter((m) => m.kind === "episodic"),
    priceTrends,
    newSchemes,
    now,
  });
  if (candidates.length === 0) return null;

  const recent = await Notification.find({
    user: userId,
    createdAt: { $gte: new Date(now - DEDUPE_DAYS * DAY_MS) },
  })
    .select("dedupeKey createdAt")
    .lean();

  // One alert per day at most.
  if (recent.some((n) => now - new Date(n.createdAt) < 20 * 60 * 60 * 1000)) return null;

  const alert = pickAlert(candidates, new Set(recent.map((n) => n.dedupeKey)));
  if (!alert) return null;

  const notification = await Notification.create({ user: userId, ...alert });

  if (emailEnabled()) {
    const user = await User.findById(userId).select("email name");
    if (user?.email) {
      await sendAlertEmail(user, alert)
        .then(() => Notification.updateOne({ _id: notification._id }, { $set: { emailed: true } }))
        .catch((error) => console.error("[ALERTS] Email failed:", error.message));
    }
  }
  return notification;
};

/** Farmers worth checking: anyone with a remembered location or crop. */
const listAlertRecipients = () =>
  FarmerMemory.distinct("user", {
    status: "active",
    kind: "semantic",
    key: { $in: ["district", "village", "state", "crop"] },
  });

module.exports = { runAlertsForUser, listAlertRecipients };
