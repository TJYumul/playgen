/**
 * Song storage service using Supabase.
 *
 * Uses a server-side Supabase key (service role) so we can insert/upsert.
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
 * Upsert songs into the `songs` table.
 *
 * "inserted" returned here means "rows upserted" (inserted or updated)
 * since Supabase does not directly tell insert-vs-update counts per row.
 *
 * @param {Array<{ jamendo_id: string, title: string, artist: string, audio_url: string, image_url: string, duration: number, popularity: number }>} songs
 * @returns {Promise<number>}
 */
export async function upsertSongs(songs) {
  if (!Array.isArray(songs) || songs.length === 0) return 0;

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("songs")
    .upsert(songs, { onConflict: "jamendo_id" })
    // Return something lightweight so we can count rows.
    .select("jamendo_id");

  if (error) throw error;

  return Array.isArray(data) ? data.length : songs.length;
}
