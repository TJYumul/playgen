import { useEffect } from "react";

function App() {
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
    </div>
  );
}

export default App;
