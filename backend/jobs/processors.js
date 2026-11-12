/**
 * What each background job does. Shared by the BullMQ worker and the inline
 * fallback used when Redis/BullMQ is unavailable.
 */
const JOB_NAMES = {
  CONSOLIDATION: "memory-consolidation",
  ALERTS: "proactive-alerts",
  USER_ALERTS: "user-alerts",
};

const processJob = async (name, data = {}, { enqueue } = {}) => {
  switch (name) {
    case JOB_NAMES.CONSOLIDATION: {
      const { consolidateAll } = require("../memory/consolidation");
      return consolidateAll();
    }

    case JOB_NAMES.ALERTS: {
      // Fan out: one small job per farmer, so one failure (e.g. a weather
      // API timeout) is retried on its own instead of failing everyone.
      const { listAlertRecipients, runAlertsForUser } = require("../alerts/alertService");
      const users = await listAlertRecipients();
      if (enqueue) {
        await enqueue(
          users.map((userId) => ({
            name: JOB_NAMES.USER_ALERTS,
            data: { userId: String(userId) },
          }))
        );
        return { queued: users.length };
      }
      let sent = 0;
      for (const userId of users) {
        if (await runAlertsForUser(userId).catch(() => null)) sent++;
      }
      return { users: users.length, sent };
    }

    case JOB_NAMES.USER_ALERTS: {
      const { runAlertsForUser } = require("../alerts/alertService");
      const notification = await runAlertsForUser(data.userId);
      return { sent: Boolean(notification), type: notification?.type };
    }

    default:
      throw new Error(`Unknown job ${name}`);
  }
};

module.exports = { JOB_NAMES, processJob };
