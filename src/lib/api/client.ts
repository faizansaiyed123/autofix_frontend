/**
 * The API client.
 *
 * Three things live here and nowhere else:
 *
 *  1. Token custody. The access token is short-lived (30 minutes) and the refresh
 *     token long-lived. Both are held in `localStorage` because the backend is
 *     stateless JWT with no httpOnly cookie endpoint to borrow — a real
 *     deployment should add one, and this file is the single place that would
 *     have to change when it does.
 *  2. One refresh at a time. Six panels load on the dashboard and all six can
 *     come back 401 at the same moment. Without a single-flight latch that is
 *     six refresh calls, five of which race and lose, and the losers log the
 *     user out mid-session. `refreshInFlight` collapses them into one.
 *  3. Errors that carry their status. A 403 and a 404 mean different things to a
 *     caller — one is "not yours", the other is "not there" — so the status is
 *     on the exception rather than folded into a message string.
 */
import { API_BASE_URL, API_PREFIX, STORAGE_KEYS } from "@/lib/config";

export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, detail: unknown, message?: string) {
    super(message ?? `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }

  /** True when the caller simply is not allowed, as opposed to being unauthenticated. */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** Validation failures arrive as a list of `{loc, msg}`; anything else as prose. */
  get fieldErrors(): { field: string; message: string }[] {
    if (!Array.isArray(this.detail)) return [];
    return this.detail
      .filter((d): d is { loc?: unknown[]; msg?: string } => !!d && typeof d === "object")
      .map((d) => ({
        field: Array.isArray(d.loc) ? d.loc.filter((x) => x !== "body").join(".") : "",
        message: d.msg ?? "Invalid value",
      }));
  }

  get messageForUser(): string {
    const fieldErrors = this.fieldErrors;
    if (fieldErrors.length > 0) {
      return fieldErrors.map((f) => (f.field ? `${f.field}: ${f.message}` : f.message)).join("; ");
    }
    if (typeof this.detail === "string") return this.detail;
    return this.message;
  }
}

type Listener = () => void;
const forcedLogoutListeners = new Set<Listener>();

/** Called by the auth provider so a dead refresh token ends the session once. */
export function onForcedLogout(listener: Listener): () => void {
  forcedLogoutListeners.add(listener);
  return () => {
    forcedLogoutListeners.delete(listener);
  };
}

function announceForcedLogout() {
  clearTokens();
  for (const listener of forcedLogoutListeners) listener();
}

function readToken(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

export function getAccessToken(): string | null {
  return readToken(STORAGE_KEYS.accessToken);
}

export function setTokens(access: string, refresh: string) {
  window.localStorage.setItem(STORAGE_KEYS.accessToken, access);
  window.localStorage.setItem(STORAGE_KEYS.refreshToken, refresh);
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEYS.accessToken);
  window.localStorage.removeItem(STORAGE_KEYS.refreshToken);
}

export function hasStoredSession(): boolean {
  return readToken(STORAGE_KEYS.accessToken) !== null;
}

export type QueryValue = string | number | boolean | null | undefined | string[];
export type Query = Record<string, QueryValue>;

function buildQuery(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item));
    } else {
      params.append(key, String(value));
    }
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Query;
  /** Public routes skip the Authorization header and the refresh dance. */
  anonymous?: boolean;
  signal?: AbortSignal;
  /** Internal: prevents an infinite refresh loop on the retry. */
  _isRetry?: boolean;
}

async function parseError(response: Response): Promise<ApiError> {
  let detail: unknown = null;
  const text = await response.text().catch(() => "");
  if (text) {
    try {
      const parsed = JSON.parse(text);
      detail = parsed?.detail ?? parsed;
    } catch {
      detail = text;
    }
  }
  return new ApiError(response.status, detail);
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Exchange the refresh token for a new pair. Single-flight: concurrent callers
 * await the same promise rather than each starting their own exchange.
 */
async function refreshTokens(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refresh = readToken(STORAGE_KEYS.refreshToken);
    if (!refresh) return false;
    try {
      const response = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!response.ok) return false;
      const tokens = (await response.json()) as { access_token: string; refresh_token: string };
      setTokens(tokens.access_token, tokens.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      // Released in a microtask so callers already awaiting this promise are not
      // handed a `null` latch.
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    }
  })();

  return refreshInFlight;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, anonymous = false, signal } = options;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (!anonymous) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${API_PREFIX}${path}${buildQuery(query)}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (response.status === 401 && !anonymous && !options._isRetry) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      return request<T>(path, { ...options, _isRetry: true });
    }
    announceForcedLogout();
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * Fetch a server-rendered HTML document (the printable estimate and invoice).
 *
 * It is fetched rather than linked so the browser's cookies-and-forwarded
 * headers are never in play and the download is a deliberate act: opening it in
 * a new tab would leak a bearer token into the address bar.
 */
export async function requestDocument<T = string>(path: string): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, { headers });
  if (!response.ok) throw await parseError(response);
  return (await response.text()) as T;
}

/** Download a server-rendered document as a file. */
export async function downloadDocument(path: string, filename: string) {
  const html = await requestDocument<string>(path);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) =>
    request<T>(path, { method: "GET", query, signal }),
  post: <T>(path: string, body?: unknown, query?: Query) =>
    request<T>(path, { method: "POST", body, query }),
  patch: <T>(path: string, body?: unknown, query?: Query) =>
    request<T>(path, { method: "PATCH", body, query }),
  put: <T>(path: string, body?: unknown, query?: Query) =>
    request<T>(path, { method: "PUT", body, query }),
  delete: <T>(path: string, query?: Query) => request<T>(path, { method: "DELETE", query }),
};