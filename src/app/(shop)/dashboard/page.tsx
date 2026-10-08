"use client";

import Link from "next/link";

import { LineChart } from "@/components/charts/Chart";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorState, Loading } from "@/components/ui/States";
import { PageHeader, StatTile } from "@/components/ui/Page";
import { reportsApi } from "@/lib/api/insight";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { formatMoney, formatNumber, formatDate } from "@/lib/format";
import { useSession } from "@/lib/auth/AuthProvider";

/**
 * The morning screen.
 *
 * Two numbers sit at the top, and they are not the same number: what the shop
 * **charged** (issued invoices) and what the till actually **took** (recorded
 * payments). The gap between them is the money that has been billed and not
 * paid, which is the one figure a garage most often talks itself out of. Showing
 * a single "revenue" tile would hide exactly the difference that matters.
 *
 * Everything below is a snapshot of *now*: how many repair orders are open, how
 * many are waiting on quality control, how many parts are below their reorder
 * point. Those are counts of things that exist, not of things that happened in
 * the window — answering "how many are sitting in QC right now" with a number
 * from a thirty-day window would report a healthy pipeline that is on fire.
 */
export default function DashboardPage() {
  const { can } = useSession();

  const dashboard = useApiQuery(() => reportsApi.dashboard());
  const revenue = useApiQuery(() => reportsApi.revenue(), [], {
    enabled: can("reports:read"),
  });

  if (dashboard.loading && dashboard.initial) return <Loading label="Reading the day…" />;
  if (dashboard.error) return <ErrorState error={dashboard.error} onRetry={dashboard.refetch} />;

  const report = dashboard.data;
  if (!report) return <ErrorState error={new Error("No dashboard data")} />;

  const { revenue: money, work, money: counts, operations } = report;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${formatDate(report.period.start_date)} to ${formatDate(report.period.end_date)} · ${report.period.days} days`}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Invoiced"
          value={formatMoney(money.invoiced_total)}
          hint="Billed and issued, in this period"
        />
        <StatTile
          label="Collected"
          value={formatMoney(money.collected_total)}
          hint="Recorded at the till, net of voids"
          tone={money.collected_total >= money.invoiced_total ? "success" : "warning"}
        />
        <StatTile
          label="Outstanding"
          value={formatMoney(money.outstanding_balance)}
          hint="Every unpaid bill, whatever its age"
        />
        <StatTile
          label="Overdue"
          value={formatMoney(money.overdue_balance)}
          hint={`${money.overdue_count} bill(s) past the due date`}
          tone={money.overdue_count > 0 ? "danger" : "neutral"}
        />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Billed against collected"
            subtitle="A gap here is money the shop has charged and not taken."
          />
          {revenue.loading && revenue.initial ? (
            <Loading label="Summing invoices…" />
          ) : revenue.data ? (
            <LineChart
              format={(v) => formatMoney(v)}
              series={[
                {
                  name: "Invoiced",
                  color: "var(--color-brand-500)",
                  points: revenue.data.series.map((point) => ({
                    label: point.period_start,
                    value: point.invoiced,
                  })),
                },
                {
                  name: "Collected",
                  color: "var(--color-emerald-500)",
                  points: revenue.data.series.map((point) => ({
                    label: point.period_start,
                    value: point.collected,
                  })),
                },
              ]}
            />
          ) : (
            <ErrorState error={revenue.error ?? new Error("No revenue series")} />
          )}
        </Card>

        <Card>
          <CardHeader title="Money on the books" subtitle="By invoice status" />
          <dl className="space-y-2">
            {[
              ["Drafts", counts.invoices_draft, "Not yet issued"],
              ["Issued", counts.invoices_issued, "Sent, unpaid"],
              ["Part paid", counts.invoices_partially_paid, "Settled in part"],
              ["Paid", counts.invoices_paid, "Settled in full"],
            ].map(([label, value, hint]) => (
              <div key={String(label)} className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-ink-700">
                  {label} <span className="text-xs text-ink-500">· {hint}</span>
                </dt>
                <dd className="tabular text-sm font-semibold text-ink-900">{formatNumber(Number(value))}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="On the floor"
            subtitle="A snapshot of right now, not of the period"
            actions={<Link href="/repair-orders" className="text-sm text-brand-700 hover:underline">Repair orders</Link>}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile label="Open" value={formatNumber(work.repair_orders_open)} />
            <StatTile
              label="In progress"
              value={formatNumber(work.repair_orders_in_progress)}
              tone={work.repair_orders_in_progress > 0 ? "info" : "neutral"}
            />
            <StatTile
              label="On hold"
              value={formatNumber(work.repair_orders_on_hold)}
              tone={work.repair_orders_on_hold > 0 ? "warning" : "neutral"}
            />
            <StatTile
              label="Awaiting QC"
              value={formatNumber(work.repair_orders_awaiting_qc)}
              hint="Finished, nobody has inspected"
              tone={work.repair_orders_awaiting_qc > 0 ? "warning" : "neutral"}
            />
            <StatTile label="Completed" value={formatNumber(work.completed_in_period)} />
            <StatTile
              label="Part requests"
              value={formatNumber(work.part_requests_pending)}
              tone={work.part_requests_pending > 0 ? "info" : "neutral"}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Shop and shelf"
            subtitle="Today, and what is below its reorder point"
            actions={
              can("inventory:read") ? (
                <Link href="/inventory" className="text-sm text-brand-700 hover:underline">
                  Inventory
                </Link>
              ) : null
            }
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile label="Appointments today" value={formatNumber(operations.appointments_today)} />
            <StatTile label="Vehicles in shop" value={formatNumber(operations.vehicles_in_shop)} />
            <StatTile
              label="Low stock"
              value={formatNumber(operations.low_stock_count)}
              tone={operations.low_stock_count > 0 ? "warning" : "neutral"}
            />
            <StatTile
              label="Out of stock"
              value={formatNumber(operations.out_of_stock_count)}
              tone={operations.out_of_stock_count > 0 ? "danger" : "neutral"}
            />
            <StatTile
              label="Stock at cost"
              value={formatMoney(operations.inventory_cost_value)}
            />
            <StatTile
              label="Unread"
              value={formatNumber(operations.unread_notifications)}
              hint="In the attention centre"
            />
          </div>
        </Card>
      </div>
    </>
  );
}