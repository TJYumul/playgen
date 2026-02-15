/**
 * Fetch Jamendo tracks and upsert into Supabase in batches.
 *
 * Uses existing services:
 * - fetchJamendoTracks({ clientId, limit, offset, genre })  -> Jamendo API
 * - upsertSongs(songs)                                    -> Supabase upsert (onConflict: jamendo_id)
 *
 * Requirements implemented:
 * - Pagination via limit/offset
 * - Optional genre array (loops genres)
 * - Mapping Jamendo fields to `songs` table (incl. new UUID + created_at)
 * - Batch upserts with per-batch + total logging
 * - Graceful error handling + retry with backoff
 * - Exits when at least TARGET songs have been upserted
 */

import dotenv from "dotenv";
import { randomUUID } from "node:crypto";

import { fetchJamendoTracks } from "../services/jamendoService.js";
import { upsertSongs } from "../services/songService.js";

dotenv.config();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Very small CLI parser to keep the script dependency-free.
 *
 * Supported flags:
 *   --limit 100
 *   --offset 0
 *   --batch-size 50
 *   --target 300
 *   --genres rock,pop,jazz
 */
function parseArgs(argv) {
  const args = {
    limit: undefined,
    offset: undefined,
    batchSize: undefined,
    target: undefined,
    genres: undefined
  };

  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const value = argv[i + 1];

    if (key === "--limit") {
      args.limit = Number(value);
      i++;
    } else if (key === "--offset") {
      args.offset = Number(value);
      i++;
    } else if (key === "--batch-size") {
      args.batchSize = Number(value);
      i++;
    } else if (key === "--target") {
      args.target = Number(value);
      i++;
    } else if (key === "--genres") {
      args.genres = String(value ?? "");
      i++;
    }
  }

  return args;
}

/**
 * Retry wrapper for API calls.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ retries?: number, baseDelayMs?: number }} [options]
 * @returns {Promise<T>}
 */
async function withRetry(fn, { retries = 3, baseDelayMs = 750 } = {}) {
  let lastErr;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isLast = attempt === retries;
      const jitter = Math.floor(Math.random() * 250);
      const delayMs = Math.min(10_000, baseDelayMs * 2 ** (attempt - 1)) + jitter;

      console.warn(
        `[jamendo] Fetch failed (attempt ${attempt}/${retries})${isLast ? ": giving up" : ""}:`,
        err?.message ?? err
      );

      if (!isLast) {
        await sleep(delayMs);
      }
    }
  }

  throw lastErr;
}

/**
 * Map Jamendo track -> Supabase `songs` row.
 *
 * Required mapping:
 * - id          -> new UUID
 * - jamendo_id  -> track.id
 * - artist      -> track.artist_name
 * - audio_url   -> track.audio
 * - image_url   -> track.image
 * - duration    -> track.duration
 * - popularity  -> track.popularity (fallbacks allowed)
 * - created_at  -> current timestamp
 *
 * @param {any} track
 * @returns {null | {
 *   id: string,
 *   jamendo_id: string,
 *   title: string,
 *   artist: string,
 *   audio_url: string,
 *   image_url: string,
 *   duration: number,
 *   popularity: number,
 *   created_at: string
 * }}
 */
function mapTrackToSongRow(track) {
  if (!track) return null;

  const jamendoId = track.id;
  const title = track.name;
  const artist = track.artist_name;
  const audioUrl = track.audio;
  const imageUrl = track.image;

  if (!jamendoId || !title || !artist || !audioUrl) return null;

  const duration = Number(track.duration ?? 0);
  const popularity = Number(
    track.popularity ??
      track.popularity_total ??
      track.popularity_week ??
      track.popularity_month ??
      0
  );

  return {
    id: randomUUID(),
    jamendo_id: String(jamendoId),
    title: String(title),
    artist: String(artist),
    audio_url: String(audioUrl),
    image_url: imageUrl ? String(imageUrl) : "",
    duration: Number.isFinite(duration) ? duration : 0,
    popularity: Number.isFinite(popularity) ? popularity : 0,
    created_at: new Date().toISOString()
  };
}

