"use client";

import { useState } from "react";

import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, KeyValue, KeyValueGrid } from "@/components/ui/Card";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Field, FormError, Input, Select, Textarea, useForm } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader, Toolbar } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { useReferences } from "@/components/layout/ReferenceProvider";
import { checkInsApi } from "@/lib/api/shop";
import type { CheckIn, CheckInCreate } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { formatDateTime, formatNumber, titleCase, toApiDateTime } from "@/lib/format";

const CHECKIN_TYPES = ["DRIVE_IN", "WALK_IN", "APPOINTMENT"];

/**
 * The statuses `CheckInStatus` actually holds, and where each one may go.
 *
 * The shared `CHECKIN_STATUSES` array says CHECKED_IN / IN_SERVICE /
 * READY_FOR_PICKUP / DELIVERED, none of which the API recognises — a filter built
 * from it silently matches nothing and a status control built from it is refused
 * on every press. These are the API's own values, and the table doubles as the
 * transition map, which is what makes the terminal states visible.
 */
const CHECKIN_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const CHECKIN_STATUSES = Object.keys(CHECKIN_TRANSITIONS);

/**
 * What happens on arrival.
 *
 * The odometer is the number a customer later argues about, and the tyre, fluid
 * and light notes are the shop's record of how the car looked when it arrived —
 * which is why they are captured at the door rather than reconstructed later.
 */
