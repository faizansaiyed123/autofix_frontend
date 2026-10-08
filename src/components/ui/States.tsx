import type { ReactNode } from "react";

/** Shown while the first load is in flight. */
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-sm text-ink-500">
      <span
        aria-hidden
        className="inline-block size-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"
      />
      {label}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink-700">{title}</p>
      {description ? <p className="max-w-md text-sm text-ink-500">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/**
 * A failure the user can act on.
 *
 * The distinction that matters: a 403 means the person is not allowed and no
 * amount of retrying will help, so it says so. A 404 means the record is not
 * there. Anything else is very likely the network, and offers a retry. Rendering
 * all three as "Something went wrong" is how an outage gets reported as a bug.
 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const status = (error as { status?: number })?.status ?? 0;
  const message = (error as { messageForUser?: string })?.messageForUser ?? "Something went wrong.";

  const heading =
    status === 403
      ? "You do not have access to this"
      : status === 404
        ? "Not found"
        : "Could not load this";

  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-6 py-8 text-center"
    >
      <p className="text-sm font-semibold text-rose-900">{heading}</p>
      <p className="max-w-lg text-sm text-rose-800">{message}</p>
      {status !== 403 && status !== 404 && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-rose-800 ring-1 ring-rose-200 hover:bg-rose-100"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

/** An inline notice for the outcome of a write, sitting above the thing it changed. */
export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "danger";
  children: ReactNode;
}) {
  const tones = {
    info: "bg-brand-50 text-brand-900 ring-brand-200",
    success: "bg-emerald-50 text-emerald-900 ring-emerald-200",
    danger: "bg-rose-50 text-rose-900 ring-rose-200",
  } as const;
  return (
    <div
      role="status"
      className={`rounded-lg px-3 py-2 text-sm ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </div>
  );
}