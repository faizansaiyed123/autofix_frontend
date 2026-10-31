"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import {
  Field,
  FormError,
  Input,
  Select,
  Textarea,
  useForm,
} from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader, Toolbar } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { useReferences } from "@/components/layout/ReferenceProvider";
import { inspectionsApi } from "@/lib/api/shop";
import type { Inspection } from "@/lib/api/types";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useSession } from "@/lib/auth/AuthProvider";
import type { InspectionCreate } from "@/lib/api/types";
import { INSPECTION_STATUSES } from "@/lib/status";
import { formatDate, formatNumber, titleCase } from "@/lib/format";

/**
 * The condition badge uses the API's result from the worst inspection item; don't
 * recompute that severity in the frontend.
 */
export default function InspectionsPage() {
  const router = useRouter();
  const { customerLabel, userName, vehicleLabel, staff, vehicles, customers } =
    useReferences();
  const { can } = useSession();
  const [creating, setCreating] = useState(false);
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
      render: (i) => (
        <span className="font-medium text-ink-800">
          {vehicleLabel(i.vehicle_id)}
        </span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (i) => (
        <span className="text-sm text-ink-700">
          {customerLabel(i.customer_id)}
        </span>
      ),
    },
    {
      key: "technician",
      header: "Technician",
      render: (i) =>
        i.technician_id ? (
          <span className="text-sm text-ink-700">
            {userName(i.technician_id)}
          </span>
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
      render: (i) => (
        <span className="text-xs text-ink-500">{formatDate(i.created_at)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (i) => <StatusBadge status={i.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Inspections"
        subtitle={list.data ? `${list.data.meta.total} on record` : undefined}
        actions={
          can("inspections:write") ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              New inspection
            </Button>
          ) : null
        }
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
                {[vehicle.year, vehicle.make, vehicle.model]
                  .filter(Boolean)
                  .join(" ")}
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
            description="Start an inspection for a customer and vehicle, then record the findings that become the customer's condition report."
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
      {creating ? (
        <NewInspectionModal
          customers={customers}
          vehicles={vehicles}
          staff={staff}
          onClose={() => setCreating(false)}
          onCreated={(inspection) =>
            router.push(`/inspections/${inspection.id}`)
          }
        />
      ) : null}
    </>
  );
}

function NewInspectionModal({
  customers,
  vehicles,
  staff,
  onClose,
  onCreated,
}: {
  customers: Array<{
    id: string;
    first_name: string;
    last_name: string;
    company_name?: string | null;
  }>;
  vehicles: Array<{
    id: string;
    customer_id: string;
    make: string;
    model: string;
    year: number | null;
  }>;
  staff: Array<{
    id: string;
    first_name: string;
    last_name: string;
    roles?: string[];
  }>;
  onClose: () => void;
  onCreated: (inspection: Inspection) => void;
}) {
  const form = useForm({
    customer_id: "",
    vehicle_id: "",
    technician_id: "",
    mileage: "",
    overall_notes: "",
  });
  const create = useApiMutation((body: InspectionCreate) =>
    inspectionsApi.create(body),
  );
  const customerVehicles = vehicles.filter(
    (vehicle) => vehicle.customer_id === form.values.customer_id,
  );

  async function submit() {
    if (form.missing(["customer_id", "vehicle_id"]).length > 0) return;
    const vehicle = customerVehicles.find(
      (candidate) => candidate.id === form.values.vehicle_id,
    );
    if (!vehicle) return;
    const created = await create.run({
      customer_id: form.values.customer_id,
      vehicle_id: form.values.vehicle_id,
      technician_id: form.values.technician_id || null,
      mileage: form.values.mileage === "" ? null : Number(form.values.mileage),
      overall_notes: form.values.overall_notes.trim() || null,
      items: [],
    });
    if (created) {
      form.reset();
      onCreated(created);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New inspection"
      description="Choose a customer and one of their vehicles. Findings can be added on the next screen."
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose} disabled={create.pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            pending={create.pending}
            disabled={!form.values.customer_id || !form.values.vehicle_id}
            onClick={() => void submit()}
          >
            Create inspection
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <FormError error={create.error} />
        <Field label="Customer" required>
          <Select
            value={form.values.customer_id}
            onChange={(event) => {
              const customerId = event.target.value;
              form.set("customer_id", customerId);
              form.set("vehicle_id", "");
            }}
          >
            <option value="">Choose a customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.first_name} {customer.last_name}
                {customer.company_name ? ` · ${customer.company_name}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Vehicle" required>
          <Select
            value={form.values.vehicle_id}
            disabled={!form.values.customer_id}
            onChange={(event) => form.set("vehicle_id", event.target.value)}
          >
            <option value="">Choose a vehicle</option>
            {customerVehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {[vehicle.year, vehicle.make, vehicle.model]
                  .filter(Boolean)
                  .join(" ")}
              </option>
            ))}
          </Select>
          {form.values.customer_id && customerVehicles.length === 0 ? (
            <p className="mt-1 text-xs text-amber-700">
              This customer has no registered vehicles.
            </p>
          ) : null}
        </Field>
        <Field label="Technician">
          <Select
            value={form.values.technician_id}
            onChange={(event) => form.set("technician_id", event.target.value)}
          >
            <option value="">Not assigned</option>
            {staff.map((person) => (
              <option key={person.id} value={person.id}>
                {person.first_name} {person.last_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Mileage" hint="Optional; cannot be negative.">
          <Input
            type="number"
            min="0"
            max="10000000"
            value={form.values.mileage}
            onChange={(event) => form.set("mileage", event.target.value)}
          />
        </Field>
        <Field label="Overall notes">
          <Textarea
            rows={3}
            maxLength={5000}
            value={form.values.overall_notes}
            onChange={(event) => form.set("overall_notes", event.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
