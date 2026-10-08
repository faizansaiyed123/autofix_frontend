"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { BarList, LineChart } from "@/components/charts/Chart";
import { StatusBadge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Field, Input } from "@/components/ui/Form";
import { PageHeader, StatTile } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { reportsApi } from "@/lib/api/insight";
import type {
  CustomerRetentionReport,
  InventoryValueReport,
  TechnicianProductivity,
} from "@/lib/api/types";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import {
  daysAgoIso,
  formatDate,
  formatMoney,
  formatNumber,
  formatPercent,
  titleCase,
  todayIso,
} from "@/lib/format";

/**
 * The reporting screen.
 *
 * A report here is a **reading**, not a record: every figure is summed live from
 * the tables the shop already keeps. There is no summary table and nothing is
 * cached, so no number on this page can be stale and none of it is written back.
 *
 * The panels load on demand rather than on mount. Six reports fired at once would
 * sum the whole ledger six times over before anybody had chosen which one they
 * wanted, and each report is a different permission away from the next.
 */
const TABS = [
  {
    key: "revenue",
    label: "Revenue",
    permission: "reports:read",
    restrictedTo: "Needs reports access (reports:read)",
  },
  {
    key: "orders",
    label: "Repair orders",
    permission: "reports:read",
    restrictedTo: "Needs reports access (reports:read)",
  },
  {
    key: "technicians",
    label: "Technicians",
    permission: "reports:analytics",
    restrictedTo: "Owner only — reports:analytics is deliberately not given to a service advisor",
  },
  {
    key: "stock",
    label: "Inventory value",
    permission: "inventory:read",
    restrictedTo: "Needs inventory access (inventory:read), not reports:read",
  },
  {
    key: "retention",
    label: "Customer retention",
    permission: "reports:analytics",
    restrictedTo: "Owner only — reports:analytics is deliberately not given to a service advisor",
  },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function ReportsPage() {
  const { can } = useSession();
  const [chosen, setChosen] = useState<TabKey | null>(null);
  const [start, setStart] = useState(() => daysAgoIso(30));
  const [end, setEnd] = useState(() => todayIso());

  const permittedTabs = TABS.filter((tab) => can(tab.permission));
  // The first report the account may actually open, rather than the first on the
  // list — otherwise somebody without reports:read lands on a locked panel.
  const active: TabKey =
    chosen && permittedTabs.some((tab) => tab.key === chosen)
      ? chosen
      : (permittedTabs[0]?.key ?? "revenue");
  const allowed = permittedTabs.length > 0;
  const ranged = start !== "" && end !== "" && start <= end;
  const activeLabel = TABS.find((tab) => tab.key === active)?.label ?? "Report";
  const locked = TABS.filter((tab) => !can(tab.permission));

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={
          ranged
            ? `${formatDate(start)} to ${formatDate(end)} · summed live, nothing is stored`
            : "Summed live from the shop's own records — nothing here is a stored figure"
        }
      />

      {!allowed ? (
        <Notice tone="danger">
          Reading the shop&apos;s reports is restricted. Ask the owner for reports access.
        </Notice>
      ) : null}

      <Card className="mb-5">
        <CardHeader
          title="Period"
          subtitle="Every report below is read over this window."
        />
        <div className="flex flex-wrap items-end gap-3">
          <Field label="From" className="w-44">
            <Input
              type="date"
              value={start}
              max={end || undefined}
              onChange={(event) => {
                const value = event.target.value;
                setStart(value);
                // The API refuses a window that starts after it ends, so the far
                // end is dragged along with the near one rather than letting the
                // user compose a request that comes back 400.
                if (value && end && value > end) setEnd(value);
              }}
            />
          </Field>
          <Field label="To" className="w-44">
            <Input
              type="date"
              value={end}
              min={start || undefined}
              onChange={(event) => {
                const value = event.target.value;
                setEnd(value);
                if (value && start && value < start) setStart(value);
              }}
            />
          </Field>
          <p className="pb-2 text-xs text-ink-500">
            Past 62 days the series is charted by month rather than by day.
          </p>
        </div>
        {!ranged && allowed ? (
          <p className="mt-3 text-xs text-amber-700">
            Pick both dates before a report will run.
          </p>
        ) : null}
      </Card>

      <div role="tablist" aria-label="Reports" className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const permitted = can(tab.permission);
          const selected = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`report-${tab.key}`}
              disabled={!permitted}
              title={permitted ? undefined : tab.restrictedTo}
              onClick={() => setChosen(tab.key)}
              className={`rounded-lg px-3 py-2 text-sm font-medium disabled:cursor-not-allowed ${
                selected
                  ? "bg-brand-600 text-white"
                  : permitted
                    ? "bg-white text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50"
                    : "bg-ink-100 text-ink-400 ring-1 ring-ink-200"
              }`}
            >
              {tab.label}
              {permitted ? null : <span className="ml-1.5 text-xs">locked</span>}
            </button>
          );
        })}
      </div>

      {locked.length > 0 ? (
        <p className="mb-4 text-xs text-ink-500">
          Not open to your account:{" "}
          {locked.map((tab, index) => (
            <span key={tab.key}>
              {index > 0 ? " · " : ""}
              <span className="font-medium text-ink-700">{tab.label}</span> — {tab.restrictedTo}
            </span>
          ))}
        </p>
      ) : null}

      {!allowed ? null : !ranged ? (
        <Card>
          <EmptyState
            title="No period chosen"
            description="Every report is read between a start and an end date. Choose both above."
          />
        </Card>
      ) : (
        <>
          <section id={`report-${active}`} role="tabpanel" aria-label={activeLabel}>
            {active === "revenue" ? (
              <RevenuePanel start={start} end={end} />
            ) : active === "orders" ? (
              <RepairOrdersPanel start={start} end={end} />
            ) : active === "technicians" ? (
              <TechniciansPanel start={start} end={end} />
            ) : active === "stock" ? (
              <InventoryValuePanel start={start} end={end} />
            ) : (
              <RetentionPanel start={start} end={end} />
            )}
          </section>
          <p className="mt-3 text-xs text-ink-500">
            A report is a reading taken when you asked for it. Nothing on this page is
            stored, and nothing here can be edited.
          </p>
        </>
      )}
    </>
  );
}

