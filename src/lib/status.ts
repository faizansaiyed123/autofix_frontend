/**
 * One vocabulary for statuses, shared by every screen.
 *
 * The backend has a dozen independent status machines, and a status rendered
 * differently on two pages is the kind of defect nobody reports: the owner sees
 * "In progress" in red on one screen and in blue on another and cannot tell
 * whether the work is on fire. Anything not listed here falls back to neutral
 * title-cased text, so a new status from a new module shows up as itself rather
 * than as a screaming raw code.
 */

export type Tone = "neutral" | "info" | "progress" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-700 ring-ink-200",
  info: "bg-brand-50 text-brand-800 ring-brand-200",
  progress: "bg-amber-50 text-amber-800 ring-amber-200",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warning: "bg-orange-50 text-orange-800 ring-orange-200",
  danger: "bg-rose-50 text-rose-800 ring-rose-200",
};

export function toneClasses(tone: Tone): string {
  return TONES[tone];
}

const STATUS_TONES: Record<string, Tone> = {
  /* appointments & check-ins */
  REQUESTED: "info",
  NEW: "info",
  IN_REVIEW: "info",
  CONFIRMED: "info",
  CHECKED_IN: "progress",
  IN_SERVICE: "progress",
  IN_PROGRESS: "progress",
  ON_HOLD: "warning",
  COMPLETED: "success",
  QC_PASSED: "success",
  READY_FOR_PICKUP: "success",
  DELIVERED: "success",
  PASSED: "success",
  APPROVED: "success",
  ACTIVE: "success",
  IN_STOCK: "success",
  OK: "success",
  GREEN: "success",
  RECEIVED: "success",
  FULFILLED: "success",

  /* waiting on somebody */
  SENT: "info",
  QUOTED: "info",
  SCHEDULED: "info",
  PENDING: "warning",
  PARTIALLY_APPROVED: "warning",
  PARTIALLY_RECEIVED: "warning",
  PARTIALLY_PAID: "warning",
  ISSUED: "warning",
  LOW_STOCK: "warning",
  ATTENTION: "warning",
  RECOMMENDED: "warning",
  YELLOW: "warning",
  MEDIUM: "warning",
  ON_HAPPY_PATH: "info",

  /* blocked, refused or late */
  CANCELLED: "neutral",
  ARCHIVED: "neutral",
  INACTIVE: "neutral",
  DISCONTINUED: "neutral",
  SUSPENDED: "neutral",
  SKIPPED: "neutral",
  NOT_CHECKED: "neutral",
  CONVERTED: "success",
  OUT_OF_STOCK: "danger",
  DECLINED: "danger",
  REJECTED: "danger",
  REWORK: "danger",
  FAILED: "danger",
  VOID: "danger",
  RED: "danger",
  URGENT: "danger",
  HIGH: "danger",
  NO_SHOW: "danger",
  OVERDUE: "danger",
};

export function toneForStatus(status: string | null | undefined): Tone {
  if (!status) return "neutral";
  return STATUS_TONES[status.toUpperCase()] ?? "neutral";
}

/** Statuses that are terminal: nothing further will happen without a reversal. */
export const TERMINAL_STATUSES = new Set([
  "CANCELLED",
  "DELIVERED",
  "VOID",
  "RECEIVED",
  "DECLINED",
]);

export function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.has(status.toUpperCase());
}

export const APPOINTMENT_STATUSES = [
  "REQUESTED",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_SERVICE",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

export const SERVICE_TYPES = [
  "OIL_CHANGE",
  "BRAKE_SERVICE",
  "TIRE_SERVICE",
  "DIAGNOSTIC",
  "SCHEDULED_MAINTENANCE",
  "INSPECTION",
  "REPAIR",
  "OTHER",
];

export const SERVICE_REQUEST_STATUSES = ["NEW", "IN_REVIEW", "APPROVED", "REJECTED", "CONVERTED"];

export const CHECKIN_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

export const CHECKIN_TYPES = ["DRIVE_IN", "WALK_IN", "APPOINTMENT"];

export const INSPECTION_STATUSES = ["DRAFT", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

export const INSPECTION_ITEM_STATUSES = [
  "GOOD",
  "ATTENTION",
  "RECOMMENDED",
  "URGENT",
  "NOT_CHECKED",
];

/** The suggested action that accompanies an inspection item's severity. */
export const INSPECTION_RECOMMENDATIONS = [
  "PASS",
  "MONITOR",
  "ADJUST",
  "CLEAN",
  "LUBE",
  "REPAIR",
  "REPLACE",
  "INSPECT_FURTHER",
];

export const INSPECTION_CATEGORIES = [
  "EXTERIOR",
  "INTERIOR",
  "TIRES",
  "BRAKES",
  "SUSPENSION",
  "ENGINE",
  "TRANSMISSION",
  "FLUIDS",
  "ELECTRICAL",
  "SAFETY",
];

export const ESTIMATE_STATUSES = [
  "DRAFT",
  "SENT",
  "PARTIALLY_APPROVED",
  "APPROVED",
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
];

export const ESTIMATE_ITEM_STATUSES = ["PENDING", "APPROVED", "DECLINED"];

export const REPAIR_ORDER_STATUSES = [
  "DRAFT",
  "APPROVED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "QC_PASSED",
  "DELIVERED",
  "CANCELLED",
];

export const REPAIR_TASK_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "SKIPPED"];

export const PART_REQUEST_STATUSES = [
  "PENDING",
  "APPROVED",
  "FULFILLED",
  "REJECTED",
  "CANCELLED",
];

export const QC_STATUSES = ["IN_PROGRESS", "PASSED", "FAILED"];

export const INVOICE_STATUSES = ["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "VOID"];

export const PAYMENT_METHODS = [
  "CASH",
  "CARD",
  "BANK_TRANSFER",
  "CHEQUE",
  "OTHER",
];

/** Methods the backend requires a reference for: money with no paper trail. */
export const REFERENCE_REQUIRED_METHODS = new Set(["BANK_TRANSFER", "CHEQUE"]);

export const INVENTORY_TRANSACTION_TYPES = [
  "RECEIPT",
  "ISSUE",
  "RETURN",
  "ADJUSTMENT",
  "TRANSFER",
  "SCRAP",
];

export const PURCHASE_ORDER_STATUSES = [
  "DRAFT",
  "SENT",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
];

export const PRIORITIES = ["LOW", "STANDARD", "HIGH", "EMERGENCY"];

export const PART_CATEGORIES = [
  "ENGINE",
  "BRAKES",
  "SUSPENSION",
  "ELECTRICAL",
  "FILTERS",
  "LUBRICANTS",
  "BODY",
  "INTERIOR",
  "TIRES",
  "OTHER",
];