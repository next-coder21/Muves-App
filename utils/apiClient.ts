// Single source of truth for all backend HTTP traffic.
//
// Centralising fetch lets every screen/context inherit:
//   • request timeout via AbortController (prevents indefinite hangs)
//   • parsed error payloads (JSON or text) wrapped in a typed ApiError
//   • a global 401/403 hook so the auth context can sign the user out
//   • caller-supplied AbortSignal merged with the timeout signal
//
// IMPORTANT: do not import any React/expo modules here. This file must stay
// pure so it can be invoked from outside the React tree (e.g. background
// auth check) without dragging providers into the dependency graph.

export class ApiError extends Error {
  status: number;
  payload?: unknown;
  isNetwork: boolean;
  isTimeout: boolean;

  constructor(message: string, opts: {
    status?: number;
    payload?: unknown;
    isNetwork?: boolean;
    isTimeout?: boolean;
  } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status ?? 0;
    this.payload = opts.payload;
    this.isNetwork = opts.isNetwork ?? false;
    this.isTimeout = opts.isTimeout ?? false;
  }
}

export type ApiMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type ApiOptions = {
  method?: ApiMethod;
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
  // When true, do NOT trigger the global onAuthError hook on 401/403
  // (used by the auth check itself so it doesn't infinite-loop on logout).
  skipAuthErrorHook?: boolean;
};

const DEFAULT_TIMEOUT_MS = 15_000;

// Global hook fired exactly once per authentication failure. The auth context
// installs this on mount so contexts/hooks anywhere can rely on it.
let onAuthErrorHandler: ((status: number) => void) | null = null;

export function setAuthErrorHandler(fn: ((status: number) => void) | null) {
  onAuthErrorHandler = fn;
}

function mergeSignals(a: AbortSignal, b?: AbortSignal): AbortSignal {
  if (!b) return a;
  // If either aborts, propagate to a fresh controller
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  if (a.aborted || b.aborted) ctrl.abort();
  else {
    a.addEventListener("abort", onAbort, { once: true });
    b.addEventListener("abort", onAbort, { once: true });
  }
  return ctrl.signal;
}

async function parseError(res: Response): Promise<{ message: string; payload: unknown }> {
  const text = await res.text().catch(() => "");
  if (!text) return { message: `Request failed (${res.status})`, payload: null };
  try {
    const json = JSON.parse(text);
    const j = json as Record<string, unknown>;
    const msg = (
      typeof json === "object" && json !== null &&
      (typeof j.error === "string" ? j.error : typeof j.message === "string" ? j.message : null)
    ) || `Request failed (${res.status})`;
    return { message: String(msg), payload: json };
  } catch {
    // Non-JSON body (HTML error page, plain text)
    return { message: text.slice(0, 200) || `Request failed (${res.status})`, payload: text };
  }
}

export async function apiRequest<T = unknown>(url: string, opts: ApiOptions = {}): Promise<T> {
  const {
    method = "GET",
    body,
    token,
    headers: extraHeaders,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
    skipAuthErrorHook,
  } = opts;

  const headers: Record<string, string> = { Accept: "application/json", ...extraHeaders };
  if (body !== undefined) headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const timeoutCtrl = new AbortController();
  const timeoutId = setTimeout(() => timeoutCtrl.abort(), timeoutMs);
  const finalSignal = mergeSignals(timeoutCtrl.signal, signal);

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: finalSignal,
    });
  } catch (e: unknown) {
    clearTimeout(timeoutId);
    // Caller-initiated abort: rethrow so callers can distinguish via signal.aborted
    if (signal?.aborted) throw e;
    if (timeoutCtrl.signal.aborted) {
      throw new ApiError("Request timed out", { isTimeout: true });
    }
    throw new ApiError(
      e instanceof Error ? e.message : "Network error",
      { isNetwork: true }
    );
  }
  clearTimeout(timeoutId);

  if ((res.status === 401 || res.status === 403) && !skipAuthErrorHook) {
    onAuthErrorHandler?.(res.status);
  }

  if (!res.ok) {
    const { message, payload } = await parseError(res);
    throw new ApiError(message, { status: res.status, payload });
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  // Try to parse JSON; if body is empty/non-JSON, return as text or undefined
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}