function LockedPanel({ who }: { who: string }) {
  return (
    <Card>
      <EmptyState
        title="Not open to your account"
        description={who}
      />
    </Card>
  );
}

/**
 * Money, counted twice on purpose.
 *
 * `invoiced_total` is what the shop **charged** (issued invoices); `collected_total`
 * is what the till **took** (recorded payments, net of voids). Adding them together
 * would produce a figure describing no real thing, and a garage that does it ends
 * the month convinced it earned money it was never paid.
 */
function RevenuePanel({ start, end }: { start: string; end: string }) {
  const { can } = useSession();
  const permitted = can("reports:read");
  const query = useApiQuery(
    () => reportsApi.revenue({ start_date: start, end_date: end }),
    [start, end],
    { enabled: permitted },
  );

  if (!permitted) {
    return (
      <LockedPanel who="Reading money taken needs reports access, which your roles do not carry." />
    );
  }
  if (query.loading && query.initial) return <Card><Loading label="Summing invoices…" /></Card>;
  if (query.error) return <Card><ErrorState error={query.error} onRetry={query.refetch} /></Card>;

  const report = query.data;
  if (!report) return <Card><ErrorState error={new Error("No revenue figures")} /></Card>;

  const byStatus = Object.entries(report.invoiced_by_status).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Invoiced"
          value={formatMoney(report.invoiced_total)}
          hint="Charged on issued invoices, this period"
        />
        <StatTile
          label="Collected"
          value={formatMoney(report.collected_total)}
          hint={`${formatNumber(report.payment_count)} recorded payment(s), net of voids`}
          tone={report.collected_total >= report.invoiced_total ? "success" : "warning"}
        />
        <StatTile
          label="Voided"
          value={formatMoney(report.voided_total)}
          hint={`${formatNumber(report.void_count)} voided payment(s)`}
          tone={report.void_count > 0 ? "danger" : "neutral"}
        />
        <StatTile
          label="Average invoice"
          value={formatMoney(report.average_invoice)}
          hint={`Across ${formatNumber(report.invoice_count)} invoice(s)`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile
          label="Outstanding"
          value={formatMoney(report.outstanding_balance)}
          hint={`${formatNumber(report.outstanding_count)} unpaid bill(s), any age`}
        />
        <StatTile
          label="Overdue"
          value={formatMoney(report.overdue_balance)}
          hint={`${formatNumber(report.overdue_count)} past the due date`}
          tone={report.overdue_count > 0 ? "danger" : "neutral"}
        />
      </div>

      <Notice tone="info">
        Outstanding and overdue are balances, not flows, so they are not scoped to the
        window above. A bill from eleven months ago that nobody has paid is still owed
        today, and filtering it by date would hide exactly the oldest debts.
      </Notice>

      <Card>
        <CardHeader
          title="Charged against collected"
          subtitle={`${formatDate(report.period.start_date)} to ${formatDate(report.period.end_date)}, by ${report.period.granularity.toLowerCase()}`}
        />
        <LineChart
          format={(value) => formatMoney(value)}
          series={[
            {
              name: "Invoiced",
              color: "var(--color-brand-500)",
              points: report.series.map((point) => ({
                label: point.period_start,
                value: point.invoiced,
              })),
            },
            {
              name: "Collected",
              color: "var(--color-emerald-500)",
              points: report.series.map((point) => ({
                label: point.period_start,
                value: point.collected,
              })),
            },
          ]}
        />
      </Card>

      <Card>
        <CardHeader
          title="What was written, by status"
          subtitle="Every status in the window, not just the issued ones"
        />
        {byStatus.length === 0 ? (
          <EmptyState title="No invoices in this period" />
        ) : (
          <>
            <BarList
              format={(value) => formatMoney(value)}
              items={byStatus.map(([status, total]) => ({
                label: titleCase(status),
                value: total,
              }))}
            />
            <p className="mt-3 text-xs text-ink-500">
              Deliberately unfiltered by status: a manager asking why the month looks
              short is owed the drafts and the write-offs that are holding the number
              back, not a total that quietly excludes them.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}

/**
 * How work moved through the shop.
 *
 * The counts under the tiles are inside the window. The `status_counts` list is
 * not, and could not be: a queue is a snapshot of what exists, and a shop whose QC
 * pile is on fire today does not become healthy because the window is March.
 */
function RepairOrdersPanel({ start, end }: { start: string; end: string }) {
  const { can } = useSession();
  const permitted = can("reports:read");
  const query = useApiQuery(
    () => reportsApi.repairOrders({ start_date: start, end_date: end }),
    [start, end],
    { enabled: permitted },
  );

  if (!permitted) {
    return (
      <LockedPanel who="Reading repair-order throughput needs reports access, which your roles do not carry." />
    );
  }
  if (query.loading && query.initial) return <Card><Loading label="Counting the board…" /></Card>;
  if (query.error) return <Card><ErrorState error={query.error} onRetry={query.refetch} /></Card>;

  const report = query.data;
  if (!report) return <Card><ErrorState error={new Error("No repair-order figures")} /></Card>;

  const statuses = Object.entries(report.status_counts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Raised"
          value={formatNumber(report.total_orders)}
          hint="Repair orders created in the period"
        />
        <StatTile label="Opened" value={formatNumber(report.opened)} hint="Work started in the period" />
        <StatTile
          label="Completed"
          value={formatNumber(report.completed)}
          hint="Work finished in the period"
          tone="success"
        />
        <StatTile label="Delivered" value={formatNumber(report.delivered)} hint="Handed back to a customer" />
        <StatTile
          label="Cancelled"
          value={formatNumber(report.cancelled)}
          tone={report.cancelled > 0 ? "warning" : "neutral"}
        />
        <StatTile
          label="Completion rate"
          value={formatPercent(report.completion_rate)}
          hint={`Completed against raised · ${formatNumber(report.total_orders)} denominator`}
        />
        <StatTile
          label="Average cycle"
          value={`${formatNumber(report.average_cycle_hours, 2)} h`}
          hint="First work started to finished, on orders that finished in the period"
        />
      </div>

      <Card>
        <CardHeader
          title="Opened against completed"
          subtitle={`By ${report.period.granularity.toLowerCase()} across the period`}
        />
        <LineChart
          format={(value) => formatNumber(value)}
          series={[
            {
              name: "Opened",
              color: "var(--color-brand-500)",
              points: report.series.map((point) => ({
                label: point.period_start,
                value: point.opened,
              })),
            },
            {
              name: "Completed",
              color: "var(--color-emerald-500)",
              points: report.series.map((point) => ({
                label: point.period_start,
                value: point.completed,
              })),
            },
          ]}
        />
      </Card>

      <Card>
        <CardHeader
          title="Where every repair order stands"
          subtitle="A snapshot of right now, not of the period"
        />
        {statuses.length === 0 ? (
          <EmptyState title="No repair orders exist yet" />
        ) : (
          <>
            <BarList
              items={statuses.map(([status, count]) => ({
                label: titleCase(status),
                value: count,
              }))}
            />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {statuses.map(([status]) => (
                <StatusBadge key={status} status={status} />
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-500">
              Counts every repair order that exists. A COMPLETED order here is still
              awaiting quality control — finishing the work is not the same as having
              somebody check it.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}

type WorkshopRow =
  | { kind: "person"; rank: number; technician: TechnicianProductivity }
  | {
      kind: "total";
      technicians: number;
      repairOrdersCompleted: number;
      tasksCompleted: number;
      laborHoursActual: number;
      laborHoursBillable: number;
      laborRevenue: number;
    };

/** The totals row is emphasised, so every column asks the row what kind it is. */
function emphasise(row: WorkshopRow, value: ReactNode): ReactNode {
  return row.kind === "total" ? <span className="font-semibold text-ink-900">{value}</span> : value;
}

const workshopColumns: Column<WorkshopRow>[] = [
  {
    key: "rank",
    header: "#",
    numeric: true,
    render: (row) => emphasise(row, row.kind === "person" ? formatNumber(row.rank) : "—"),
  },
  {
    key: "name",
    header: "Technician",
    render: (row) =>
      emphasise(
        row,
        row.kind === "person" ? row.technician.name : `Whole workshop (${formatNumber(row.technicians)})`,
      ),
  },
  {
    key: "assigned",
    header: "ROs assigned",
    numeric: true,
    render: (row) =>
      emphasise(row, row.kind === "person" ? formatNumber(row.technician.repair_orders_assigned) : "—"),
  },
  {
    key: "completed",
    header: "ROs completed",
    numeric: true,
    render: (row) =>
      emphasise(
        row,
        row.kind === "person"
          ? formatNumber(row.technician.repair_orders_completed)
          : formatNumber(row.repairOrdersCompleted),
      ),
  },
  {
    key: "tasks",
    header: "Tasks completed",
    numeric: true,
    render: (row) =>
      emphasise(
        row,
        row.kind === "person"
          ? formatNumber(row.technician.tasks_completed)
          : formatNumber(row.tasksCompleted),
      ),
  },
  {
    key: "actual",
    header: "Actual hours",
    numeric: true,
    render: (row) =>
      emphasise(
        row,
        row.kind === "person"
          ? formatNumber(row.technician.labor_hours_actual, 2)
          : formatNumber(row.laborHoursActual, 2),
      ),
  },
  {
    key: "billable",
    header: "Billable hours",
    numeric: true,
    render: (row) =>
      emphasise(
        row,
        row.kind === "person"
          ? formatNumber(row.technician.labor_hours_billable, 2)
          : formatNumber(row.laborHoursBillable, 2),
      ),
  },
  {
    key: "revenue",
    header: "Labour revenue",
    numeric: true,
    render: (row) =>
      emphasise(
        row,
        row.kind === "person"
          ? formatMoney(row.technician.labor_revenue)
          : formatMoney(row.laborRevenue),
      ),
  },
  {
    key: "cycle",
    header: "Avg cycle hours",
    numeric: true,
    render: (row) =>
      emphasise(row, row.kind === "person" ? formatNumber(row.technician.average_cycle_hours, 2) : "—"),
  },
];

/**
 * A ranking of named colleagues.
 *
 * The order is the API's, which is the point: the client does not get to choose
 * whose row is first. The totals row is shown because one technician read on their
 * own is not a report of the workshop.
 */
function TechniciansPanel({ start, end }: { start: string; end: string }) {
  const { can } = useSession();
  const permitted = can("reports:analytics");
  const query = useApiQuery(
    () => reportsApi.technicians({ start_date: start, end_date: end }),
    [start, end],
    { enabled: permitted },
  );

  if (!permitted) {
    return (
      <LockedPanel who="This report ranks named people, so it sits on reports:analytics. That permission is the owner's alone and is deliberately withheld from every other role." />
    );
  }
  if (query.loading && query.initial) return <Card><Loading label="Reading the workshop…" /></Card>;
  if (query.error) return <Card><ErrorState error={query.error} onRetry={query.refetch} /></Card>;

  const report = query.data;
  if (!report) return <Card><ErrorState error={new Error("No technician figures")} /></Card>;

  const rows: WorkshopRow[] = [
    ...report.technicians.map((technician, index) => ({
      kind: "person" as const,
      rank: index + 1,
      technician,
    })),
    {
      kind: "total" as const,
      technicians: report.totals.technician_count,
      repairOrdersCompleted: report.totals.repair_orders_completed,
      tasksCompleted: report.totals.tasks_completed,
      laborHoursActual: report.totals.labor_hours_actual,
      laborHoursBillable: report.totals.labor_hours_billable,
      laborRevenue: report.totals.labor_revenue,
    },
  ];

  return (
    <div className="space-y-4">
      <Notice tone="info">
        This report ranks named colleagues and is management&apos;s to read — it is held on
        reports:analytics, which the owner holds and no other role is given. Ordered by
        labour revenue, then completed repair orders.
      </Notice>

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title="Who did what"
            subtitle={`${formatDate(report.period.start_date)} to ${formatDate(report.period.end_date)} · busiest first, with the workshop total`}
          />
        </div>
        {report.technicians.length === 0 ? (
          <EmptyState
            title="Nobody worked in this period"
            description="A technician appears here because they did work inside the window, not because they hold the role."
          />
        ) : (
          <DataTable
            rows={rows}
            columns={workshopColumns}
            rowKey={(row, index) => (row.kind === "person" ? row.technician.technician_id : `total-${index}`)}
            dense
          />
        )}
      </Card>
      <p className="text-xs text-ink-500">
        Average cycle hours is a per-technician mean over the orders each of them
        finished, so it has no meaningful workshop total and is left blank there.
      </p>
    </div>
  );
}

/**
 * Stock at the shop's own purchase cost.
 *
 * Valued at today's catalog cost, which answers "what would replacing this shelf
 * cost us" and not "what did this stock cost us" — the ledger keeps each issue's
 * own unit cost, which is what the movers list uses. This report sits behind
 * `inventory:read` rather than `reports:read` because it is the shop's own cost.
 */
function InventoryValuePanel({ start, end }: { start: string; end: string }) {
  const { can } = useSession();
  const permitted = can("inventory:read");
  const query = useApiQuery(
    () => reportsApi.inventoryValue({ start_date: start, end_date: end }),
    [start, end],
    { enabled: permitted },
  );

  if (!permitted) {
    return (
      <LockedPanel who="These figures are the shop's own purchase cost per part, so they are gated on inventory:read rather than reports:read. Ask for inventory access to open this report." />
    );
  }
  if (query.loading && query.initial) return <Card><Loading label="Counting the shelves…" /></Card>;
  if (query.error) return <Card><ErrorState error={query.error} onRetry={query.refetch} /></Card>;

  const report = query.data;
  if (!report) return <Card><ErrorState error={new Error("No stock figures")} /></Card>;

  const lowStockColumns: Column<InventoryValueReport["low_stock_items"][number]>[] = [
    {
      key: "part",
      header: "Part",
      render: (item) => (
        <div className="min-w-0">
          <Link href={`/parts/${item.part_id}`} className="font-medium text-brand-700 hover:underline">
            {item.name}
          </Link>
          <p className="text-xs text-ink-500">{item.part_number}</p>
        </div>
      ),
    },
    {
      key: "onhand",
      header: "On hand",
      numeric: true,
      render: (item) => formatNumber(item.quantity_on_hand, 2),
    },
    {
      key: "reorder",
      header: "Reorder at",
      numeric: true,
      render: (item) => formatNumber(item.reorder_level, 2),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge status={item.stock_status} />,
    },
    {
      key: "cost",
      header: "Cost value",
      numeric: true,
      render: (item) => formatMoney(item.cost_value),
    },
  ];

  const moverColumns: Column<InventoryValueReport["top_movers"][number]>[] = [
    {
      key: "part",
      header: "Part",
      render: (mover) => (
        <div className="min-w-0">
          <Link href={`/parts/${mover.part_id}`} className="font-medium text-brand-700 hover:underline">
            {mover.name}
          </Link>
          <p className="text-xs text-ink-500">{mover.part_number}</p>
        </div>
      ),
    },
    {
      key: "quantity",
      header: "Issued",
      numeric: true,
      render: (mover) => formatNumber(mover.quantity_issued, 2),
    },
    {
      key: "value",
      header: "Value issued",
      numeric: true,
      render: (mover) => formatMoney(mover.value_issued),
    },
  ];

  return (
    <div className="space-y-4">
      <Notice tone="info">
        Cost and retail here are the shop&apos;s own figures, which is why this report is
        gated separately from the operational reports. Nothing below can be exported or
        edited — it is read from the catalog and the ledger as they stand.
      </Notice>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Stock at cost"
          value={formatMoney(report.cost_value)}
          hint={`Valued at today's catalog cost, as of ${formatDate(report.as_of)}`}
        />
        <StatTile label="Stock at retail" value={formatMoney(report.retail_value)} />
        <StatTile
          label="Potential margin"
          value={formatMoney(report.potential_margin)}
          hint="Retail less cost, if all of it sold"
        />
        <StatTile label="Parts" value={formatNumber(report.part_count)} hint="Lines on the catalog" />
        <StatTile label="Units on hand" value={formatNumber(report.units_on_hand, 2)} />
        <StatTile
          label="Low stock"
          value={formatNumber(report.low_stock_count)}
          tone={report.low_stock_count > 0 ? "warning" : "neutral"}
          hint="At or below the reorder point"
        />
        <StatTile
          label="Out of stock"
          value={formatNumber(report.out_of_stock_count)}
          tone={report.out_of_stock_count > 0 ? "danger" : "neutral"}
          hint="Nothing left to issue"
        />
      </div>

      <Card>
        <CardHeader title="Value by category" subtitle="At cost, across the catalog" />
        {report.by_category.length === 0 ? (
          <EmptyState title="Nothing on the shelves" />
        ) : (
          <BarList
            format={(value) => formatMoney(value)}
            items={[...report.by_category]
              .sort((a, b) => b.cost_value - a.cost_value)
              .map((row) => ({
                label: titleCase(row.category),
                value: row.cost_value,
                hint: `${formatMoney(row.retail_value)} at retail · ${formatNumber(row.part_count)} part(s), ${formatNumber(row.units_on_hand, 2)} units`,
              }))}
          />
        )}
      </Card>

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader title="At or below the reorder point" subtitle="Raise these before a job needs them" />
        </div>
        {report.low_stock_items.length === 0 ? (
          <EmptyState title="Nothing is running low" description="Every line is above its reorder point." />
        ) : (
          <DataTable
            rows={report.low_stock_items}
            columns={lowStockColumns}
            rowKey={(item) => item.part_id}
            dense
          />
        )}
      </Card>

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title="Top movers"
            subtitle={`Issued between ${formatDate(start)} and ${formatDate(end)}, at each issue's own cost`}
          />
        </div>
        {report.top_movers.length === 0 ? (
          <EmptyState title="Nothing was issued in this period" />
        ) : (
          <DataTable
            rows={report.top_movers}
            columns={moverColumns}
            rowKey={(mover) => mover.part_id}
            dense
          />
        )}
      </Card>
    </div>
  );
}

/**
 * Whether customers come back.
 *
 * "Retained" means settled more than one bill **ever**, not more than one inside
 * this window, so the customer who came back after a year away is precisely the one
 * this report exists to find.
 */
function RetentionPanel({ start, end }: { start: string; end: string }) {
  const { can } = useSession();
  const permitted = can("reports:analytics");
  const query = useApiQuery(
    () => reportsApi.customerRetention({ start_date: start, end_date: end }),
    [start, end],
    { enabled: permitted },
  );

  if (!permitted) {
    return (
      <LockedPanel who="Customers ranked by what they are worth is management's judgement, not a report anybody may read. reports:analytics is the owner's alone." />
    );
  }
  if (query.loading && query.initial) return <Card><Loading label="Reading the customer book…" /></Card>;
  if (query.error) return <Card><ErrorState error={query.error} onRetry={query.refetch} /></Card>;

  const report = query.data;
  if (!report) return <Card><ErrorState error={new Error("No retention figures")} /></Card>;

  const topColumns: Column<CustomerRetentionReport["top_customers"][number]>[] = [
    {
      key: "name",
      header: "Customer",
      render: (row) => (
        <Link href={`/customers/${row.customer_id}`} className="font-medium text-brand-700 hover:underline">
          {row.name}
        </Link>
      ),
    },
    { key: "invoices", header: "Settled bills", numeric: true, render: (row) => formatNumber(row.invoice_count) },
    { key: "revenue", header: "Settled revenue", numeric: true, render: (row) => formatMoney(row.revenue) },
  ];

  return (
    <div className="space-y-4">
      <Notice tone="info">
        Retention here is lifetime: a customer counts as retained once they have settled
        more than one bill ever, not more than one inside this window. A customer who came
        back after a year away is exactly who this report is looking for.
      </Notice>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile
          label="Customers billed"
          value={formatNumber(report.customers_billed)}
          hint="Someone settled a bill inside the period"
        />
        <StatTile
          label="First bill"
          value={formatNumber(report.new_customers)}
          hint="This was the first they ever paid"
        />
        <StatTile
          label="Came back"
          value={formatNumber(report.returning_customers)}
          hint="They had paid before, at some point"
        />
        <StatTile
          label="Repeat rate"
          value={formatPercent(report.repeat_rate)}
          hint={`${formatNumber(report.returning_customers)} of ${formatNumber(report.customers_billed)} customers billed`}
        />
        <StatTile
          label="Settled revenue"
          value={formatMoney(report.settled_revenue)}
          hint="Bills actually paid, not bills sent"
        />
        <StatTile
          label="Per customer"
          value={formatMoney(report.revenue_per_customer)}
          hint={`Over ${formatNumber(report.customers_billed)} billed customer(s)`}
        />
      </div>

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader title="Who came back most" subtitle="By settled revenue in the period" />
        </div>
        {report.top_customers.length === 0 ? (
          <EmptyState title="Nobody settled a bill in this period" />
        ) : (
          <DataTable
            rows={report.top_customers}
            columns={topColumns}
            rowKey={(row) => row.customer_id}
            dense
          />
        )}
      </Card>
    </div>
  );
}