import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { getCropRecommendations } from "../services/cropService";

const savedUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const WATER_STYLE = {
  low: "bg-amber-50 text-amber-800",
  medium: "bg-sky-50 text-sky-800",
  high: "bg-blue-100 text-blue-900",
};

const ReasonList = ({ reasons, t }) => {
  const season = (s = "") => s.split("/").map((x) => t(`crops.season.${x.trim()}`, { defaultValue: x })).join(" / ");
  const positive = new Set(["sow_now", "temp_ok", "water_ok", "region_major", "soil_match", "you_grow"]);
  return (
    <ul className="space-y-1 text-sm">
      {reasons.map((r, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden className={positive.has(r.code) ? "text-green-600" : "text-amber-600"}>
            {positive.has(r.code) ? "✓" : "!"}
          </span>
          <span className="text-gray-700">
            {t(`crops.reason.${r.code}`, {
              ...r.params,
              season: r.params?.season ? season(r.params.season) : "",
              need: r.params?.need ? t(`crops.water.${r.params.need}`) : "",
              soil: r.params?.soil ? t(`crops.soil.${r.params.soil}`, { defaultValue: r.params.soil }) : "",
            })}
          </span>
        </li>
      ))}
    </ul>
  );
};

const CropCard = ({ rec, rank, lang, t }) => (
  <div className="bg-white rounded-xl shadow-md p-5 flex flex-col">
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        <p className="text-xs text-gray-500">#{rank}</p>
        <h3 className="text-xl font-bold text-green-800">{lang === "hi" ? rec.nameHi : rec.nameEn}</h3>
        <p className="text-xs text-gray-500">{lang === "hi" ? rec.nameEn : rec.nameHi}</p>
      </div>
      <span
        className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
          rec.sowNow ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
        }`}
      >
        {rec.sowNow ? t("crops.sowNow") : t("crops.sowNextMonth")}
      </span>
    </div>

    <div className="mb-3">
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{t("crops.suitability")}</span>
        <span className="font-semibold">{rec.score}/100</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden" role="meter" aria-valuenow={rec.score} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-green-600 rounded-full" style={{ width: `${rec.score}%` }} />
      </div>
    </div>

    <div className="flex flex-wrap gap-2 mb-3 text-xs">
      <span className={`px-2 py-0.5 rounded-full ${WATER_STYLE[rec.water]}`}>
        💧 {t("crops.waterNeed")}: {t(`crops.water.${rec.water}`)}
      </span>
      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
        ⏱ {t("crops.duration", { min: rec.durationDays[0], max: rec.durationDays[1] })}
      </span>
    </div>

    <ReasonList reasons={rec.reasons} t={t} />

    <div className="mt-auto pt-4 border-t border-gray-100 mt-4 text-sm">
      {rec.mandi ? (
        <p className="text-gray-700">
          📈 {t("crops.mandiPrice")}:{" "}
          <span className="font-semibold">₹{rec.mandi.averageModalPrice.toLocaleString("en-IN")}</span>
          <span className="text-gray-500">/{t("crops.quintal")}</span>
          <span className="block text-xs text-gray-500">
            {t("crops.mandiMeta", { markets: rec.mandi.marketsReporting, date: rec.mandi.arrivalDate })}
          </span>
        </p>
      ) : (
        <p className="text-xs text-gray-500">{t("crops.noMandi")}</p>
      )}
    </div>
  </div>
);

const CropGuide = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith("hi") ? "hi" : "en";
  const user = savedUser();
  const [location, setLocation] = useState(user?.location || "");
  const [query, setQuery] = useState(user?.location || "");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (place) => {
    setLoading(true);
    setError(null);
    try {
      setData(await getCropRecommendations(place, lang));
    } catch (err) {
      const status = err.response?.status;
      setData(null);
      setError(status === 404 ? t("crops.notFound") : status === 400 ? t("crops.needLocation") : t("crops.error"));
    } finally {
      setLoading(false);
    }
  }, [lang, t]);

  // Signed-in farmers without a typed place still get results: the backend
  // falls back to the district saved in their farm memory.
  useEffect(() => {
    if (query || user) load(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, lang]);

  const submit = (e) => {
    e.preventDefault();
    if (location.trim()) setQuery(location.trim());
  };

  const c = data?.conditions;
  const personal = data?.personalisedWith || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <Navbar />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <h1 className="text-3xl font-bold text-green-800 mb-2">{t("crops.title")}</h1>
        <p className="text-gray-700 mb-6">{t("crops.subtitle")}</p>

        <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t("crops.placeholder")}
            aria-label={t("crops.placeholder")}
            maxLength={100}
            className="flex-1 px-4 py-3 rounded-lg border border-green-200 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            type="submit"
            disabled={!location.trim() || loading}
            className="px-6 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {t("crops.button")}
          </button>
        </form>

        {loading && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl shadow-md p-5 animate-pulse h-64" />
            ))}
          </div>
        )}

        {!loading && error && <div className="bg-white rounded-xl p-6 text-center text-gray-600">{error}</div>}

        {!loading && !error && !data && (
          <div className="bg-white/70 rounded-xl p-8 text-center text-gray-600">{t("crops.empty")}</div>
        )}

        {!loading && data && (
          <>
            <div className="bg-white rounded-xl shadow-md p-5 mb-6">
              <p className="font-semibold text-gray-800 mb-3">
                📍 {[data.location.name, data.location.state].filter(Boolean).join(", ")}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">{t("crops.avgTemp")}</p>
                  <p className="font-semibold">{c.avgTemp ?? "—"}°C</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">{t("crops.rain5d")}</p>
                  <p className="font-semibold">{c.rainNext5DaysMm} mm</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">{t("crops.soilMoisture")}</p>
                  <p className="font-semibold">{c.soilMoisture ? t(`crops.moisture.${c.soilMoisture}`) : "—"}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">{t("crops.currentTemp")}</p>
                  <p className="font-semibold">{c.currentTemp ?? "—"}°C</p>
                </div>
              </div>
              {Object.keys(personal).length > 0 && (
                <p className="text-xs text-green-700 mt-3">
                  {t("crops.personalised", {
                    details: Object.entries(personal).map(([k, v]) => `${t(`crops.profile.${k}`)}: ${v}`).join(" · "),
                  })}
                </p>
              )}
              {data.summary && <p className="mt-4 text-gray-800 leading-relaxed">{data.summary}</p>}
            </div>

            {data.recommendations.length === 0 ? (
              <div className="bg-white rounded-xl p-6 text-center text-gray-600">{t("crops.none")}</div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {data.recommendations.map((rec, i) => (
                  <CropCard key={rec.crop} rec={rec} rank={i + 1} lang={lang} t={t} />
                ))}
              </div>
            )}

            <p className="text-xs text-gray-500 mt-6">
              {t("crops.sources", { sources: data.sources.join(", ") })} {t("crops.disclaimer")}
            </p>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default CropGuide;
