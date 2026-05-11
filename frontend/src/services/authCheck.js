import api from "./api";

function decodeJwtPayload(token) {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "===".slice((b64.length + 3) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function clearAuth(reason) {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  console.warn(`[auth] cleared: ${reason}`);
  window.location.reload();
}

let serverCheckInFlight = false;

export async function runAuthCheck() {
  const token = localStorage.getItem("token");
  if (!token) return;

  const payload = decodeJwtPayload(token);
  if (!payload) {
    clearAuth("malformed token");
    return;
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp <= nowSec) {
    clearAuth("token expired (client exp check)");
    return;
  }

  if (serverCheckInFlight) return;
  serverCheckInFlight = true;
  try {
    await api.get("/api/auth/me");
  } catch (err) {
    if (err?.response?.status === 401) {
      clearAuth("server rejected /api/auth/me");
    }
  } finally {
    serverCheckInFlight = false;
  }
}
