"use client";

import { useEffect, useState } from "react";

/**
 * Debounce a fast-changing value — a search box, chiefly.
 *
 * Without it, typing "WALTER" fires five requests, four of which are for
 * prefixes nobody will ever look at, and the last one to arrive wins. That is a
 * race in the UI: the list flickers through intermediate results and can settle
 * on the response to "WAL" if it happens to land last.
 */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}