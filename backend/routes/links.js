import express from "express";
import axios from "axios";
import {
    createTrackingLink,
    recordCapture,
    addCredits,
} from "../utils/linkService.js";

const router = express.Router();

// ─── Helpers: parse browser/OS/device from User-Agent ────────

function parseBrowser(ua = "") {
    if (/Edg\//i.test(ua)) return "Edge";
    if (/OPR|Opera/i.test(ua)) return "Opera";
    if (/YaBrowser/i.test(ua)) return "Yandex";
    if (/SamsungBrowser/i.test(ua)) return "Samsung Browser";
    if (/Chrome/i.test(ua)) return "Chrome";
    if (/Firefox/i.test(ua)) return "Firefox";
    if (/Safari/i.test(ua)) return "Safari";
    return "Unknown";
}

function parseOS(ua = "") {
    if (/Windows NT 10\.0/i.test(ua)) return "Windows 10/11";
    if (/Windows NT 6\.3/i.test(ua)) return "Windows 8.1";
    if (/Windows NT 6\.1/i.test(ua)) return "Windows 7";
    if (/Windows/i.test(ua)) return "Windows";
    if (/Android (\d+[\.\d]*)/i.test(ua)) return `Android ${ua.match(/Android ([\d.]+)/i)?.[1] || ""}`;
    if (/iPhone OS ([\d_]+)/i.test(ua)) return `iOS ${ua.match(/iPhone OS ([\d_]+)/i)?.[1]?.replace(/_/g, ".") || ""}`;
    if (/iPad.*OS ([\d_]+)/i.test(ua)) return `iPadOS ${ua.match(/OS ([\d_]+)/i)?.[1]?.replace(/_/g, ".") || ""}`;
    if (/Mac OS X/i.test(ua)) return "macOS";
    if (/Linux/i.test(ua)) return "Linux";
    if (/CrOS/i.test(ua)) return "Chrome OS";
    return "Unknown";
}

function parseDevice(ua = "") {
    if (/Mobi|Android.*Mobile/i.test(ua)) return "Mobile";
    if (/Tablet|iPad/i.test(ua)) return "Tablet";
    return "Desktop";
}

// ─── Extract real IP from request ────────────────────────────

function getClientIP(req) {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) return forwarded.split(",")[0].trim();
    return req.socket?.remoteAddress || req.ip || "Unknown";
}

// ─── Reverse geocode GPS coords via OpenStreetMap Nominatim ─────

async function reverseGeocode(lat, lon) {
    try {
        const res = await axios.get(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
            {
                headers: {
                    "User-Agent": "Traxalon/1.0 (forensic tracking app)",
                    Accept: "application/json",
                },
                timeout: 6000,
            }
        );
        const data = res.data;
        const addr = data.address || {};
        return {
            gpsAddress: data.display_name || null,
            gpsCity: addr.city || addr.town || addr.village || addr.county || null,
            gpsState: addr.state || null,
            gpsPincode: addr.postcode || null,
            gpsCountry: addr.country || null,
        };
    } catch {
        return {}; // non-fatal
    }
}

// ─── IP enrichment via ip-api.com (free, no auth needed) ─────

