import type { ReactNode } from "react";

import { toneClasses, toneForStatus, type Tone } from "@/lib/status";

/** Render API status codes consistently; unknown values use neutral title-cased labels. */
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