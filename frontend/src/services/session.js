import axios from "axios";

// Client side of "이 기기에서 로그인 유지".
//
// The short-lived access token (JWT, 8h) stays in localStorage as before, so
// every existing consumer (api.js, ps2api.js, WebSocket handshakes) keeps
// working. A remembered device additionally holds an HttpOnly `tv_device`
// cookie that JS cannot read; POST /api/auth/refresh trades it for a fresh
// access token. `tv_remember_device` is only a hint flag so anonymous
// visitors never fire a pointless refresh request.

const TOKEN_KEY = "token";
const USER_KEY = "user";
const REMEMBER_KEY = "tv_remember_device";

const authClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  withCredentials: true,
});

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readToken() {
  return storage()?.getItem(TOKEN_KEY) ?? null;
}

export function decodeJwtPayload(token) {
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

/** Seconds until the token expires (negative when expired); null if unreadable. */
export function tokenSecondsLeft(token, nowMs = Date.now()) {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return null;
  return payload.exp - Math.floor(nowMs / 1000);
}

export function isDeviceRemembered() {
  return storage()?.getItem(REMEMBER_KEY) === "1";
}

export function storeSession(data, { remember } = {}) {
  const s = storage();
  if (!s) return;
  s.setItem(TOKEN_KEY, data.access_token);
  s.setItem(USER_KEY, JSON.stringify(data.user));
  if (remember === true) s.setItem(REMEMBER_KEY, "1");
  if (remember === false) s.removeItem(REMEMBER_KEY);
}

/** Drop the access token only; a remembered device may still refresh. */
export function clearStoredAuth() {
  const s = storage();
  s?.removeItem(TOKEN_KEY);
  s?.removeItem(USER_KEY);
}

/** Forget everything, including the remembered-device hint. */
export function clearSession() {
  clearStoredAuth();
  storage()?.removeItem(REMEMBER_KEY);
}

/** True when the app should refresh before rendering (expired/missing token on a remembered device). */
export function needsBootRefresh(nowMs = Date.now(), minValiditySec = 60) {
  if (!isDeviceRemembered()) return false;
  const left = tokenSecondsLeft(readToken(), nowMs);
  return left === null || left <= minValiditySec;
}

let inflight = null;

/**
 * Trade the HttpOnly device cookie for a new access token.
 * Resolves "ok" | "rejected" (device no longer valid) | "unavailable" (network/server error).
 * Concurrent callers share one request.
 */
export function refreshSession() {
  if (inflight) return inflight;
  inflight = authClient
    .post("/api/auth/refresh")
    .then(({ data }) => {
      storeSession(data, { remember: true });
      return "ok";
    })
    .catch((err) => {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        clearSession();
        return "rejected";
      }
      return "unavailable";
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Make sure a usable access token exists, refreshing on a remembered device. Resolves "valid" | "none". */
export async function ensureSession({ minValiditySec = 0, nowMs = Date.now() } = {}) {
  const left = tokenSecondsLeft(readToken(), nowMs);
  if (left !== null && left > minValiditySec) return "valid";
  if (isDeviceRemembered() && (await refreshSession()) === "ok") return "valid";
  return left !== null && left > 0 ? "valid" : "none";
}

/** Sign out here: revoke the device server-side (best effort) and clear local state. */
export async function logoutSession() {
  try {
    await authClient.post("/api/auth/logout");
  } catch {
    // Offline or server down — local sign-out still happens.
  }
  clearSession();
}
