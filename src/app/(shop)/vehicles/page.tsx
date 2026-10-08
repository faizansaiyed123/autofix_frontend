"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Field, FormError, Input, Select, Textarea, useForm } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader, SearchInput, Toolbar } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { useReferences } from "@/components/layout/ReferenceProvider";
import { vehiclesApi } from "@/lib/api/shop";
import type { Vehicle, VehicleCreate, VehicleStatus } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { formatNumber, formatRelative } from "@/lib/format";

const VEHICLE_STATUSES: VehicleStatus[] = ["ACTIVE", "IN_SHOP", "ARCHIVED"];

/**
 * The shop's vehicle book.
 *
 * Shop-wide rather than "mine", for the same reason the customer book is: this
 * screen sits behind the staff gate and every desk needs to see every car in
 * order to recognise one at the kerb.
 */
export default function VehiclesPage() {
  const { can } = useSession();
  const router = useRouter();
  const { customerLabel, customers } = useReferences();
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const query = useApiQuery(
    () =>
      vehiclesApi.list({
        page,
        size: 25,
        search: search || undefined,
        customer_id: customerId || undefined,
      }),
    [page, search, customerId],
  );

  const columns: Column<Vehicle>[] = [
    {
      key: "vehicle",
      header: "Vehicle",
      render: (v) => (
        <div className="min-w-0">
          <Link href={`/vehicles/${v.id}`} className="font-medium text-brand-700 hover:underline">
            {[v.year, v.make, v.model].filter(Boolean).join(" ")}
          </Link>
          {v.license_plate ? (
            <p className="text-xs text-ink-500">{v.license_plate}</p>
          ) : (
            <p className="text-xs text-ink-400">No plate</p>
          )}
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (v) => <span className="text-sm text-ink-700">{customerLabel(v.customer_id)}</span>,
    },
    {
      key: "mileage",
      header: "Mileage",
      numeric: true,
      render: (v) => (v.mileage === null ? <span className="text-ink-400">—</span> : formatNumber(v.mileage)),
    },
    { key: "status", header: "Status", render: (v) => <StatusBadge status={v.status} /> },
    {
      key: "updated",
      header: "Updated",
      numeric: true,
      render: (v) => {
        // The vehicle payload carries no updated_at, so the newest mileage
        // reading is the only timestamp the row actually has.
        const latest = lastReadingAt(v);
        return (
          <span className="text-xs text-ink-500">{latest ? formatRelative(latest) : "No reading"}</span>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Vehicles"
        subtitle={query.data ? `${query.data.meta.total} in the book` : undefined}
        actions={
          can("vehicles:write") ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Add vehicle
            </Button>
          ) : null
        }
      />

      <Card padded={false}>
        <Toolbar>
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Make, model, plate or VIN"
            className="min-w-64 flex-1"
          />
          <Select
            value={customerId}
            onChange={(event) => {
              setCustomerId(event.target.value);
              setPage(1);
            }}
            className="w-56"
          >
            <option value="">Any customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.first_name} {customer.last_name}
              </option>
            ))}
          </Select>
        </Toolbar>

        {query.loading && query.initial ? (
          <Loading />
        ) : query.error ? (
          <div className="p-4">
            <ErrorState error={query.error} onRetry={query.refetch} />
          </div>
        ) : !query.data || query.data.data.length === 0 ? (
          <EmptyState
            title={search ? "No vehicle matches that" : "No vehicles yet"}
            description={
              search
                ? "Search covers make, model, plate and VIN."
                : "Add a vehicle against a customer to start booking work on it."
            }
          />
        ) : (
          <>
            <DataTable
              rows={query.data.data}
              columns={columns}
              rowKey={(v) => v.id}
              onRowClick={(v) => router.push(`/vehicles/${v.id}`)}
            />
            <Pagination
              page={query.data.meta.page}
              pages={query.data.meta.pages}
              total={query.data.meta.total}
              onPage={setPage}
            />
          </>
        )}
      </Card>

      <NewVehicleModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          query.refetch();
          router.push(`/vehicles/${id}`);
        }}
      />
    </>
  );
}

