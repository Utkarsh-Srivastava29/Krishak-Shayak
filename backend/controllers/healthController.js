const { CloudWatchClient, DescribeAlarmsCommand, GetMetricDataCommand } = require("@aws-sdk/client-cloudwatch");
const mongoose = require("mongoose");
const { isRedisReady, getCache, setCache } = require("../config/redisClient");

const REGION = process.env.AWS_REGION || "ap-south-1";

// Safe initialization of CloudWatch client
let cwClient = null;
try {
  cwClient = new CloudWatchClient({
    region: REGION,
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    } : undefined, // Uses default credential chain (IAM instance role / AWS CLI profile) if env not set
  });
} catch (err) {
  console.warn("[HEALTH] CloudWatch client initialization failed:", err.message);
}

/**
 * Service definitions mapped to CloudWatch alarms and canaries
 */
const MONITORED_SERVICES = [
  {
    id: "frontend",
    name: "Web Application & CDN",
    category: "Frontend",
    canary: "ks-frontend-check",
    alarmPrefix: "FrontendDown",
    endpoint: "https://krishakshayak.duckdns.org/",
    description: "React Single Page App hosted via Nginx reverse proxy",
  },
  {
    id: "schemes",
    name: "Government Schemes API",
    category: "External Integration",
    canary: "ks-schemes-check",
    alarmPrefix: "SchemesApiDown",
    endpoint: "/api/schemes",
    description: "Syncs welfare schemes from Government of India Google Sheets dataset",
  },
  {
    id: "weather",
    name: "Weather Forecasting API",
    category: "External Integration",
    canary: "ks-weather-check",
    alarmPrefix: "WeatherApiDown",
    endpoint: "/api/weather?location=Delhi",
    description: "Live weather and agricultural forecasts via OpenWeatherMap API",
  },
  {
    id: "market-prices",
    name: "Mandi Market Prices API",
    category: "External Integration",
    canary: "ks-market-check",
    alarmPrefix: "MarketPricesApiDown",
    endpoint: "/api/market-prices?state=Delhi",
    description: "Daily commodity and APMC mandi market rates from Data.gov.in",
  },
  {
    id: "products",
    name: "Products & Catalog Service",
    category: "Core API",
    canary: "ks-products-check",
    alarmPrefix: "ProductsApiDown",
    endpoint: "/api/products",
    description: "Agricultural products catalog and seller inventory engine",
  },
  {
    id: "shops",
    name: "Seller Shops & Marketplace",
    category: "Core API",
    canary: "ks-shops-check",
    alarmPrefix: "ShopsApiDown",
    endpoint: "/api/seller/shops",
    description: "Local farmer shops directory and vendor store endpoints",
  },
];

/**
 * GET /api/health
 * Returns comprehensive health status combining CloudWatch alarms, canaries, and local services.
 */
