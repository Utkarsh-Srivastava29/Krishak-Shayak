import { API_URL } from "./api";

/**
 * Streams an answer from the Krishak Sahayak assistant.
 * Calls onText with each chunk as it arrives; resolves when the answer is complete.
 */
export const streamChat = async ({
  messages,
  language,
  page,
  onText,
  signal,
}) => {
  const response = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
      if (payload.text) onText(payload.text);
      if (payload.done) return;
    }
  }
};
