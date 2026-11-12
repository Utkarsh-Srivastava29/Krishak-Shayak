/**
 * Creates (or updates) the two free Upstash QStash schedules that trigger
 * background jobs:
 *   02:00 IST  memory-consolidation
 *   06:00 IST  proactive-alerts
 *
 *   QSTASH_TOKEN=... PUBLIC_API_URL=https://your-backend.onrender.com npm run jobs:schedule
 *
 * Uses 2 of the free tier's 1,000 messages per day.
 */
require("dotenv").config();
const axios = require("axios");

const QSTASH_URL = (process.env.QSTASH_URL || "https://qstash.upstash.io").replace(/\/$/, "");

// Cron in UTC: 20:30 UTC = 02:00 IST, 00:30 UTC = 06:00 IST.
const SCHEDULES = [
  { id: "krishak-memory-consolidation", job: "memory-consolidation", cron: "30 20 * * *" },
  { id: "krishak-proactive-alerts", job: "proactive-alerts", cron: "30 0 * * *" },
];

const main = async () => {
  const token = process.env.QSTASH_TOKEN;
  const api = process.env.PUBLIC_API_URL;
  if (!token || !api) {
    console.error("Set QSTASH_TOKEN and PUBLIC_API_URL first.");
    process.exit(1);
  }

  for (const schedule of SCHEDULES) {
    const destination = `${api.replace(/\/$/, "")}/api/jobs/${schedule.job}`;
    const { data } = await axios.post(`${QSTASH_URL}/v2/schedules/${destination}`, "{}", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Upstash-Cron": schedule.cron,
        "Upstash-Schedule-Id": schedule.id,
        "Upstash-Retries": "3",
      },
    });
    console.log(`Scheduled ${schedule.job} (${schedule.cron} UTC) → ${destination}`, data);
  }
};

main().catch((error) => {
  console.error("Could not create schedules:", error.response?.data || error.message);
  process.exit(1);
});
