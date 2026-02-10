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

/**
 * Fetch songs from the `songs` table.
 *
 * @param {{ limit?: number }} [options]
 * @returns {Promise<Array<{ id: string, title: string, artist: string, audio_url: string, cover_url: string }>>}
 */
export async function listSongs({ limit = 200 } = {}) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("songs")
     .select("id,jamendo_id,title,artist,audio_url,image_url,popularity")
    .order("popularity", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];

  return rows
    .map((row) => {
      const id = row?.id;
      const title = row?.title;
      const artist = row?.artist;
      const audioUrl = row?.audio_url;
      const coverUrl = row?.image_url;

      if (!id || !title || !artist || !audioUrl) return null;

      return {
        id: String(id),
        title: String(title),
        artist: String(artist),
        audio_url: String(audioUrl),
        cover_url: coverUrl ? String(coverUrl) : "",
        // Keep Jamendo id available for debugging/attribution if needed.
        jamendo_id: row?.jamendo_id ? String(row.jamendo_id) : undefined
      };
    })
    .filter(Boolean);
}