function chunk(array, size) {
  if (!Array.isArray(array) || array.length === 0) return [];
  const safeSize = Math.max(1, Math.floor(size));

  /** @type {Array<Array<any>>} */
  const out = [];
  for (let i = 0; i < array.length; i += safeSize) {
    out.push(array.slice(i, i + safeSize));
  }
  return out;
}

async function main() {
  const jamendoClientId = process.env.JAMENDO_CLIENT_ID;
  if (!jamendoClientId) {
    throw new Error("Missing JAMENDO_CLIENT_ID in environment");
  }

  // Supabase env vars are validated inside upsertSongs().

  const argv = parseArgs(process.argv.slice(2));

  const limit = Number.isFinite(argv.limit) ? Math.min(Math.max(argv.limit, 1), 200) : 100;
  const startOffset = Number.isFinite(argv.offset) ? Math.max(argv.offset, 0) : 0;
  const batchSize = Number.isFinite(argv.batchSize) ? Math.min(Math.max(argv.batchSize, 1), 200) : 50;
  const target = Number.isFinite(argv.target) ? Math.max(argv.target, 1) : 300;

  // Genres can be passed as --genres "rock,pop" or env JAMENDO_GENRES.
  const genreString = (argv.genres ?? process.env.JAMENDO_GENRES ?? "").trim();
  const genres = genreString
    ? genreString
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean)
    : [null];

  console.log("[ingest] Starting Jamendo ingestion", {
    limit,
    startOffset,
    batchSize,
    target,
    genres: genres[0] === null ? "(none)" : genres
  });

  let totalUpserted = 0;

  // Prevent duplicates within this run (across pages + genres).
  const seenJamendoIds = new Set();

  for (const genre of genres) {
    let offset = startOffset;
    let emptyPagesInARow = 0;

    console.log(`[ingest] Genre: ${genre ?? "(none)"}`);

    while (totalUpserted < target) {
      // Fetch a page of tracks (with retry/backoff).
      const tracks = await withRetry(
        () => fetchJamendoTracks({ clientId: jamendoClientId, limit, offset, genre: genre ?? undefined }),
        { retries: 4, baseDelayMs: 800 }
      ).catch((err) => {
        // Graceful handling: log and skip this page.
        console.error(`[jamendo] Page failed after retries. Skipping offset=${offset}`, err?.message ?? err);
        return [];
      });

      if (!Array.isArray(tracks) || tracks.length === 0) {
        emptyPagesInARow += 1;
        if (emptyPagesInARow >= 2) {
          console.log("[ingest] No more results for this genre; moving on.");
          break;
        }
      } else {
        emptyPagesInARow = 0;
      }

      // Map + dedupe by jamendo_id.
      const mapped = (tracks ?? [])
        .map(mapTrackToSongRow)
        .filter(Boolean)
        .filter((row) => {
          if (seenJamendoIds.has(row.jamendo_id)) return false;
          seenJamendoIds.add(row.jamendo_id);
          return true;
        });

      if (mapped.length === 0) {
        offset += limit;
        continue;
      }

      // Upsert in batches.
      for (const batch of chunk(mapped, batchSize)) {
        if (totalUpserted >= target) break;

        try {
          const upserted = await upsertSongs(batch);
          totalUpserted += upserted;

          console.log(
            `[upsert] batch=${batch.length} upserted=${upserted} total=${totalUpserted}/${target}`
          );
        } catch (err) {
          // Don’t crash the whole run for one bad batch.
          console.error("[upsert] Batch failed; continuing:", err?.message ?? err);
        }
      }

      offset += limit;
    }

    if (totalUpserted >= target) break;
  }

  console.log("[ingest] Done", { totalUpserted, target });

  // Exit when at least TARGET songs have been inserted/upserted.
  process.exit(totalUpserted >= target ? 0 : 1);
}

main().catch((err) => {
  console.error("[ingest] Fatal error:", err?.message ?? err);
  process.exit(1);
});
