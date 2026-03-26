/**
 * Supabase client initialization.
 *
 * Vite loads variables prefixed with VITE_ from `.env` files.
 * Required:
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Helpful diagnostics to verify env loading.
  console.error("[supabase] Missing env vars. Check your frontend/.env file.");
  console.error("[supabase] VITE_SUPABASE_URL present:", Boolean(supabaseUrl));
  console.error("[supabase] VITE_SUPABASE_ANON_KEY present:", Boolean(supabaseAnonKey));
  throw new Error(
    "Missing Supabase env vars: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY"
  );
}

// Log a safe hint (don’t print full keys).
console.info("[supabase] URL:", supabaseUrl);
console.info("[supabase] Anon key prefix:", `${supabaseAnonKey.slice(0, 8)}…`);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Needed for OAuth redirects to be processed on page load.
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true
  }
});
