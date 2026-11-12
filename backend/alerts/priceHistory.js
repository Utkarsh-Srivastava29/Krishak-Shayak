const mongoose = require("mongoose");

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDate = (date) => new Date(date).toISOString().slice(0, 10);

const model = () => require("../models/PriceSnapshot");

/** Store today's average price for a crop (one row per crop/state/day). */
const recordSnapshot = async (summary, now = new Date()) => {
  if (!summary || mongoose.connection.readyState !== 1) return;
  await model().updateOne(
    { commodity: summary.commodity, state: summary.state, date: isoDate(now) },
    { $set: { averageModalPrice: summary.averageModalPrice, marketsReporting: summary.marketsReporting } },
    { upsert: true }
  );
};

/**
 * Percentage change between the latest stored price and the one closest to
 * a week before it (5–10 days back). Pure, so it is easy to test.
 */
const computeTrend = (snapshots) => {
  if (!snapshots || snapshots.length < 2) return null;
  const sorted = [...snapshots].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0];
  const latestTime = Date.parse(latest.date);
  const weekAgo = sorted.find((s) => {
    const days = (latestTime - Date.parse(s.date)) / DAY_MS;
    return days >= 5 && days <= 10;
  });
  if (!weekAgo || !weekAgo.averageModalPrice) return null;

  const changePct = ((latest.averageModalPrice - weekAgo.averageModalPrice) / weekAgo.averageModalPrice) * 100;
  return {
    fromDate: weekAgo.date,
    fromPrice: weekAgo.averageModalPrice,
    toDate: latest.date,
    toPrice: latest.averageModalPrice,
    changePct: Math.round(changePct * 10) / 10,
  };
};

const getPriceTrend = async (commodity, state) => {
  if (mongoose.connection.readyState !== 1) return null;
  const since = isoDate(Date.now() - 14 * DAY_MS);
  const snapshots = await model()
    .find({ commodity, state, date: { $gte: since } })
    .select("date averageModalPrice")
    .lean();
  return computeTrend(snapshots);
};

module.exports = { recordSnapshot, computeTrend, getPriceTrend };