function lastReadingAt(vehicle: Vehicle): string | null {
  if (!vehicle.mileage_records || vehicle.mileage_records.length === 0) return null;
  return vehicle.mileage_records.reduce(
    (latest, record) => (record.created_at > latest ? record.created_at : latest),
    vehicle.mileage_records[0].created_at,
  );
}

function NewVehicleModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { customers } = useReferences();
  const form = useForm({
    customer_id: "",
    make: "",
    model: "",
    year: "",
    vin: "",
    license_plate: "",
    mileage: "",
    color: "",
    status: "ACTIVE",
    notes: "",
  });
  const create = useApiMutation((body: VehicleCreate) => vehiclesApi.create(body));

  const year = Number(form.values.year);
  const yearRejected = form.values.year !== "" && !(year >= 1900 && year <= 2030);
  const vinRejected = Boolean(
    form.values.vin && !/^[A-HJ-NPR-Z0-9]{11,17}$/i.test(form.values.vin.trim()),
  );

  async function submit() {
    const missing = form.missing(["customer_id", "make", "model"]);
    if (missing.length > 0) return;

    // The year range and the VIN pattern are enforced by the API, so a value
    // either fails here in the form or is never sent at all.
    if (yearRejected || vinRejected) return;

    const mileage = Number(form.values.mileage);

    const created = await create.run({
      customer_id: form.values.customer_id,
      make: form.values.make,
      model: form.values.model,
      year: form.values.year ? year : null,
      vin: form.values.vin ? form.values.vin.trim().toUpperCase() : null,
      license_plate: form.values.license_plate || null,
      mileage: form.values.mileage ? mileage : null,
      color: form.values.color || null,
      status: form.values.status as VehicleStatus,
      notes: form.values.notes || null,
    });
    if (created) {
      form.reset();
      onCreated(created.id);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add vehicle"
      description="A vehicle belongs to a customer — book work against the pair, never the car alone."
      footer={
        <>
          <Button onClick={onClose} disabled={create.pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            pending={create.pending}
            disabled={yearRejected || vinRejected}
            onClick={() => void submit()}
          >
            Add vehicle
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="space-y-3"
      >
        <FormError error={create.error} />
        <Field label="Owner" required>
          <Select
            value={form.values.customer_id}
            onChange={(event) => form.set("customer_id", event.target.value)}
          >
            <option value="">Choose a customer…</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.first_name} {customer.last_name}
                {customer.company_name ? ` · ${customer.company_name}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Make" required>
            <Input value={form.values.make} onChange={(e) => form.set("make", e.target.value)} />
          </Field>
          <Field label="Model" required>
            <Input value={form.values.model} onChange={(e) => form.set("model", e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Year"
            hint="1900 to 2030"
            error={yearRejected ? "Outside 1900 to 2030" : null}
          >
            <Input
              type="number"
              min={1900}
              max={2030}
              value={form.values.year}
              onChange={(e) => form.set("year", e.target.value)}
            />
          </Field>
          <Field label="Colour">
            <Input value={form.values.color} onChange={(e) => form.set("color", e.target.value)} />
          </Field>
        </div>
        <Field
          label="VIN"
          hint="Optional. 11 to 17 characters, no I, O or Q."
          error={vinRejected ? "Not a valid VIN" : null}
        >
          <Input
            value={form.values.vin}
            onChange={(e) => form.set("vin", e.target.value.toUpperCase())}
            className="font-mono"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Plate">
            <Input
              value={form.values.license_plate}
              onChange={(e) => form.set("license_plate", e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Mileage">
            <Input
              type="number"
              min={0}
              value={form.values.mileage}
              onChange={(e) => form.set("mileage", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Status">
          <Select
            value={form.values.status}
            onChange={(e) => form.set("status", e.target.value)}
          >
            {VEHICLE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes">
          <Textarea
            rows={2}
            value={form.values.notes}
            onChange={(e) => form.set("notes", e.target.value)}
          />
        </Field>
        <Notice tone="info">
          Mileage entered here sets the current reading. Add readings over time from the vehicle page
          so the history explains itself.
        </Notice>
      </form>
    </Modal>
  );
}