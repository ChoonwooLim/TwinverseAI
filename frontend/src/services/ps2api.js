import axios from "axios";

// PS2 GPU Server URL — set this in production to point to the GPU server tunnel
// Local dev: empty (uses main backend via Vite proxy)
// Production: e.g. "https://ps2-api.twinverse.org" (Cloudflare Tunnel to GPU PC)
const PS2_API_URL = import.meta.env.VITE_PS2_API_URL
  || (import.meta.env.PROD ? "https://ps2-api.twinverse.org" : "");

const ps2api = axios.create({
  baseURL: PS2_API_URL,
});

// Reuse the same JWT token from the main backend
ps2api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 handling — only wipe credentials for actual user-action requests
// (spawn, terminate, heartbeat, office join, etc.).
// Health checks and session-status polls run automatically on page load;
// a 401 from the GPU server for those does NOT mean the main-site token is
// invalid, so we must NOT nuke localStorage or redirect — otherwise simply
// navigating to /twinversedesk/launch logs the user out.
const PS2_SILENT_PATHS = ["/api/ps2/health", "/api/ps2/sessions", "/api/ps2/status/"];

ps2api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const url = err.config?.url || "";
      const isSilent = PS2_SILENT_PATHS.some((p) => url.includes(p));
      if (!isSilent) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

// Office multiplayer helpers
export const officeApi = {
  join: (officeId, map) =>
    ps2api.post("/api/ps2/office/join", { office_id: officeId, map }),
  status: (officeId) =>
    ps2api.get(`/api/ps2/office/${officeId}`),
};

export default ps2api;
