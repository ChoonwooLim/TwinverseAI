import { beforeEach, describe, expect, it, vi } from "vitest";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("axios", () => ({ default: { create: vi.fn(() => ({ post })) } }));

import {
  clearSession,
  ensureSession,
  isDeviceRemembered,
  logoutSession,
  needsBootRefresh,
  readToken,
  refreshSession,
  storeSession,
  tokenSecondsLeft,
} from "./session";

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

function jwt(expSec) {
  const enc = (o) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${enc({ alg: "HS256" })}.${enc({ sub: "1", exp: expSec })}.sig`;
}

const NOW_MS = 1_800_000_000_000;
const NOW = NOW_MS / 1000;
const USER = { id: 1, username: "steven", role: "admin" };

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  post.mockReset();
});

describe("tokenSecondsLeft", () => {
  it("reads exp from the JWT payload", () => {
    expect(tokenSecondsLeft(jwt(NOW + 90), NOW_MS)).toBe(90);
    expect(tokenSecondsLeft(jwt(NOW - 5), NOW_MS)).toBe(-5);
  });

  it("returns null for missing or malformed tokens", () => {
    expect(tokenSecondsLeft(null, NOW_MS)).toBeNull();
    expect(tokenSecondsLeft("not-a-jwt", NOW_MS)).toBeNull();
  });
});

describe("needsBootRefresh", () => {
  it("never fires for devices that did not opt in", () => {
    expect(needsBootRefresh(NOW_MS)).toBe(false);
    localStorage.setItem("token", jwt(NOW - 10));
    expect(needsBootRefresh(NOW_MS)).toBe(false);
  });

  it("fires on a remembered device whose token is missing, expired or about to expire", () => {
    storeSession({ access_token: jwt(NOW - 10), user: USER }, { remember: true });
    expect(needsBootRefresh(NOW_MS)).toBe(true);

    localStorage.removeItem("token");
    expect(needsBootRefresh(NOW_MS)).toBe(true);

    localStorage.setItem("token", jwt(NOW + 30));
    expect(needsBootRefresh(NOW_MS)).toBe(true);
  });

  it("skips when the remembered token is still comfortably valid", () => {
    storeSession({ access_token: jwt(NOW + 3600), user: USER }, { remember: true });
    expect(needsBootRefresh(NOW_MS)).toBe(false);
  });
});

describe("refreshSession", () => {
  it("stores the new token on success", async () => {
    localStorage.setItem("tv_remember_device", "1");
    const fresh = jwt(NOW + 8 * 3600);
    post.mockResolvedValueOnce({ data: { access_token: fresh, user: USER } });

    await expect(refreshSession()).resolves.toBe("ok");
    expect(post).toHaveBeenCalledWith("/api/auth/refresh");
    expect(readToken()).toBe(fresh);
    expect(JSON.parse(localStorage.getItem("user"))).toEqual(USER);
    expect(isDeviceRemembered()).toBe(true);
  });

  it("forgets the device when the server rejects it", async () => {
    storeSession({ access_token: jwt(NOW - 10), user: USER }, { remember: true });
    post.mockRejectedValueOnce({ response: { status: 401 } });

    await expect(refreshSession()).resolves.toBe("rejected");
    expect(readToken()).toBeNull();
    expect(isDeviceRemembered()).toBe(false);
  });

  it("keeps the device on network or server errors so a later retry can succeed", async () => {
    storeSession({ access_token: jwt(NOW - 10), user: USER }, { remember: true });
    post.mockRejectedValueOnce(new Error("Network Error"));

    await expect(refreshSession()).resolves.toBe("unavailable");
    expect(isDeviceRemembered()).toBe(true);
  });

  it("shares one request between concurrent callers", async () => {
    localStorage.setItem("tv_remember_device", "1");
    post.mockResolvedValueOnce({ data: { access_token: jwt(NOW + 100), user: USER } });

    const [a, b] = await Promise.all([refreshSession(), refreshSession()]);
    expect([a, b]).toEqual(["ok", "ok"]);
    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe("ensureSession", () => {
  it("does not call the server while the token is valid", async () => {
    storeSession({ access_token: jwt(NOW + 3600), user: USER }, { remember: true });
    await expect(ensureSession({ minValiditySec: 60, nowMs: NOW_MS })).resolves.toBe("valid");
    expect(post).not.toHaveBeenCalled();
  });

  it("silently signs a remembered device back in after expiry", async () => {
    storeSession({ access_token: jwt(NOW - 3600), user: USER }, { remember: true });
    post.mockResolvedValueOnce({ data: { access_token: jwt(NOW + 8 * 3600), user: USER } });

    await expect(ensureSession({ nowMs: NOW_MS })).resolves.toBe("valid");
    expect(tokenSecondsLeft(readToken(), NOW_MS)).toBeGreaterThan(0);
  });

  it("reports none for an expired token on a device that was not remembered", async () => {
    storeSession({ access_token: jwt(NOW - 3600), user: USER }, { remember: false });
    await expect(ensureSession({ nowMs: NOW_MS })).resolves.toBe("none");
    expect(post).not.toHaveBeenCalled();
  });
});

describe("logoutSession", () => {
  it("revokes the device and clears local state even if the request fails", async () => {
    storeSession({ access_token: jwt(NOW + 3600), user: USER }, { remember: true });
    post.mockRejectedValueOnce(new Error("offline"));

    await logoutSession();
    expect(post).toHaveBeenCalledWith("/api/auth/logout");
    expect(readToken()).toBeNull();
    expect(isDeviceRemembered()).toBe(false);
  });

  it("clearSession wipes the remember hint", () => {
    storeSession({ access_token: "x", user: USER }, { remember: true });
    clearSession();
    expect(isDeviceRemembered()).toBe(false);
  });
});
