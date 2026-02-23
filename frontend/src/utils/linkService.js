// frontend/src/utils/linkService.js
// All link creation now goes through the backend API (which handles Bitly shortening).
// Firebase-direct calls are kept only for addCredits (simple write).

import {
    doc,
    updateDoc,
    increment,
} from "firebase/firestore";
import { db } from "../firebase/config";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

/**
 * Create a tracking link via the backend.
 * The backend:
 *   1. Creates a /t/:token tracking URL
 *   2. Shortens it with Bitly → bit.ly/xxx
 *   3. Stores { trackingUrl, shortUrl, destinationUrl } in Firestore
 *   4. Deducts 1 credit
 * 
 * @param {string} uid             Firebase user UID
 * @param {string} label           Optional label / case name
 * @param {string} destinationUrl  URL to redirect suspect to after capture
 * @returns {{ token, trackingUrl, shortUrl }}
 */
export async function createTrackingLink(uid, label, destinationUrl) {
    const res = await fetch(`${BACKEND_URL}/api/links/shorten`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, label, destinationUrl }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to create tracking link");
    return data; // { token, trackingUrl, shortUrl }
}

/**
 * Record a capture by calling the backend.
 * Returns { found, destinationUrl } so TrackingCapture can redirect.
 */
export async function recordCapture(token, deviceData) {
    const res = await fetch(`${BACKEND_URL}/api/links/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, deviceData }),
    });
    const data = await res.json();
    if (!res.ok) return { found: false, destinationUrl: null };
    return data; // { found, destinationUrl }
}

/**
 * Add credits directly via Firestore (no Bitly needed here).
 */
export async function addCredits(uid, amount) {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
        credits: increment(amount),
    });
}