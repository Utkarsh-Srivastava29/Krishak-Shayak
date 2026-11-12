/**
 * Proactive alert rules. Pure functions: given what we know about a farmer
 * (memory profile and farm diary) and today's data (forecast, price trends,
 * new schemes), return candidate alerts. The service sends at most one alert
 * per farmer per day — the highest priority one not sent recently — so
 * alerts stay useful instead of becoming spam.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const SPRAY_WORDS = /spray|pesticide|insecticide|fungicide|herbicide|weedicide|छिड़काव|दवा/i;
const IRRIGATION_WORDS = /irrigat|watering|सिंचाई|पानी/i;

const daysFrom = (now, date) => Math.floor((new Date(date) - now) / DAY_MS);
const dayLabel = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });

const nextDays = (daily, now, count) =>
  daily.filter((d) => {
    const diff = (Date.parse(`${d.date}T00:00:00Z`) - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / DAY_MS;
    return diff >= 0 && diff < count;
  });

const findEpisode = (episodes, pattern, { now, fromDays, toDays, planned }) =>
  episodes.find((e) => {
    if (planned !== undefined && Boolean(e.isPlanned) !== planned) return false;
    if (!pattern.test(e.text)) return false;
    const diff = daysFrom(now, e.eventDate || e.createdAt);
    return diff >= fromDays && diff <= toDays;
  });

const buildAlertCandidates = ({ profile = {}, daily = [], episodes = [], priceTrends = [], newSchemes = [], now = new Date() }) => {
  const alerts = [];
  const soon = nextDays(daily, now, 3);
  const rainyDay = soon.find((d) => d.rainMm >= 2 || d.rainChancePct >= 60);
  const heavyRainDay = soon.find((d) => d.rainMm >= 30);

  // 1. Rain soon after a spray, or before a planned spray.
  if (rainyDay) {
    const plannedSpray = findEpisode(episodes, SPRAY_WORDS, { now, fromDays: 0, toDays: 3, planned: true });
    const recentSpray = findEpisode(episodes, SPRAY_WORDS, { now, fromDays: -1, toDays: 0, planned: false });
    if (plannedSpray || recentSpray) {
      alerts.push({
        type: "spray_rain",
        priority: 90,
        dedupeKey: `spray_rain:${rainyDay.date}`,
        title: "Rain expected — check your spraying plan",
        message: `Rain is expected on ${dayLabel(rainyDay.date)} (${rainyDay.rainMm} mm, ${rainyDay.rainChancePct}% chance). ${
          plannedSpray
            ? "Postpone the planned spray until after the rain so it is not washed off."
            : "Your recent spray may be washed off; check the crop after the rain before spraying again."
        }`,
        data: { forecastDay: rainyDay },
      });
    }
  }

  // 2. Planned irrigation with enough rain coming.
  const wetDay = soon.find((d) => d.rainMm >= 10);
  const plannedIrrigation = findEpisode(episodes, IRRIGATION_WORDS, { now, fromDays: 0, toDays: 3, planned: true });
  if (wetDay && plannedIrrigation) {
    alerts.push({
      type: "irrigation_rain",
      priority: 80,
      dedupeKey: `irrigation_rain:${wetDay.date}`,
      title: "You may be able to skip irrigation",
      message: `About ${wetDay.rainMm} mm of rain is forecast on ${dayLabel(wetDay.date)}. Consider postponing the planned irrigation and save water and diesel.`,
      data: { forecastDay: wetDay },
    });
  }

  // 3. Heavy rain in general.
  if (heavyRainDay) {
    alerts.push({
      type: "heavy_rain",
      priority: 75,
      dedupeKey: `heavy_rain:${heavyRainDay.date}`,
      title: "Heavy rain forecast",
      message: `Heavy rain (${heavyRainDay.rainMm} mm) is forecast on ${dayLabel(heavyRainDay.date)}. Clear field drainage and keep harvested produce covered.`,
      data: { forecastDay: heavyRainDay },
    });
  }

  // 4. Cold nights (frost risk for rabi crops) and heat stress.
  const coldDay = soon.find((d) => d.minTemp <= 3);
  if (coldDay) {
    alerts.push({
      type: "frost",
      priority: 70,
      dedupeKey: `frost:${coldDay.date}`,
      title: "Frost risk tonight",
      message: `Night temperature may drop to ${coldDay.minTemp}°C on ${dayLabel(coldDay.date)}. A light irrigation in the evening helps protect crops from frost.`,
      data: { forecastDay: coldDay },
    });
  }
  const hotDay = soon.find((d) => d.maxTemp >= 40);
  if (hotDay) {
    alerts.push({
      type: "heat",
      priority: 60,
      dedupeKey: `heat:${hotDay.date}`,
      title: "Very hot day ahead",
      message: `Temperature may reach ${hotDay.maxTemp}°C on ${dayLabel(hotDay.date)}. Irrigate in the early morning or evening and give animals shade and water.`,
      data: { forecastDay: hotDay },
    });
  }

  // 5. Big weekly price moves for crops the farmer grows.
  const crops = new Set((profile.crops || []).map((c) => c.toLowerCase()));
  for (const trend of priceTrends) {
    if (!crops.has(trend.commodity) || Math.abs(trend.changePct) < 8) continue;
    const up = trend.changePct > 0;
    alerts.push({
      type: "price_move",
      priority: 65,
      dedupeKey: `price_move:${trend.commodity}:${trend.toDate}`,
      title: `${trend.commodity[0].toUpperCase()}${trend.commodity.slice(1)} price ${up ? "up" : "down"} ${Math.abs(trend.changePct)}%`,
      message: `Average mandi price in ${trend.state} moved from ₹${trend.fromPrice} to ₹${trend.toPrice} per quintal in a week. Ask the assistant before deciding when to sell.`,
      data: trend,
    });
  }

  // 6. Newly added schemes that apply to the farmer's state.
  for (const scheme of newSchemes.slice(0, 1)) {
    alerts.push({
      type: "new_scheme",
      priority: 40,
      dedupeKey: `new_scheme:${scheme.title}`,
      title: "New government scheme",
      message: `${scheme.title} was added to the scheme list. Ask the assistant whether you qualify.`,
      data: { title: scheme.title, url: scheme.url },
    });
  }

  return alerts.sort((a, b) => b.priority - a.priority);
};

/** The single alert to send today, skipping anything sent recently. */
const pickAlert = (candidates, recentDedupeKeys = new Set()) =>
  candidates.find((alert) => !recentDedupeKeys.has(alert.dedupeKey)) || null;

module.exports = { buildAlertCandidates, pickAlert, SPRAY_WORDS, IRRIGATION_WORDS };
