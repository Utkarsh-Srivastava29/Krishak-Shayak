const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const Notification = require("../models/Notification");

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(protect);

// GET /api/notifications — latest alerts for the signed-in farmer
router.get(
  "/",
  wrap(async (req, res) => {
    const notifications = await Notification.find({ user: req.user._id })
      .select("type title message read createdAt data")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json({ notifications, unread: notifications.filter((n) => !n.read).length });
  })
);

// PATCH /api/notifications/:id/read
router.patch(
  "/:id/read",
  wrap(async (req, res) => {
    await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { $set: { read: true } });
    res.json({ ok: true });
  })
);

module.exports = router;
