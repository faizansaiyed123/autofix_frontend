/** Browser-facing configuration; `NEXT_PUBLIC_API_URL` must be reachable from the user's browser. */
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");

export const API_PREFIX = "/api/v1";

/** Currency the shop trades in. Mirrors `COMPANY_CURRENCY` on the backend. */
export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "USD";

/** Company name for the shell header. Mirrors `COMPANY_NAME` on the backend. */
export const COMPANY_NAME =
  process.env.NEXT_PUBLIC_COMPANY_NAME ?? "AutoFix Garage";

export const STORAGE_KEYS = {
  accessToken: "autofix.access_token",
  refreshToken: "autofix.refresh_token",
} as const;
