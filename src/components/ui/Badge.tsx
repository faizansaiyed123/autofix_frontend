import type { ReactNode } from "react";

import { toneClasses, toneForStatus, type Tone } from "@/lib/status";

/**
 * A status, rendered the same way everywhere.
 *
 * The label is the backend's own code, not a re-invented word per screen: the
 * shop's screens, the audit trail and the API all key off it, and a UI that
 * invents its own vocabulary cannot be talked back to the record it describes.
 * Anything the vocabulary does not know is still shown — as neutral title-cased
 * text — so a status from a new module reads as itself rather than as raw caps.
 */
export function StatusBadge({
  status,
  tone,
  className = "",
}: {
  status: string | null | undefined;
  tone?: Tone;
  className?: string;
}) {
  if (!status) return <span className="text-ink-400">—</span>;
  const resolved = tone ?? toneForStatus(status);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${toneClasses(resolved)} ${className}`}
    >
      {status}
    </span>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${toneClasses(tone)} ${className}`}
    >
      {children}
    </span>
  );
}

/** True when a row means "somebody must act", whatever the field is called. */
export function YesNo({
  value,
  trueLabel = "Yes",
  falseLabel = "No",
}: {
  value: boolean;
  trueLabel?: string;
  falseLabel?: string;
}) {
  return (
    <span className={value ? "font-medium text-emerald-700" : "text-ink-400"}>
      {value ? trueLabel : falseLabel}
    </span>
  );
}