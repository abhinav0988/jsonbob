import axios from "axios";
import { getApiBaseUrl } from "../lib/apiBase";
import { useAuthStore } from "../store/authStore";

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      throw error;
    }
    original._retry = true;
    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) {
      useAuthStore.getState().logout();
      throw error;
    }

    refreshing ??= (async () => {
      try {
        const base = getApiBaseUrl();
        const { data } = await axios.post(`${base}/auth/refresh`, { refreshToken });
        useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);
        if (data.user) useAuthStore.getState().setUser(data.user);
        return data.accessToken as string;
      } catch {
        useAuthStore.getState().logout();
        return null;
      } finally {
        refreshing = null;
      }
    })();

    const token = await refreshing;
    if (!token) throw error;
    original.headers.Authorization = `Bearer ${token}`;
    return api(original);
  },
);

export default api;
