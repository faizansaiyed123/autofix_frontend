/**
 * Presentation helpers.
 *
 * Money is formatted from the number the API returned, never recomputed from
 * the lines on screen: the backend rounds to cents in the service layer, and a
 * second rounding done in the browser is a second answer to the same question.
 */
import { CURRENCY } from "@/lib/config";

const moneyFormatters = new Map<string, Intl.NumberFormat>();

function moneyFormatter(currency: string): Intl.NumberFormat {
  let formatter = moneyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    moneyFormatters.set(currency, formatter);
  }
  return formatter;
}

export function formatMoney(value: number | null | undefined, currency = CURRENCY): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return moneyFormatter(currency).format(value);
}

/** Money with an explicit sign, for ledgers where direction is the point. */
export function formatSignedMoney(value: number, currency = CURRENCY): string {
  const formatted = formatMoney(Math.abs(value), currency);
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

/**
 * Parse a backend timestamp for display.
 *
 * The API returns naive local datetimes (`2026-10-03T09:30:00`) for shop time —
 * a garage's day starts when the shop opens, not at UTC — so they are read as
 * local wall-clock time rather than converted from UTC, which would shift every
 * booking in the calendar by the viewer's offset.
 */
function parseApiDate(value: string): Date {
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
  return new Date(hasZone ? value : `${value}Z`);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = parseApiDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = parseApiDate(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = parseApiDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
}

/** "in 3 days" / "2 days ago" — the form a person actually plans around. */
export function formatRelative(value: string | null | undefined): string {
  if (!value) return "—";
  const date = parseApiDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  const deltaMs = date.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const minutes = Math.round(deltaMs / 60000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

export function todayIso(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

export function daysAgoIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

/** Convert an ISO instant into the `YYYY-MM-DDTHH:mm` shape the API expects. */
export function toApiDateTime(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function titleCase(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function personName(person: { first_name: string; last_name: string } | null | undefined): string {
  if (!person) return "—";
  return `${person.first_name} ${person.last_name}`.trim() || "—";
}

export function vehicleLabel(vehicle: {
  make: string;
  model: string;
  year?: number | null;
  license_plate?: string | null;
} | null | undefined): string {
  if (!vehicle) return "—";
  const base = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
  return vehicle.license_plate ? `${base} (${vehicle.license_plate})` : base;
}

export function initials(first?: string | null, last?: string | null): string {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
}