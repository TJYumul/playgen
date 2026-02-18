/**
 * Aggregate user listening behavior from `events` into `user_song_features`.
 *
 * Requirements:
 * - Uses service role key (server-side only)
 * - Fetches events then aggregates in JavaScript
 * - Upserts into `user_song_features` with onConflict: "user_id,song_id"
 * - Batch size: 50
 * - Optional: --limit (limit number of events fetched)
 *
 * Usage:
 *   node backend/scripts/generateUserSongFeatures.js
 *   node backend/scripts/generateUserSongFeatures.js --limit 1000
 */

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prefer backend/.env so running from repo root works out-of-the-box.
// Fallback to default dotenv behavior (process.cwd()/.env) if backend/.env is missing.
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config();

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    const loadedFromBackendEnv = path.resolve(__dirname, "..", ".env");
    const missing = [
      !supabaseUrl ? "SUPABASE_URL" : null,
      !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null
    ].filter(Boolean);

    throw new Error(
      `Missing ${missing.join(", ")} in environment. ` +
        `This script loads backend/.env from: ${loadedFromBackendEnv}`
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

/**
 * Minimal CLI parser.
 * Supports:
 *  --limit 100
 *  --limit=100
 *
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ limit?: number }} */
  const args = {};

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (token === "--limit") {
      const value = argv[i + 1];
      args.limit = Number(value);
      i++;
      continue;
    }

    if (token.startsWith("--limit=")) {
      const value = token.split("=").slice(1).join("=");
      args.limit = Number(value);
    }
  }

  if (args.limit !== undefined && !Number.isFinite(args.limit)) {
    throw new Error("Invalid --limit (must be a number)");
  }

  if (args.limit !== undefined) {
    args.limit = Math.max(0, Math.floor(args.limit));
  }

  return args;
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

/**
 * Fetches all events (or up to limit) via pagination.
 *
 * @param {ReturnType<typeof createClient>} supabase
 * @param {{ limit?: number }} [options]
 */
async function fetchAllEvents(supabase, { limit } = {}) {
  const pageSize = 1000;
  let offset = 0;

  /** @type {Array<any>} */
  const all = [];

  while (true) {
    const remaining = limit !== undefined ? Math.max(0, limit - all.length) : undefined;
    if (remaining === 0) break;

    const take = remaining !== undefined ? Math.min(pageSize, remaining) : pageSize;

    const from = offset;
    const to = offset + take - 1;

    const { data, error } = await supabase
      .from("events")
      .select("user_id,song_id,event_type,play_duration,timestamp")
      .range(from, to);

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) break;

    all.push(...rows);
    offset += rows.length;

    if (rows.length < take) break;
  }

  return all;
}

/**
 * @param {any} value
 * @returns {string | null}
 */
function normalizeId(value) {
  if (value === null || value === undefined) return null;
  const str = typeof value === "string" ? value : String(value);
  const trimmed = str.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * @param {any} value
 * @returns {number | null}
 */
function normalizeDurationSeconds(value) {
  if (value === null || value === undefined) return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < 0) return null;
  return num;
}

/**
 * @param {any} value
 * @returns {number | null}
 */
function parseTimestampMs(value) {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  const ms = d.getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Aggregate events into per-(user_id,song_id) features.
 *
 * @param {Array<any>} events
 */
function aggregateEvents(events) {
  /**
   * @type {Map<string, {
   *   user_id: string,
   *   song_id: string,
   *   play_count: number,
   *   skip_count: number,
   *   complete_count: number,
   *   total_play_duration: number,
   *   last_played_ms: number | null
   * }>}
   */
  const groups = new Map();

  let processedEvents = 0;

  for (const evt of events) {
    const userId = normalizeId(evt?.user_id);
    const songId = normalizeId(evt?.song_id);

    if (!userId || !songId) {
      continue;
    }

    processedEvents++;

    const key = `${userId}:${songId}`;
    let agg = groups.get(key);

    if (!agg) {
      agg = {
        user_id: userId,
        song_id: songId,
        play_count: 0,
        skip_count: 0,
        complete_count: 0,
        total_play_duration: 0,
        last_played_ms: null
      };
      groups.set(key, agg);
    }

    const eventType = typeof evt?.event_type === "string" ? evt.event_type.trim().toLowerCase() : "";

    if (eventType === "play") agg.play_count += 1;
    else if (eventType === "skip") agg.skip_count += 1;
    else if (eventType === "complete") agg.complete_count += 1;

    const duration = normalizeDurationSeconds(evt?.play_duration);
    if (duration !== null) {
      agg.total_play_duration += duration;
    }

    const tsMs = parseTimestampMs(evt?.timestamp);
    if (tsMs !== null && (agg.last_played_ms === null || tsMs > agg.last_played_ms)) {
      agg.last_played_ms = tsMs;
    }
  }

  const updatedAt = new Date().toISOString();

  const features = Array.from(groups.values()).map((g) => {
    const avgPlayDuration = g.play_count > 0 ? g.total_play_duration / g.play_count : 0;
    const completionRate = g.play_count > 0 ? g.complete_count / g.play_count : 0;

    const lastPlayedAt =
      g.last_played_ms !== null ? new Date(g.last_played_ms).toISOString() : updatedAt;

    return {
      user_id: g.user_id,
      song_id: g.song_id,
      play_count: g.play_count,
      skip_count: g.skip_count,
      complete_count: g.complete_count,
      total_play_duration: g.total_play_duration,
      avg_play_duration: avgPlayDuration,
      completion_rate: completionRate,
      last_played_at: lastPlayedAt,
      updated_at: updatedAt
    };
  });

  return { features, processedEvents };
}

/**
 * @param {ReturnType<typeof createClient>} supabase
 * @param {Array<any>} featureRows
 */
async function upsertFeatureRows(supabase, featureRows) {
  const batches = chunk(featureRows, 50);
  let upserted = 0;

  for (const batch of batches) {
    const { data, error } = await supabase
      .from("user_song_features")
      .upsert(batch, { onConflict: "user_id,song_id" })
      // Return something lightweight so we can count rows.
      .select("user_id,song_id");

    if (error) throw error;

    upserted += Array.isArray(data) ? data.length : batch.length;
  }

  return upserted;
}

async function main() {
  const argv = parseArgs(process.argv.slice(2));
  const supabase = getSupabaseClient();

  const events = await fetchAllEvents(supabase, {
    ...(argv.limit !== undefined ? { limit: argv.limit } : {})
  });

  const { features, processedEvents } = aggregateEvents(events);
  const upserted = await upsertFeatureRows(supabase, features);

  console.log(`Processed ${processedEvents} events`);
  console.log(`Generated ${features.length} feature rows`);
  console.log(`Upserted ${upserted} rows into user_song_features`);
}

main().catch((err) => {
  console.error("[generateUserSongFeatures] Failed:", err?.message ?? err);
  if (err?.details) console.error("Details:", err.details);
  if (err?.hint) console.error("Hint:", err.hint);
  if (err?.code) console.error("Code:", err.code);
  process.exitCode = 1;
});
