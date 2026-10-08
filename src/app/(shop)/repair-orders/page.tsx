"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader, Toolbar } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { useReferences } from "@/components/layout/ReferenceProvider";
import { appointmentsApi } from "@/lib/api/shop";
import { estimatesApi, repairOrdersApi } from "@/lib/api/work";
import type { RepairOrder, RepairTask } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { REPAIR_ORDER_STATUSES } from "@/lib/status";
import { formatDateTime, formatNumber } from "@/lib/format";

/**
 * The floor board: every job the shop has been authorised to do.
 *
 * A repair order carries no money at all — the estimate it came from stays the
 * single source of truth for pricing — so what this list has to show instead is
 * progress. The task count comes from the tasks the API returned with the row,
 * because a list screen that fired a second request per row to learn how far
 * along each job was would be a list screen that stops working at twenty rows.
 */
export default function RepairOrdersPage() {
  const { can } = useSession();
  const router = useRouter();
  const { customerLabel, vehicleLabel, userName, staff } = useReferences();
  const [status, setStatus] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [advisorId, setAdvisorId] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const query = useApiQuery(
    () =>
      repairOrdersApi.list({
        page,
        size: 25,
        status: status || undefined,
        technician_id: technicianId || undefined,
        advisor_id: advisorId || undefined,
      }),
    [page, status, technicianId, advisorId],
  );

  const columns: Column<RepairOrder>[] = [
    {
      key: "number",
      header: "RO",
      render: (ro) => (
        <Link href={`/repair-orders/${ro.id}`} className="font-medium text-brand-700 hover:underline">
          {ro.ro_number}
        </Link>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (ro) => <span className="text-sm">{customerLabel(ro.customer_id)}</span>,
    },
    {
      key: "vehicle",
      header: "Vehicle",
      render: (ro) => <span className="text-sm">{vehicleLabel(ro.vehicle_id)}</span>,
    },
    {
      key: "technician",
      header: "Technician",
      render: (ro) => <span className="text-sm">{ro.technician_id ? userName(ro.technician_id) : "—"}</span>,
    },
    { key: "bay", header: "Bay", render: (ro) => <span className="text-sm">{ro.bay ?? "—"}</span> },
    {
      key: "status",
      header: "Status",
      render: (ro) => <StatusBadge status={ro.status} />,
    },
    {
      key: "tasks",
      header: "Tasks",
      numeric: true,
      render: (ro) => <TaskProgress tasks={ro.tasks} />,
    },
    {
      key: "promised",
      header: "Promised",
      numeric: true,
      render: (ro) => <span className="text-xs text-ink-600">{formatDateTime(ro.promised_at)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Repair orders"
        subtitle={query.data ? `${query.data.meta.total} on the floor` : undefined}
        actions={
          can("repair_orders:write") ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              New repair order
            </Button>
          ) : null
        }
      />

      <Card padded={false}>
        <Toolbar>
          <label className="block">
            <span className="sr-only">Status</span>
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="w-44"
            >
              <option value="">Any status</option>
              {REPAIR_ORDER_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </label>
          <StaffFilter
            label="Any technician"
            staff={staff}
            value={technicianId}
            onChange={(value) => {
              setTechnicianId(value);
              setPage(1);
            }}
          />
          <StaffFilter
            label="Any advisor"
            staff={staff}
            value={advisorId}
            onChange={(value) => {
              setAdvisorId(value);
              setPage(1);
            }}
          />
        </Toolbar>

        {query.loading && query.initial ? (
          <Loading label="Reading the floor…" />
        ) : query.error ? (
          <div className="p-4">
            <ErrorState error={query.error} onRetry={query.refetch} />
          </div>
        ) : !query.data || query.data.data.length === 0 ? (
          <EmptyState
            title="No repair orders match"
            description="A repair order is the shop's authorisation to work, raised against an estimate the customer has approved."
          />
        ) : (
          <>
            <DataTable rows={query.data.data} columns={columns} rowKey={(ro) => ro.id} />
            <Pagination
              page={query.data.meta.page}
              pages={query.data.meta.pages}
              total={query.data.meta.total}
              onPage={setPage}
            />
          </>
        )}
      </Card>

      <NewRepairOrderModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          query.refetch();
          router.push(`/repair-orders/${id}`);
        }}
      />
    </>
  );
}

/** Done is COMPLETED or SKIPPED — a skipped task is finished, not outstanding. */
function TaskProgress({ tasks }: { tasks: RepairTask[] }) {
  const total = tasks.length;
  const done = tasks.filter((task) => task.status === "COMPLETED" || task.status === "SKIPPED").length;
  if (total === 0) return <span className="text-xs text-ink-400">No tasks</span>;
  const percent = Math.round((done / total) * 100);
  return (
    <span className="block">
      <span className="tabular text-xs">
        {done} of {total} done
      </span>
      <span className="mt-1 block h-1 w-20 overflow-hidden rounded-full bg-ink-200">
        <span className="block h-full bg-brand-500" style={{ width: `${percent}%` }} />
      </span>
    </span>
  );
}

function StaffFilter({
  label,
  staff,
  value,
  onChange,
}: {
  label: string;
  staff: { id: string; first_name: string; last_name: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <Select value={value} onChange={(event) => onChange(event.target.value)} className="w-48">
        <option value="">{label}</option>
        {staff.map((person) => (
          <option key={person.id} value={person.id}>
            {person.first_name} {person.last_name}
          </option>
        ))}
      </Select>
    </label>
  );
}

/* ------------------------------------------------------------- new RO -- */

interface TaskDraft {
  key: string;
  description: string;
  notes: string;
  assigned_to_id: string;
}

let taskCounter = 0;

function blankTask(): TaskDraft {
  taskCounter += 1;
  return { key: `task-${taskCounter}`, description: "", notes: "", assigned_to_id: "" };
}

function NewRepairOrderModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { customers, vehiclesFor, vehicleLabel, staff } = useReferences();
  const [customerId, setCustomerId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [estimateId, setEstimateId] = useState("");
  const [appointmentId, setAppointmentId] = useState("");
  const [advisorId, setAdvisorId] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [bay, setBay] = useState("");
  const [odometerIn, setOdometerIn] = useState("");
  const [odometerOut, setOdometerOut] = useState("");
  const [promisedAt, setPromisedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [tasks, setTasks] = useState<TaskDraft[]>([]);
  const [problems, setProblems] = useState<string[]>([]);

  // Only estimates the backend will accept are offered: it refuses anything that
  // is not APPROVED or PARTIALLY_APPROVED, or that is for another vehicle.
  const estimates = useApiQuery(
    () => estimatesApi.list({ vehicle_id: vehicleId, size: 100 }).then((page) => page.data),
    [vehicleId],
    { enabled: Boolean(vehicleId) && open },
  );

  const appointments = useApiQuery(
    () => appointmentsApi.list({ customer_id: customerId, size: 50 }).then((page) => page.data),
    [customerId],
    { enabled: Boolean(customerId) && open },
  );

  const create = useApiMutation((body: Parameters<typeof repairOrdersApi.create>[0]) =>
    repairOrdersApi.create(body),
  );

  const vehicles = customerId ? vehiclesFor(customerId) : [];
  const usableEstimates = (estimates.data ?? []).filter(
    (estimate) => estimate.status === "APPROVED" || estimate.status === "PARTIALLY_APPROVED",
  );

  function reset() {
    setCustomerId("");
    setVehicleId("");
    setEstimateId("");
    setAppointmentId("");
    setAdvisorId("");
    setTechnicianId("");
    setBay("");
    setOdometerIn("");
    setOdometerOut("");
    setPromisedAt("");
    setNotes("");
    setCustomerNotes("");
    setTasks([]);
  }

  async function submit() {
    const found: string[] = [];
    if (!customerId) found.push("Choose a customer");
    if (!vehicleId) found.push("Choose the vehicle");
    if (tasks.some((task) => !task.description.trim())) found.push("Every task needs a description");
    setProblems(found);
    if (found.length > 0) return;

    const created = await create.run({
      customer_id: customerId,
      vehicle_id: vehicleId,
      estimate_id: estimateId || null,
      appointment_id: appointmentId || null,
      advisor_id: advisorId || null,
      technician_id: technicianId || null,
      bay: bay.trim() || null,
      odometer_in: odometerIn ? Number(odometerIn) : null,
      odometer_out: odometerOut ? Number(odometerOut) : null,
      promised_at: promisedAt || null,
      notes: notes.trim() || null,
      customer_notes: customerNotes.trim() || null,
      tasks: tasks
        .filter((task) => task.description.trim())
        .map((task) => ({
          description: task.description.trim(),
          notes: task.notes.trim() || null,
          assigned_to_id: task.assigned_to_id || null,
        })),
    });
    if (created) {
      reset();
      onCreated(created.id);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New repair order"
      description="The shop's authorisation to work. Money stays on the estimate."
      width="max-w-3xl"
      footer={
        <>
          <Button onClick={onClose} disabled={create.pending}>
            Cancel
          </Button>
          <Button variant="primary" pending={create.pending} onClick={() => void submit()}>
            Create repair order
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="space-y-4"
      >
        <FormError error={create.error} />
        {problems.length > 0 ? (
          <Notice tone="danger">
            <ul className="list-disc space-y-0.5 pl-4">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </Notice>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Customer" required>
            <Select
              value={customerId}
              onChange={(event) => {
                setCustomerId(event.target.value);
                setVehicleId("");
                setEstimateId("");
                setAppointmentId("");
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
          <Field label="Vehicle" required hint={customerId ? undefined : "Pick a customer first."}>
            <Select
              value={vehicleId}
              disabled={!customerId}
              onChange={(event) => {
                setVehicleId(event.target.value);
                setEstimateId("");
              }}
            >
              <option value="">Choose a vehicle</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicleLabel(vehicle.id)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Estimate"
            hint={
              vehicleId
                ? "Only approved estimates for this vehicle can carry an order"
                : "Pick a vehicle to see its approved estimates"
            }
          >
            <Select value={estimateId} onChange={(event) => setEstimateId(event.target.value)} disabled={!vehicleId}>
              <option value="">None</option>
              {usableEstimates.map((estimate) => (
                <option key={estimate.id} value={estimate.id}>
                  {estimate.estimate_number} — {estimate.status}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Appointment" hint="Optional — the booking this job came from">
            <Select
              value={appointmentId}
              onChange={(event) => setAppointmentId(event.target.value)}
              disabled={!customerId}
            >
              <option value="">None</option>
              {(appointments.data ?? []).map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  {formatDateTime(appointment.scheduled_start)} — {appointment.service_type}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Advisor">
            <Select value={advisorId} onChange={(event) => setAdvisorId(event.target.value)}>
              <option value="">Unassigned</option>
              {staff.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.first_name} {person.last_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Technician">
            <Select value={technicianId} onChange={(event) => setTechnicianId(event.target.value)}>
              <option value="">Unassigned</option>
              {staff.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.first_name} {person.last_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Bay">
            <Input value={bay} onChange={(event) => setBay(event.target.value)} />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Odometer in">
            <Input
              type="number"
              min="0"
              value={odometerIn}
              onChange={(event) => setOdometerIn(event.target.value)}
            />
          </Field>
          <Field label="Odometer out">
            <Input
              type="number"
              min="0"
              value={odometerOut}
              onChange={(event) => setOdometerOut(event.target.value)}
            />
          </Field>
          <Field label="Promised at">
            <Input
              type="datetime-local"
              value={promisedAt}
              onChange={(event) => setPromisedAt(event.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Internal notes">
            <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
          <Field label="Customer notes" hint="What the customer sees on their paperwork">
            <Textarea
              rows={2}
              value={customerNotes}
              onChange={(event) => setCustomerNotes(event.target.value)}
            />
          </Field>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-ink-600 uppercase">Tasks</p>
          <p className="text-xs text-ink-500">
            Leave this empty and an approved estimate generates the breakdown from its approved lines.
            The breakdown cannot be changed once work starts.
          </p>
          {tasks.map((task, index) => (
            <div key={task.key} className="rounded-lg border border-ink-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-ink-700">Task {index + 1}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setTasks(tasks.filter((t) => t.key !== task.key))}
                >
                  Remove
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Description" required>
                  <Input
                    value={task.description}
                    onChange={(event) =>
                      setTasks(
                        tasks.map((t) =>
                          t.key === task.key ? { ...t, description: event.target.value } : t,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Assigned to">
                  <Select
                    value={task.assigned_to_id}
                    onChange={(event) =>
                      setTasks(
                        tasks.map((t) =>
                          t.key === task.key ? { ...t, assigned_to_id: event.target.value } : t,
                        ),
                      )
                    }
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
              <Field label="Notes" className="mt-3">
                <Textarea
                  rows={2}
                  value={task.notes}
                  onChange={(event) =>
                    setTasks(
                      tasks.map((t) => (t.key === task.key ? { ...t, notes: event.target.value } : t)),
                    )
                  }
                />
              </Field>
            </div>
          ))}
          <Button onClick={() => setTasks([...tasks, blankTask()])}>Add task</Button>
        </div>

        <Notice tone="info">
          {tasks.length === 0 && estimateId
            ? "The tasks will be generated from this estimate's approved lines."
            : "An order with no tasks cannot be started, and cannot be completed."}
          {" Open tasks: "}
          {formatNumber(tasks.length)}.
        </Notice>
      </form>
    </Modal>
  );
}