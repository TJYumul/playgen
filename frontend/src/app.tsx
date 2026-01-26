import { Routes, Route } from "react-router-dom"; // ✅ Import router
import LandingPage from "./pages/LandingPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />          {/* Landing page */}
    </Routes>
  );
}

export default App;
