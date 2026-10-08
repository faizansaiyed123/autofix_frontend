"use client";

import { useState } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

import { ApiError } from "@/lib/api/client";

export function Field({
  label,
  children,
  hint,
  required,
  error,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
  error?: string | null;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 flex items-center gap-1 text-xs font-medium tracking-wide text-ink-600 uppercase">
        {label}
        {required ? <span className="text-rose-600">*</span> : null}
      </span>
      {children}
      {hint && !error ? <span className="mt-1 block text-xs text-ink-500">{hint}</span> : null}
      {error ? <span className="mt-1 block text-xs text-rose-700">{error}</span> : null}
    </label>
  );
}

const controlClasses =
  "w-full rounded-lg bg-white px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-200 placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:bg-ink-50 disabled:text-ink-500";

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`${controlClasses} ${className}`} />;
}

export function Select({
  className = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={`${controlClasses} ${className}`}>
      {children}
    </select>
  );
}

export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={`${controlClasses} ${className}`} />;
}

/**
 * A validation message taken from the server, attached to the form rather than
 * to a field.
 *
 * It shows the reason the write failed *and* the field it was about, because
 * `{"loc": ["body", "scheduled_start"], "msg": "must be tz-aware"}` is the whole
 * error text the API gives and a bare "Something went wrong" throws it away.
 */
export function FormError({ error }: { error: ApiError | null }) {
  if (!error) return null;
  const fields = error.fieldErrors;
  return (
    <div role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900 ring-1 ring-rose-200 ring-inset">
      <p className="font-medium">{fields.length > 0 ? "Check these fields" : "Could not save"}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {fields.length > 0 ? (
          fields.map((f, index) => (
            <li key={`${f.field}-${index}`}>
              {f.field ? <span className="font-medium">{f.field}: </span> : null}
              {f.message}
            </li>
          ))
        ) : (
          <li>{error.messageForUser}</li>
        )}
      </ul>
    </div>
  );
}

/**
 * A form whose values live in local state rather than in a form library.
 *
 * The dependency list in this project is deliberately small, and every write
 * here has under a dozen fields. Controlled state is what makes it possible to
 * keep a half-typed form after a rejection and to derive a live line total
 * while the user types.
 */
export function useForm<T extends Record<string, unknown>>(initial: T) {
  const [values, setValues] = useState<typeof initial>(initial);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  function set<K extends keyof T>(key: K, value: T[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setTouched((current) => ({ ...current, [key as string]: true }));
  }

  function reset(next: T = initial) {
    setValues(next);
    setTouched({});
  }

  /** `true` for every string field still empty — the check a required marker implies. */
  function missing(keys: (keyof T)[]): (keyof T)[] {
    return keys.filter((key) => {
      const value = values[key];
      return value === undefined || value === null || String(value).trim() === "";
    });
  }

  return { values, setValues, set, reset, touched, missing };
}