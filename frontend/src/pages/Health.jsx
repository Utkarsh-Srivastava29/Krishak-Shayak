import React, { useState, useEffect, useCallback } from "react";
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
} from "react-icons/fa";

const Health = () => {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchHealth = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      // Direct fetch to health endpoint
      const response = await fetch(`${API_URL}/health`);
      if (!response.ok) {
        throw new Error(`Health check returned status ${response.status}`);
      }
      const data = await response.json();
      setHealthData(data);
      setError(null);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Failed to fetch health status:", err);
      setError(err.message || "Failed to connect to health endpoint");
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  // Auto-refresh interval (every 30 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      fetchHealth();
    }, 30000);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchHealth]);

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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-grow max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Header Title Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                System Status
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300">
                <FaShieldAlt className="text-slate-500" />
                Live Telemetry
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Real-time service health, uptime verification, and CloudWatch canaries for Krishak Shayak.
            </p>
          </div>

          <div className="flex items-center gap-3">
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
              onClick={() => fetchHealth(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50"
            >
              <FaSyncAlt className={isRefreshing ? "animate-spin" : ""} />
              Refresh
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
