const mongoose = require("mongoose");

/**
 * Long-term memory about one farmer.
 *
 * - semantic: stable facts ("grows mustard", "2 acres", "district Etawah").
 *   `key` groups them; single-valued keys are replaced, multi-valued keys
 *   (crops, livestock) accumulate.
 * - episodic: dated events ("sprayed pesticide on wheat", "plans to irrigate").
 * - summary: written by nightly consolidation to compress old episodes.
 *
 * Replaced facts are kept with status "superseded" so changes are auditable;
 * farmers can view, edit and delete everything from the app.
 */
const farmerMemorySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: ["semantic", "episodic", "summary"], required: true },
    key: { type: String, default: "" },
    value: { type: String, default: "" },
    text: { type: String, required: true, maxlength: 300 },
    eventDate: { type: Date },
    isPlanned: { type: Boolean, default: false },
    source: { type: String, enum: ["chat", "user", "action", "consolidation"], default: "chat" },
    status: { type: String, enum: ["active", "superseded", "archived"], default: "active", index: true },
    supersededBy: { type: mongoose.Schema.Types.ObjectId, ref: "FarmerMemory" },
    lastSeenAt: { type: Date, default: Date.now },
    consolidatedAt: { type: Date },
  },
  { timestamps: true }
);

farmerMemorySchema.index({ user: 1, status: 1, kind: 1 });

module.exports = mongoose.model("FarmerMemory", farmerMemorySchema);
