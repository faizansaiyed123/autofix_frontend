"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Loading } from "@/components/ui/States";
import { useSession } from "@/lib/auth/AuthProvider";
import { landingPath } from "@/lib/navigation";

/** Route signed-in customers to the portal and staff to the dashboard. */
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