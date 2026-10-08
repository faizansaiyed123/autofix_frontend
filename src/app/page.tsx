"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Loading } from "@/components/ui/States";
import { useSession } from "@/lib/auth/AuthProvider";
import { landingPath } from "@/lib/navigation";

/**
 * The front door.
 *
 * `/` is not a page: it decides which of two applications somebody wants. A
 * customer lands on their account, staff on the dashboard. There is no default
 * view here, because the wrong one is either a refusal or a leak.
 */
export default function RootPage() {
  const { status, isCustomer } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace(landingPath(isCustomer));
    else if (status === "anonymous") router.replace("/login");
  }, [status, isCustomer, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-900">
      <Loading label="Signing you in…" />
    </main>
  );
}