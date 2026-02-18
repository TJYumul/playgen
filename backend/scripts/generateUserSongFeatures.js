/**
 * Generate aggregated user listening features from `events` and upsert into `user_song_features`.
 *
 * Metrics computed per (user_id, song_id):
 * - play_count: count(event_type = 'play')
 * - skip_count: count(event_type = 'skip')
 * - complete_count: count(event_type = 'complete')
 * - total_play_duration: sum(play_duration) across ALL events (null treated as 0)
 * - avg_play_duration: total_play_duration / play_count
 * - completion_rate: clamp(total_play_duration / songs.duration, 0..1)
 * - last_played_at: latest event timestamp
 * - updated_at: now()
 *
 * Notes:
 * - This script streams events in pages and aggregates in a single pass, so it does not load
 *   the entire `events` table into memory.
 * - It expects a server-side Supabase key (service role) and should never be run client-side.
 *
 * Usage:
 *   node backend/scripts/generateUserSongFeatures.js
 *   node backend/scripts/generateUserSongFeatures.js --limit 100000
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
 * Attempt to determine the timestamp column for the `events` table.
 * Some older code paths used `timestamp`; the requirements assume `created_at`.
 *
 * @param {ReturnType<typeof createClient>} supabase
 * @returns {Promise<'created_at' | 'timestamp'>}
 */
