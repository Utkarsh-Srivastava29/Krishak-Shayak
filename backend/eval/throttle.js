/**
 * Wraps a Gemini client so evaluation stays inside free-tier rate limits:
 * spaces out requests (EVAL_RPM per minute) and retries 429s with backoff.
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRateLimit = (error) => error?.status === 429 || /429|RESOURCE_EXHAUSTED|quota/i.test(error?.message || "");

const createThrottledClient = (client, { rpm = parseInt(process.env.EVAL_RPM || "8", 10), retries = 5 } = {}) => {
  const interval = Math.ceil(60000 / Math.max(rpm, 1));
  let nextSlot = 0;
  let calls = 0;

  const waitTurn = async () => {
    const now = Date.now();
    const wait = Math.max(0, nextSlot - now);
    nextSlot = Math.max(now, nextSlot) + interval;
    if (wait) await sleep(wait);
  };

  const wrap = (fn) => async (...args) => {
    for (let attempt = 0; ; attempt++) {
      await waitTurn();
      calls++;
      try {
        return await fn(...args);
      } catch (error) {
        if (!isRateLimit(error) || attempt >= retries) throw error;
        const backoff = 15000 * 2 ** attempt;
        console.log(`    rate limited; retrying in ${backoff / 1000}s`);
        await sleep(backoff);
      }
    }
  };

  return {
    models: {
      generateContent: wrap((req) => client.models.generateContent(req)),
      generateContentStream: wrap((req) => client.models.generateContentStream(req)),
      embedContent: wrap((req) => client.models.embedContent(req)),
    },
    get calls() {
      return calls;
    },
  };
};

module.exports = { createThrottledClient, sleep };
