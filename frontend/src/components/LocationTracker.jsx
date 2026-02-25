/**
 * LocationTracker — GPS + Reverse Geocoding
 * GPS fires ONLY on button click (required by browsers for permission prompt).
 */

import React, { useState } from "react";

// ─── Reverse geocode ────────────────────────────────────────────────────────

async function reverseGeocode(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&zoom=18&accept-language=en`;
    const res = await fetch(url, {
        headers: { "User-Agent": "Traxalon/1.0", Accept: "application/json" },
    });
    if (!res.ok) throw new Error("Geocode failed");
    const d = await res.json();
    const a = d.address || {};
    return {
        fullAddress: d.display_name || null,
        houseNumber: a.house_number || null,
        road: a.road || a.pedestrian || a.path || null,
        suburb: a.suburb || a.neighbourhood || null,
        city: a.city || a.town || a.village || a.county || null,
        district: a.state_district || a.district || null,
        state: a.state || null,
        pincode: a.postcode || null,
        country: a.country || null,
        countryCode: (a.country_code || "").toUpperCase() || null,
    };
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function LocationTracker() {
    const [status, setStatus] = useState("idle");   // idle | loading | success | error
    const [location, setLocation] = useState(null);
    const [errorMsg, setErrorMsg] = useState("");

    // Called ONLY on button click — this is what shows the browser permission dialog
    function handleGetLocation() {
        if (!navigator.geolocation) {
            setErrorMsg("Your browser does not support GPS location.");
            setStatus("error");
            return;
        }

        setStatus("loading");
        setErrorMsg("");
        setLocation(null);

        navigator.geolocation.getCurrentPosition(
            // ── Success ────────────────────────────────────────────────────────
            async (pos) => {
                const { latitude: lat, longitude: lon, accuracy } = pos.coords;
                try {
                    const addr = await reverseGeocode(lat, lon);
                    setLocation({ lat, lon, accuracy: Math.round(accuracy), ...addr });
                    setStatus("success");
                } catch {
                    // GPS worked, geocoding failed — still show raw coordinates
                    setLocation({ lat, lon, accuracy: Math.round(accuracy) });
                    setErrorMsg("Address lookup failed — showing raw GPS only.");
                    setStatus("success");
                }
            },
            // ── Error ──────────────────────────────────────────────────────────
            (err) => {
                setStatus("error");
                if (err.code === 1) {
                    setErrorMsg(
                        "Permission denied. Click the 🔒 lock icon in your address bar → Site settings → Location → Allow. Then click the button again."
                    );
                } else if (err.code === 3) {
                    setErrorMsg("GPS timed out. Go outdoors or enable high-accuracy location and try again.");
                } else {
                    setErrorMsg("Could not get location. Make sure GPS / Location Services are on.");
                }
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    }

    const mapUrl = location
        ? `https://www.google.com/maps?q=${location.lat},${location.lon}`
        : null;

    return (
        <div style={styles.page}>
            <style>{`@keyframes _spin{to{transform:rotate(360deg)}}`}</style>
            <div style={styles.card}>

                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 26 }}>📍</span>
                    <h2 style={styles.title}>GPS Location</h2>
                    {status === "success" && <span style={styles.gpsBadge}>📡 GPS</span>}
                </div>
                <p style={styles.sub}>Device GPS · No IP tracking · Reverse geocoded</p>

                {/* ── IDLE — show button ── */}
                {status === "idle" && (
                    <div style={{ textAlign: "center", paddingTop: 8 }}>
                        <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 20 }}>
                            Click the button below — your browser will ask for permission to access your location.
                        </p>
                        <button style={styles.btn} onClick={handleGetLocation}>
                            🎯 Get My Real Location
                        </button>
                    </div>
                )}

                {/* ── LOADING ── */}
                {status === "loading" && (
                    <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
                        <div style={styles.spinner} />
                        <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 6px" }}>
                            Waiting for GPS fix…
                        </p>
                        <p style={{ color: "#475569", fontSize: 12, margin: 0 }}>
                            If a permission popup appeared, click <strong style={{ color: "#818cf8" }}>Allow</strong>
                        </p>
                    </div>
                )}

                {/* ── ERROR ── */}
                {status === "error" && (
                    <>
                        <div style={styles.errBox}>⚠ {errorMsg}</div>
                        <button style={styles.btn} onClick={handleGetLocation}>↺ Try Again</button>
                    </>
                )}

                {/* ── SUCCESS ── */}
                {status === "success" && location && (
                    <>
                        {/* Accuracy badge */}
                        {location.accuracy != null && (
                            <div style={styles.accBadge}>✅ Accurate to ±{location.accuracy} m</div>
                        )}

                        {/* Address string */}
                        {location.fullAddress && (
                            <div style={styles.addrBox}>📌 {location.fullAddress}</div>
                        )}

                        {/* If geocoding failed, show error note */}
                        {errorMsg && <div style={styles.errBox}>⚠ {errorMsg}</div>}

                        {/* Coordinates */}
                        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                            <Chip label="Latitude" value={location.lat.toFixed(6)} />
                            <Chip label="Longitude" value={location.lon.toFixed(6)} />
                        </div>

                        {/* Address breakdown */}
                        <Row label="Road / Street" value={[location.houseNumber, location.road].filter(Boolean).join(" ")} />
                        <Row label="Area" value={location.suburb} />
                        <Row label="City" value={location.city} />
                        <Row label="District" value={location.district} />
                        <Row label="State" value={location.state} />
                        <Row label="Pincode" value={location.pincode} />
                        <Row label="Country" value={
                            location.country && location.countryCode
                                ? `${location.country} (${location.countryCode})`
                                : location.country
                        } />

                        {/* Google Maps */}
                        <a href={mapUrl} target="_blank" rel="noopener noreferrer" style={styles.mapLink}>
                            🗺 Open in Google Maps
                        </a>

                        <button style={{ ...styles.btn, marginTop: 20 }} onClick={handleGetLocation}>
                            ↺ Refresh Location
                        </button>
                    </>
                )}

            </div>
        </div>
    );
}

