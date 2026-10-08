"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { ProtectedRoute } from "@/components/auth/Guard";
import { Icon } from "@/components/layout/Icon";
import { notificationsApi } from "@/lib/api/insight";
import { COMPANY_NAME } from "@/lib/config";
import { useSession } from "@/lib/auth/AuthProvider";

const PORTAL_LINKS = [
  { href: "/portal", label: "Overview", icon: "dashboard" as const },
  { href: "/portal/vehicles", label: "My vehicles", icon: "vehicle" as const },
  { href: "/portal/appointments", label: "Appointments", icon: "calendar" as const },
  { href: "/portal/estimates", label: "Estimates", icon: "estimate" as const },
  { href: "/portal/invoices", label: "Invoices", icon: "invoice" as const },
  { href: "/portal/service-requests", label: "Requests", icon: "request" as const },
  { href: "/portal/payments", label: "Payments", icon: "payment" as const },
];

/**
 * The customer's own view of the shop.
 *
 * A deliberately different frame from the staff shell: lighter, no groups, no
 * twenty items. The portal is not the shop with fewer buttons — it is a
 * different application that happens to read the same records.
 *
 * The gate here is `staffOnly={false}`. Staff are welcome: they simply have no
 * customer record behind their login, so every portal query answers 404 and the
 * pages say so rather than showing somebody else's account.
 */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute staffOnly={false}>
      <PortalShell>{children}</PortalShell>
    </ProtectedRoute>
  );
}

function PortalShell({ children }: { children: ReactNode }) {
  const { user, logout } = useSession();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      notificationsApi
        .unreadCount()
        .then((result) => {
          if (!cancelled) setUnread(result.unread_count);
        })
        .catch(() => {
          /* The badge is decoration; the page it links to reports its own errors. */
        });
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/portal" className="text-sm font-semibold text-ink-900">
            {COMPANY_NAME}
            <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800">
              My account
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/attention"
              className="relative rounded-lg p-2 text-ink-500 hover:bg-ink-100"
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
            >
              <Icon name="bell" />
              {unread > 0 ? (
                <span className="absolute top-1 right-1 size-2 rounded-full bg-rose-500" />
              ) : null}
            </Link>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-ink-900">
                {user ? `${user.first_name} ${user.last_name}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-100"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="mx-auto max-w-5xl overflow-x-auto px-4">
          <ul className="flex gap-1">
            {PORTAL_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-sm whitespace-nowrap ${
                      active
                        ? "border-brand-600 font-medium text-brand-800"
                        : "border-transparent text-ink-600 hover:text-ink-900"
                    }`}
                  >
                    <Icon name={link.icon} className="size-4" />
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}