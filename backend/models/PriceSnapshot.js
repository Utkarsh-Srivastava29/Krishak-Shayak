const mongoose = require("mongoose");

/**
 * Daily average modal price per crop and state. The data.gov.in feed only
 * publishes today's prices, so the app keeps its own history to tell farmers
 * how prices moved over the week.
 */
const priceSnapshotSchema = new mongoose.Schema(
  {
    commodity: { type: String, required: true },
    state: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    averageModalPrice: { type: Number, required: true },
    marketsReporting: { type: Number, default: 0 },
  },
  { timestamps: true }
);

priceSnapshotSchema.index({ commodity: 1, state: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("PriceSnapshot", priceSnapshotSchema);
