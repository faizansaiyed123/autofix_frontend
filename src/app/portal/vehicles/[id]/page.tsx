"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { Card, CardHeader, KeyValue, KeyValueGrid } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { portalApi } from "@/lib/api/portal";
import type {
  PortalInspection,
  PortalInvoice,
  PortalRepairOrder,
  PortalServiceRequest,
} from "@/lib/api/types";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";

/**
 * One car, and everything that has happened to it.
 *
 * The history is deliberately narrower than the shop's view of the same vehicle.
 * Per-inspection measurements, the technician's name and which bay the car was in
 * are working notes, not a customer document — so they are simply not in the
 * response and cannot be shown here.
 *
 * `total_spent` counts settled invoices only. A draft or written-off bill is not
 * money that was spent, and an unpaid one is not history the customer has
 * completed.
 */
export default function PortalVehicleHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const history = useApiQuery(() => portalApi.vehicleHistory(id), [id]);

  if (history.loading && history.initial) return <Loading />;
  if (history.error) return <ErrorState error={history.error} />;

  const data = history.data;
  if (!data) return <ErrorState error={new Error("No history")} />;

  const { vehicle, repair_orders, inspections, invoices, service_requests, total_spent, visit_count } =
    data;

  return (
    <>
      <PageHeader
        breadcrumb={<Link href="/portal/vehicles" className="hover:underline">My vehicles</Link>}
        title={[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}
        subtitle={vehicle.license_plate ?? undefined}
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="This car" />
          <KeyValueGrid>
            <KeyValue label="Status">{vehicle.status_view.label}</KeyValue>
            <KeyValue label="Mileage">{formatNumber(vehicle.mileage)}</KeyValue>
            <KeyValue label="VIN">{vehicle.vin ?? "—"}</KeyValue>
            <KeyValue label="Colour">{vehicle.color ?? "—"}</KeyValue>
            <KeyValue label="Plate">{vehicle.license_plate ?? "—"}</KeyValue>
            <KeyValue label="Year">{vehicle.year ?? "—"}</KeyValue>
          </KeyValueGrid>
          {vehicle.status_view.detail ? (
            <p className="mt-3 text-sm text-ink-600">{vehicle.status_view.detail}</p>
          ) : null}
        </Card>

        <Card>
          <CardHeader title="Your spend" subtitle="Settled invoices only" />
          <p className="tabular text-2xl font-semibold text-ink-900">{formatMoney(total_spent)}</p>
          <p className="mt-1 text-sm text-ink-500">
            {visit_count} visit{visit_count === 1 ? "" : "s"} on record
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="Repairs" subtitle="What was done to this car" />
          </div>
          {repair_orders.length === 0 ? (
            <EmptyState title="No repairs recorded" />
          ) : (
            <DataTable
              rows={repair_orders}
              dense
              rowKey={(r) => r.id}
              columns={repairOrderColumns}
            />
          )}
        </Card>

        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="Inspections" subtitle="Health checks" />
          </div>
          {inspections.length === 0 ? (
            <EmptyState title="No inspections recorded" />
          ) : (
            <DataTable rows={inspections} dense rowKey={(i) => i.id} columns={inspectionColumns} />
          )}
        </Card>

        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="Invoices" />
          </div>
          {invoices.length === 0 ? (
            <EmptyState title="No invoices yet" />
          ) : (
            <DataTable rows={invoices} dense rowKey={(i) => i.id} columns={invoiceColumns} />
          )}
        </Card>

        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="Requests you sent" />
          </div>
          {service_requests.length === 0 ? (
            <EmptyState title="No requests sent" />
          ) : (
            <DataTable
              rows={service_requests}
              dense
              rowKey={(r) => r.id}
              columns={requestColumns}
            />
          )}
        </Card>
      </div>
    </>
  );
}

function CustomerStatusCell({ label, detail }: { label: string; detail?: string }) {
  return (
    <span title={detail} className="text-xs text-ink-700">
      {label}
    </span>
  );
}

const repairOrderColumns: Column<PortalRepairOrder>[] = [
  {
    key: "work",
    header: "Work",
    render: (r) => (
      <div>
        <p className="font-medium text-ink-800">{r.ro_number}</p>
        <p className="text-xs text-ink-500">
          {r.completed_at ? `Finished ${formatDate(r.completed_at)}` : "In progress"}
        </p>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (r) => <CustomerStatusCell label={r.status_view.label} detail={r.status_view.detail} />,
  },
];

const inspectionColumns: Column<PortalInspection>[] = [
  {
    key: "condition",
    header: "Condition",
    render: (i) => (
      <span className="text-xs font-medium text-ink-700">{i.overall_condition}</span>
    ),
  },
  { key: "date", header: "Date", render: (i) => formatDate(i.created_at) },
];

const invoiceColumns: Column<PortalInvoice>[] = [
  {
    key: "number",
    header: "Invoice",
    render: (i) => (
      <Link href="/portal/invoices" className="font-medium text-brand-700 hover:underline">
        {i.invoice_number}
      </Link>
    ),
  },
  { key: "total", header: "Total", numeric: true, render: (i) => formatMoney(i.total) },
  {
    key: "balance",
    header: "Balance",
    numeric: true,
    render: (i) => (
      <span className={i.balance > 0 ? "font-medium text-amber-700" : "text-ink-600"}>
        {formatMoney(i.balance)}
      </span>
    ),
  },
  { key: "status", header: "Status", render: (i) => i.status_view.label },
];

const requestColumns: Column<PortalServiceRequest>[] = [
  {
    key: "title",
    header: "Request",
    render: (r) => (
      <div>
        <p className="text-ink-800">{r.title}</p>
        <p className="text-xs text-ink-500">{formatDateTime(r.created_at)}</p>
      </div>
    ),
  },
  { key: "status", header: "Status", render: (r) => r.status_view.label },
];