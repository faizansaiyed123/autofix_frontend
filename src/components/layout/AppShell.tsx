"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { Icon } from "@/components/layout/Icon";
import { NAV_GROUPS } from "@/lib/navigation";
import { notificationsApi } from "@/lib/api/insight";
import { COMPANY_NAME } from "@/lib/config";
import { formatRelative } from "@/lib/format";
import { useSession } from "@/lib/auth/AuthProvider";

/**
 * The frame every staff screen sits in.
 *
 * The navigation is built from the same permission list the API enforces, so a
 * user is never shown a screen that will refuse them. The unread badge is
 * polled rather than pushed: this product has no websocket, and a badge that
 * needs a page reload to notice a new work request is not an attention centre.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, permissions, logout, can } = useSession();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!can("notifications:read")) return;
    let cancelled = false;
    const load = () => {
      notificationsApi
        .unreadCount()
        .then((result) => {
          if (!cancelled) setUnread(result.unread_count);
        })
        .catch(() => {
          /* The badge is not worth an error message; the page it links to has one. */
        });
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [can]);

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => permissions.includes(item.permission)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col bg-ink-900 text-ink-200 lg:flex">
        <div className="border-b border-white/10 px-5 py-4">
          <p className="text-sm font-semibold tracking-wide text-white">{COMPANY_NAME}</p>
          <p className="text-xs text-ink-400">Front desk</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {visibleGroups.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="mb-1.5 px-2 text-[11px] font-semibold tracking-wider text-ink-500 uppercase">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors ${
                          active
                            ? "bg-brand-600 font-medium text-white"
                            : "text-ink-300 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <Icon name={item.icon} />
                        <span className="flex-1">{item.label}</span>
                        {item.href === "/attention" && unread > 0 ? (
                          <span className="tabular rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-ink-200 bg-white/90 px-4 py-2.5 backdrop-blur">
          <div className="lg:hidden">
            <p className="text-sm font-semibold text-ink-900">{COMPANY_NAME}</p>
          </div>
          <nav className="-mx-1 flex flex-1 gap-1 overflow-x-auto lg:hidden">
            {visibleGroups
              .flatMap((group) => group.items)
              .slice(0, 8)
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs text-ink-600 hover:bg-ink-100"
                >
                  {item.label}
                </Link>
              ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/attention"
              className="relative rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
              aria-label={unread > 0 ? `Attention centre, ${unread} unread` : "Attention centre"}
            >
              <Icon name="bell" />
              {unread > 0 ? (
                <span className="absolute top-1 right-1 size-2 rounded-full bg-rose-500" />
              ) : null}
            </Link>
            <div className="text-right">
              <p className="text-sm font-medium text-ink-900">
                {user ? `${user.first_name} ${user.last_name}` : ""}
              </p>
              <p className="text-[11px] text-ink-500">{user?.roles.join(", ")}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-100"
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

/**
 * Where a record was last touched, for a detail page's footer.
 *
 * Derived from the row rather than fetched: it is context, not the reason the
 * page is open, and it must not be the thing that fails to load.
 */
export function RecordMeta({ label, at }: { label: string; at: string | null | undefined }) {
  return (
    <span className="text-xs text-ink-500">
      {label} {formatRelative(at)}
    </span>
  );
}