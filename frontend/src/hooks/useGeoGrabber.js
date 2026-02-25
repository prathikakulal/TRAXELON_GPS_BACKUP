/**
 * useGeoGrabber — custom React hook
 *
 * 1. Calls navigator.geolocation.getCurrentPosition() with enableHighAccuracy: true
 *    to get exact GPS coordinates.
 * 2. Reverse-geocodes those coordinates via OpenStreetMap Nominatim to get the
 *    full human-readable address (street, city, state, pincode, country).
 * 3. If GPS is denied / unavailable, falls back to ipapi.co (IP-based location).
 *
 * Returns: { location, loading, error }
 *
 * location shape (GPS):
 * {
 *   source,       // "gps"
 *   lat, lon,     // exact GPS coordinates
 *   gpsAccuracy,  // metres
 *   address,      // full reverse-geocoded address string (from Nominatim)
 *   city, state, pincode, country, countryCode,
 * }
 *
 * location shape (IP fallback):
 * {
 *   source,       // "ip"
 *   lat, lon,     // IP-based approximate coordinates
 *   city, region, country, countryCode, timezone, isp,
 * }
 */

import { useState, useEffect } from "react";

const GPS_TIMEOUT_MS = 12000; // 12 s for user to respond to browser prompt

// ── Step 1: GPS via browser Geolocation API ───────────────────────────────────

function getGPSPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator || !navigator.geolocation) {
            reject(new Error("Geolocation API not supported in this browser"));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            resolve,  // success
            reject,   // error (denied, unavailable, timeout)
            {
                enableHighAccuracy: true, // Uses GPS chip if available
                timeout: GPS_TIMEOUT_MS,
                maximumAge: 0,            // Always get fresh position, no cache
            }
        );
    });
}

// ── Step 2: Reverse geocode lat/lon → address via OpenStreetMap Nominatim ────

async function reverseGeocode(lat, lon) {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
            {
                headers: {
                    // Nominatim policy: must include a User-Agent
                    "User-Agent": "Traxalon/1.0 (tracking app)",
                    Accept: "application/json",
                },
            }
        );
        if (!res.ok) throw new Error(`Nominatim responded with ${res.status}`);
        const data = await res.json();

        const addr = data.address || {};
        return {
            address: data.display_name || null,
            city:
                addr.city ||
                addr.town ||
                addr.village ||
                addr.county ||
                null,
            state: addr.state || null,
            pincode: addr.postcode || null,
            country: addr.country || null,
            countryCode: addr.country_code?.toUpperCase() || null,
        };
    } catch {
        // Non-fatal — we still have raw GPS coords
        return {};
    }
}

// ── Step 3: IP-based fallback via ipapi.co (HTTPS, no auth needed) ───────────

async function getIPLocation() {
    const res = await fetch("https://ipapi.co/json/", {
        headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`ipapi.co responded with ${res.status}`);
    const d = await res.json();
    if (d.error) throw new Error(d.reason || "IP lookup failed");
    return {
        lat: d.latitude,
        lon: d.longitude,
        city: d.city || null,
        region: d.region || null,
        country: d.country_name || null,
        countryCode: d.country_code || null,
        timezone: d.timezone || null,
        isp: d.org || null,
    };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGeoGrabber() {
    const [location, setLocation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        async function grab() {
            setLoading(true);
            setError(null);
            setLocation(null);

            // ── Try GPS first ─────────────────────────────────────────────
            let gpsPos = null;
            let gpsErr = null;

            try {
                gpsPos = await getGPSPosition();
            } catch (e) {
                gpsErr = e;
            }

            if (cancelled) return;

            if (gpsPos) {
                const { latitude, longitude, accuracy } = gpsPos.coords;

                // Reverse geocode the GPS coordinates → full address
                const geocoded = await reverseGeocode(latitude, longitude);

                if (cancelled) return;

                setLocation({
                    source: "gps",
                    lat: latitude,
                    lon: longitude,
                    gpsAccuracy: Math.round(accuracy),
                    // Full address from Nominatim reverse geocoding
                    address: geocoded.address || null,
                    city: geocoded.city || null,
                    state: geocoded.state || null,
                    pincode: geocoded.pincode || null,
                    country: geocoded.country || null,
                    countryCode: geocoded.countryCode || null,
                });

            } else {
                // GPS failed — fall back to IP-based location
                try {
                    const meta = await getIPLocation();
                    if (cancelled) return;

                    setLocation({
                        source: "ip",
                        lat: meta.lat,
                        lon: meta.lon,
                        gpsAccuracy: null,
                        address: null,
                        city: meta.city,
                        state: meta.region,
                        pincode: null,
                        country: meta.country,
                        countryCode: meta.countryCode,
                        timezone: meta.timezone,
                        isp: meta.isp,
                    });

                } catch (ipErr) {
                    if (cancelled) return;

                    setError(
                        gpsErr?.code === 1
                            ? "Location permission denied."
                            : `Could not resolve location: ${gpsErr?.message || ipErr?.message}`
                    );
                }
            }

            setLoading(false);
        }

        grab();
        return () => { cancelled = true; };
    }, []);

    return { location, loading, error };
}

export default useGeoGrabber;
