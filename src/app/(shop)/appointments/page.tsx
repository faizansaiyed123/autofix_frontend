"use client";

import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, KeyValue, KeyValueGrid } from "@/components/ui/Card";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Field, FormError, Input, Select, Textarea, useForm } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader, Toolbar } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { useReferences } from "@/components/layout/ReferenceProvider";
import { appointmentsApi } from "@/lib/api/shop";
import type { Appointment } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { APPOINTMENT_STATUSES } from "@/lib/status";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatTime,
  titleCase,
  toApiDateTime,
  todayIso,
} from "@/lib/format";

type CalendarView = "day" | "week" | "month";
const CALENDAR_VIEWS: CalendarView[] = ["day", "week", "month"];

/**
 * `ServiceType` is fixed by the backend's enum, not by the shared status
 * vocabulary, so it is listed here. A free-text box would be a 422 waiting to
 * happen: the schema rejects anything outside this set.
 */
const SERVICE_TYPES = [
  "OIL_CHANGE",
  "BRAKE_SERVICE",
  "TIRE_SERVICE",
  "DIAGNOSTIC",
  "SCHEDULED_MAINTENANCE",
  "INSPECTION",
  "REPAIR",
  "OTHER",
];

const DURATIONS = [
  ["30", "30 minutes"],
  ["60", "1 hour"],
  ["90", "1.5 hours"],
  ["120", "2 hours"],
  ["180", "Half a day"],
  ["240", "Full day"],
] as const;

/**
 * Where an appointment may go next.
 *
 * The API refuses any transition not in this table and refuses everything at
 * all from COMPLETED, CANCELLED or NO_SHOW, so the control offers only what the
 * server will accept rather than letting a person find out from a 422.
 */
