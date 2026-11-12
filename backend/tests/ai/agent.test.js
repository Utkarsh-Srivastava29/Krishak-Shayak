require("./_setup");
const test = require("node:test");
const assert = require("node:assert/strict");
const { runAgent } = require("../../agent/agentLoop");
const { signAction, verifyAction } = require("../../agent/actionTokens");
const { fixtureDeps } = require("../../eval/fixtures");

/**
 * Fake Gemini client: each call to generateContentStream pops the next
 * scripted turn and records the request it received.
 */
const fakeClient = (turns) => {
  const requests = [];
  return {
    requests,
    models: {
      generateContentStream: async (req) => {
        requests.push(JSON.parse(JSON.stringify(req)));
        const parts = turns.shift() || [{ text: "fallback" }];
        return (async function* stream() {
          for (const part of parts) yield { candidates: [{ content: { parts: [part] } }] };
        })();
      },
    },
  };
};

const userTurn = (text) => [{ role: "user", parts: [{ text }] }];

test("ReAct loop: calls tools in parallel, feeds results back, streams the answer", async () => {
  const client = fakeClient([
    [
      { functionCall: { id: "c1", name: "get_mandi_prices", args: { commodity: "sarson", state: "Uttar Pradesh" } } },
      { functionCall: { id: "c2", name: "get_weather_forecast", args: { location: "Etawah" } } },
    ],
    [{ text: "Mustard is ₹5,640 per quintal. " }, { text: "Rain is expected tomorrow." }],
  ]);
  const events = [];
  const result = await runAgent({
    client,
    model: "test",
    systemInstruction: "sys",
    contents: userTurn("Should I sell mustard?"),
    ctx: { language: "en", deps: fixtureDeps },
    emit: (e) => events.push(e),
  });

  assert.equal(result.text, "Mustard is ₹5,640 per quintal. Rain is expected tomorrow.");
  assert.deepEqual(result.toolCalls.map((t) => t.name), ["get_mandi_prices", "get_weather_forecast"]);
  assert.equal(result.steps, 2);

  // The second request carries the model's calls and our function responses.
  const second = client.requests[1].contents;
  assert.equal(second[1].role, "model");
  const responses = second[2].parts.map((p) => p.functionResponse);
  assert.equal(responses[0].id, "c1");
  assert.equal(responses[0].response.averageModalPrice, 5640);
  assert.equal(responses[0].response.weeklyChange.changePct, 3.1);
  assert.equal(responses[1].response.daily[1].rainMm, 14);

  assert.ok(events.some((e) => e.status && e.tool === "get_mandi_prices"));
  assert.deepEqual(events.filter((e) => e.text).map((e) => e.text), ["Mustard is ₹5,640 per quintal. ", "Rain is expected tomorrow."]);
});

test("profile from memory fills missing tool arguments", async () => {
  const client = fakeClient([[{ functionCall: { name: "get_weather_forecast", args: {} } }], [{ text: "ok" }]]);
  await runAgent({
    client,
    model: "test",
    systemInstruction: "sys",
    contents: userTurn("Will it rain?"),
    ctx: { language: "en", deps: fixtureDeps, profile: { district: "ludhiana" } },
  });
  const response = client.requests[1].contents[2].parts[0].functionResponse.response;
  assert.equal(response.place.name, "Ludhiana");
});

test("write actions are proposed with a signed token, never executed", async () => {
  const client = fakeClient([
    [{ functionCall: { name: "add_to_cart", args: { productId: "p1", productName: "Mustard seed", quantity: 2 } } }],
    [{ text: "Tap Confirm to add it." }],
  ]);
  const events = [];
  const result = await runAgent({
    client,
    model: "test",
    systemInstruction: "sys",
    contents: userTurn("Add 2 mustard seed"),
    ctx: { language: "en", userId: "u1", deps: fixtureDeps },
    emit: (e) => events.push(e),
  });
  assert.equal(result.actions.length, 1);
  const { action } = events.find((e) => e.action);
  assert.equal(action.summary, "Add 2 × Mustard seed to cart");
  assert.equal(action.executor, "client");
  assert.deepEqual(verifyAction(action.token, { userId: "u1" }).args, { productId: "p1", productName: "Mustard seed", quantity: 2 });
  const response = client.requests[1].contents[2].parts[0].functionResponse.response;
  assert.equal(response.status, "awaiting_farmer_confirmation");
});

test("guests cannot propose account actions", async () => {
  const client = fakeClient([[{ functionCall: { name: "log_farm_activity", args: { activity: "Sprayed" } } }], [{ text: "Please sign in." }]]);
  const result = await runAgent({ client, model: "t", systemInstruction: "s", contents: userTurn("log it"), ctx: { language: "en" } });
  assert.equal(result.actions.length, 0);
  assert.match(client.requests[1].contents[2].parts[0].functionResponse.response.error, /not signed in/);
});

test("the last step disables tools so the model must answer", async () => {
  const loop = Array.from({ length: 5 }, () => [{ functionCall: { name: "get_weather_forecast", args: { location: "Etawah" } } }]);
  const client = fakeClient([...loop.slice(0, 2), [{ text: "Final answer." }]]);
  const result = await runAgent({
    client,
    model: "t",
    systemInstruction: "s",
    contents: userTurn("x"),
    ctx: { language: "en", deps: fixtureDeps },
    maxSteps: 2,
  });
  assert.equal(result.text, "Final answer.");
  assert.equal(client.requests[2].config.toolConfig.functionCallingConfig.mode, "NONE");
  assert.equal(client.requests[0].config.toolConfig.functionCallingConfig.mode, "AUTO");
});

test("tool failures are reported to the model, not thrown", async () => {
  const client = fakeClient([[{ functionCall: { name: "get_weather_forecast", args: { location: "Etawah" } } }], [{ text: "Weather is unavailable." }]]);
  const deps = { weather: { getForecast: async () => { throw new Error("timeout"); } } };
  const result = await runAgent({ client, model: "t", systemInstruction: "s", contents: userTurn("x"), ctx: { language: "en", deps } });
  assert.equal(result.toolCalls[0].error, "The get_weather_forecast service is unavailable right now.");
});

test("baseline mode sends no tools", async () => {
  const client = fakeClient([[{ text: "Hello" }]]);
  await runAgent({ client, model: "t", systemInstruction: "s", contents: userTurn("hi"), ctx: { enabledTools: [] } });
  assert.equal(client.requests[0].config.tools, undefined);
});

test("action tokens reject tampering, expiry and other users", () => {
  const token = signAction({ type: "log_farm_activity", args: { activity: "a" }, userId: "u1" }, 1000);
  assert.equal(verifyAction(token, { userId: "u1", now: 2000 }).type, "log_farm_activity");
  assert.throws(() => verifyAction(token, { userId: "u2", now: 2000 }), /another user/);
  assert.throws(() => verifyAction(token, { userId: "u1", now: 1000 + 16 * 60 * 1000 }), /expired/);
  const [body, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url")), args: { activity: "b" } })).toString("base64url");
  assert.throws(() => verifyAction(`${forged}.${sig}`, { userId: "u1", now: 2000 }), /Invalid action signature/);
});
