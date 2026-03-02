import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import linksRouter from "./routes/links.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl)
        if (!origin) return callback(null, true);

        const allowed = [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://192.168.10.1:5173",
            "http://192.168.84.1:5173",
            "http://192.168.1.36:5173",
        ];

        // Allow any *.vercel.app subdomain (covers all your frontend deployments)
        if (allowed.includes(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) {
            return callback(null, true);
        }

        return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
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
const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 Traxalon backend running on http://localhost:${PORT}`);
    console.log(`   LAN access:   http://192.168.10.1:${PORT}`);
    const bitlyToken = process.env.BITLY_API_TOKEN;
    const bitlyReady = bitlyToken && bitlyToken !== "YOUR_BITLY_ACCESS_TOKEN_HERE";
    console.log(`   Bitly token: ${bitlyReady ? "✅ Set" : "⚠️  NOT SET — add real token to backend/.env"}\n`);
});

server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        console.error(`\n❌ Port ${PORT} is already in use!`);
        console.error(`   Run this to fix it:  taskkill /F /IM node.exe`);
        console.error(`   Then run:            npm start\n`);
        process.exit(1);
    } else {
        throw err;
    }
});
