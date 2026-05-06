import { useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiRequest, type ApiOptions } from "@/utils/apiClient";

// Thin wrapper around apiRequest that injects the current auth token. Every
// helper accepts an optional AbortSignal so screens can cancel in-flight
// requests on unmount or when a newer search supersedes them.
export function useApi() {
  const { token } = useAuth();

  const get = useCallback(
    <T = any>(url: string, opts: Omit<ApiOptions, "method" | "body" | "token"> = {}) =>
      apiRequest<T>(url, { ...opts, method: "GET", token }),
    [token]
  );

  const post = useCallback(
    <T = any>(url: string, body?: unknown, opts: Omit<ApiOptions, "method" | "body" | "token"> = {}) =>
      apiRequest<T>(url, { ...opts, method: "POST", body, token }),
    [token]
  );

  const patch = useCallback(
    <T = any>(url: string, body?: unknown, opts: Omit<ApiOptions, "method" | "body" | "token"> = {}) =>
      apiRequest<T>(url, { ...opts, method: "PATCH", body, token }),
    [token]
  );

  const del = useCallback(
    <T = any>(url: string, opts: Omit<ApiOptions, "method" | "body" | "token"> = {}) =>
      apiRequest<T>(url, { ...opts, method: "DELETE", token }),
    [token]
  );

  return { get, post, patch, del };
}
