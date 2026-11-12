const FarmerMemory = require("../models/FarmerMemory");
const { extractFacts } = require("./memoryExtractor");
const { planMemoryUpdates, formatMemoryContext, profileFromMemories } = require("./memoryMerge");

const MAX_ACTIVE_MEMORIES = 200;

const getActiveMemories = (userId) =>
  FarmerMemory.find({ user: userId, status: "active" }).sort({ updatedAt: -1 }).limit(MAX_ACTIVE_MEMORIES).lean();

/** Text block for the agent prompt, or "" when nothing is remembered. */
const getMemoryContext = async (userId) => formatMemoryContext(await getActiveMemories(userId));

const getFarmerProfile = async (userId) => profileFromMemories(await getActiveMemories(userId));

/** Apply planned operations (see planMemoryUpdates) to MongoDB. */
const applyMemoryOps = async (userId, ops, source = "chat") => {
  const now = new Date();
  let added = 0;
  for (const op of ops) {
    if (op.op === "touch") {
      await FarmerMemory.updateOne({ _id: op.id, user: userId }, { $set: { lastSeenAt: now } });
      continue;
    }
    const created = await FarmerMemory.create({ ...op.fact, user: userId, source, lastSeenAt: now });
    added++;
    if (op.op === "supersede") {
      await FarmerMemory.updateOne(
        { _id: op.oldId, user: userId },
        { $set: { status: "superseded", supersededBy: created._id } }
      );
    }
  }
  return added;
};

/**
 * After a chat turn: extract facts the farmer shared and merge them into
 * memory. Runs after the reply has been sent, so it never slows the answer.
 */
const rememberFromConversation = async (userId, messages) => {
  const facts = await extractFacts(messages);
  if (facts.length === 0) return 0;
  const existing = await getActiveMemories(userId);
  return applyMemoryOps(userId, planMemoryUpdates(existing, facts));
};

/** Save one fact directly (farmer typed it, or confirmed an agent action). */
const addMemory = async (userId, fact, source = "user") => {
  const existing = await getActiveMemories(userId);
  return applyMemoryOps(userId, planMemoryUpdates(existing, [fact]), source);
};

module.exports = {
  getActiveMemories,
  getMemoryContext,
  getFarmerProfile,
  applyMemoryOps,
  rememberFromConversation,
  addMemory,
};
