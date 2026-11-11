import api from "./api";
import {
  clearStoredAuth,
  isDeviceRemembered,
  readToken,
  refreshSession,
  tokenSecondsLeft,
} from "./session";

// Refresh this long before the 8h access token runs out, so WebSocket
// handshakes and other direct localStorage readers always see a live token.
const REFRESH_AHEAD_SEC = 15 * 60;

function clearAuth(reason) {
  clearStoredAuth();
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  console.warn(`[auth] cleared: ${reason}`);
  window.location.reload();
}

let serverCheckInFlight = false;

export async function runAuthCheck() {
  const token = readToken();
  if (!token) return;

  const left = tokenSecondsLeft(token);
  if (left === null) {
    clearAuth("malformed token");
    return;
  }

  if (left <= REFRESH_AHEAD_SEC && isDeviceRemembered()) {
    const result = await refreshSession();
    if (result === "ok") return;
    if (result === "rejected") {
      clearAuth("remembered device rejected");
      return;
    }
    // "unavailable": keep the current token while it still works.
  }

  if (left <= 0) {
    clearAuth("token expired (client exp check)");
    return;
  }

  if (serverCheckInFlight) return;
  serverCheckInFlight = true;
  try {
    await api.get("/api/auth/me");
  } catch (err) {
    if (err?.response?.status === 401) {
      if (isDeviceRemembered() && (await refreshSession()) === "ok") return;
      clearAuth("server rejected /api/auth/me");
    }
  } finally {
    serverCheckInFlight = false;
  }
}
