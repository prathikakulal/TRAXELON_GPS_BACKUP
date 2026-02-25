/**
 * useAccurateLocation
 * ---------------------------------------------------------------
 * GPS-only location hook. NO IP geolocation.
 * Auto-runs on mount using navigator.geolocation.getCurrentPosition.
 * Reverse-geocodes coordinates via OpenStreetMap Nominatim (free, HTTPS).
 *
 * Returns: { location, loading, error, permissionDenied, retry }
 */

import { useState, useCallback } from "react";

// ─── Reverse geocode: GPS coords → full address ────────────────────────────

async function reverseGeocode(lat, lon) {
    const url =
        `https://nominatim.openstreetmap.org/reverse` +
        `?lat=${lat}&lon=${lon}&format=json&addressdetails=1&zoom=18&accept-language=en`;

    const res = await fetch(url, {
        headers: {
            "User-Agent": "Traxalon/1.0",
            "Accept": "application/json",
        },
    });

    if (!res.ok) throw new Error("Reverse geocode request failed");

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

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useAccurateLocation() {
    const [location, setLocation] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [permissionDenied, setDenied] = useState(false);

    const run = useCallback(() => {
        if (!navigator?.geolocation) {
            setError("Your browser does not support location access.");
            return;
        }

        // Reset
        setLoading(true);
        setError(null);
        setLocation(null);
        setDenied(false);

        navigator.geolocation.getCurrentPosition(
            // ── SUCCESS ─────────────────────────────────────────────────────────
            async (pos) => {
                const { latitude: lat, longitude: lon, accuracy } = pos.coords;

                try {
                    const address = await reverseGeocode(lat, lon);
                    setLocation({ lat, lon, accuracy: Math.round(accuracy), ...address });
                } catch {
                    // GPS worked but address lookup failed — still show coordinates
                    setLocation({
                        lat, lon, accuracy: Math.round(accuracy),
                        fullAddress: null, houseNumber: null, road: null,
                        suburb: null, city: null, district: null,
                        state: null, pincode: null, country: null, countryCode: null,
                    });
                    setError("Got GPS fix but address lookup failed. Check your internet.");
                }

                setLoading(false);
            },

            // ── ERROR ────────────────────────────────────────────────────────────
            (err) => {
                setLoading(false);
                if (err.code === 1) {
                    setDenied(true);
                    setError("Location permission was denied.");
                } else if (err.code === 3) {
                    setError("GPS timed out — move to an open area and retry.");
                } else {
                    setError("Could not get device location. Make sure GPS is on.");
                }
            },

            // ── GPS OPTIONS ──────────────────────────────────────────────────────
            {
                enableHighAccuracy: true,  // real GPS chip, not WiFi/IP
                timeout: 15000, // 15 s
                maximumAge: 0,     // always fresh
            }
        );
    }, []);

    return { location, loading, error, permissionDenied, retry: run };
}

export default useAccurateLocation;
