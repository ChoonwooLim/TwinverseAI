import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import DocViewerPage from "./pages/DocViewerPage";
import SkillsPage from "./pages/SkillsPage";
import PluginsPage from "./pages/PluginsPage";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/docs/:docKey" element={<DocViewerPage />} />
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/plugins" element={<PluginsPage />} />
        <Route path="/admin" element={
          <ProtectedRoute requiredRole="admin">
            <DashboardPage />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
