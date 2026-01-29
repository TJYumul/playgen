import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { fetchJamendoTracks } from "./services/jamendoService.js";
import { normalizeJamendoTrack } from "./utils/normalizeSong.js";
import { listSongs, upsertSongs } from "./services/songService.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Backend is running" });
});

app.get("/", (req, res) => {
  res.send("Backend running");
});

/**
 * Ingest Jamendo tracks into Supabase.
 *
 * GET /api/ingest/jamendo
 * - Fetches 20 tracks from Jamendo using JAMENDO_CLIENT_ID (server-side only)
 * - Normalizes track objects into our internal song shape
 * - Upserts into Supabase table `songs` using `jamendo_id` conflict key
 *
 * Responds:
 *   { inserted: number }
 */
app.get("/api/ingest/jamendo", async (req, res) => {
  try {
    const jamendoClientId = process.env.JAMENDO_CLIENT_ID;
    if (!jamendoClientId) {
      throw new Error("Missing JAMENDO_CLIENT_ID in environment");
    }

    const tracks = await fetchJamendoTracks({ clientId: jamendoClientId, limit: 20 });
    const normalizedSongs = tracks
      .map(normalizeJamendoTrack)
      // Drop any tracks that failed normalization.
      .filter(Boolean);

    const inserted = await upsertSongs(normalizedSongs);
    res.json({ inserted });
  } catch (err) {
    console.error("[ingest/jamendo] Failed:", err);
    res.status(500).json({ error: err?.message ?? "Unknown error" });
  }
});

/**
 * Public track list for the frontend.
 *
 * GET /api/tracks
 * Responds:
 *   Array<{ id, title, artist, audio_url, cover_url }>
 */
app.get("/api/tracks", async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 200);
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 200;

    const songs = await listSongs({ limit: safeLimit });
    res.json(songs);
  } catch (err) {
    console.error("[tracks] Failed:", err);
    res.status(500).json({ error: err?.message ?? "Unknown error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
