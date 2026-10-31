"use client";

/** Keep mutation errors in state so forms can preserve input and show validation feedback. */
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api/client";

export interface MutationState<TArgs extends unknown[], TResult> {
  run: (...args: TArgs) => Promise<TResult | null>;
  pending: boolean;
  error: ApiError | null;
  result: TResult | null;
  reset: () => void;
}

export function useApiMutation<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
): MutationState<TArgs, TResult> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<TResult | null>(null);

  // The action is almost always an inline arrow, so it changes identity every
  // render. Holding it in a ref keeps it out of the dependency list, which would
  // otherwise re-create `run` on every keystroke.
  const actionRef = useRef(action);
  useEffect(() => {
    actionRef.current = action;
  });

  const run = useCallback(async (...args: TArgs) => {
    setPending(true);
    setError(null);
    try {
      const value = await actionRef.current(...args);
      setResult(value);
      return value;
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, caught, "Something went wrong"),
      );
      return null;
    } finally {
      setPending(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  return { run, pending, error, result, reset };
}
