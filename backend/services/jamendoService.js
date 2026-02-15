/**
 * Jamendo API service.
 * Fetches tracks from Jamendo using a server-side client ID.
 *
 * API docs: https://developer.jamendo.com/v3.0
 */

const JAMENDO_TRACKS_ENDPOINT = "https://api.jamendo.com/v3.0/tracks";

/**
 * Fetch a list of Jamendo tracks.
 *
 * Supports pagination via `offset`, and optional filtering via `genre` (mapped to Jamendo `tags`).
 *
 * @param {{ clientId: string, limit?: number, offset?: number, genre?: string }} options
 * @returns {Promise<Array<any>>}
 */
export async function fetchJamendoTracks({ clientId, limit = 20, offset = 0, genre } = {}) {
  if (!clientId) throw new Error("Jamendo clientId is required");

  // Uses native fetch (Node 18+). If you’re on older Node, add node-fetch.
  if (typeof fetch !== "function") {
    throw new Error(
      "Global fetch is not available. Use Node 18+ or add a fetch polyfill (e.g. node-fetch)."
    );
  }

  const url = new URL(JAMENDO_TRACKS_ENDPOINT);
  const params = new URLSearchParams({
    client_id: clientId,
    format: "json",
    limit: String(limit),
    offset: String(offset),
    audioformat: "mp31"
  });

  // Jamendo uses `tags` for genre-style filtering.
  if (genre && String(genre).trim().length > 0) {
    params.set("tags", String(genre).trim());
  }

  url.search = params.toString();

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Jamendo fetch failed: ${response.status} ${response.statusText} ${body}`);
  }

  /** @type {{ results?: Array<any> }} */
  const json = await response.json();
  const results = Array.isArray(json?.results) ? json.results : [];

  return results;
}
