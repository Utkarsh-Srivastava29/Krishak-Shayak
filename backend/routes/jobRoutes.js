const express = require("express");
const router = express.Router();
const { verifyQstashSignature } = require("../jobs/qstashVerify");
const { enqueue } = require("../jobs/queue");
const { JOB_NAMES } = require("../jobs/processors");

const TRIGGERABLE = new Set([JOB_NAMES.CONSOLIDATION, JOB_NAMES.ALERTS]);

/**
 * Called by Upstash QStash schedules (free tier). The request also wakes the
 * Render free instance if it was asleep. We only verify and enqueue, then
 * answer 202 straight away so QStash does not time out; the BullMQ worker
 * does the work and retries failures.
 *
 * POST /api/jobs/memory-consolidation
 * POST /api/jobs/proactive-alerts
 */
router.post("/:name", async (req, res) => {
  const { name } = req.params;
  if (!TRIGGERABLE.has(name)) return res.status(404).json({ message: "Unknown job" });

  try {
    const publicUrl = process.env.PUBLIC_API_URL
      ? `${process.env.PUBLIC_API_URL.replace(/\/$/, "")}/api/jobs/${name}`
      : undefined;
    verifyQstashSignature(req.get("Upstash-Signature"), req.rawBody, { url: publicUrl });
  } catch (error) {
    return res.status(401).json({ message: error.message });
  }

  // BullMQ custom job ids may not contain ":".
  const day = new Date().toISOString().slice(0, 10);
  const result = await enqueue(name, { triggeredBy: "qstash" }, { jobId: `${name}-${day}` });
  res.status(202).json({ accepted: true, job: name, ...result });
});

module.exports = router;