/* ── Row & Chip helpers ─────────────────────────────────────────────────── */
function Row({ label, value }) {
    if (!value) return null;
    return (
        <div style={{
            display: "flex", justifyContent: "space-between",
            padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.05)"
        }}>
            <span style={{
                fontSize: 11, color: "#64748b", textTransform: "uppercase",
                letterSpacing: "0.06em", fontWeight: 600
            }}>{label}</span>
            <span style={{
                fontSize: 14, color: "#cbd5e1", fontWeight: 500,
                textAlign: "right", maxWidth: "65%", wordBreak: "break-word"
            }}>{value}</span>
        </div>
    );
}
function Chip({ label, value }) {
    return (
        <div style={{
            flex: 1, background: "rgba(15,23,42,1)", border: "1px solid rgba(99,102,241,0.2)",
            borderRadius: 10, padding: "10px 14px", textAlign: "center"
        }}>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {label}
            </div>
            <div style={{
                fontSize: 14, fontWeight: 700, fontFamily: "monospace",
                color: "#818cf8", marginTop: 3
            }}>{value}</div>
        </div>
    );
}

/* ── Styles ─────────────────────────────────────────────────────────────── */
const styles = {
    page: {
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(160deg,#060d1f 0%,#0f172a 60%,#0d1f12 100%)",
        padding: "24px 16px", fontFamily: "'Inter','Segoe UI',sans-serif",
    },
    card: {
        background: "rgba(15,23,42,0.97)", border: "1px solid rgba(99,102,241,0.25)",
        borderRadius: 20, padding: "32px 36px", maxWidth: 500, width: "100%",
        boxShadow: "0 30px 80px rgba(0,0,0,0.5)", boxSizing: "border-box", color: "#e2e8f0",
    },
    title: { fontSize: 20, fontWeight: 800, color: "#f8fafc", margin: 0, flex: 1 },
    sub: { fontSize: 12, color: "#475569", marginBottom: 24, marginTop: 2 },
    gpsBadge: {
        fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
        background: "rgba(16,185,129,0.15)", color: "#34d399",
        border: "1px solid rgba(52,211,153,0.2)",
    },
    accBadge: {
        display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 20,
        background: "rgba(16,185,129,0.1)", color: "#34d399",
        border: "1px solid rgba(52,211,153,0.2)", marginBottom: 14,
    },
    addrBox: {
        background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.18)",
        borderRadius: 12, padding: "13px 16px", marginBottom: 16,
        fontSize: 13, color: "#a5b4fc", lineHeight: 1.65,
    },
    errBox: {
        background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)",
        borderRadius: 12, padding: "14px 18px", color: "#fca5a5",
        fontSize: 13, lineHeight: 1.65, marginBottom: 14,
    },
    btn: {
        width: "100%", padding: "13px 0", borderRadius: 12,
        background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
        color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer",
    },
    mapLink: {
        display: "block", textAlign: "center", margin: "16px auto 0",
        fontSize: 13, color: "#818cf8",
        textDecoration: "none", borderBottom: "1px dashed rgba(129,140,248,0.3)",
        width: "fit-content",
    },
    spinner: {
        width: 36, height: 36, margin: "0 auto 16px",
        border: "3px solid rgba(99,102,241,0.15)", borderTop: "3px solid #818cf8",
        borderRadius: "50%", animation: "_spin .9s linear infinite",
    },
};
