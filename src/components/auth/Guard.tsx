"use client";

import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { Loading } from "@/components/ui/States";
import { useSession } from "@/lib/auth/AuthProvider";

/** Client-side navigation gate; server-side authorization remains authoritative. */
export function ProtectedRoute({
  children,
  staffOnly = true,
}: {
  children: ReactNode;
  staffOnly?: boolean;
}) {
  const { status, isCustomer } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "anonymous") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (status === "authenticated" && staffOnly && isCustomer) {
      router.replace("/portal");
    }
  }, [status, isCustomer, staffOnly, router, pathname]);

  // One label for both waiting states: the two branches render the same component,
  // and a signed-out visitor's very first paint must match what the server sent.
  if (status !== "authenticated")
    return <Loading label="Checking your access…" />;
  if (staffOnly && isCustomer) return <Loading label="Checking your access…" />;

  return <>{children}</>;
}

/** Hide actions the user cannot access; the API must still enforce the permission. */
export function Can({
  permission,
  anyOf,
  children,
  fallback = null,
}: {
  permission?: string;
  anyOf?: string[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can, canAny } = useSession();
  const allowed = permission
    ? can(permission)
    : anyOf
      ? canAny(...anyOf)
      : true;
  return <>{allowed ? children : fallback}</>;
}

/** The same question, as a hook, for a button's disabled state. */
export function useCan(permission: string): boolean {
  return useSession().can(permission);
}
