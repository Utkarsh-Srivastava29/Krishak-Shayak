import { API_URL, getToken } from "./api";

const authHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Streams an answer from the Krishak Sahayak agent over Server-Sent Events.
 *
 * Event callbacks:
 *   onText(chunk)        answer text as it is written
 *   onStatus(text, tool) the agent is calling a tool ("Checking mandi prices…")
 *   onAction(action)     the agent proposes a write action that needs Confirm
 *   onCitations(list)    official links used for the answer
 *
 * The token is sent when signed in so the assistant can remember the farm.
 */
export const streamChat = async ({
  messages,
  language,
  page,
  onText,
  onStatus,
  onAction,
  onCitations,
  signal,
}) => {
  const response = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ messages, language, page }),
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "The assistant is unavailable right now.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop();

    for (const event of events) {
      const line = event.trim();
      if (!line.startsWith("data:")) continue;

      const payload = JSON.parse(line.slice(5));
      if (payload.error) throw new Error(payload.error);
      if (payload.status) onStatus?.(payload.status, payload.tool);
      if (payload.text) onText?.(payload.text);
      if (payload.action) onAction?.(payload.action);
      if (payload.citations) onCitations?.(payload.citations);
      if (payload.done) return payload;
    }
  }
};

/** Run an action the farmer confirmed. Returns the server's verdict. */
export const confirmAgentAction = async (token) => {
  const response = await fetch(`${API_URL}/chat/actions/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ token }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Could not complete the action.");
  return body;
};
