/**
 * Normalizes a Jamendo track object into our internal song structure.
 *
 * Output shape:
 * {
 *   jamendo_id: string,
 *   title: string,
 *   artist: string,
 *   audio_url: string,
 *   image_url: string,
 *   duration: number,
 *   popularity: number
 * }
 */

/**
 * @param {any} track
 * @returns {{ jamendo_id: string, title: string, artist: string, audio_url: string, image_url: string, duration: number, popularity: number } | null}
 */
export function normalizeJamendoTrack(track) {
  if (!track) return null;

  const jamendoId = track.id ?? track.jamendo_id;
  const title = track.name ?? track.title;
  const artist = track.artist_name ?? track.artist;
  const audioUrl = track.audio ?? track.audio_url;
  const imageUrl = track.image ?? track.image_url;

  if (!jamendoId || !title || !artist || !audioUrl) {
    // Skip bad/partial rows; keep ingestion resilient.
    return null;
  }

  // Jamendo typically returns duration in seconds. Popularity can vary by field.
  const duration = Number(track.duration ?? 0);
  const popularity = Number(
    track.popularity ??
      track.popularity_total ??
      track.popularity_week ??
      track.popularity_month ??
      0
  );

  return {
    jamendo_id: String(jamendoId),
    title: String(title),
    artist: String(artist),
    audio_url: String(audioUrl),
    image_url: imageUrl ? String(imageUrl) : "",
    duration: Number.isFinite(duration) ? duration : 0,
    popularity: Number.isFinite(popularity) ? popularity : 0
  };
}
