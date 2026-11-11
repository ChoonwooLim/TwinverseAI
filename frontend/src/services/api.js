import axios from "axios";
import { clearStoredAuth, isDeviceRemembered, readToken, refreshSession } from "./session";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
});

api.interceptors.request.use((config) => {
  const token = readToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config;
    if (err.response?.status === 401 && config && !config.url?.includes("/api/auth/")) {
      // A remembered device gets one silent refresh + retry before we give up.
      if (!config._authRetried && isDeviceRemembered()) {
        config._authRetried = true;
        if ((await refreshSession()) === "ok") return api(config);
      }
      clearStoredAuth();
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
