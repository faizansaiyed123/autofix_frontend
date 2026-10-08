/**
 * The application's navigation, declared once.
 *
 * Each item names the permission that opens it, and the sidebar drops anything
 * the signed-in user cannot do. A parts clerk should not be shown a navigation
 * that leads to four screens which will each answer 403 — the item is a promise
 * the page can keep, so the items the person cannot use are not rendered.
 *
 * The server enforces the same rule independently. This list is for the
 * interface, not for access.
 */
export interface NavItem {
  href: string;
  label: string;
  /** The permission that makes this screen usable. */
  permission: string;
  icon: IconName;
  description?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export type IconName =
  | "dashboard"
  | "bell"
  | "customers"
  | "vehicle"
  | "calendar"
  | "request"
  | "checkin"
  | "inspection"
  | "estimate"
  | "repair"
  | "labour"
  | "partrequest"
  | "qc"
  | "wrench"
  | "invoice"
  | "payment"
  | "parts"
  | "inventory"
  | "supplier"
  | "purchaseorder"
  | "chart"
  | "users"
  | "audit";

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Today",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        permission: "reports:read",
        icon: "dashboard",
        description: "What the shop is holding and what it has taken",
      },
      {
        href: "/attention",
        label: "Attention centre",
        permission: "notifications:read",
        icon: "bell",
        description: "Everything waiting on a decision",
      },
      {
        href: "/service-requests",
        label: "Service requests",
        permission: "service_requests:read",
        icon: "request",
        description: "What customers have asked for",
      },
      {
        href: "/appointments",
        label: "Diary",
        permission: "appointments:read",
        icon: "calendar",
        description: "The shop's bookings, by day or week",
      },
    ],
  },
  {
    label: "Customers",
    items: [
      {
        href: "/customers",
        label: "Customers",
        permission: "customers:read",
        icon: "customers",
      },
      {
        href: "/vehicles",
        label: "Vehicles",
        permission: "vehicles:read",
        icon: "vehicle",
      },
      {
        href: "/check-ins",
        label: "Check-ins",
        permission: "check_ins:read",
        icon: "checkin",
      },
      {
        href: "/inspections",
        label: "Inspections",
        permission: "inspections:read",
        icon: "inspection",
      },
    ],
  },
  {
    label: "Workshop",
    items: [
      {
        href: "/estimates",
        label: "Estimates",
        permission: "estimates:read",
        icon: "estimate",
      },
      {
        href: "/repair-orders",
        label: "Repair orders",
        permission: "repair_orders:read",
        icon: "repair",
      },
      {
        href: "/part-requests",
        label: "Part requests",
        permission: "part_requests:read",
        icon: "partrequest",
      },
      {
        href: "/qc",
        label: "Quality control",
        permission: "qc:read",
        icon: "qc",
      },
      {
        href: "/my-work",
        label: "My work",
        permission: "labor:read",
        icon: "wrench",
        description: "A technician's own board",
      },
      {
        href: "/labour",
        label: "Labour",
        permission: "labor:read",
        icon: "labour",
      },
    ],
  },
  {
    label: "Money",
    items: [
      {
        href: "/invoices",
        label: "Invoices",
        permission: "invoices:read",
        icon: "invoice",
      },
      {
        href: "/payments",
        label: "Payments",
        permission: "payments:read",
        icon: "payment",
      },
    ],
  },
  {
    label: "Stock",
    items: [
      {
        href: "/parts",
        label: "Parts catalog",
        permission: "parts:read",
        icon: "parts",
      },
      {
        href: "/inventory",
        label: "Inventory ledger",
        permission: "inventory:read",
        icon: "inventory",
      },
      {
        href: "/suppliers",
        label: "Suppliers",
        permission: "suppliers:read",
        icon: "supplier",
      },
      {
        href: "/purchase-orders",
        label: "Purchase orders",
        permission: "purchase_orders:read",
        icon: "purchaseorder",
      },
    ],
  },
  {
    label: "Management",
    items: [
      {
        href: "/reports",
        label: "Reports",
        permission: "reports:read",
        icon: "chart",
      },
      {
        href: "/staff",
        label: "Staff",
        permission: "users:read",
        icon: "users",
      },
      {
        href: "/audit",
        label: "Audit log",
        permission: "audit_logs:read",
        icon: "audit",
      },
    ],
  },
];

/**
 * Where a signed-in user belongs by default.
 *
 * A customer has no business on the staff dashboard, so `/` sends them to their
 * own account rather than to a screen that would refuse them. The redirect is a
 * convenience; the boundary is `require_staff` on the server.
 */
export function landingPath(isCustomer: boolean): string {
  return isCustomer ? "/portal" : "/dashboard";
}