const getHealthStatus = async (req, res) => {
  try {
    // 1. Check Redis cache first (TTL: 30s) to keep status snappy and avoid rate-limiting
    const cachedHealth = await getCache("health:status");
    if (cachedHealth) {
      return res.status(200).json({
        ...cachedHealth,
        cached: true,
      });
    }

    // 2. Local Infrastructure checks
    const mongoState = mongoose.connection.readyState;
    const mongoStatus = mongoState === 1 ? "healthy" : "unhealthy";
    const redisStatus = isRedisReady() ? "healthy" : "degraded";

    // 3. Query CloudWatch Alarms (with 3s timeout to never stall the request)
    let alarms = [];
    if (cwClient) {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("CloudWatch query timed out")), 3000)
        );
        const cmd = new DescribeAlarmsCommand({
          AlarmNamePrefix: "KrishakShayak-",
        });
        const resp = await Promise.race([cwClient.send(cmd), timeoutPromise]);
        alarms = resp.MetricAlarms || [];
      } catch (cwErr) {
        console.warn("[HEALTH] Could not retrieve CloudWatch alarms:", cwErr.message);
      }
    }

    // 4. Map services to alarm states
    let activeIncidentCount = 0;

    const services = MONITORED_SERVICES.map((svc) => {
      // Find all alarms matching this service
      const svcAlarms = alarms.filter((a) =>
        a.AlarmName && a.AlarmName.includes(svc.alarmPrefix)
      );

      const hasCritical = svcAlarms.some((a) => a.StateValue === "ALARM" && a.AlarmName.includes("critical"));
      const hasWarning = svcAlarms.some((a) => a.StateValue === "ALARM" && a.AlarmName.includes("warning"));

      let status = "operational";
      let statusMessage = "All checks passing";

      if (hasCritical) {
        status = "outage";
        statusMessage = "Critical alarm triggered in CloudWatch";
        activeIncidentCount++;
      } else if (hasWarning) {
        status = "degraded";
        statusMessage = "High response latency detected";
      }

      // Extract latency metric if available in alarm reason
      let averageLatencyMs = null;
      const latencyAlarm = svcAlarms.find((a) => a.AlarmName.includes("Latency"));
      if (latencyAlarm && latencyAlarm.StateReason) {
        const match = latencyAlarm.StateReason.match(/\[([0-9.]+)\s*\(/);
        if (match && match[1]) {
          averageLatencyMs = Math.round(parseFloat(match[1]));
        }
      }

      return {
        id: svc.id,
        name: svc.name,
        category: svc.category,
        endpoint: svc.endpoint,
        description: svc.description,
        status,
        statusMessage,
        canaryName: svc.canary,
        alarmsCount: svcAlarms.length,
        averageLatencyMs,
        lastEvaluated: svcAlarms[0]?.StateUpdatedTimestamp || new Date(),
      };
    });

    // 5. Add Internal Infrastructure components
    const internalServices = [
      {
        id: "mongodb",
        name: "MongoDB Atlas Cluster",
        category: "Database",
        endpoint: "Primary Replica Set",
        description: "Primary cloud database for user accounts, products, and orders",
        status: mongoStatus === "healthy" ? "operational" : "outage",
        statusMessage: mongoStatus === "healthy" ? "Connected (read/write active)" : "Disconnected",
        lastEvaluated: new Date(),
      },
      {
        id: "redis",
        name: "In-Memory Redis Cache",
        category: "Cache",
        endpoint: "127.0.0.1:6379",
        description: "In-memory caching layer for fast API response and rate limiting",
        status: redisStatus === "healthy" ? "operational" : "degraded",
        statusMessage: redisStatus === "healthy" ? "Connected & Ready" : "Disconnected (cache pass-through)",
        lastEvaluated: new Date(),
      },
    ];

    const allServices = [...services, ...internalServices];

    // 6. Calculate System Overall Status
    let overallStatus = "operational";
    let overallMessage = "All Systems Fully Operational";

    if (allServices.some((s) => s.status === "outage")) {
      overallStatus = "outage";
      overallMessage = "Service Outage Detected";
    } else if (allServices.some((s) => s.status === "degraded")) {
      overallStatus = "degraded";
      overallMessage = "Partial Service Degradation";
    }

    const payload = {
      overallStatus,
      overallMessage,
      timestamp: new Date().toISOString(),
      region: REGION,
      metricsSource: alarms.length > 0 ? "AWS CloudWatch Synthetics" : "Direct Internal Telemetry",
      cloudwatchAlarmsTotal: alarms.length,
      activeIncidents: activeIncidentCount,
      services: allServices,
    };

    // Cache in Redis for 30s
    await setCache("health:status", payload, 30);

    return res.status(200).json(payload);
  } catch (error) {
    console.error("[HEALTH] Error generating health report:", error);
    return res.status(500).json({
      overallStatus: "degraded",
      overallMessage: "Unable to compile full health metrics",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * GET /api/health/chart?type=uptime|latency|errors&hours=3
 * Returns rendered CloudWatch PNG metric widget image
 */
const getMetricChart = async (req, res) => {
  try {
    if (!cwClient) {
      return res.status(503).send("CloudWatch client not configured");
    }

    const type = req.query.type || "uptime";
    const hours = parseInt(req.query.hours || "3", 10);
    const startRange = `-PT${Math.min(Math.max(hours, 1), 24)}H`;

    const cacheKey = `health:chart:${type}:${hours}`;
    const cachedBase64 = await getCache(cacheKey);
    if (cachedBase64) {
      const imgBuffer = Buffer.from(cachedBase64, "base64");
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=60");
      return res.send(imgBuffer);
    }

    const canaries = [
      { name: "ks-frontend-check", label: "Frontend Web", color: "#10b981" },
      { name: "ks-schemes-check", label: "Schemes API", color: "#3b82f6" },
      { name: "ks-weather-check", label: "Weather API", color: "#f59e0b" },
      { name: "ks-market-check", label: "Market Prices", color: "#06b6d4" },
      { name: "ks-products-check", label: "Products Catalog", color: "#8b5cf6" },
      { name: "ks-shops-check", label: "Seller Shops", color: "#ec4899" },
    ];

    let widgetConfig = {};

    if (type === "latency") {
      widgetConfig = {
        title: "Canary Latency & Response Duration (ms)",
        view: "timeSeries",
        stacked: false,
        theme: "light",
        width: 800,
        height: 340,
        start: startRange,
        end: "P0D",
        period: 300,
        stat: "Average",
        yAxis: {
          left: { label: "Milliseconds", min: 0 },
        },
        metrics: canaries.map((c) => [
          "CloudWatchSynthetics",
          "Duration",
          "CanaryName",
          c.name,
          { label: c.label, color: c.color },
        ]),
      };
    } else if (type === "errors") {
      widgetConfig = {
        title: "Canary Failure & Fault Count",
        view: "timeSeries",
        stacked: false,
        theme: "light",
        width: 800,
        height: 340,
        start: startRange,
        end: "P0D",
        period: 300,
        stat: "Sum",
        yAxis: {
          left: { label: "Failed Executions", min: 0 },
        },
        metrics: canaries.map((c) => [
          "CloudWatchSynthetics",
          "Failed",
          "CanaryName",
          c.name,
          { label: `${c.label} Failures`, color: c.color },
        ]),
      };
    } else {
      // Default: Uptime / SuccessPercent
      widgetConfig = {
        title: "Canary Success Rate (%)",
        view: "timeSeries",
        stacked: false,
        theme: "light",
        width: 800,
        height: 340,
        start: startRange,
        end: "P0D",
        period: 300,
        stat: "Average",
        yAxis: {
          left: { label: "Percent", min: 0, max: 100 },
        },
        metrics: canaries.map((c) => [
          "CloudWatchSynthetics",
          "SuccessPercent",
          "CanaryName",
          c.name,
          { label: c.label, color: c.color },
        ]),
      };
    }

    const cmd = new GetMetricWidgetImageCommand({
      MetricWidget: JSON.stringify(widgetConfig),
      OutputFormat: "png",
    });

    const resp = await cwClient.send(cmd);
    if (!resp.MetricWidgetImage) {
      return res.status(500).send("No image generated");
    }

    const imageBuffer = Buffer.from(resp.MetricWidgetImage);

    // Cache base64 in Redis for 60s
    await setCache(cacheKey, imageBuffer.toString("base64"), 60);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.send(imageBuffer);
  } catch (err) {
    console.error("[HEALTH] Error generating metric chart:", err.message);
    return res.status(500).send("Failed to render metric chart");
  }
};

module.exports = {
  getHealthStatus,
  getMetricChart,
};
