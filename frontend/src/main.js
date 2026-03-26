/**
 * Supabase Auth Test (Vanilla JS)
 *
 * UI:
 * - Login with Google
 * - Logout
 * - Shows auth status, email, user id
 *
 * Notes:
 * - Make sure Google OAuth is enabled in Supabase Dashboard.
 * - Add your dev URL (e.g. http://localhost:5173) to Auth -> URL Configuration.
 */

import { supabase } from "./supabase";

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authStatusEl = document.getElementById("authStatus");
const emailEl = document.getElementById("userEmail");
const userIdEl = document.getElementById("userId");
const errorEl = document.getElementById("errorBox");

function nowIso() {
  return new Date().toISOString();
}

function setError(message) {
  if (!errorEl) return;
  if (!message) {
    errorEl.textContent = "";
    errorEl.hidden = true;
    return;
  }

  errorEl.textContent = message;
  errorEl.hidden = false;
}

function renderSession(session) {
  const loggedIn = Boolean(session);
  authStatusEl.textContent = loggedIn ? "logged in" : "logged out";
  emailEl.textContent = loggedIn ? session.user?.email ?? "(no email)" : "—";
  userIdEl.textContent = loggedIn ? session.user?.id ?? "(no id)" : "—";

  // Basic UX: avoid clicking logout when logged out.
  loginBtn.disabled = loggedIn;
  logoutBtn.disabled = !loggedIn;
}

async function refreshSessionFromClient() {
  setError("");

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  renderSession(data.session);
}

async function loginWithGoogle() {
  setError("");

  try {
    // This usually redirects the page to Google's OAuth flow.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google"
    });

    if (error) throw error;
  } catch (err) {
    console.error(`[auth] Login failed (${nowIso()})`, err);
    setError(err?.message ?? String(err));
  }
}

async function logout() {
  setError("");

  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Clear immediately; auth state listener will also run.
    renderSession(null);
    console.info(`[auth] Logout (${nowIso()})`);
  } catch (err) {
    console.error(`[auth] Logout failed (${nowIso()})`, err);
    setError(err?.message ?? String(err));
  }
}

function wireUi() {
  if (!(loginBtn instanceof HTMLButtonElement)) {
    throw new Error("Missing #loginBtn in index.html");
  }
  if (!(logoutBtn instanceof HTMLButtonElement)) {
    throw new Error("Missing #logoutBtn in index.html");
  }

  loginBtn.addEventListener("click", () => {
    void loginWithGoogle();
  });

  logoutBtn.addEventListener("click", () => {
    void logout();
  });
}

function wireAuthLoggingAndRendering() {
  // Fires on initial page load and on sign-in/out.
  supabase.auth.onAuthStateChange((event, session) => {
    renderSession(session);

    if (event === "SIGNED_IN") {
      console.info(`[auth] Successful login (${nowIso()})`, {
        userId: session?.user?.id,
        email: session?.user?.email
      });
    }

    if (event === "SIGNED_OUT") {
      console.info(`[auth] Logout (${nowIso()})`);
    }
  });
}

async function main() {
  wireUi();
  wireAuthLoggingAndRendering();

  // On initial load (including after OAuth redirect), read session.
  try {
    await refreshSessionFromClient();
  } catch (err) {
    console.error(`[auth] getSession failed (${nowIso()})`, err);
    setError(err?.message ?? String(err));
    renderSession(null);
  }
}

void main();
