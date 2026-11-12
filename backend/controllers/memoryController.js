const FarmerMemory = require("../models/FarmerMemory");
const { addMemory } = require("../memory/memoryService");
const { containsPII, ALLOWED_KEYS } = require("../memory/memoryMerge");

const PUBLIC_FIELDS = "kind key value text eventDate isPlanned source status createdAt updatedAt";

// @desc    Everything the assistant remembers about the signed-in farmer
// @route   GET /api/memory
// @access  Private
exports.listMemories = async (req, res) => {
  const memories = await FarmerMemory.find({ user: req.user._id, status: "active" })
    .select(PUBLIC_FIELDS)
    .sort({ kind: 1, eventDate: -1, updatedAt: -1 })
    .lean();
  res.json({ memories });
};

// @desc    Farmer adds a fact themselves
// @route   POST /api/memory
// @access  Private
exports.createMemory = async (req, res) => {
  const { kind = "semantic", key = "other", value = "", text, eventDate, isPlanned } = req.body || {};
  if (!text || typeof text !== "string" || text.length > 300) {
    return res.status(400).json({ message: "text is required (max 300 characters)" });
  }
  if (!["semantic", "episodic"].includes(kind)) return res.status(400).json({ message: "invalid kind" });
  if (containsPII(text)) {
    return res.status(400).json({ message: "Please don't store ID, phone or bank numbers here." });
  }
  await addMemory(
    req.user._id,
    {
      kind,
      key: ALLOWED_KEYS.has(key) ? key : "other",
      value,
      text: text.trim(),
      eventDate: eventDate ? new Date(eventDate) : kind === "episodic" ? new Date() : undefined,
      isPlanned: Boolean(isPlanned),
    },
    "user"
  );
  res.status(201).json({ ok: true });
};

// @desc    Farmer corrects a memory
// @route   PATCH /api/memory/:id
// @access  Private
exports.updateMemory = async (req, res) => {
  const { text, value } = req.body || {};
  if (!text || typeof text !== "string" || text.length > 300) {
    return res.status(400).json({ message: "text is required (max 300 characters)" });
  }
  if (containsPII(`${text} ${value || ""}`)) {
    return res.status(400).json({ message: "Please don't store ID, phone or bank numbers here." });
  }
  const update = { text: text.trim(), source: "user" };
  if (typeof value === "string") update.value = value.trim().toLowerCase();

  const memory = await FarmerMemory.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id, status: "active" },
    { $set: update },
    { new: true }
  ).select(PUBLIC_FIELDS);
  if (!memory) return res.status(404).json({ message: "Memory not found" });
  res.json({ memory });
};

// @desc    Forget one memory (hard delete — the farmer asked us to forget)
// @route   DELETE /api/memory/:id
// @access  Private
exports.deleteMemory = async (req, res) => {
  const { deletedCount } = await FarmerMemory.deleteOne({ _id: req.params.id, user: req.user._id });
  if (!deletedCount) return res.status(404).json({ message: "Memory not found" });
  res.json({ ok: true });
};

// @desc    Forget everything, including superseded history
// @route   DELETE /api/memory
// @access  Private
exports.deleteAllMemories = async (req, res) => {
  const { deletedCount } = await FarmerMemory.deleteMany({ user: req.user._id });
  res.json({ ok: true, deleted: deletedCount });
};
