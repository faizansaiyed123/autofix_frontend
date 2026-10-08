"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Select } from "@/components/ui/Form";
import { PageHeader, Toolbar } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { useReferences } from "@/components/layout/ReferenceProvider";
import { inspectionsApi } from "@/lib/api/shop";
import type { Inspection } from "@/lib/api/types";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { INSPECTION_STATUSES } from "@/lib/status";
import { formatDate, formatNumber, titleCase } from "@/lib/format";

/**
 * The condition inspections the shop has carried out.
 *
 * The condition column is the traffic light the customer is eventually shown —
 * GREEN, YELLOW or RED, derived by the API from the worst item on the record —
 * so it is rendered through the shared badge rather than recomputed here.
 */
export default function InspectionsPage() {
  const router = useRouter();
  const { customerLabel, userName, vehicleLabel, staff, vehicles } = useReferences();
  const [status, setStatus] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [page, setPage] = useState(1);

  const list = useApiQuery(
    () =>
      inspectionsApi.list({
        page,
        size: 25,
        status: status || undefined,
        vehicle_id: vehicleId || undefined,
        technician_id: technicianId || undefined,
      }),
    [page, status, vehicleId, technicianId],
  );

  const columns: Column<Inspection>[] = [
    {
      key: "vehicle",
      header: "Vehicle",
      render: (i) => <span className="font-medium text-ink-800">{vehicleLabel(i.vehicle_id)}</span>,
    },
    {
      key: "customer",
      header: "Customer",
      render: (i) => <span className="text-sm text-ink-700">{customerLabel(i.customer_id)}</span>,
    },
    {
      key: "technician",
      header: "Technician",
      render: (i) =>
        i.technician_id ? (
          <span className="text-sm text-ink-700">{userName(i.technician_id)}</span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: "condition",
      header: "Condition",
      render: (i) => <StatusBadge status={i.overall_condition} />,
    },
    {
      key: "items",
      header: "Items",
      numeric: true,
      render: (i) => formatNumber(i.items.length),
    },
    {
      key: "date",
      header: "Date",
      numeric: true,
      render: (i) => <span className="text-xs text-ink-500">{formatDate(i.created_at)}</span>,
    },
    { key: "status", header: "Status", render: (i) => <StatusBadge status={i.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Inspections"
        subtitle={list.data ? `${list.data.meta.total} on record` : undefined}
      />

      <Card padded={false}>
        <Toolbar>
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="w-44"
            aria-label="Filter by status"
          >
            <option value="">Any status</option>
            {INSPECTION_STATUSES.map((option) => (
              <option key={option} value={option}>
                {titleCase(option)}
              </option>
            ))}
          </Select>
          <Select
            value={vehicleId}
            onChange={(event) => {
              setVehicleId(event.target.value);
              setPage(1);
            }}
            className="w-52"
            aria-label="Filter by vehicle"
          >
            <option value="">Any vehicle</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}
              </option>
            ))}
          </Select>
          <Select
            value={technicianId}
            onChange={(event) => {
              setTechnicianId(event.target.value);
              setPage(1);
            }}
            className="w-48"
            aria-label="Filter by technician"
          >
            <option value="">Any technician</option>
            {staff.map((person) => (
              <option key={person.id} value={person.id}>
                {person.first_name} {person.last_name}
              </option>
            ))}
          </Select>
        </Toolbar>

        {list.loading && list.initial ? (
          <Loading />
        ) : list.error ? (
          <div className="p-4">
            <ErrorState error={list.error} onRetry={list.refetch} />
          </div>
        ) : !list.data || list.data.data.length === 0 ? (
          <EmptyState
            title="No inspections yet"
            description="An inspection is created from a check-in, and its findings become the customer's condition report."
          />
        ) : (
          <>
            <DataTable
              rows={list.data.data}
              columns={columns}
              rowKey={(i) => i.id}
              onRowClick={(i) => router.push(`/inspections/${i.id}`)}
            />
            <Pagination
              page={list.data.meta.page}
              pages={list.data.meta.pages}
              total={list.data.meta.total}
              onPage={setPage}
            />
          </>
        )}
      </Card>
    </>
  );
}