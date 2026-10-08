"use client";

import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { Loading } from "@/components/ui/States";
import { useSession } from "@/lib/auth/AuthProvider";

/**
 * The client-side gate every authenticated screen sits behind.
 *
 * It redirects rather than renders a 403, because a customer who follows a staff
 * link has no business seeing a staff page exists — the right answer is their own
 * account, not a refusal. The server is the real boundary: these routers sit
 * behind `require_staff` and answer 403 whatever the browser believes. This
 * exists to keep people out of screens that would only show them errors.
 */
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
  if (status !== "authenticated") return <Loading label="Checking your access…" />;
  if (staffOnly && isCustomer) return <Loading label="Checking your access…" />;

  return <>{children}</>;
}

/**
 * Render something only if the signed-in user holds a permission.
 *
 * This is a usability boundary, not a security one — it keeps an action out of
 * the interface for the person who cannot use it, which stops the 403. It
 * cannot be the thing that enforces access, because anything in a browser can be
 * called directly; the permission check that matters is the one on the server.
 */
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
  const allowed = permission ? can(permission) : anyOf ? canAny(...anyOf) : true;
  return <>{allowed ? children : fallback}</>;
}

/** The same question, as a hook, for a button's disabled state. */
export function useCan(permission: string): boolean {
  return useSession().can(permission);
}