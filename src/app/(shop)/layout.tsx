"use client";

import type { ReactNode } from "react";

import { ProtectedRoute } from "@/components/auth/Guard";
import { AppShell } from "@/components/layout/AppShell";
import { ReferenceProvider } from "@/components/layout/ReferenceProvider";

/**
 * Everything a member of staff sees.
 *
 * Two gates in a row, deliberately. `ProtectedRoute` refuses a signed-out or
 * customer visitor before a single request goes out; the server's
 * `require_staff` answers 403 regardless of what the browser believed. Neither
 * one is load-bearing on its own — the client gate is a courtesy, the server is
 * the boundary.
 */
export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute staffOnly>
      <ReferenceProvider>
        <AppShell>{children}</AppShell>
      </ReferenceProvider>
    </ProtectedRoute>
  );
}