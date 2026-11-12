const { JOB_NAMES, processJob } = require("./processors");

/**
 * BullMQ queue + worker on Redis (Render free Key Value, local Redis, or any
 * Redis URL). Redis only holds the queue; all memory and alerts are stored
 * in MongoDB, because free Redis instances can lose data on restart.
 *
 * If BullMQ or Redis is unavailable the app still works: jobs run inline.
 */
const QUEUE_NAME = "krishak-jobs";

let bull = null;
let queue = null;
let worker = null;

// Without a configured Redis there is nothing to connect to; run inline
// instead of retrying a missing localhost Redis forever.
const redisConfigured = () => Boolean(process.env.REDIS_URL);

const loadBullMQ = () => {
  if (bull !== null) return bull;
  if (!redisConfigured()) {
    console.warn("[JOBS] REDIS_URL not set — background jobs will run inline.");
    bull = false;
    return bull;
  }
  try {
    bull = require("bullmq");
  } catch {
    console.warn("[JOBS] bullmq not installed — background jobs will run inline.");
    bull = false;
  }
  return bull;
};

// BullMQ needs its own connections with maxRetriesPerRequest: null.
const connection = () => {
  const IORedis = require("ioredis");
  return new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
};

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 30000 },
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 200 },
};

const getQueue = () => {
  if (queue) return queue;
  const lib = loadBullMQ();
  if (!lib) return null;
  queue = new lib.Queue(QUEUE_NAME, { connection: connection(), defaultJobOptions: DEFAULT_JOB_OPTIONS });
  queue.on("error", (error) => console.error("[JOBS] Queue error:", error.message));
  return queue;
};

const enqueueMany = async (jobs) => {
  const q = getQueue();
  if (!q) {
    for (const job of jobs) await processJob(job.name, job.data).catch((e) => console.error(e.message));
    return;
  }
  await q.addBulk(jobs.map((job) => ({ ...job, opts: { ...DEFAULT_JOB_OPTIONS, ...(job.opts || {}) } })));
};

/**
 * Add a job. `jobId` makes repeated triggers for the same day idempotent
 * (QStash retries, a double click on "run now").
 */
const enqueue = async (name, data = {}, { jobId } = {}) => {
  const q = getQueue();
  if (!q) {
    // No queue: run in the background of this process.
    setImmediate(() =>
      processJob(name, data).catch((error) => console.error(`[JOBS] Inline ${name} failed:`, error.message))
    );
    return { inline: true };
  }
  const job = await q.add(name, data, jobId ? { jobId } : {});
  return { id: job.id };
};

const startWorker = () => {
  if (worker || process.env.ENABLE_JOB_WORKER === "false") return worker;
  const lib = loadBullMQ();
  if (!lib) return null;

  worker = new lib.Worker(QUEUE_NAME, (job) => processJob(job.name, job.data, { enqueue: enqueueMany }), {
    connection: connection(),
    concurrency: 2,
  });
  worker.on("completed", (job, result) => console.log(`[JOBS] ${job.name} done`, JSON.stringify(result)));
  worker.on("failed", (job, error) => console.error(`[JOBS] ${job?.name} failed:`, error.message));
  worker.on("error", (error) => console.error("[JOBS] Worker error:", error.message));
  console.log("[JOBS] BullMQ worker started");
  return worker;
};

/**
 * Optional: let BullMQ itself schedule the jobs (needs an always-on server,
 * e.g. the EC2/PM2 deployment). On Render's free tier, which sleeps, use
 * QStash instead (scripts/setupQstashSchedules.js).
 * Times are UTC: 20:30 UTC = 02:00 IST, 00:30 UTC = 06:00 IST.
 */
const registerBullSchedules = async () => {
  const q = getQueue();
  if (!q || typeof q.upsertJobScheduler !== "function") return false;
  await q.upsertJobScheduler("nightly-consolidation", { pattern: "30 20 * * *" }, { name: JOB_NAMES.CONSOLIDATION });
  await q.upsertJobScheduler("morning-alerts", { pattern: "30 0 * * *" }, { name: JOB_NAMES.ALERTS });
  console.log("[JOBS] BullMQ schedules registered");
  return true;
};

module.exports = { QUEUE_NAME, getQueue, enqueue, enqueueMany, startWorker, registerBullSchedules };
