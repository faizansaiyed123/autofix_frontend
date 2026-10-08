"use client";

/**
 * Data loading for a screen.
 *
 * Three states, not two: loading, error and loaded. A screen that treats "not
 * loaded yet" as "empty" shows an empty table for a moment and then fills it,
 * which reads as a glitch; a screen that swallows an error shows an empty table
 * forever and reads as "there is nothing here". Both are worse than saying so.
 *
 * The fetcher is held in a ref rather than in a dependency list because callers
 * pass an inline arrow, which changes identity on every render — listing it
 * would refetch forever. The ref is written from an effect declared *before* the
 * fetching effect, so the fetch always sees the fetcher belonging to the render
 * that scheduled it.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api/client";

export interface QueryState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  /** True only until the first load settles, so a refetch does not blank a table. */
  initial: boolean;
  refetch: () => void;
}

function toApiError(caught: unknown): ApiError {
  return caught instanceof ApiError ? caught : new ApiError(0, caught, "Could not reach the server");
}

export function useApiQuery<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: unknown[] = [],
  options: { enabled?: boolean } = {},
): QueryState<T> {
  const enabled = options.enabled ?? true;
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{ data: T | null; error: ApiError | null } | null>(null);

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let cancelled = false;

    fetcherRef.current(controller.signal).then(
      (data) => {
        if (!cancelled) setSettled({ data, error: null });
      },
      (caught: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        setSettled({ data: null, error: toApiError(caught) });
      },
    );

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, attempt, ...deps]);

  const refetch = useCallback(() => setAttempt((n) => n + 1), []);

  // Loading is derived, not stored: a disabled query is never loading, and a
  // refetch after a successful load does not put the screen back into a spinner
  // over data the reader can already see.
  const loading = enabled && settled === null;

  return { data: settled?.data ?? null, error: settled?.error ?? null, loading, initial: loading, refetch };
}