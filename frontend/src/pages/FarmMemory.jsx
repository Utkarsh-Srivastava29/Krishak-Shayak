import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import {
  getMemories,
  addMemory,
  updateMemory,
  deleteMemory,
  deleteAllMemories,
} from "../services/farmMemoryService";

const SOURCE_LABEL = {
  chat: "farmMemory.fromChat",
  user: "farmMemory.fromYou",
  action: "farmMemory.fromAction",
  consolidation: "farmMemory.fromSummary",
};

const formatDate = (value, language) =>
  value
    ? new Date(value).toLocaleDateString(language?.startsWith("hi") ? "hi-IN" : "en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

/**
 * "What Krishak Sahayak remembers": the farmer can see, correct and delete
 * everything the assistant has stored about them.
 */
const FarmMemory = () => {
  const { t, i18n } = useTranslation();
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState("");
  const [newFact, setNewFact] = useState("");
  const [newActivity, setNewActivity] = useState("");

  const load = async () => {
    try {
      setMemories(await getMemories());
      setError("");
    } catch {
      setError(t("farmMemory.error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (fn) => {
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message || t("farmMemory.error"));
    }
  };

  const saveEdit = (memory) =>
    run(async () => {
      await updateMemory(memory._id, { text: editText });
      setEditing(null);
    });

  const add = (kind, text, reset) =>
    run(async () => {
      if (!text.trim()) return;
      await addMemory({ kind, key: "other", text: text.trim() });
      reset("");
    });

  const forgetAll = () => {
    if (window.confirm(t("farmMemory.confirmDeleteAll"))) run(deleteAllMemories);
  };

  const groups = [
    { kind: "semantic", title: t("farmMemory.profile") },
    { kind: "episodic", title: t("farmMemory.activity") },
    { kind: "summary", title: t("farmMemory.history") },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 rounded-lg bg-gradient-to-r from-green-500 to-green-600 p-6 shadow-lg">
          <h1 className="mb-1 text-2xl font-bold text-white">{t("farmMemory.title")}</h1>
          <p className="text-green-100">{t("farmMemory.subtitle")}</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <p className="text-gray-500">…</p>
        ) : memories.length === 0 ? (
          <div className="mb-6 rounded-lg bg-white p-6 text-gray-600 shadow">{t("farmMemory.empty")}</div>
        ) : (
          groups.map(({ kind, title }) => {
            const list = memories.filter((m) => m.kind === kind);
            if (list.length === 0) return null;
            return (
              <section key={kind} className="mb-6 rounded-lg bg-white p-5 shadow">
                <h2 className="mb-3 text-lg font-semibold text-gray-800">{title}</h2>
                <ul className="divide-y divide-gray-100">
                  {list.map((memory) => (
                    <li key={memory._id} className="flex items-start justify-between gap-3 py-3">
                      {editing === memory._id ? (
                        <div className="flex flex-1 gap-2">
                          <input
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            maxLength={300}
                            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                          <button onClick={() => saveEdit(memory)} className="rounded bg-green-600 px-3 py-1 text-sm text-white">
                            {t("farmMemory.save")}
                          </button>
                          <button onClick={() => setEditing(null)} className="rounded border px-3 py-1 text-sm">
                            {t("farmMemory.cancel")}
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1">
                            <p className="text-gray-800">
                              {memory.isPlanned && (
                                <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                                  {t("farmMemory.planned")}
                                </span>
                              )}
                              {memory.text}
                            </p>
                            <p className="text-xs text-gray-400">
                              {kind !== "semantic" && `${formatDate(memory.eventDate || memory.createdAt, i18n.language)} · `}
                              {t(SOURCE_LABEL[memory.source] || "farmMemory.fromChat")}
                            </p>
                          </div>
                          <div className="flex gap-2 text-sm">
                            <button
                              onClick={() => {
                                setEditing(memory._id);
                                setEditText(memory.text);
                              }}
                              className="text-green-700 hover:underline"
                            >
                              {t("farmMemory.edit")}
                            </button>
                            <button onClick={() => run(() => deleteMemory(memory._id))} className="text-red-600 hover:underline">
                              {t("farmMemory.delete")}
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}

        <section className="mb-6 grid gap-4 rounded-lg bg-white p-5 shadow sm:grid-cols-2">
          <AddBox
            label={t("farmMemory.addFact")}
            placeholder={t("farmMemory.addPlaceholder")}
            value={newFact}
            onChange={setNewFact}
            onSave={() => add("semantic", newFact, setNewFact)}
            saveLabel={t("farmMemory.save")}
          />
          <AddBox
            label={t("farmMemory.addActivity")}
            placeholder={t("farmMemory.activityPlaceholder")}
            value={newActivity}
            onChange={setNewActivity}
            onSave={() => add("episodic", newActivity, setNewActivity)}
            saveLabel={t("farmMemory.save")}
          />
        </section>

        {memories.length > 0 && (
          <button onClick={forgetAll} className="text-sm text-red-600 hover:underline">
            {t("farmMemory.deleteAll")}
          </button>
        )}
      </div>
      <Footer />
    </div>
  );
};

const AddBox = ({ label, placeholder, value, onChange, onSave, saveLabel }) => (
  <div>
    <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSave()}
        placeholder={placeholder}
        maxLength={300}
        className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-green-500"
      />
      <button onClick={onSave} className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700">
        {saveLabel}
      </button>
    </div>
  </div>
);

export default FarmMemory;
