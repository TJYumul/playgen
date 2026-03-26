/**
 * Event logging service using Supabase.
 *
 * Inserts play/pause/skip/etc events into the `events` table.
 * Uses a server-side Supabase key (service role) so we can insert.
 * Never expose SUPABASE_SERVICE_ROLE_KEY to the frontend.
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

/**
 * Validates a UUID (v1-v5) string.
 * @param {unknown} value
 * @returns {value is string}
 */
export function isValidUuid(value) {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v) return false;

  // Accepts UUID versions 1-5.
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(v);
}

/**
 * Inserts an event into the `events` table.
 *
 * NOTE: If `timestamp` is omitted, the DB column should default to now().
 *
 * @param {{ user_id: string, song_id: string, event_type: string, timestamp?: string, play_duration?: number }} payload
 * @returns {Promise<string>} Inserted event id
 */
export async function insertEvent(payload) {
  const supabase = getSupabaseClient();

  const eventRow = {
    user_id: payload.user_id,
    song_id: payload.song_id,
    event_type: payload.event_type
  };

  // Only include timestamp if provided; otherwise rely on DB default now().
  if (payload.timestamp) {
    eventRow.timestamp = payload.timestamp;
  }

  // Only include play_duration if explicitly provided.
  // Validate it is a non-negative, finite number (seconds).
  if (payload.play_duration !== undefined && payload.play_duration !== null) {
    if (typeof payload.play_duration !== "number" || !Number.isFinite(payload.play_duration)) {
      throw new Error("Invalid play_duration (expected a non-negative number)");
    }
    if (payload.play_duration < 0) {
      throw new Error("Invalid play_duration (must be >= 0)");
    }

    // Store as an integer number of seconds.
    eventRow.play_duration = Math.floor(payload.play_duration);
  }

  const { data, error } = await supabase
    .from("events")
    .insert(eventRow)
    .select("id")
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error("Event insert succeeded but no id was returned");

  return String(data.id);
}
