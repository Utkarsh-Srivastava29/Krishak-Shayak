import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { streamChat } from "../services/chatService";

const HIDDEN_ON = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth/google/callback",
];

const AssistantChatbot = () => {
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  const suggestions = t("assistant.suggestions", { returnObjects: true });

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streamingText]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (text) => {
    const question = text.trim();
    if (!question || isStreaming) return;

    const history = [...messages, { role: "user", content: question }];
    setMessages(history);
    setInput("");
    setError(null);
    setStreamingText("");
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    let answer = "";
    try {
      await streamChat({
        messages: history,
        language: i18n.language?.startsWith("hi") ? "hi" : "en",
        page: pathname,
        signal: controller.signal,
        onText: (chunk) => {
          answer += chunk;
          setStreamingText(answer);
        },
      });
      setMessages([...history, { role: "assistant", content: answer }]);
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(err.message);
      setMessages(history);
    } finally {
      setIsStreaming(false);
      setStreamingText("");
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const closePanel = () => {
    abortRef.current?.abort();
    setIsOpen(false);
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setStreamingText("");
    setIsStreaming(false);
    setError(null);
    inputRef.current?.focus();
  };

  if (HIDDEN_ON.some((route) => pathname.startsWith(route))) return null;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        aria-label={t("assistant.open")}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-green-600 px-5 py-4 text-white shadow-lg transition-all hover:bg-green-700 hover:shadow-xl"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.9 9.9 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <span className="hidden font-medium sm:inline">
          {t("assistant.open")}
        </span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-0 sm:p-6">
      <div
        className="absolute inset-0 bg-black/20 sm:hidden"
        onClick={closePanel}
      />

      <div className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-[600px] sm:max-h-[80vh] sm:w-96 sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between bg-green-700 px-4 py-3 text-white">
          <div>
            <h2 className="font-bold">{t("assistant.title")}</h2>
            <p className="text-xs text-green-100">{t("assistant.subtitle")}</p>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                aria-label={t("assistant.clear")}
                title={t("assistant.clear")}
                className="rounded-full p-1 transition-colors hover:bg-green-600"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            )}
            <button
              onClick={closePanel}
              aria-label={t("assistant.close")}
              className="rounded-full p-1 transition-colors hover:bg-green-600"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && !isStreaming && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">{t("assistant.greeting")}</p>
              {Array.isArray(suggestions) &&
                suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => send(suggestion)}
                    className="block w-full rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-left text-sm text-green-800 transition-colors hover:bg-green-100"
                  >
                    {suggestion}
                  </button>
                ))}
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={
                message.role === "user"
                  ? "flex justify-end"
                  : "flex justify-start"
              }
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                  message.role === "user"
                    ? "rounded-br-sm bg-green-600 text-white"
                    : "rounded-bl-sm bg-gray-100 text-gray-800"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}

          {isStreaming && (
            <div className="flex justify-start">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2 text-sm text-gray-800">
                {streamingText || (
                  <span className="flex gap-1 py-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
                  </span>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-gray-200 p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("assistant.placeholder")}
              maxLength={2000}
              className="max-h-28 flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || isStreaming}
              aria-label={t("assistant.send")}
              className="rounded-lg bg-green-600 p-2.5 text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-gray-400">
            {t("assistant.disclaimer")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AssistantChatbot;
