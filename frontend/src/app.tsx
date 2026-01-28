import { Routes, Route, Navigate } from "react-router-dom"; // ✅ Router
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import HomePage from "./pages/HomePage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />          {/* Landing page */}
      <Route path="/login" element={<Login />} />            {/* Login page */}
      <Route path="/home" element={<HomePage />} />          {/* Home page */}
      {/* Fallback: redirect unknown routes to landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
