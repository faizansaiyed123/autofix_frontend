import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`rounded-xl bg-white shadow-sm ring-1 ring-ink-200 ${padded ? "p-5" : ""} ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-ink-600">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** A label/value pair, used everywhere a record's details are read. */
export function KeyValue({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink-900">{children ?? "—"}</dd>
    </div>
  );
}

/** A label/value grid. `className` sets the column count, which is per-screen. */
export function KeyValueGrid({
  children,
  className = "grid-cols-2 sm:grid-cols-3",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <dl className={`grid gap-x-6 gap-y-3 ${className}`}>{children}</dl>;
}