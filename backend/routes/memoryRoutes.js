const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  listMemories,
  createMemory,
  updateMemory,
  deleteMemory,
  deleteAllMemories,
} = require("../controllers/memoryController");

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(protect);
router.get("/", wrap(listMemories));
router.post("/", wrap(createMemory));
router.delete("/", wrap(deleteAllMemories));
router.patch("/:id", wrap(updateMemory));
router.delete("/:id", wrap(deleteMemory));

module.exports = router;
