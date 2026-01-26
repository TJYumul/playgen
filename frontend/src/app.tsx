import { useEffect } from "react";
import { useAuth } from "./components/AuthProvider";
import { supabase } from "./supabase";

function App() {
  const { user, session, loading } = useAuth();
  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        console.log("Backend health:", data);
      })
      .catch((err) => {
        console.error("Backend health check failed:", err);
      });
  }, []);

  return (
    <div className="app">
      <h1>Playlist generation</h1>
      <div style={{ marginTop: 16 }}>
        <p>Status: {loading ? "loading…" : session ? "logged in" : "logged out"}</p>
        <p>Email: {user?.email ?? "—"}</p>
        <p>User ID: {user?.id ?? "—"}</p>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onClick={() => {
              void supabase.auth.signInWithOAuth({ provider: "google" });
            }}
            disabled={loading || Boolean(session)}
          >
            Login with Google
          </button>
          <button
            onClick={() => {
              void supabase.auth.signOut();
            }}
            disabled={loading || !session}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
export default App;