async function detectEventTimestampColumn(supabase) {
  {
    const { error } = await supabase.from("events").select("created_at").limit(1);
    if (!error) return "created_at";
  }

  {
    const { error } = await supabase.from("events").select("timestamp").limit(1);
    if (!error) return "timestamp";
  }

  // Default to created_at (matches Supabase auto columns) even if table is empty.
  return "created_at";
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
 * @param {unknown} value
 * @returns {number}
 */
function toNonNegativeNumber(value) {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return num;
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Fetch events in pages, ordered by (user_id, song_id, timestamp) so we can stream-aggregate.
 *
 * @param {ReturnType<typeof createClient>} supabase
 * @param {{ limit?: number, pageSize?: number, timestampColumn: 'created_at' | 'timestamp' }} options
 */
async function* fetchEvents(supabase, { limit, pageSize = 5000, timestampColumn }) {
  let offset = 0;
  let fetched = 0;

  while (true) {
    const remaining = limit !== undefined ? Math.max(0, limit - fetched) : undefined;
    if (remaining === 0) break;

    const take = remaining !== undefined ? Math.min(pageSize, remaining) : pageSize;
    const from = offset;
    const to = offset + take - 1;

    const selectColumns = `user_id,song_id,event_type,play_duration,${timestampColumn}`;

    const { data, error } = await supabase
      .from("events")
      .select(selectColumns)
      .order("user_id", { ascending: true })
      .order("song_id", { ascending: true })
      .order(timestampColumn, { ascending: true })
      .range(from, to);

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) break;

    yield rows;

    fetched += rows.length;
    offset += rows.length;
    if (rows.length < take) break;
  }
}

/**
 * Fetch song durations for a set of IDs, populating a cache.
 *
 * @param {ReturnType<typeof createClient>} supabase
 * @param {Map<string, number>} durationCache
 * @param {string[]} songIds
 */
async function hydrateSongDurations(supabase, durationCache, songIds) {
  const unique = Array.from(new Set(songIds)).filter(Boolean);
  const missing = unique.filter((id) => !durationCache.has(id));
  if (missing.length === 0) return;

  const chunks = chunk(missing, 500);
  for (const ids of chunks) {
    const { data, error } = await supabase.from("songs").select("id,duration").in("id", ids);
    if (error) throw error;

    for (const row of Array.isArray(data) ? data : []) {
      const id = normalizeId(row?.id);
      const duration = toNonNegativeNumber(row?.duration);
      if (id) durationCache.set(id, duration);
    }

    // If some songs weren't found, record 0 to avoid repeated lookups.
    for (const id of ids) {
      if (!durationCache.has(id)) durationCache.set(id, 0);
    }
  }
}

/**
 * Aggregate events into `user_song_features` rows.
 * Streaming: relies on events being ordered by (user_id, song_id, timestamp).
 *
 * @param {object} options
 * @param {AsyncGenerator<Array<any>>} options.eventPages
 * @param {Map<string, number>} options.songDurationCache
 * @param {'created_at' | 'timestamp'} options.timestampColumn
 * @param {(rows: Array<any>) => Promise<void>} options.onBatch
 * @param {number} [options.batchSize]
 */
async function aggregateUserSongFeatures({
  eventPages,
  songDurationCache,
  timestampColumn,
  onBatch,
  batchSize = 500
}) {
  let processedEvents = 0;
  let aggregatedRecords = 0;

  /** @type {Array<any>} */
  let buffer = [];

  /** @type {null | { user_id: string, song_id: string, play_count: number, skip_count: number, complete_count: number, total_play_duration: number, last_played_ms: number | null }} */
  let current = null;
  let currentKey = null;

  const flushCurrent = async () => {
    if (!current) return;

    const updatedAt = new Date().toISOString();
    const songDuration = songDurationCache.get(current.song_id) ?? 0;
    // Some schemas store avg_play_duration as an integer (seconds). Round to avoid
    // "invalid input syntax for type integer" errors during upsert.
    const avgPlayDurationSeconds =
      current.play_count > 0 ? Math.round(current.total_play_duration / current.play_count) : 0;
    const completionRate = songDuration > 0 ? clamp01(current.total_play_duration / songDuration) : 0;

    const lastPlayedAt =
      current.last_played_ms !== null ? new Date(current.last_played_ms).toISOString() : updatedAt;

    buffer.push({
      user_id: current.user_id,
      song_id: current.song_id,
      play_count: current.play_count,
      skip_count: current.skip_count,
      complete_count: current.complete_count,
      total_play_duration: current.total_play_duration,
      avg_play_duration: avgPlayDurationSeconds,
      completion_rate: completionRate,
      last_played_at: lastPlayedAt,
      updated_at: updatedAt
    });

    aggregatedRecords += 1;
    current = null;
    currentKey = null;

    if (buffer.length >= batchSize) {
      const rows = buffer;
      buffer = [];
      await onBatch(rows);
    }
  };

  for await (const page of eventPages) {
    for (const evt of page) {
      const userId = normalizeId(evt?.user_id);
      const songId = normalizeId(evt?.song_id);
      if (!userId || !songId) continue;

      processedEvents += 1;

      const key = `${userId}:${songId}`;
      if (currentKey !== null && key !== currentKey) {
        await flushCurrent();
      }

      if (!current) {
        current = {
          user_id: userId,
          song_id: songId,
          play_count: 0,
          skip_count: 0,
          complete_count: 0,
          total_play_duration: 0,
          last_played_ms: null
        };
        currentKey = key;
      }

      const eventType = typeof evt?.event_type === "string" ? evt.event_type.trim().toLowerCase() : "";
      if (eventType === "play") current.play_count += 1;
      else if (eventType === "skip") current.skip_count += 1;
      else if (eventType === "complete") current.complete_count += 1;

      // Requirement: treat null play_duration as 0.
      current.total_play_duration += toNonNegativeNumber(evt?.play_duration);

      const tsMs = parseTimestampMs(evt?.[timestampColumn]);
      if (tsMs !== null && (current.last_played_ms === null || tsMs > current.last_played_ms)) {
        current.last_played_ms = tsMs;
      }
    }
  }

  await flushCurrent();
  if (buffer.length > 0) {
    await onBatch(buffer);
    buffer = [];
  }

  return { processedEvents, aggregatedRecords };
}

/**
 * @param {ReturnType<typeof createClient>} supabase
 * @param {Array<any>} featureRows
 */
async function upsertUserSongFeatures(supabase, featureRows) {
  if (!Array.isArray(featureRows) || featureRows.length === 0) return 0;

  const batches = chunk(featureRows, 500);
  let attempted = 0;

  for (const batch of batches) {
    const { error } = await supabase
      .from("user_song_features")
      .upsert(batch, { onConflict: "user_id,song_id" });

    if (error) throw error;
    attempted += batch.length;
  }

  return attempted;
}

async function main() {
  const argv = parseArgs(process.argv.slice(2));
  const supabase = getSupabaseClient();

  const timestampColumn = await detectEventTimestampColumn(supabase);
  console.log(`[generateUserSongFeatures] Using events timestamp column: ${timestampColumn}`);

  const songDurationCache = new Map();

  let totalUpsertsAttempted = 0;
  let totalEventsFetched = 0;

  const eventPages = (async function* () {
    for await (const page of fetchEvents(supabase, {
      timestampColumn,
      ...(argv.limit !== undefined ? { limit: argv.limit } : {})
    })) {
      totalEventsFetched += page.length;

      // Preload song durations for this page to avoid per-row lookups.
      const pageSongIds = page.map((r) => normalizeId(r?.song_id)).filter(Boolean);
      await hydrateSongDurations(supabase, songDurationCache, pageSongIds);

      if (totalEventsFetched % 50000 === 0) {
        console.log(`[generateUserSongFeatures] Fetched ${totalEventsFetched} events...`);
      }

      yield page;
    }
  })();

  const { processedEvents, aggregatedRecords } = await aggregateUserSongFeatures({
    eventPages,
    songDurationCache,
    timestampColumn,
    onBatch: async (rows) => {
      const attempted = await upsertUserSongFeatures(supabase, rows);
      totalUpsertsAttempted += attempted;
      console.log(
        `[generateUserSongFeatures] Upserted batch: ${attempted} (total attempted: ${totalUpsertsAttempted})`
      );
    }
  });

  console.log(`[generateUserSongFeatures] Processed events: ${processedEvents}`);
  console.log(`[generateUserSongFeatures] Aggregated records: ${aggregatedRecords}`);
  console.log(`[generateUserSongFeatures] Upserts attempted: ${totalUpsertsAttempted}`);
}

main().catch((err) => {
  console.error("[generateUserSongFeatures] Failed:", err?.message ?? err);
  if (err?.details) console.error("Details:", err.details);
  if (err?.hint) console.error("Hint:", err.hint);
  if (err?.code) console.error("Code:", err.code);
  process.exitCode = 1;
});
