import express from "express";
import {
    createTrackingLink,
    recordCapture,
    addCredits,
} from "../utils/linkService.js";

const router = express.Router();

// POST /api/links/shorten
// Body: { uid, label, destinationUrl }
// Creates a tracking link, shortens it via Bitly, returns shortUrl
router.post("/shorten", async (req, res) => {
    try {
        const { uid, label, destinationUrl } = req.body;

        if (!uid) {
            return res.status(400).json({ error: "uid is required" });
        }
        if (!destinationUrl) {
            return res.status(400).json({ error: "destinationUrl is required" });
        }

        const result = await createTrackingLink(uid, label, destinationUrl);
        return res.status(200).json(result);
    } catch (err) {
        console.error("[POST /shorten]", err.message);
        return res.status(400).json({ error: err.message });
    }
});

// POST /api/links/capture
// Body: { token, deviceData }
// Records device capture and returns destinationUrl to redirect to
router.post("/capture", async (req, res) => {
    try {
        const { token, deviceData } = req.body;
        if (!token) return res.status(400).json({ error: "token is required" });

        const result = await recordCapture(token, deviceData || {});
        return res.status(200).json(result);
    } catch (err) {
        console.error("[POST /capture]", err.message);
        return res.status(500).json({ error: "Failed to record capture" });
    }
});

// POST /api/links/credits
// Body: { uid, amount }
router.post("/credits", async (req, res) => {
    try {
        const { uid, amount } = req.body;
        if (!uid || !amount) {
            return res.status(400).json({ error: "uid and amount are required" });
        }
        await addCredits(uid, Number(amount));
        return res.status(200).json({ success: true });
    } catch (err) {
        console.error("[POST /credits]", err.message);
        return res.status(500).json({ error: err.message });
    }
});

export default router;
