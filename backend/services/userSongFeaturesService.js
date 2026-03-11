/**
 * Recompute and upsert `user_song_features` for a single (user_id, song_id) pair.
 *
 * This is intentionally correctness-first: it derives aggregates from the `events` table
 * so we can enforce "per-session max(play_duration)" without requiring a session_id
 * column or in-memory state.
 */

import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL in environment");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in environment");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

/** @type {null | 'created_at' | 'timestamp'} */
let cachedTimestampColumn = null;

/**
 * Attempt to determine the timestamp column for the `events` table.
 * @param {ReturnType<typeof createClient>} supabase
 * @returns {Promise<'created_at' | 'timestamp'>}
 */
async function detectEventTimestampColumn(supabase) {
  if (cachedTimestampColumn) return cachedTimestampColumn;

  {
    const { error } = await supabase.from("events").select("created_at").limit(1);
    if (!error) {
      cachedTimestampColumn = "created_at";
      return cachedTimestampColumn;
    }
  }

  {
    const { error } = await supabase.from("events").select("timestamp").limit(1);
    if (!error) {
      cachedTimestampColumn = "timestamp";
      return cachedTimestampColumn;
    }
  }

  cachedTimestampColumn = "created_at";
  return cachedTimestampColumn;
}

function normalizeId(value) {
  if (value === null || value === undefined) return null;
  const str = typeof value === "string" ? value : String(value);
  const trimmed = str.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseTimestampMs(value) {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  const ms = d.getTime();
  return Number.isNaN(ms) ? null : ms;
}

function toNonNegativeNumber(value) {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return num;
}

function isTerminalEventType(eventType) {
  return eventType === "pause" || eventType === "skip" || eventType === "complete";
}

/**
 * @param {Array<any>} orderedEvents
 * @param {'created_at' | 'timestamp'} timestampColumn
 */
function computeUserSongFeaturesFromEvents(orderedEvents, timestampColumn) {
  let playCount = 0;
  let skipCount = 0;
  let completeCount = 0;

  let totalPlayDuration = 0;
  let sessionMaxDuration = 0;
  /** @type {number | null} */
  let lastDurationSeen = null;

  /** @type {number | null} */
  let lastPlayedMs = null;

  for (const evt of orderedEvents) {
    const eventType =
      typeof evt?.event_type === "string" ? evt.event_type.trim().toLowerCase() : "";

    if (eventType === "play") playCount += 1;
    else if (eventType === "skip") skipCount += 1;
    else if (eventType === "complete") completeCount += 1;

    const duration = toNonNegativeNumber(evt?.play_duration);

    // Detect a new session when progress resets (duration decreases vs previously seen).
    if (duration > 0 && lastDurationSeen !== null && duration + 1 < lastDurationSeen) {
      totalPlayDuration += sessionMaxDuration;
      sessionMaxDuration = 0;
      lastDurationSeen = null;
    }

    if (duration > sessionMaxDuration) {
      sessionMaxDuration = duration;
    }

    if (duration > 0) {
      lastDurationSeen = duration;
    }

    if (isTerminalEventType(eventType)) {
      totalPlayDuration += sessionMaxDuration;
      sessionMaxDuration = 0;
      lastDurationSeen = null;
    }

    const tsMs = parseTimestampMs(evt?.[timestampColumn]);
    if (tsMs !== null && (lastPlayedMs === null || tsMs > lastPlayedMs)) {
      lastPlayedMs = tsMs;
    }
  }

  // If we ended mid-session (e.g., last event is a pause), commit the max duration.
  if (sessionMaxDuration > 0) {
    totalPlayDuration += sessionMaxDuration;
  }

  const updatedAt = new Date().toISOString();
  const avgPlayDurationSeconds = playCount > 0 ? Math.round(totalPlayDuration / playCount) : 0;
  const completionRate = playCount > 0 ? completeCount / playCount : 0;
  const lastPlayedAt = lastPlayedMs !== null ? new Date(lastPlayedMs).toISOString() : updatedAt;

  return {
    play_count: playCount,
    skip_count: skipCount,
    complete_count: completeCount,
    total_play_duration: totalPlayDuration,
    avg_play_duration: avgPlayDurationSeconds,
    completion_rate: completionRate,
    last_played_at: lastPlayedAt,
    updated_at: updatedAt
  };
}

/**
 * Recomputes aggregates from `events` and upserts into `user_song_features`.
 *
 * @param {{ user_id: string, song_id: string }} params
 */
export async function recomputeAndUpsertUserSongFeatures(params) {
  const userId = normalizeId(params?.user_id);
  const songId = normalizeId(params?.song_id);
  if (!userId || !songId) {
    throw new Error("recomputeAndUpsertUserSongFeatures: missing user_id or song_id");
  }

  const supabase = getSupabaseClient();
  const timestampColumn = await detectEventTimestampColumn(supabase);

  const pageSize = 5000;
  let offset = 0;

  /** @type {Array<any>} */
  const events = [];

  while (true) {
    const from = offset;
    const to = offset + pageSize - 1;

    const selectColumns = `user_id,song_id,event_type,play_duration,${timestampColumn}`;

    const { data, error } = await supabase
      .from("events")
      .select(selectColumns)
      .eq("user_id", userId)
      .eq("song_id", songId)
      .order(timestampColumn, { ascending: true })
      .range(from, to);

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) break;

    events.push(...rows);
    offset += rows.length;

    if (rows.length < pageSize) break;
  }

  const computed = computeUserSongFeaturesFromEvents(events, timestampColumn);

  const row = {
    user_id: userId,
    song_id: songId,
    ...computed
  };

  const { error: upsertError } = await supabase
    .from("user_song_features")
    .upsert(row, { onConflict: "user_id,song_id" });

  if (upsertError) throw upsertError;

  return row;
}
