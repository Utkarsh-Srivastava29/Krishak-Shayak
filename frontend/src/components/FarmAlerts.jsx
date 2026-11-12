import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getNotifications, markNotificationRead } from "../services/farmMemoryService";

/** Proactive alerts created by the daily background job. */
const FarmAlerts = () => {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getNotifications()
      .then((data) => setAlerts(data.notifications || []))
      .catch(() => setAlerts([]))
      .finally(() => setLoaded(true));
  }, []);

  const markRead = async (id) => {
    setAlerts((list) => list.map((a) => (a._id === id ? { ...a, read: true } : a)));
    await markNotificationRead(id).catch(() => {});
  };

  if (!loaded) return null;

  return (
    <div className="mb-6 rounded-lg bg-white p-5 shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">{t("alerts.title")}</h2>
        <Link to="/farm-memory" className="text-sm text-green-700 hover:underline">
          {t("alerts.manageMemory")}
        </Link>
      </div>
      {alerts.length === 0 ? (
        <p className="text-sm text-gray-500">{t("alerts.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {alerts.slice(0, 5).map((alert) => (
            <li
              key={alert._id}
              className={`rounded-lg border p-3 ${alert.read ? "border-gray-200 bg-gray-50" : "border-amber-200 bg-amber-50"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-800">{alert.title}</p>
                  <p className="text-sm text-gray-700">{alert.message}</p>
                  <p className="mt-1 text-xs text-gray-400">{new Date(alert.createdAt).toLocaleString("en-IN")}</p>
                </div>
                {!alert.read && (
                  <button onClick={() => markRead(alert._id)} className="shrink-0 text-xs text-green-700 hover:underline">
                    {t("alerts.markRead")}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FarmAlerts;
