"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { useDebounced } from "@/lib/hooks/useDebounced";

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        {breadcrumb ? <div className="mb-1 text-xs text-ink-500">{breadcrumb}</div> : null}
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-600">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Search box plus filters, above a table. */
export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-ink-100 px-4 py-3">
      {children}
    </div>
  );
}

/**
 * A search box that waits before asking.
 *
 * The typed value stays here; the caller only ever receives the debounced one,
 * so it fires one request per pause rather than one per keystroke. Local state
 * is what makes that safe: the input stays responsive while the query is stale,
 * and because only the debounced value reaches the caller, intermediate
 * responses cannot race each other into the list.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const debounced = useDebounced(draft, 300);
  const lastPushed = useRef(value);

  // Adopt a value the caller changed from elsewhere (a cleared filter) without
  // echoing our own debounce back at it.
  useEffect(() => {
    if (value !== lastPushed.current) setDraft(value);
  }, [value]);

  useEffect(() => {
    if (debounced === lastPushed.current) return;
    lastPushed.current = debounced;
    onChange(debounced);
  }, [debounced, onChange]);

  return (
    <label className={`block ${className}`}>
      <span className="sr-only">{placeholder}</span>
      <input
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg bg-white px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-200 placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500 focus:outline-none"
      />
    </label>
  );
}

/** A number the owner looks at, with its label. */
export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const tones = {
    neutral: "text-ink-900",
    success: "text-emerald-700",
    warning: "text-amber-700",
    danger: "text-rose-700",
    info: "text-brand-700",
  } as const;
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-ink-200">
      <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">{label}</p>
      <p className={`tabular mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}