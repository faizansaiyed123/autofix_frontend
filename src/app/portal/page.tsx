"use client";

import Link from "next/link";

import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader, StatTile } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { portalApi } from "@/lib/api/portal";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { formatDateTime, formatMoney } from "@/lib/format";

/**
 * What the customer needs to do, and what they owe.
 *
 * The summary is a **view**, not a stored copy: it is assembled from the
 * estimates, invoices, appointments and repair orders the shop already keeps, at
 * the moment it is asked for. A portal that kept its own copy of an invoice would
 * be a second invoice, and the only question is when the two would disagree.
 */
export default function PortalOverviewPage() {
  const summary = useApiQuery(() => portalApi.summary());

  if (summary.loading && summary.initial) return <Loading label="Opening your account…" />;
  if (summary.error) {
    // 404 here means the person signed in has no customer record behind their
    // login — which is exactly what a member of staff sees.
    return (
      <ErrorState
        error={summary.error}
        onRetry={summary.error.status === 404 ? undefined : summary.refetch}
      />
    );
  }

  const account = summary.data;
  if (!account) return <ErrorState error={new Error("No account summary")} />;

  return (
    <>
      <PageHeader
        title={`Hello, ${account.full_name.split(" ")[0]}`}
        subtitle="Everything the shop is doing for you, and anything waiting on you."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="To pay"
          value={formatMoney(account.open_balance)}
          hint={account.open_balance > 0 ? "Invoices you have not settled" : "Nothing outstanding"}
          tone={account.open_balance > 0 ? "warning" : "success"}
        />
        <StatTile
          label="Overdue"
          value={formatMoney(account.overdue_balance)}
          tone={account.overdue_balance > 0 ? "danger" : "success"}
        />
        <StatTile
          label="Needs your decision"
          value={account.awaiting_approval}
          hint="Estimate lines waiting on you"
          tone={account.awaiting_approval > 0 ? "warning" : "neutral"}
        />
        <StatTile
          label="Ready for pickup"
          value={account.ready_for_pickup}
          tone={account.ready_for_pickup > 0 ? "success" : "neutral"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Next appointment"
            actions={
              <Link href="/portal/appointments" className="text-sm text-brand-700 hover:underline">
                All appointments
              </Link>
            }
          />
          {account.next_appointment ? (
            <div className="rounded-lg bg-ink-50 p-4">
              <p className="font-medium text-ink-900">{account.next_appointment.service_type}</p>
              <p className="text-sm text-ink-600">
                {account.next_appointment.vehicle_label} ·{" "}
                {formatDateTime(account.next_appointment.scheduled_start)}
              </p>
              <p className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-medium text-ink-700 ring-1 ring-ink-200 ring-inset">
                {account.next_appointment.status_view.label}
              </p>
              {account.next_appointment.status_view.detail ? (
                <p className="mt-2 text-sm text-ink-600">
                  {account.next_appointment.status_view.detail}
                </p>
              ) : null}
            </div>
          ) : (
            <EmptyState
              title="Nothing booked"
              description="Ask the shop for a slot and it goes straight into their diary."
              action={
                <Link
                  href="/portal/appointments"
                  className="text-sm font-medium text-brand-700 hover:underline"
                >
                  Book a slot
                </Link>
              }
            />
          )}
        </Card>

        <Card>
          <CardHeader
            title="What we can help with"
            subtitle="Filing a request puts you in the shop's own queue."
          />
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/portal/service-requests" className="text-brand-700 hover:underline">
                Ask for work
              </Link>{" "}
              <span className="text-ink-600">— describe what the car is doing.</span>
            </li>
            <li>
              <Link href="/portal/estimates" className="text-brand-700 hover:underline">
                Decide on an estimate
              </Link>{" "}
              <span className="text-ink-600">— approve or decline each line separately.</span>
            </li>
            <li>
              <Link href="/portal/invoices" className="text-brand-700 hover:underline">
                Settle an invoice
              </Link>{" "}
              <span className="text-ink-600">— in full or in part, from here.</span>
            </li>
            <li>
              <Link href="/portal/vehicles" className="text-brand-700 hover:underline">
                See a car&apos;s history
              </Link>{" "}
              <span className="text-ink-600">— every visit, inspection and bill.</span>
            </li>
          </ul>
        </Card>
      </div>
    </>
  );
}