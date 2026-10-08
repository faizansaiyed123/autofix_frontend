"use client";

import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { portalApi } from "@/lib/api/portal";
import type { PortalVehicle } from "@/lib/api/types";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { formatNumber } from "@/lib/format";

export default function PortalVehiclesPage() {
  const vehicles = useApiQuery(() => portalApi.vehicles());

  const columns: Column<PortalVehicle>[] = [
    {
      key: "vehicle",
      header: "Vehicle",
      render: (v) => (
        <Link href={`/portal/vehicles/${v.id}`} className="font-medium text-brand-700 hover:underline">
          {[v.year, v.make, v.model].filter(Boolean).join(" ")}
        </Link>
      ),
    },
    {
      key: "identifiers",
      header: "Plate / VIN",
      render: (v) => (
        <span className="text-xs text-ink-600">
          {v.license_plate ?? "—"}
          {v.vin ? <span className="block text-ink-400">{v.vin}</span> : null}
        </span>
      ),
    },
    { key: "mileage", header: "Mileage", numeric: true, render: (v) => formatNumber(v.mileage) },
    {
      key: "status",
      header: "Status",
      render: (v) => (
        <span className="inline-flex items-center rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-700">
          {v.status_view.label}
        </span>
      ),
    },
  ];

  if (vehicles.loading && vehicles.initial) return <Loading />;
  if (vehicles.error) {
    return <ErrorState error={vehicles.error} onRetry={vehicles.error.status === 404 ? undefined : vehicles.refetch} />;
  }

  return (
    <>
      <PageHeader title="My vehicles" subtitle="The cars on your account." />
      <Card padded={false}>
        {vehicles.data && vehicles.data.length > 0 ? (
          <DataTable
            rows={vehicles.data}
            columns={columns}
            rowKey={(v) => v.id}
            empty={<EmptyState title="No vehicles on your account yet" />}
          />
        ) : (
          <EmptyState
            title="No vehicles on your account yet"
            description="The shop adds a vehicle when you bring a car in."
          />
        )}
      </Card>
    </>
  );
}