export default function CheckInsPage() {
  const { can } = useSession();
  const { customerLabel, vehicleLabel, vehicles, customers } = useReferences();
  const [status, setStatus] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useApiQuery(
    () =>
      checkInsApi.list({
        page,
        size: 25,
        status: status || undefined,
        vehicle_id: vehicleId || undefined,
        customer_id: customerId || undefined,
      }),
    [page, status, vehicleId, customerId],
  );

  const columns: Column<CheckIn>[] = [
    {
      key: "when",
      header: "Arrived",
      render: (c) => <span className="text-xs text-ink-600">{formatDateTime(c.created_at)}</span>,
    },
    {
      key: "vehicle",
      header: "Vehicle",
      render: (c) => <span className="font-medium text-ink-800">{vehicleLabel(c.vehicle_id)}</span>,
    },
    {
      key: "customer",
      header: "Customer",
      render: (c) => <span className="text-sm text-ink-700">{customerLabel(c.customer_id)}</span>,
    },
    {
      key: "odometer",
      header: "Odometer",
      numeric: true,
      render: (c) => `${formatNumber(c.odometer)} mi`,
    },
    { key: "type", header: "Type", render: (c) => titleCase(c.checkin_type) },
    { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Check-ins"
        subtitle={list.data ? `${list.data.meta.total} on record` : undefined}
        actions={
          can("check_ins:write") ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Check a vehicle in
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
            {CHECKIN_STATUSES.map((option) => (
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
            className="w-56"
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
            value={customerId}
            onChange={(event) => {
              setCustomerId(event.target.value);
              setPage(1);
            }}
            className="w-48"
            aria-label="Filter by customer"
          >
            <option value="">Any customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.first_name} {customer.last_name}
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
            title="Nothing checked in"
            description="Record a vehicle on arrival to start its visit."
          />
        ) : (
          <>
            <DataTable
              rows={list.data.data}
              columns={columns}
              rowKey={(c) => c.id}
              onRowClick={(c) => setSelectedId(c.id)}
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

      <NewCheckInModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          list.refetch();
        }}
      />

      <CheckInDetailModal
        id={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={list.refetch}
      />
    </>
  );
}

function NewCheckInModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { vehicles } = useReferences();
  const [search, setSearch] = useState("");
  const form = useForm({
    vehicle_id: "",
    odometer: "",
    checkin_type: "DRIVE_IN",
    expected_completion: "",
    tire_condition: "",
    fluid_levels: "",
    lights_status: "",
    notes: "",
  });
  const create = useApiMutation((body: CheckInCreate) => checkInsApi.create(body));

  // Narrowing happens in the browser because the list endpoint has no search
  // parameter; the vehicle book is small enough for that to be honest.
  const term = search.trim().toLowerCase();
  const choices = term
    ? vehicles.filter((vehicle) =>
        [vehicle.make, vehicle.model, vehicle.license_plate, vehicle.vin]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(term)),
      )
    : vehicles;

  async function submit() {
    const missing = form.missing(["vehicle_id", "odometer"]);
    if (missing.length > 0) return;
    const odometer = Number(form.values.odometer);
    if (!Number.isFinite(odometer) || odometer <= 0) return;

    const chosen = vehicles.find((vehicle) => vehicle.id === form.values.vehicle_id);
    if (!chosen) return;

    const created = await create.run({
      // The owner comes from the vehicle rather than a second picker, because the
      // API rejects a customer/vehicle pair that disagrees.
      customer_id: chosen.customer_id,
      vehicle_id: chosen.id,
      odometer,
      checkin_type: form.values.checkin_type,
      expected_completion: form.values.expected_completion
        ? toApiDateTime(new Date(form.values.expected_completion))
        : null,
      tire_condition: form.values.tire_condition || null,
      fluid_levels: form.values.fluid_levels || null,
      lights_status: form.values.lights_status || null,
      notes: form.values.notes || null,
    });
    if (created) {
      form.reset();
      setSearch("");
      onCreated();
    }
  }

  const odometer = Number(form.values.odometer);
  const odometerRejected = form.values.odometer !== "" && !(odometer > 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Check a vehicle in"
      description="Capture how the car looks now — it is the shop's record of its condition on arrival."
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose} disabled={create.pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            pending={create.pending}
            disabled={odometerRejected}
            onClick={() => void submit()}
          >
            Check in
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
        <Field label="Find the vehicle">
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Plate, model or VIN"
          />
        </Field>
        <Field
          label="Vehicle"
          required
          hint={
            choices.length === 0
              ? "No vehicle matches. Add it to the vehicle book first."
              : `${choices.length} in the book — the owner is filled in from the vehicle`
          }
        >
          <Select
            value={form.values.vehicle_id}
            onChange={(event) => form.set("vehicle_id", event.target.value)}
          >
            <option value="">Choose a vehicle…</option>
            {choices.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}
                {vehicle.license_plate ? ` (${vehicle.license_plate})` : ""}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Odometer" required error={odometerRejected ? "Must be greater than zero" : null}>
            <Input
              type="number"
              min={1}
              value={form.values.odometer}
              onChange={(event) => form.set("odometer", event.target.value)}
            />
          </Field>
          <Field label="How it arrived">
            <Select
              value={form.values.checkin_type}
              onChange={(event) => form.set("checkin_type", event.target.value)}
            >
              {CHECKIN_TYPES.map((type) => (
                <option key={type} value={type}>
                  {titleCase(type)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Promised by" hint="Optional — shown to the customer on their account">
          <Input
            type="datetime-local"
            value={form.values.expected_completion}
            onChange={(event) => form.set("expected_completion", event.target.value)}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Tyres" hint="Up to 50 characters">
            <Input
              maxLength={50}
              value={form.values.tire_condition}
              onChange={(event) => form.set("tire_condition", event.target.value)}
              placeholder="Good all round"
            />
          </Field>
          <Field label="Fluids" hint="Up to 50 characters">
            <Input
              maxLength={50}
              value={form.values.fluid_levels}
              onChange={(event) => form.set("fluid_levels", event.target.value)}
              placeholder="Topped up"
            />
          </Field>
          <Field label="Lights" hint="Up to 50 characters">
            <Input
              maxLength={50}
              value={form.values.lights_status}
              onChange={(event) => form.set("lights_status", event.target.value)}
              placeholder="All working"
            />
          </Field>
        </div>

        <Field label="Notes">
          <Textarea
            rows={2}
            maxLength={2000}
            value={form.values.notes}
            onChange={(event) => form.set("notes", event.target.value)}
          />
        </Field>

        <Notice tone="info">
          A new check-in starts as PENDING. Move it on from the record when the work actually starts.
        </Notice>
      </form>
    </Modal>
  );
}

function CheckInDetailModal({
  id,
  onClose,
  onChanged,
}: {
  id: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { can } = useSession();
  const { customerLabel, userName, vehicleLabel } = useReferences();

  const detail = useApiQuery(() => checkInsApi.get(id ?? ""), [id], { enabled: id !== null });
  const setStatus = useApiMutation((status: string) => checkInsApi.setStatus(id ?? "", status));

  const record = id ? detail.data : null;
  const allowed = record ? (CHECKIN_TRANSITIONS[record.status] ?? []) : [];

  return (
    <Modal
      open={id !== null}
      onClose={onClose}
      title="Check-in"
      width="max-w-2xl"
      description={
        record ? `${vehicleLabel(record.vehicle_id)} · ${formatDateTime(record.created_at)}` : undefined
      }
    >
      {detail.loading && detail.initial ? (
        <Loading />
      ) : detail.error ? (
        <ErrorState error={detail.error} onRetry={detail.refetch} />
      ) : !record ? (
        <EmptyState title="Not found" />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={record.status} />
            <span className="text-xs text-ink-500">{titleCase(record.checkin_type)}</span>
          </div>

          <KeyValueGrid>
            <KeyValue label="Customer">{customerLabel(record.customer_id)}</KeyValue>
            <KeyValue label="Vehicle">{vehicleLabel(record.vehicle_id)}</KeyValue>
            <KeyValue label="Odometer">{formatNumber(record.odometer)} mi</KeyValue>
            <KeyValue label="Promised by">{formatDateTime(record.expected_completion)}</KeyValue>
            <KeyValue label="Tyres">{record.tire_condition ?? "—"}</KeyValue>
            <KeyValue label="Fluids">{record.fluid_levels ?? "—"}</KeyValue>
            <KeyValue label="Lights">{record.lights_status ?? "—"}</KeyValue>
            <KeyValue label="Advisor">
              {record.service_advisor_id ? userName(record.service_advisor_id) : "—"}
            </KeyValue>
          </KeyValueGrid>

          {record.notes ? (
            <div>
              <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Notes</p>
              <p className="mt-0.5 text-sm whitespace-pre-line text-ink-700">{record.notes}</p>
            </div>
          ) : null}

          {can("check_ins:write") ? (
            <div className="rounded-lg bg-ink-50 p-3">
              <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Move it along</p>
              {allowed.length === 0 ? (
                <Notice tone="info">
                  {record.status} is final. The API refuses any further change of status.
                </Notice>
              ) : (
                <>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {allowed.map((option) => (
                      <Button
                        key={option}
                        size="sm"
                        variant={option === "CANCELLED" ? "danger" : "primary"}
                        pending={setStatus.pending}
                        onClick={() =>
                          setStatus.run(option).then((saved) => {
                            if (saved) {
                              detail.refetch();
                              onChanged();
                            }
                          })
                        }
                      >
                        {titleCase(option)}
                      </Button>
                    ))}
                  </div>
                  {setStatus.error ? (
                    <div className="mt-2">
                      <Notice tone="danger">{setStatus.error.messageForUser}</Notice>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}