const APPOINTMENT_TRANSITIONS: Record<string, string[]> = {
  REQUESTED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["IN_SERVICE", "CANCELLED"],
  IN_SERVICE: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export default function AppointmentsPage() {
  const { can } = useSession();
  const { customerLabel, userName, vehicleLabel } = useReferences();

  const [mode, setMode] = useState<"calendar" | "list">("calendar");
  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState(todayIso());
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [status, setStatus] = useState("");
  const [fromToday, setFromToday] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  const calendar = useApiQuery(
    () =>
      appointmentsApi.calendar({
        view,
        anchor,
        include_cancelled: includeCancelled,
      }),
    [view, anchor, includeCancelled],
  );

  const list = useApiQuery(
    () =>
      appointmentsApi.list({
        page,
        size: 25,
        status: status || undefined,
        // The endpoint orders by start time from the beginning of time, so a
        // diary view has to say where its window opens or page one is 2019.
        start_from: fromToday ? toApiDateTime(new Date(`${todayIso()}T00:00:00`)) : undefined,
      }),
    [page, status, fromToday],
    { enabled: mode === "list" },
  );

  function refreshAll() {
    calendar.refetch();
    list.refetch();
  }

  const listColumns: Column<Appointment>[] = [
    {
      key: "when",
      header: "When",
      render: (a) => (
        <div className="whitespace-nowrap">
          <p className="font-medium text-ink-800">{formatDate(a.scheduled_start)}</p>
          <p className="text-xs text-ink-500">
            {formatTime(a.scheduled_start)}–{formatTime(a.scheduled_end)}
          </p>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (a) => <span className="text-sm text-ink-700">{customerLabel(a.customer_id)}</span>,
    },
    {
      key: "vehicle",
      header: "Vehicle",
      render: (a) => <span className="text-sm text-ink-700">{vehicleLabel(a.vehicle_id)}</span>,
    },
    { key: "service", header: "Work", render: (a) => titleCase(a.service_type) },
    { key: "bay", header: "Bay", render: (a) => a.bay ?? <span className="text-ink-400">—</span> },
    {
      key: "technician",
      header: "Technician",
      render: (a) => (a.technician_id ? userName(a.technician_id) : <span className="text-ink-400">—</span>),
    },
    { key: "status", header: "Status", render: (a) => <StatusBadge status={a.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Diary"
        subtitle={calendar.data ? `${formatNumber(calendar.data.total)} booked in view` : undefined}
        actions={
          <>
            <div className="flex rounded-lg bg-ink-100 p-0.5">
              {(["calendar", "list"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMode(option)}
                  aria-pressed={mode === option}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${
                    mode === option ? "bg-white text-ink-900 shadow-sm" : "text-ink-600"
                  }`}
                >
                  {option === "calendar" ? "Calendar" : "List"}
                </button>
              ))}
            </div>
            {can("appointments:write") ? (
              <Button variant="primary" onClick={() => setBooking(true)}>
                New booking
              </Button>
            ) : null}
          </>
        }
      />

      {mode === "calendar" ? (
        <Card padded={false}>
          <Toolbar>
            <Select
              value={view}
              onChange={(event) => setView(event.target.value as CalendarView)}
              className="w-32"
              aria-label="Calendar range"
            >
              {CALENDAR_VIEWS.map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </Select>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setAnchor(shiftAnchor(anchor, view, -1))}>
                Previous
              </Button>
              <Button size="sm" onClick={() => setAnchor(todayIso())}>
                Today
              </Button>
              <Button size="sm" onClick={() => setAnchor(shiftAnchor(anchor, view, 1))}>
                Next
              </Button>
            </div>
            <label className="flex items-center gap-2 text-xs text-ink-600">
              <input
                type="checkbox"
                checked={includeCancelled}
                onChange={(event) => setIncludeCancelled(event.target.checked)}
                className="size-3.5 rounded border-ink-300"
              />
              Show cancelled
            </label>
            {calendar.data ? (
              <p className="ml-auto text-xs text-ink-500">
                {formatDate(calendar.data.range_start)} – {formatDate(calendar.data.range_end)}
              </p>
            ) : null}
          </Toolbar>

          {calendar.loading && calendar.initial ? (
            <Loading label="Loading the diary…" />
          ) : calendar.error ? (
            <div className="p-4">
              <ErrorState error={calendar.error} onRetry={calendar.refetch} />
            </div>
          ) : !calendar.data || calendar.data.days.length === 0 ? (
            <EmptyState
              title="Nothing in this range"
              description="Step forward a week, or book the first slot."
            />
          ) : (
            <div className="p-4">
              <div
                className={
                  view === "day"
                    ? "grid gap-3"
                    : "grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
                }
              >
                {calendar.data.days.map((day) => (
                  <DayColumn
                    key={day.date}
                    date={day.date}
                    appointments={day.appointments}
                    vehicleLabel={vehicleLabel}
                    onOpen={setSelectedId}
                  />
                ))}
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card padded={false}>
          <Toolbar>
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="w-48"
              aria-label="Filter by status"
            >
              <option value="">Any status</option>
              {APPOINTMENT_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-2 text-xs text-ink-600">
              <input
                type="checkbox"
                checked={fromToday}
                onChange={(event) => {
                  setFromToday(event.target.checked);
                  setPage(1);
                }}
                className="size-3.5 rounded border-ink-300"
              />
              From today
            </label>
          </Toolbar>

          {list.loading && list.initial ? (
            <Loading />
          ) : list.error ? (
            <div className="p-4">
              <ErrorState error={list.error} onRetry={list.refetch} />
            </div>
          ) : !list.data || list.data.data.length === 0 ? (
            <EmptyState
              title="No appointments match"
              description="Cancellations are hidden unless the status filter asks for them."
            />
          ) : (
            <>
              <DataTable
                rows={list.data.data}
                columns={listColumns}
                rowKey={(a) => a.id}
                onRowClick={(a) => setSelectedId(a.id)}
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
      )}

      <AppointmentDetailModal
        id={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={refreshAll}
      />

      <NewAppointmentModal
        open={booking}
        onClose={() => setBooking(false)}
        onBooked={() => {
          setBooking(false);
          setPage(1);
          refreshAll();
        }}
      />
    </>
  );
}

function DayColumn({
  date,
  appointments,
  vehicleLabel,
  onOpen,
}: {
  date: string;
  appointments: Appointment[];
  vehicleLabel: (id: string | null | undefined) => string;
  onOpen: (id: string) => void;
}) {
  const isToday = date === todayIso();

  return (
    <section
      className={`min-w-0 rounded-lg border p-2 ${
        isToday ? "border-brand-300 bg-brand-50/50" : "border-ink-200 bg-white"
      }`}
    >
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold text-ink-700">{formatDate(date)}</h2>
        {appointments.length > 0 ? (
          <span className="tabular text-xs text-ink-500">{appointments.length}</span>
        ) : null}
      </header>
      {appointments.length === 0 ? (
        <p className="px-1 pb-1 text-xs text-ink-400">Free</p>
      ) : (
        <ul className="space-y-1.5">
          {appointments.map((appointment) => (
            <li key={appointment.id}>
              <button
                type="button"
                onClick={() => onOpen(appointment.id)}
                className="w-full rounded-md bg-ink-50 px-2 py-1.5 text-left ring-1 ring-ink-200 hover:bg-brand-50"
              >
                <span className="tabular block text-xs font-semibold text-ink-900">
                  {formatTime(appointment.scheduled_start)}
                </span>
                <span className="block truncate text-xs text-ink-700">
                  {titleCase(appointment.service_type)}
                </span>
                <span className="block truncate text-[11px] text-ink-500">
                  {vehicleLabel(appointment.vehicle_id)}
                </span>
                <span className="mt-1 flex items-center gap-1">
                  {appointment.bay ? (
                    <span className="text-[11px] text-ink-500">{appointment.bay}</span>
                  ) : null}
                  <StatusBadge status={appointment.status} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AppointmentDetailModal({
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

  const detail = useApiQuery(() => appointmentsApi.get(id ?? ""), [id], { enabled: id !== null });
  const setStatus = useApiMutation((status: string, reason: string | null) =>
    appointmentsApi.setStatus(id ?? "", status, reason),
  );

  const record = id ? detail.data : null;
  const allowed = record ? (APPOINTMENT_TRANSITIONS[record.status] ?? []) : [];

  async function changeStatus(next: string, reason: string | null) {
    const changed = await setStatus.run(next, reason);
    if (changed) {
      detail.refetch();
      onChanged();
    }
  }

  return (
    <Modal
      open={id !== null}
      onClose={onClose}
      title={record ? titleCase(record.service_type) : "Appointment"}
      description={record ? formatDateTime(record.scheduled_start) : undefined}
      width="max-w-2xl"
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
            {record.status === "CANCELLED" && record.cancellation_reason ? (
              <span className="text-xs text-ink-600">
                Cancelled: {record.cancellation_reason}
              </span>
            ) : null}
          </div>

          <KeyValueGrid>
            <KeyValue label="Customer">{customerLabel(record.customer_id)}</KeyValue>
            <KeyValue label="Vehicle">{vehicleLabel(record.vehicle_id)}</KeyValue>
            <KeyValue label="Starts">{formatDateTime(record.scheduled_start)}</KeyValue>
            <KeyValue label="Ends">{formatDateTime(record.scheduled_end)}</KeyValue>
            <KeyValue label="Duration">{formatNumber(record.duration_minutes)} min</KeyValue>
            <KeyValue label="Bay">{record.bay ?? "—"}</KeyValue>
            <KeyValue label="Technician">
              {record.technician_id ? userName(record.technician_id) : "—"}
            </KeyValue>
            <KeyValue label="Advisor">
              {record.advisor_id ? userName(record.advisor_id) : "—"}
            </KeyValue>
            <KeyValue label="From a request">
              {record.service_request_id ? "Yes" : "No"}
            </KeyValue>
          </KeyValueGrid>

          {record.customer_concern ? (
            <div>
              <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">
                Customer concern
              </p>
              <p className="mt-0.5 text-sm whitespace-pre-line text-ink-700">
                {record.customer_concern}
              </p>
            </div>
          ) : null}
          {record.notes ? (
            <div>
              <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Notes</p>
              <p className="mt-0.5 text-sm whitespace-pre-line text-ink-700">{record.notes}</p>
            </div>
          ) : null}

          {can("appointments:write") ? (
            <StatusControl
              key={record.id}
              current={record.status}
              allowed={allowed}
              pending={setStatus.pending}
              error={setStatus.error}
              onChange={changeStatus}
            />
          ) : null}
        </div>
      )}
    </Modal>
  );
}

function StatusControl({
  current,
  allowed,
  pending,
  error,
  onChange,
}: {
  current: string;
  allowed: string[];
  pending: boolean;
  error: { messageForUser: string } | null;
  onChange: (next: string, reason: string | null) => void;
}) {
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const needsReason = target === "CANCELLED";
  const canSubmit = target !== "" && (!needsReason || reason.trim() !== "");

  function reset() {
    setTarget("");
    setReason("");
  }

  return (
    <div className="rounded-lg bg-ink-50 p-3">
      <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Move this booking on</p>

      {allowed.length === 0 ? (
        <Notice tone="info">
          {current} is a final state. The API refuses any further transition, so there is nothing to
          move it to.
        </Notice>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            {APPOINTMENT_STATUSES.map((option) => {
              const reachable = allowed.includes(option);
              const isTarget = target === option;
              return (
                <Button
                  key={option}
                  size="sm"
                  variant={isTarget ? "primary" : "secondary"}
                  disabled={!reachable || pending}
                  title={
                    reachable
                      ? undefined
                      : `Not allowed from ${current} — the API only permits ${allowed.join(", ")}`
                  }
                  onClick={() => {
                    if (isTarget) reset();
                    else setTarget(option);
                  }}
                >
                  {titleCase(option)}
                </Button>
              );
            })}
          </div>

          {needsReason ? (
            <div className="mt-3">
              <Field
                label="Why is it being cancelled"
                required
                hint="A cancellation with no reason is a hole in the diary six weeks from now."
              >
                <Textarea
                  rows={2}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={1000}
                />
              </Field>
            </div>
          ) : null}

          {error ? <Notice tone="danger">{error.messageForUser}</Notice> : null}

          <div className="mt-3 flex justify-end gap-2">
            {target ? (
              <Button size="sm" onClick={reset} disabled={pending}>
                Clear
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="primary"
              pending={pending}
              disabled={!canSubmit}
              onClick={() => {
                onChange(target, needsReason ? reason.trim() : null);
                reset();
              }}
            >
              Apply
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function NewAppointmentModal({
  open,
  onClose,
  onBooked,
}: {
  open: boolean;
  onClose: () => void;
  onBooked: () => void;
}) {
  const { customers, staff, vehiclesFor } = useReferences();
  const form = useForm({
    customer_id: "",
    vehicle_id: "",
    service_type: "SCHEDULED_MAINTENANCE",
    scheduled_start: "",
    duration_minutes: "60",
    bay: "",
    technician_id: "",
    customer_concern: "",
    notes: "",
  });

  const create = useApiMutation((body: Record<string, unknown>) => appointmentsApi.create(body));
  const check = useApiMutation((body: ConflictCheckRequestBody) =>
    appointmentsApi.checkConflicts(body),
  );

  const vehicles = vehiclesFor(form.values.customer_id);
  const duration = Number(form.values.duration_minutes);

  // A result left over from a previous booking would block the button before
  // anything had been checked for this one.
  const { reset: resetConflictCheck } = check;
  useEffect(() => {
    if (open) resetConflictCheck();
  }, [open, resetConflictCheck]);

  // Conflicts are checked as soon as the slot is meaningful, so a clash is
  // visible before the booking is attempted rather than after a rejection.
  useEffect(() => {
    if (!open || !form.values.scheduled_start || !form.values.customer_id) return;
    if (!Number.isFinite(duration) || duration < 5 || duration > 1440) return;
    void check.run({
      scheduled_start: toApiDateTime(new Date(form.values.scheduled_start)),
      duration_minutes: duration,
      technician_id: form.values.technician_id || null,
      bay: form.values.bay || null,
      vehicle_id: form.values.vehicle_id || null,
    });
    // `check.run` is stable, so the slot fields are the whole dependency set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    form.values.scheduled_start,
    form.values.customer_id,
    form.values.vehicle_id,
    form.values.technician_id,
    form.values.bay,
    duration,
  ]);

  const conflicts = check.result;
  const blocked = Boolean(conflicts?.has_conflict);

  async function submit() {
    const missing = form.missing(["customer_id", "vehicle_id", "scheduled_start"]);
    if (missing.length > 0) return;
    const booked = await create.run({
      customer_id: form.values.customer_id,
      vehicle_id: form.values.vehicle_id,
      service_type: form.values.service_type,
      scheduled_start: toApiDateTime(new Date(form.values.scheduled_start)),
      duration_minutes: duration,
      technician_id: form.values.technician_id || null,
      bay: form.values.bay || null,
      customer_concern: form.values.customer_concern || null,
      notes: form.values.notes || null,
    });
    if (booked) {
      form.reset();
      onBooked();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New booking"
      description="Bookings start as REQUESTED — confirm it once the customer agrees."
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose} disabled={create.pending}>
            Cancel
          </Button>
          <Button variant="primary" pending={create.pending} disabled={blocked} onClick={() => void submit()}>
            Book it
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

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Customer" required>
            <Select
              value={form.values.customer_id}
              onChange={(event) => {
                form.set("customer_id", event.target.value);
                // The API refuses a vehicle that is not this customer's, so the
                // vehicle list is rebuilt from the chosen owner.
                form.set("vehicle_id", "");
              }}
            >
              <option value="">Choose a customer…</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.first_name} {customer.last_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Vehicle"
            required
            hint={
              form.values.customer_id
                ? vehicles.length > 0
                  ? undefined
                  : "This customer has no vehicles on file"
                : "Choose the customer first"
            }
          >
            <Select
              value={form.values.vehicle_id}
              disabled={!form.values.customer_id || vehicles.length === 0}
              onChange={(event) => form.set("vehicle_id", event.target.value)}
            >
              <option value="">Choose a vehicle…</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}
                  {vehicle.license_plate ? ` (${vehicle.license_plate})` : ""}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Starts" required>
            <Input
              type="datetime-local"
              value={form.values.scheduled_start}
              onChange={(event) => form.set("scheduled_start", event.target.value)}
            />
          </Field>
          <Field label="How long">
            <Select
              value={form.values.duration_minutes}
              onChange={(event) => form.set("duration_minutes", event.target.value)}
            >
              {DURATIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Work">
            <Select
              value={form.values.service_type}
              onChange={(event) => form.set("service_type", event.target.value)}
            >
              {SERVICE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {titleCase(type)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Bay" hint="Optional, 30 characters">
            <Input
              value={form.values.bay}
              maxLength={30}
              onChange={(event) => form.set("bay", event.target.value)}
            />
          </Field>
          <Field label="Technician" hint="Optional">
            <Select
              value={form.values.technician_id}
              onChange={(event) => form.set("technician_id", event.target.value)}
            >
              <option value="">Unassigned</option>
              {staff.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.first_name} {person.last_name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {check.pending ? (
          <p className="text-xs text-ink-500">Checking the slot…</p>
        ) : blocked && conflicts ? (
          <Notice tone="danger">
            <p className="font-medium">That slot is already taken.</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {conflicts.conflicts.map((conflict) => (
                <li key={conflict.appointment_id}>
                  {conflict.reason} — {formatTime(conflict.scheduled_start)} to{" "}
                  {formatTime(conflict.scheduled_end)}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs">
              Pick another time, or leave the bay and technician blank to book alongside existing
              work.
            </p>
          </Notice>
        ) : conflicts && !conflicts.has_conflict ? (
          <Notice tone="success">The slot is free.</Notice>
        ) : null}

        <Field label="What the customer said" hint="Up to 2000 characters">
          <Textarea
            rows={2}
            maxLength={2000}
            value={form.values.customer_concern}
            onChange={(event) => form.set("customer_concern", event.target.value)}
          />
        </Field>
        <Field label="Notes" hint="Up to 2000 characters">
          <Textarea
            rows={2}
            maxLength={2000}
            value={form.values.notes}
            onChange={(event) => form.set("notes", event.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}

type ConflictCheckRequestBody = {
  scheduled_start: string;
  duration_minutes: number;
  technician_id: string | null;
  bay: string | null;
  vehicle_id: string | null;
};

function shiftAnchor(anchor: string, view: CalendarView, direction: 1 | -1): string {
  const date = new Date(`${anchor}T00:00:00`);
  if (view === "month") {
    // Stepping from the 31st would overshoot into the following month, so the
    // day is pinned to the 1st before the month is moved.
    date.setDate(1);
    date.setMonth(date.getMonth() + direction);
  } else {
    date.setDate(date.getDate() + (view === "week" ? 7 : 1) * direction);
  }
  return toApiDateTime(date).slice(0, 10);
}