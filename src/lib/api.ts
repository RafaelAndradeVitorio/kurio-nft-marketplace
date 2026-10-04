import axios from "axios";
import { QueryClient } from "@tanstack/react-query";
import type { ApiError } from "../domain/types";
const guest = localStorage.getItem("kurio.guest") || crypto.randomUUID();
localStorage.setItem("kurio.guest", guest);
export const api = axios.create({ baseURL: "/api", timeout: 2500 });
api.interceptors.request.use((config) => {
  config.headers.set("x-guest", guest);
  const token = localStorage.getItem("kurio.session");
  if (token) config.headers.set("x-session", token);
  return config;
});
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401)
      window.dispatchEvent(new Event("kurio:expired"));
    return Promise.reject(error);
  },
);
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: (count, error) =>
        count < 1 &&
        (!axios.isAxiosError(error) ||
          !error.response ||
          error.response.status >= 500),
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
});
export const get = <T>(url: string, signal?: AbortSignal) =>
  api.get<T>(url, { signal }).then((r) => r.data);
export const errorInfo = (error: unknown): ApiError =>
  axios.isAxiosError<ApiError>(error)
    ? error.response?.data || {
        code: "NETWORK",
        message:
          error.code === "ECONNABORTED"
            ? "A resposta demorou. Tente novamente para recuperar a mesma operação."
            : "Não foi possível conectar. Verifique a conexão e tente novamente.",
      }
    : {
        code: "UNKNOWN",
        message: error instanceof Error ? error.message : "Ocorreu um erro.",
      };
