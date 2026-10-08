import type { IconName } from "@/lib/navigation";

/**
 * Line icons at a single stroke weight.
 *
 * Inline rather than a package: twenty shapes that never change are not worth a
 * dependency, and inlining them keeps the icons on the same grid as the text
 * beside them.
 */
const PATHS: Record<IconName, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
      <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
    </>
  ),
  customers: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 11.2A3 3 0 0 0 16 5.4" />
      <path d="M17.5 20a5.6 5.6 0 0 0-2.2-4.4" />
    </>
  ),
  vehicle: (
    <>
      <path d="M3 13.5 4.8 8A2 2 0 0 1 6.7 6.5h10.6A2 2 0 0 1 19.2 8L21 13.5" />
      <path d="M3 13.5h18V18H3z" />
      <circle cx="7" cy="18.5" r="1.8" />
      <circle cx="17" cy="18.5" r="1.8" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  request: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4M9 12h7M9 16h5" />
    </>
  ),
  checkin: (
    <>
      <path d="M3 12h4l2-5 3 10 2-5h7" />
      <path d="M3 20h18" />
    </>
  ),
  inspection: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  estimate: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4" />
      <path d="M9.5 16.5 12 11l2.5 5.5M10.2 14.8h3.6" />
    </>
  ),
  repair: (
    <>
      <path d="M14.5 4.5a4 4 0 0 0-5.2 5.2L4 15l3 3 5.3-5.3a4 4 0 0 0 5.2-5.2L15 9.5 12.5 7 14.5 4.5Z" />
      <path d="M17 4.5 19.5 7" />
    </>
  ),
  labour: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  partrequest: (
    <>
      <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
      <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
    </>
  ),
  qc: (
    <>
      <path d="M12 3 4 6v6c0 4.5 3.2 8.2 8 9 4.8-.8 8-4.5 8-9V6z" />
      <path d="M8.8 12.2 11 14.4l4.2-4.6" />
    </>
  ),
  wrench: (
    <>
      <path d="M20 5.5a5 5 0 0 1-6.6 6.2L6 19a2 2 0 0 1-2.8-2.8l7.3-7.4A5 5 0 0 1 16.5 2L13 5.5 15.5 8 19 4.5c.4.3.8.6 1 1Z" />
    </>
  ),
  invoice: (
    <>
      <path d="M6 3h12v18l-2.5-1.6L13 21l-2.5-1.6L8 21l-2-1.4z" />
      <path d="M9.5 8h5M9.5 12h5" />
    </>
  ),
  payment: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M2.5 10.5h19" />
      <path d="M6 15h4" />
    </>
  ),
  parts: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" />
    </>
  ),
  inventory: (
    <>
      <path d="M3 8.5 12 4l9 4.5-9 4.5z" />
      <path d="M3 8.5v7L12 20l9-4.5v-7M12 13v7" />
    </>
  ),
  supplier: (
    <>
      <path d="M3 21V8l6-3v16M9 21V11l12 5v5" />
      <path d="M13.5 10.5h4M13.5 14h4" />
    </>
  ),
  purchaseorder: (
    <>
      <path d="M6 3h12v18l-2.5-1.6L13 21l-2.5-1.6L8 21l-2-1.4z" />
      <path d="M9.5 9h5M9.5 13h3" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  users: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  audit: (
    <>
      <path d="M12 8v4.5l3 1.8" />
      <circle cx="12" cy="12" r="8.5" />
    </>
  ),
};

export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}