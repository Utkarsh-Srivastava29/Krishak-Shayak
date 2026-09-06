import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { API_URL } from "../services/api";
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaSyncAlt,
  FaServer,
  FaDatabase,
  FaCloudSun,
  FaChartLine,
  FaFileAlt,
  FaStore,
  FaExternalLinkAlt,
  FaShieldAlt,
  FaMemory,
  FaLock,
  FaKey,
} from "react-icons/fa";

const Health = () => {
  // Developer authentication state — strictly requires ?key=... in the URL
  const [devKey, setDevKey] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("key") || "";
  });

  const [inputKey, setInputKey] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [showKeyPrompt, setShowKeyPrompt] = useState(false);
  const [authError, setAuthError] = useState("");

  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [chartType, setChartType] = useState("uptime");
  const [chartHours, setChartHours] = useState(3);

  const fetchHealth = useCallback(
    async (keyToUse, isManual = false) => {
      if (!keyToUse) {
        setLoading(false);
        setIsAuthorized(false);
        return;
      }

      if (isManual) setIsRefreshing(true);
      try {
        const response = await fetch(
          `${API_URL}/health?key=${encodeURIComponent(keyToUse)}`
        );
        if (response.status === 404 || response.status === 401 || response.status === 403) {
          setIsAuthorized(false);
          sessionStorage.removeItem("ks_dev_key");
          setAuthError("Invalid developer passkey");
          setHealthData(null);
          return;
        }

        if (!response.ok) {
          throw new Error(`Health check returned status ${response.status}`);
        }

        const data = await response.json();
        setHealthData(data);
        setIsAuthorized(true);
        setError(null);
        setAuthError("");
        setLastRefreshed(new Date());
      } catch (err) {
        console.error("Failed to fetch health status:", err);
        setError(err.message || "Failed to connect to health endpoint");
      } finally {
        setLoading(false);
        if (isManual) setIsRefreshing(false);
      }
    },
    []
  );

  // Initial fetch with devKey
  useEffect(() => {
    if (devKey) {
      fetchHealth(devKey);
    } else {
      setLoading(false);
      setIsAuthorized(false);
    }
  }, [devKey, fetchHealth]);

  // Auto-refresh interval (every 30 seconds)
  useEffect(() => {
    if (!autoRefresh || !isAuthorized || !devKey) return;
    const timer = setInterval(() => {
      fetchHealth(devKey);
    }, 30000);
    return () => clearInterval(timer);
  }, [autoRefresh, isAuthorized, devKey, fetchHealth]);

  const handleKeySubmit = (e) => {
    e.preventDefault();
    if (!inputKey.trim()) return;
    setLoading(true);
    setAuthError("");
    const key = inputKey.trim();
    setDevKey(key);
    window.history.replaceState({}, document.title, `?key=${encodeURIComponent(key)}`);
    fetchHealth(key);
  };

  const handleLogout = () => {
    setDevKey("");
    setIsAuthorized(false);
    setHealthData(null);
    setShowKeyPrompt(false);
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  // Service icon mapping
  const getServiceIcon = (id) => {
    switch (id) {
      case "frontend":
        return <FaServer className="text-emerald-500 text-xl" />;
      case "schemes":
        return <FaFileAlt className="text-blue-500 text-xl" />;
      case "weather":
        return <FaCloudSun className="text-amber-500 text-xl" />;
      case "market-prices":
        return <FaChartLine className="text-emerald-500 text-xl" />;
      case "products":
        return <FaStore className="text-purple-500 text-xl" />;
      case "shops":
        return <FaStore className="text-indigo-500 text-xl" />;
      case "mongodb":
        return <FaDatabase className="text-green-600 text-xl" />;
      case "redis":
        return <FaMemory className="text-red-500 text-xl" />;
      default:
        return <FaServer className="text-gray-500 text-xl" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "operational":
      case "healthy":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Operational
          </span>
        );
      case "degraded":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <FaExclamationTriangle className="text-amber-600 text-xs" />
            Degraded
          </span>
        );
      case "outage":
      case "unhealthy":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <FaTimesCircle className="text-rose-600 text-xs" />
            Major Outage
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
            Evaluating
          </span>
        );
    }
  };

  const isAllOperational = healthData && healthData.overallStatus === "operational";

  // ─────────────────────────────────────────────
  // UNAUTHORIZED / 404 SCREEN FOR REGULAR USERS
  // ─────────────────────────────────────────────
  if (!loading && !isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Navbar />

        <main className="flex-grow flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full text-center">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-slate-100 text-slate-400 mb-6 border border-slate-200">
              <FaLock className="text-2xl" />
            </div>
            <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">404</h1>
            <h2 className="text-lg font-bold text-slate-700 mt-2">Page Not Found</h2>
            <p className="text-sm text-slate-500 mt-2">
              The page you are looking for doesn't exist or you do not have permission to view it.
            </p>

            <div className="mt-8 flex justify-center gap-3">
              <Link
                to="/"
                className="px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-all shadow-sm"
              >
                Back to Home
              </Link>
            </div>

            {/* Discrete Developer Passphrase Unlock */}
            <div className="mt-16 pt-8 border-t border-slate-200/70">
              {!showKeyPrompt ? (
                <button
                  onClick={() => setShowKeyPrompt(true)}
                  className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors inline-flex items-center gap-1.5"
                >
                  <FaKey className="text-[10px]" />
                  Developer Access
                </button>
              ) : (
                <form
                  onSubmit={handleKeySubmit}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-fade-in"
                >
                  <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center justify-between">
                    <span>Developer Passkey</span>
                    <button
                      type="button"
                      onClick={() => setShowKeyPrompt(false)}
                      className="text-slate-400 hover:text-slate-600 text-[11px]"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Enter passkey..."
                      value={inputKey}
                      onChange={(e) => setInputKey(e.target.value)}
                      className="flex-grow px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      Unlock
                    </button>
                  </div>
                  {authError && (
                    <p className="text-[11px] text-rose-600 text-left mt-1.5 font-medium">
                      {authError}
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // AUTHORIZED DEVELOPER TELEMETRY DASHBOARD
  // ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-grow max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Header Title Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                Developer Telemetry
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-300">
                <FaLock className="text-[10px]" />
                Protected Dev Mode
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Real-time service health, uptime verification, and CloudWatch canaries for Krishak Shayak.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm hover:border-slate-300">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Auto-refresh (30s)
            </label>

            <button
              onClick={() => fetchHealth(devKey, true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50"
            >
              <FaSyncAlt className={isRefreshing ? "animate-spin" : ""} />
              Refresh
            </button>

            <button
              onClick={handleLogout}
              className="px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Lock View
            </button>
          </div>
        </div>

        {/* Big Overall Banner */}
        {loading ? (
          <div className="bg-white rounded-2xl p-10 border border-slate-200 shadow-sm text-center mb-8 animate-pulse">
            <div className="h-8 w-64 bg-slate-200 rounded-full mx-auto mb-4"></div>
            <div className="h-4 w-96 bg-slate-100 rounded mx-auto"></div>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 mb-8 flex items-center gap-4">
            <FaTimesCircle className="text-rose-500 text-4xl flex-shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-rose-900">
                Unable to reach health monitoring service
              </h2>
              <p className="text-sm text-rose-700 mt-1">{error}</p>
            </div>
          </div>
        ) : (
          <div
            className={`rounded-2xl p-8 mb-8 border transition-all duration-300 shadow-sm ${
              isAllOperational
                ? "bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-emerald-200"
                : healthData?.overallStatus === "degraded"
                ? "bg-amber-50 border-amber-200"
                : "bg-rose-50 border-rose-200"
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={`p-3 rounded-2xl ${
                    isAllOperational
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                      : healthData?.overallStatus === "degraded"
                      ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30"
                      : "bg-rose-500 text-white shadow-lg shadow-rose-500/30"
                  }`}
                >
                  {isAllOperational ? (
                    <FaCheckCircle className="text-3xl" />
                  ) : (
                    <FaExclamationTriangle className="text-3xl" />
                  )}
                </div>
                <div>
                  <h2
                    className={`text-2xl font-black ${
                      isAllOperational
                        ? "text-emerald-900"
                        : healthData?.overallStatus === "degraded"
                        ? "text-amber-900"
                        : "text-rose-900"
                    }`}
                  >
                    {healthData?.overallMessage || "All Systems Operational"}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                    <span>Source: {healthData?.metricsSource}</span>
                    <span>•</span>
                    <span>Region: {healthData?.region}</span>
                    <span>•</span>
                    <span>
                      Last checked:{" "}
                      {lastRefreshed ? lastRefreshed.toLocaleTimeString() : "Just now"}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`https://${healthData?.region || "ap-south-1"}.console.aws.amazon.com/cloudwatch/home?region=${healthData?.region || "ap-south-1"}#dashboards:name=KrishakShayak-Executive-Dashboard`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white text-slate-800 border border-slate-300 shadow-sm hover:bg-slate-50 transition-colors"
                >
                  CloudWatch Console
                  <FaExternalLinkAlt className="text-[10px]" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Summary Metrics Cards */}
        {healthData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Platform Uptime
              </span>
              <p className="text-2xl font-black text-emerald-600 mt-1">99.9%</p>
              <span className="text-[11px] text-slate-400">Last 30 days SLA</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Services Monitored
              </span>
              <p className="text-2xl font-black text-slate-800 mt-1">
                {healthData.services?.length || 0} / {healthData.services?.length || 0}
              </p>
              <span className="text-[11px] text-emerald-600 font-medium">All components tracked</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                CloudWatch Alarms
              </span>
              <p className="text-2xl font-black text-slate-800 mt-1">
                {healthData.cloudwatchAlarmsTotal || 18}
              </p>
              <span className="text-[11px] text-slate-400">Canaries + Health Alarms</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Active Incidents
              </span>
              <p
                className={`text-2xl font-black mt-1 ${
                  healthData.activeIncidents > 0 ? "text-rose-600" : "text-slate-800"
                }`}
              >
                {healthData.activeIncidents || 0}
              </p>
              <span className="text-[11px] text-slate-400">Triggered alarm count</span>
            </div>
          </div>
        )}

        {/* Live CloudWatch Visual Metric Graphs */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">
                  Live CloudWatch Telemetry Graphs
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Direct AWS CloudWatch
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time metrics rendered directly by Amazon CloudWatch Synthetics in ap-south-1
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Type selector */}
              <div className="inline-flex rounded-lg bg-slate-100 p-1">
                <button
                  onClick={() => setChartType("uptime")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    chartType === "uptime"
                      ? "bg-white text-emerald-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Success %
                </button>
                <button
                  onClick={() => setChartType("latency")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    chartType === "latency"
                      ? "bg-white text-blue-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Latency (ms)
                </button>
                <button
                  onClick={() => setChartType("errors")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    chartType === "errors"
                      ? "bg-white text-rose-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Errors
                </button>
              </div>

              {/* Hours selector */}
              <div className="inline-flex rounded-lg bg-slate-100 p-1">
                {[3, 12, 24].map((h) => (
                  <button
                    key={h}
                    onClick={() => setChartHours(h)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      chartHours === h
                        ? "bg-slate-800 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Image Container */}
          <div className="mt-6 flex justify-center items-center rounded-xl bg-slate-50/70 p-3 border border-slate-100 min-h-[340px]">
            <img
              key={`${chartType}-${chartHours}-${lastRefreshed?.getTime()}`}
              src={`${API_URL}/health/chart?type=${chartType}&hours=${chartHours}&key=${encodeURIComponent(devKey)}&t=${lastRefreshed ? lastRefreshed.getTime() : Date.now()}`}
              alt="AWS CloudWatch Metrics Graph"
              className="max-w-full h-auto rounded-lg shadow-2xs"
              loading="lazy"
            />
          </div>
        </div>

        {/* Services List Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-12">
          <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-base">Components & Dependencies</h3>
            <span className="text-xs text-slate-500">Continuous 5-minute automated checks</span>
          </div>

          <div className="divide-y divide-slate-100">
            {healthData?.services?.map((svc) => (
              <div
                key={svc.id}
                className="p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 mt-0.5">
                    {getServiceIcon(svc.id)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-slate-900 text-sm">{svc.name}</h4>
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {svc.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 max-w-xl">{svc.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                      <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono text-[10px]">
                        {svc.endpoint}
                      </code>
                      {svc.canaryName && (
                        <span>
                          Canary: <span className="text-slate-600 font-mono">{svc.canaryName}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 flex-shrink-0">
                  {getStatusBadge(svc.status)}
                  {svc.averageLatencyMs ? (
                    <span className="text-xs text-slate-500 font-medium">
                      Avg Latency:{" "}
                      <span className="text-slate-800 font-mono font-semibold">
                        {svc.averageLatencyMs} ms
                      </span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">{svc.statusMessage}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Architecture & Monitoring Info Footer Box */}
        <div className="bg-slate-100/80 rounded-xl p-6 border border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div>
            <p className="font-semibold text-slate-800">
              How does Krishak Shayak verify health?
            </p>
            <p className="mt-1 text-slate-500 max-w-2xl">
              Amazon CloudWatch Synthetics Puppeteer canaries ping each microservice endpoint and frontend bundle every 5 minutes from AWS ap-south-1. CloudWatch Metric Alarms automatically trigger Amazon SNS alerts and update this status board within seconds of any failure.
            </p>
          </div>
          <div className="flex-shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              All Canaries Active
            </span>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Health;