async function enrichIP(ip) {
    try {
        // Skip enrichment for localhost/private IPs
        if (!ip || ip === "::1" || ip.startsWith("127.") || ip.startsWith("192.168.") || ip.startsWith("10.")) {
            return { note: "Local/private IP — no enrichment available" };
        }
        const res = await axios.get(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,reverse,query`, {
            timeout: 5000,
        });
        const d = res.data;
        if (d.status !== "success") return {};
        return {
            country: d.country,
            countryCode: d.countryCode,
            region: d.regionName,
            city: d.city,
            zip: d.zip,
            lat: d.lat,
            lon: d.lon,
            timezone: d.timezone,
            isp: d.isp,
            org: d.org,
            asn: d.as,
            hostname: d.reverse || null,
        };
    } catch {
        return {};
    }
}

// ─── Routes ──────────────────────────────────────────────────

// POST /api/links/shorten
// Body: { uid, label, destinationUrl }
router.post("/shorten", async (req, res) => {
    try {
        const { uid, label, destinationUrl } = req.body;
        if (!uid) return res.status(400).json({ error: "uid is required" });
        if (!destinationUrl) return res.status(400).json({ error: "destinationUrl is required" });

        const result = await createTrackingLink(uid, label, destinationUrl);
        return res.status(200).json(result);
    } catch (err) {
        console.error("[POST /shorten]", err.message);
        return res.status(400).json({ error: err.message });
    }
});

// POST /api/links/capture
// Body: { token, referrer, screenWidth, screenHeight, language, platform,
//         gpsLat, gpsLon, gpsAccuracy, gpsAddress, gpsCity, gpsState, gpsPincode, gpsCountry }
router.post("/capture", async (req, res) => {
    try {
        const {
            token,
            referrer,
            screenWidth,
            screenHeight,
            language,
            platform,
            gpsLat,
            gpsLon,
            gpsAccuracy,
            gpsAddress,
            gpsCity,
            gpsState,
            gpsPincode,
            gpsCountry,
        } = req.body;

        if (!token) return res.status(400).json({ error: "token is required" });

        const ua = req.headers["user-agent"] || "";

        // ── Bot / crawler filter ──────────────────────────────────
        // WhatsApp, Telegram, Slack, Google, Facebook etc. auto-fetch links
        // for link previews. We silently ignore these — they are NOT real visits.
        const BOT_PATTERNS = /bot|crawl|spider|preview|slurp|facebookexternalhit|whatsapp|telegram|slack|discord|curl|wget|python|java|go-http|axios|node-fetch|undici/i;
        if (BOT_PATTERNS.test(ua)) {
            // Return success so the caller doesn't retry, but don't record anything
            return res.status(200).json({ found: true, destinationUrl: null });
        }

        // Also reject captures with no screen data — bots don't have screens
        if (!screenWidth && !gpsLat) {
            const looksLikeBot = !ua || ua.length < 40;
            if (looksLikeBot) {
                return res.status(200).json({ found: true, destinationUrl: null });
            }
        }
        // ─────────────────────────────────────────────────────────

        const ip = getClientIP(req);

        // Enrich IP on backend (country, ISP, hostname, city, lat/lon)
        const ipData = await enrichIP(ip);

        // Reverse geocode GPS on BACKEND — avoids frontend CORS/rate-limit issues
        let geoData = {};
        if (gpsLat && gpsLon) {
            geoData = await reverseGeocode(gpsLat, gpsLon);
        }

        // Build the full capture record
        const deviceData = {
            capturedAt: new Date().toISOString(),
            ip,

            // Country + Location (IP-based, approximate)
            country: ipData.country || null,
            countryCode: ipData.countryCode || null,
            region: ipData.region || null,
            city: ipData.city || null,
            zip: ipData.zip || null,
            lat: ipData.lat || null,
            lon: ipData.lon || null,

            // GPS (exact — only present if user allowed browser location)
            gpsLat: gpsLat || null,
            gpsLon: gpsLon || null,
            gpsAccuracy: gpsAccuracy || null,

            // Reverse-geocoded address from OpenStreetMap Nominatim (done server-side)
            gpsAddress: geoData.gpsAddress || null,
            gpsCity: geoData.gpsCity || null,
            gpsState: geoData.gpsState || null,
            gpsPincode: geoData.gpsPincode || null,
            gpsCountry: geoData.gpsCountry || null,

            // Browser
            browser: parseBrowser(ua),
            os: parseOS(ua),
            device: parseDevice(ua),
            userAgent: ua,

            referrer: referrer || null,
            hostname: ipData.hostname || null,
            isp: ipData.isp || null,
            org: ipData.org || null,
            asn: ipData.asn || null,
            timezone: ipData.timezone || null,

            screenWidth: screenWidth || null,
            screenHeight: screenHeight || null,
            language: language || null,
            platform: platform || null,
        };

        const result = await recordCapture(token, deviceData);
        return res.status(200).json(result); // { found, destinationUrl }
    } catch (err) {
        console.error("[POST /capture]", err.message);
        return res.status(500).json({ error: "Failed to record capture" });
    }
});


// GET /api/links/geo-ip
// Server-side proxy for ip-api.com — avoids HTTPS mixed-content from browser
router.get("/geo-ip", async (req, res) => {
    const ip = getClientIP(req);
    const data = await enrichIP(ip);
    return res.status(200).json(data);
});

// POST /api/links/credits
router.post("/credits", async (req, res) => {
    try {
        const { uid, amount } = req.body;
        if (!uid || !amount) return res.status(400).json({ error: "uid and amount required" });
        await addCredits(uid, Number(amount));
        return res.status(200).json({ success: true });
    } catch (err) {
        console.error("[POST /credits]", err.message);
        return res.status(500).json({ error: err.message });
    }
});

export default router;
