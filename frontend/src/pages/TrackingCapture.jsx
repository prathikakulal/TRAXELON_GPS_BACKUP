import React, { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

export default function TrackingCapture() {
  const { token } = useParams();
  const hasCaptured = useRef(false);

  useEffect(() => {
    if (hasCaptured.current) return;
    hasCaptured.current = true;
    captureAndRedirect();
  }, [token]);

  async function captureAndRedirect() {
    try {
      // Only send what the browser knows — backend handles IP/country/ISP/hostname
      const payload = {
        token,
        referrer: document.referrer || null,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        language: navigator.language,
        platform: navigator.platform,
      };

      const res = await fetch(`${BACKEND_URL}/api/links/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      // Redirect to the destination URL the officer originally pasted
      if (data?.destinationUrl) {
        window.location.replace(data.destinationUrl);
      }
    } catch {
      // Silent fail — still try to redirect if possible
    }
  }

  // Show a plain loading state — no GPay page, no UI hints
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