import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { fetchJamendoTracks } from "./services/jamendoService.js";
import { normalizeJamendoTrack } from "./utils/normalizeSong.js";
import {
  getSongsByIds,
  listSongs,
  upsertSongs,
} from "./services/songService.js";
import { insertEvent, isValidUuid } from "./eventService.js";
import { recomputeAndUpsertUserSongFeatures } from "./services/userSongFeaturesService.js";

// ✅ ADD THIS (AI SERVICE)
import { getRecommendations } from "./services/aiService.js";

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
 * ✅ NEW: AI Recommendation Route
 *
 * POST /api/recommend
 * Body:
 * {
 *   "audio_url": "https://example.com/audio.mp3",
 *   "user_id": "uuid"
 * }
 */
app.post("/api/recommend", async (req, res) => {
  try {
    const { audio_url, user_id } = req.body ?? {};

    if (!audio_url || !user_id) {
      return res.status(400).json({ error: "audio_url and user_id required" });
    }

    const songIds = await getRecommendations(audio_url, user_id);

    if (!Array.isArray(songIds) || songIds.length === 0) {
      return res.json([]);
    }

    const songs = await getSongsByIds(songIds);
    const songsById = new Map(
      (songs ?? []).map((song) => [String(song.id), song]),
    );

    const orderedSongs = songIds
      .map((id) => songsById.get(String(id)))
      .filter(Boolean);

    return res.json(orderedSongs);
  } catch (err) {
    console.error("[recommend] Failed:", err);
    return res.status(500).json({ error: err?.message ?? "AI service failed" });
  }
});

/**
 * Ingest Jamendo tracks into Supabase.
 */
app.get("/api/ingest/jamendo", async (req, res) => {
  try {
    const jamendoClientId = process.env.JAMENDO_CLIENT_ID;
    if (!jamendoClientId) {
      throw new Error("Missing JAMENDO_CLIENT_ID in environment");
    }

    const tracks = await fetchJamendoTracks({
      clientId: jamendoClientId,
      limit: 20,
    });

    const normalizedSongs = tracks.map(normalizeJamendoTrack).filter(Boolean);

    const inserted = await upsertSongs(normalizedSongs);
    res.json({ inserted });
  } catch (err) {
    console.error("[ingest/jamendo] Failed:", err);
    res.status(500).json({ error: err?.message ?? "Unknown error" });
  }
});

/**
 * Public track list
 */
app.get("/api/tracks", async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 200);
    const safeLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 500)
      : 200;

    const songs = await listSongs({ limit: safeLimit });
    res.json(songs);
  } catch (err) {
    console.error("[tracks] Failed:", err);
    res.status(500).json({ error: err?.message ?? "Unknown error" });
  }
});

/**
 * Events logging
 */
app.post("/api/events", async (req, res) => {
  try {
    const { user_id, song_id, event_type, timestamp, play_duration } =
      req.body ?? {};

    console.info("[events] Incoming", {
      user_id,
      song_id,
      event_type,
      timestamp,
      play_duration,
    });

    if (!isValidUuid(user_id)) {
      return res.status(400).json({ error: "Invalid user_id (expected UUID)" });
    }

    if (typeof song_id !== "string" || song_id.trim().length === 0) {
      return res.status(400).json({ error: "Invalid song_id" });
    }

    if (typeof event_type !== "string" || event_type.trim().length === 0) {
      return res.status(400).json({ error: "Invalid event_type" });
    }

    let normalizedTimestamp;
    if (timestamp) {
      const parsed = new Date(timestamp);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ error: "Invalid timestamp" });
      }
      normalizedTimestamp = parsed.toISOString();
    }

    let normalizedPlayDuration;
    if (play_duration !== undefined) {
      if (typeof play_duration !== "number" || play_duration < 0) {
        return res.status(400).json({ error: "Invalid play_duration" });
      }
      normalizedPlayDuration = Math.floor(play_duration);
    }

    const eventId = await insertEvent({
      user_id: user_id.trim(),
      song_id: song_id.trim(),
      event_type: event_type.trim(),
      ...(normalizedTimestamp && { timestamp: normalizedTimestamp }),
      ...(normalizedPlayDuration !== undefined && {
        play_duration: normalizedPlayDuration,
      }),
    });

    let featuresUpdated = false;

    try {
      const type = event_type.toLowerCase();

      if (["play", "pause", "skip", "complete"].includes(type)) {
        await recomputeAndUpsertUserSongFeatures({
          user_id: user_id.trim(),
          song_id: song_id.trim(),
        });
        featuresUpdated = true;
      }
    } catch (err) {
      console.error("[events] Feature update failed:", err);
    }

    return res.json({
      success: true,
      event_id: eventId,
      features_updated: featuresUpdated,
    });
  } catch (err) {
    console.error("[events] Failed:", err);
    return res.status(500).json({ error: err?.message ?? "Unknown error" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
