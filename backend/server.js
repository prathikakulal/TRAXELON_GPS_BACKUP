import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import linksRouter from "./routes/links.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
    origin: [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://traxalon-main-01.vercel.app",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

// ── Routes ───────────────────────────────────────────────────
app.get("/", (req, res) => {
    res.json({ status: "Traxalon backend running ✅", version: "1.0.0" });
});

app.use("/api/links", linksRouter);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("[Error]", err);
    res.status(500).json({ error: "Internal server error" });
});

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 Traxalon backend running on http://localhost:${PORT}`);
    console.log(`   Bitly token: ${process.env.BITLY_API_TOKEN ? "✅ Set" : "⚠️  Not set (fallback mode)"}\n`);
});
