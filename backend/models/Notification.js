const mongoose = require("mongoose");

/** A proactive alert shown in the app (and optionally emailed). */
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    dedupeKey: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed },
    read: { type: Boolean, default: false },
    emailed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, dedupeKey: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
