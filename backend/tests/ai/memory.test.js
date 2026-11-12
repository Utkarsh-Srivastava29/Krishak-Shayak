require("./_setup");
const test = require("node:test");
const assert = require("node:assert/strict");
const { planMemoryUpdates, formatMemoryContext, profileFromMemories, containsPII } = require("../../memory/memoryMerge");
const { planConsolidation } = require("../../memory/consolidation");

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-12T06:00:00Z");
const mem = (props) => ({ _id: props._id || Math.random().toString(36).slice(2), status: "active", createdAt: now, ...props });

test("new semantic facts are added, repeated ones only refreshed", () => {
  const existing = [mem({ _id: "c1", kind: "semantic", key: "crop", value: "wheat", text: "Grows wheat." })];
  const ops = planMemoryUpdates(existing, [
    { kind: "semantic", key: "crop", value: "gehun", text: "Grows gehun." }, // alias of wheat
    { kind: "semantic", key: "crop", value: "Mustard", text: "Grows mustard." },
  ]);
  assert.deepEqual(ops.map((o) => o.op), ["touch", "add"]);
  assert.equal(ops[0].id, "c1");
  assert.equal(ops[1].fact.value, "mustard");
});

test("single-valued facts are superseded, not duplicated", () => {
  const existing = [mem({ _id: "d1", kind: "semantic", key: "district", value: "kanpur", text: "Farm is in Kanpur." })];
  const ops = planMemoryUpdates(existing, [{ kind: "semantic", key: "district", value: "Etawah", text: "Farm is in Etawah." }]);
  assert.equal(ops.length, 1);
  assert.equal(ops[0].op, "supersede");
  assert.equal(ops[0].oldId, "d1");
});

test("only the last value for a single-valued key in one batch is kept", () => {
  const ops = planMemoryUpdates([], [
    { kind: "semantic", key: "land_size", value: "2 acres", text: "Has 2 acres." },
    { kind: "semantic", key: "land_size", value: "3 acres", text: "Has 3 acres." },
  ]);
  assert.equal(ops.length, 1);
  assert.equal(ops[0].fact.value, "3 acres");
});

test("personal identifiers never enter memory", () => {
  assert.equal(containsPII("My aadhaar is 1234 5678 9012"), true);
  assert.equal(containsPII("Call me on 9876543210"), true);
  assert.equal(containsPII("Grows mustard on 2 acres"), false);
  const ops = planMemoryUpdates([], [
    { kind: "semantic", key: "other", text: "Aadhaar number is 123456789012" },
    { kind: "semantic", key: "crop", value: "paddy", text: "Grows paddy." },
  ]);
  assert.equal(ops.length, 1);
  assert.equal(ops[0].fact.value, "paddy");
});

test("episodic duplicates on the same day are merged", () => {
  const existing = [mem({ _id: "e1", kind: "episodic", text: "Sprayed neem oil on wheat.", eventDate: now })];
  const ops = planMemoryUpdates(existing, [
    { kind: "episodic", text: "sprayed neem oil on wheat", eventDate: new Date(now.getTime() + 3600000) },
    { kind: "episodic", text: "Applied urea to wheat.", eventDate: now },
  ]);
  assert.deepEqual(ops.map((o) => o.op), ["touch", "add"]);
});

test("memory context lists profile and dated activity", () => {
  const context = formatMemoryContext(
    [
      mem({ kind: "semantic", key: "district", value: "etawah", text: "Farm is in Etawah district." }),
      mem({ kind: "episodic", text: "Sprayed insecticide on mustard.", eventDate: new Date(now - 2 * DAY) }),
      mem({ kind: "episodic", text: "Irrigate wheat.", isPlanned: true, eventDate: new Date(now.getTime() + 2 * DAY) }),
      mem({ kind: "semantic", key: "crop", value: "old", text: "Old fact.", status: "superseded" }),
    ],
    { now }
  );
  assert.match(context, /Farm profile:\n- Farm is in Etawah district\./);
  assert.match(context, /Did: Sprayed insecticide on mustard\. \(2 days ago\)/);
  assert.match(context, /Planned: Irrigate wheat\. \(in 2 days\)/);
  assert.doesNotMatch(context, /Old fact/);
});

test("profile is built from active semantic memories", () => {
  const profile = profileFromMemories([
    mem({ kind: "semantic", key: "state", value: "uttar pradesh", text: "" }),
    mem({ kind: "semantic", key: "crop", value: "wheat", text: "" }),
    mem({ kind: "semantic", key: "crop", value: "wheat", text: "" }),
    mem({ kind: "semantic", key: "crop", value: "mustard", text: "" }),
  ]);
  assert.equal(profile.state, "uttar pradesh");
  assert.deepEqual(profile.crops, ["wheat", "mustard"]);
});

test("consolidation archives duplicates and stale plans, groups old episodes by month", () => {
  const plan = planConsolidation(
    [
      mem({ _id: "a", kind: "semantic", key: "crop", value: "wheat", text: "Grows wheat.", lastSeenAt: new Date(now - DAY) }),
      mem({ _id: "b", kind: "semantic", key: "crop", value: "wheat", text: "Grows wheat.", lastSeenAt: new Date(now - 9 * DAY) }),
      mem({ _id: "p", kind: "episodic", text: "Plan to spray.", isPlanned: true, eventDate: new Date(now - 20 * DAY) }),
      mem({ _id: "o1", kind: "episodic", text: "Sowed wheat.", eventDate: new Date("2026-09-03") }),
      mem({ _id: "o2", kind: "episodic", text: "Applied DAP.", eventDate: new Date("2026-09-10") }),
      mem({ _id: "o3", kind: "episodic", text: "Single August event.", eventDate: new Date("2026-08-02") }),
      mem({ _id: "r", kind: "episodic", text: "Recent spray.", eventDate: new Date(now - 3 * DAY) }),
    ],
    now
  );
  assert.deepEqual(plan.archive.sort(), ["b", "p"]);
  assert.deepEqual(Object.keys(plan.summarize), ["2026-09"]);
  assert.equal(plan.summarize["2026-09"].length, 2);
});
