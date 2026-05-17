import { lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { runAuthCheck } from "./services/authCheck";

// Lazy-loaded pages
const HomePage = lazy(() => import("./pages/HomePage"));
const VisionPage = lazy(() => import("./pages/VisionPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ServicesPage = lazy(() => import("./pages/ServicesPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const BoardPage = lazy(() => import("./pages/community/BoardPage"));
const PostPage = lazy(() => import("./pages/community/PostPage"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminBoards = lazy(() => import("./pages/admin/AdminBoards"));
const AdminDocs = lazy(() => import("./pages/admin/AdminDocs"));
const AdminSkills = lazy(() => import("./pages/admin/AdminSkills"));
const AdminPlugins = lazy(() => import("./pages/admin/AdminPlugins"));
const AdminNews = lazy(() => import("./pages/admin/AdminNews"));
const AdminClawCode = lazy(() => import("./pages/admin/AdminClawCode"));
const AdminClaudeCodeRepo = lazy(() => import("./pages/admin/AdminClaudeCodeRepo"));
const AdminDesignMd = lazy(() => import("./pages/admin/AdminDesignMd"));
const AdminDesignMdDetail = lazy(() => import("./pages/admin/AdminDesignMdDetail"));
const AdminOpenClawDevices = lazy(() => import("./pages/admin/AdminOpenClawDevices"));
const AdminOpenClawConsole = lazy(() => import("./pages/admin/AdminOpenClawConsole"));
const AdminOpenClawOverview = lazy(() => import("./pages/admin/AdminOpenClawOverview"));
const DeskAnalysis = lazy(() => import("./pages/twinversedesk/DeskAnalysis"));
const DeskPlan = lazy(() => import("./pages/twinversedesk/DeskPlan"));
const DeskLaunch = lazy(() => import("./pages/twinversedesk/DeskLaunch"));
const TVDeskRun = lazy(() => import("./pages/twinversedesk/TVDeskRun"));

export default function App() {
  // Validate token on boot + every 60s. Detects expired/revoked JWTs and clears
  // localStorage so the UI stops showing a stale "admin" name while downstream
  // services (PS2 GPU, etc.) reject the user. See 2026-05-12 fix.
  useEffect(() => {
    runAuthCheck();
    const id = setInterval(runAuthCheck, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
            {/* Public */}
            <Route path="/" element={<HomePage />} />
            <Route path="/vision" element={<VisionPage />} />
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
            <Route path="/admin/news" element={<ProtectedRoute requiredRole="admin"><AdminNews /></ProtectedRoute>} />
            <Route path="/admin/claw-code" element={<ProtectedRoute requiredRole="admin"><AdminClawCode /></ProtectedRoute>} />
            <Route path="/admin/claude-code-repo" element={<ProtectedRoute requiredRole="admin"><AdminClaudeCodeRepo /></ProtectedRoute>} />
            <Route path="/admin/design-md" element={<ProtectedRoute requiredRole="admin"><AdminDesignMd /></ProtectedRoute>} />
            <Route path="/admin/design-md/:slug" element={<ProtectedRoute requiredRole="admin"><AdminDesignMdDetail /></ProtectedRoute>} />
            <Route path="/admin/openclaw" element={<ProtectedRoute requiredRole="admin"><AdminOpenClawOverview /></ProtectedRoute>} />
            <Route path="/admin/openclaw-devices" element={<ProtectedRoute requiredRole="admin"><AdminOpenClawDevices /></ProtectedRoute>} />
            <Route path="/admin/openclaw-console" element={<ProtectedRoute requiredRole="admin"><AdminOpenClawConsole /></ProtectedRoute>} />
            <Route path="/admin/openclaw-console/:tab" element={<ProtectedRoute requiredRole="admin"><AdminOpenClawConsole /></ProtectedRoute>} />
          </Route>
        </Routes>
    </BrowserRouter>
  );
}
