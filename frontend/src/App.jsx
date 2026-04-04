import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import ServicesPage from "./pages/ServicesPage";
import LoginPage from "./pages/LoginPage";
import BoardPage from "./pages/community/BoardPage";
import PostPage from "./pages/community/PostPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminBoards from "./pages/admin/AdminBoards";
import AdminDocs from "./pages/admin/AdminDocs";
import AdminSkills from "./pages/admin/AdminSkills";
import AdminPlugins from "./pages/admin/AdminPlugins";
import DeskAnalysis from "./pages/twinversedesk/DeskAnalysis";
import DeskPlan from "./pages/twinversedesk/DeskPlan";
import DeskLaunch from "./pages/twinversedesk/DeskLaunch";
import TVDeskRun from "./pages/twinversedesk/TVDeskRun";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          {/* Public */}
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* TwinverseDesk */}
          <Route path="/twinversedesk/analysis" element={<DeskAnalysis />} />
          <Route path="/twinversedesk/plan" element={<DeskPlan />} />
          <Route path="/twinversedesk/launch" element={<DeskLaunch />} />
          <Route path="/twinversedesk/run" element={<TVDeskRun />} />

          {/* Community */}
          <Route path="/community/:boardType" element={<BoardPage />} />
          <Route path="/community/:boardType/:postId" element={<PostPage />} />
          <Route path="/community/:boardType/:postId/edit" element={<PostPage />} />

          {/* Admin */}
          <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin"><AdminUsers /></ProtectedRoute>} />
          <Route path="/admin/boards" element={<ProtectedRoute requiredRole="admin"><AdminBoards /></ProtectedRoute>} />
          <Route path="/admin/docs" element={<ProtectedRoute requiredRole="admin"><AdminDocs /></ProtectedRoute>} />
          <Route path="/admin/docs/:docKey" element={<ProtectedRoute requiredRole="admin"><AdminDocs /></ProtectedRoute>} />
          <Route path="/admin/skills" element={<ProtectedRoute requiredRole="admin"><AdminSkills /></ProtectedRoute>} />
          <Route path="/admin/plugins" element={<ProtectedRoute requiredRole="admin"><AdminPlugins /></ProtectedRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
