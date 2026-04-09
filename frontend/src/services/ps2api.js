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

export default ps2api;
