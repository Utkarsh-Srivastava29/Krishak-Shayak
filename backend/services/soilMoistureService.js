const axios = require("axios");

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

// Volumetric water content (m³/m³) thresholds for the root zone.
// Saturation sits near 0.50 for most agricultural soils.
const SATURATION = 0.5;
const LOW_MAX = 0.2;
const MODERATE_MAX = 0.38;

const classify = (value) => {
  if (value < LOW_MAX) return "low";
  if (value > MODERATE_MAX) return "high";
  return "moderate";
};

/**
 * Real modelled soil moisture for a coordinate, from Open-Meteo.
 * Free, no API key. Returns volumetric water content in the 3-27cm root zone.
 */
const getSoilMoisture = async (lat, lon) => {
  const response = await axios.get(OPEN_METEO_URL, {
    params: {
      latitude: lat,
      longitude: lon,
      current: "soil_moisture_3_to_9cm,soil_temperature_6cm",
      hourly: "soil_moisture_9_to_27cm",
      forecast_days: 1,
      timezone: "auto",
    },
    timeout: 10000,
  });

  const current = response.data.current || {};
  const rootZone = current.soil_moisture_3_to_9cm;

  if (typeof rootZone !== "number") {
    throw new Error("Open-Meteo returned no soil moisture for this location");
  }

  const deeper = response.data.hourly?.soil_moisture_9_to_27cm?.[0];

  return {
    value: rootZone,
    unit: "m³/m³",
    depth: "3-9cm",
    deeperValue: typeof deeper === "number" ? deeper : null,
    soilTemp: current.soil_temperature_6cm ?? null,
    level: classify(rootZone),
    // 0-1 fraction for the progress bar, relative to saturation
    fill: Math.max(0, Math.min(rootZone / SATURATION, 1)),
  };
};

module.exports = { getSoilMoisture };
