"use client";

import { useRouter } from "next/navigation";
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
import { appointmentsApi, serviceRequestsApi } from "@/lib/api/shop";
import type { ServiceRequest, ServiceRequestCreate } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { formatRelative, titleCase, toApiDateTime } from "@/lib/format";

/**
 * The statuses `ServiceRequestStatus` actually holds.
 *
 * The shared `SERVICE_REQUEST_STATUSES` array describes a longer workflow the API
 * does not have — six of its eight values would be refused. These are the API's
 * own values, and the transition map underneath is the rule it enforces, which
 * also makes the terminal states visible.
 */
const REQUEST_STATUSES = ["NEW", "IN_REVIEW", "APPROVED", "REJECTED", "CONVERTED"];

const REQUEST_TRANSITIONS: Record<string, string[]> = {
  NEW: ["IN_REVIEW", "REJECTED"],
  IN_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["CONVERTED", "REJECTED"],
  REJECTED: [],
  CONVERTED: [],
};

/**
 * `ServiceRequestPriority`. The shared `PRIORITIES` array disagrees — it says
 * MEDIUM and URGENT where the API says STANDARD and EMERGENCY — and the API
 * stores whatever it is given, so writing the wrong spelling would create a
 * priority it will never itself produce.
 */
const REQUEST_PRIORITIES = ["LOW", "STANDARD", "HIGH", "EMERGENCY"];

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
 * The queue of what customers have asked for.
 *
 * A request is not work — it is a conversation that ends in a decision, and the
 * API only lets the shop schedule one that has been approved. So the row leads
 * with what the customer wants rather than with who raised it: the person reading
 * this screen is deciding what to say next.
 */
export default function ServiceRequestsPage() {
  const { can } = useSession();
  const router = useRouter();
  const { customerLabel, vehicleLabel } = useReferences();
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useApiQuery(
    () =>
      serviceRequestsApi.list({
        page,
        size: 25,
        status: status || undefined,
        priority: priority || undefined,
      }),
    [page, status, priority],
  );

  const columns: Column<ServiceRequest>[] = [
    {
      key: "title",
      header: "Asked for",
      render: (r) => (
        <div className="min-w-0">
          <p className="font-medium text-ink-800">{r.title}</p>
          {r.description ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{r.description}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (r) => <span className="text-sm text-ink-700">{customerLabel(r.customer_id)}</span>,
    },
    {
      key: "vehicle",
      header: "Vehicle",
      render: (r) =>
        r.vehicle_id ? (
          <span className="text-sm text-ink-700">{vehicleLabel(r.vehicle_id)}</span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: "priority",
      header: "Priority",
      render: (r) => <StatusBadge status={r.priority} />,
    },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "received",
      header: "Received",
      numeric: true,
      render: (r) => <span className="text-xs text-ink-500">{formatRelative(r.created_at)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Service requests"
        subtitle={list.data ? `${list.data.meta.total} in the queue` : undefined}
        actions={
          can("service_requests:write") ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              New request
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
            className="w-48"
            aria-label="Filter by status"
          >
            <option value="">Any status</option>
            {REQUEST_STATUSES.map((option) => (
              <option key={option} value={option}>
                {titleCase(option)}
              </option>
            ))}
          </Select>
          <Select
            value={priority}
            onChange={(event) => {
              setPriority(event.target.value);
              setPage(1);
            }}
            className="w-44"
            aria-label="Filter by priority"
          >
            <option value="">Any priority</option>
            {REQUEST_PRIORITIES.map((option) => (
              <option key={option} value={option}>
                {titleCase(option)}
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
            title="Nothing waiting"
            description="Requests raised in the portal, and over the counter, land here."
          />
        ) : (
          <>
            <DataTable
              rows={list.data.data}
              columns={columns}
              rowKey={(r) => r.id}
              onRowClick={(r) => setSelectedId(r.id)}
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

      <RequestDetailModal
        id={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={list.refetch}
        onConverted={() => {
          setSelectedId(null);
          router.push("/appointments");
        }}
      />

      <NewRequestModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          setPage(1);
          list.refetch();
        }}
      />
    </>
  );
}

function RequestDetailModal({
  id,
  onClose,
  onChanged,
  onConverted,
}: {
  id: string | null;
  onClose: () => void;
  onChanged: () => void;
  onConverted: () => void;
}) {
  const { can } = useSession();
  const { customerLabel, vehicleLabel } = useReferences();
  const [converting, setConverting] = useState(false);

  const detail = useApiQuery(() => serviceRequestsApi.get(id ?? ""), [id], { enabled: id !== null });
  const setStatus = useApiMutation((status: string) => serviceRequestsApi.setStatus(id ?? "", status));

  const record = id ? detail.data : null;
  const allowed = record ? (REQUEST_TRANSITIONS[record.status] ?? []) : [];

  return (
    <Modal
      open={id !== null}
      onClose={onClose}
      title={record ? record.title : "Service request"}
      width="max-w-2xl"
      description={record ? `Received ${formatRelative(record.created_at)}` : undefined}
    >
      {detail.loading && detail.initial ? (
        <Loading />
      ) : detail.error ? (
        <ErrorState error={detail.error} onRetry={detail.refetch} />
      ) : !record ? (
        <EmptyState title="Not found" />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={record.priority} />
            <StatusBadge status={record.status} />
          </div>

          <KeyValueGrid>
            <KeyValue label="Customer">{customerLabel(record.customer_id)}</KeyValue>
            <KeyValue label="Vehicle">
              {record.vehicle_id ? vehicleLabel(record.vehicle_id) : "None named"}
            </KeyValue>
          </KeyValueGrid>

          <div>
            <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">
              What they asked for
            </p>
            <p className="mt-0.5 text-sm whitespace-pre-line text-ink-700">
              {record.description ?? "No detail given."}
            </p>
          </div>

          {can("service_requests:write") ? (
            <AdvisorNotes
              request={record}
              onSaved={() => {
                detail.refetch();
                onChanged();
              }}
            />
          ) : record.service_advisor_notes ? (
            <div>
              <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">
                Advisor notes
              </p>
              <p className="mt-0.5 text-sm whitespace-pre-line text-ink-700">
                {record.service_advisor_notes}
              </p>
            </div>
          ) : null}

          {can("service_requests:write") ? (
            <div className="rounded-lg bg-ink-50 p-3">
              <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">
                Where it goes next
              </p>
              {allowed.length === 0 ? (
                <Notice tone="info">
                  {record.status} is final. The API refuses any further change of status.
                </Notice>
              ) : (
                <>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {allowed
                      .filter((option) => option !== "CONVERTED")
                      .map((option) => (
                        <Button
                          key={option}
                          size="sm"
                          variant={option === "REJECTED" ? "danger" : "primary"}
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
                    <Button
                      size="sm"
                      variant="success"
                      disabled={record.status !== "APPROVED"}
                      title={
                        record.status === "APPROVED"
                          ? undefined
                          : "The API only converts an APPROVED request — approve it first"
                      }
                      onClick={() => setConverting(true)}
                    >
                      Convert to appointment
                    </Button>
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

      {record ? (
        <ConvertModal
          open={converting}
          request={record}
          onClose={() => setConverting(false)}
          onConverted={onConverted}
        />
      ) : null}
    </Modal>
  );
}

/**
 * The advisor's own note on a request.
 *
 * It is seeded from the record so clearing the box actually clears the note,
 * which a `value || recordValue` fallback would quietly undo.
 */
function AdvisorNotes({ request, onSaved }: { request: ServiceRequest; onSaved: () => void }) {
  const [value, setValue] = useState(request.service_advisor_notes ?? "");
  const [seededFor, setSeededFor] = useState(request.id);
  const save = useApiMutation((body: { service_advisor_notes: string | null }) =>
    serviceRequestsApi.update(request.id, body),
  );

  // The modal stays mounted between records, so the draft is re-seeded when a
  // different request is opened.
  if (seededFor !== request.id) {
    setSeededFor(request.id);
    setValue(request.service_advisor_notes ?? "");
  }

  const dirty = value !== (request.service_advisor_notes ?? "");

  async function saveNotes() {
    const saved = await save.run({ service_advisor_notes: value || null });
    if (saved) onSaved();
  }

  return (
    <div>
      <Field label="Advisor notes" hint="Internal — never shown to the customer on their portal">
        <Textarea
          rows={3}
          maxLength={2000}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </Field>
      <div className="mt-2 flex justify-end">
        <Button size="sm" pending={save.pending} disabled={!dirty} onClick={() => void saveNotes()}>
          Save notes
        </Button>
      </div>
      {save.error ? (
        <div className="mt-2">
          <Notice tone="danger">{save.error.messageForUser}</Notice>
        </div>
      ) : null}
    </div>
  );
}

function ConvertModal({
  open,
  request,
  onClose,
  onConverted,
}: {
  open: boolean;
  request: ServiceRequest;
  onClose: () => void;
  onConverted: () => void;
}) {
  const { staff, vehiclesFor } = useReferences();
  const form = useForm({
    scheduled_start: "",
    duration_minutes: "60",
    service_type: "SCHEDULED_MAINTENANCE",
    bay: "",
    technician_id: "",
    advisor_id: "",
  });

  // The request inherits its own vehicle; the picker only appears when it named
  // none, because the API requires one either way.
  const owned = vehiclesFor(request.customer_id);
  const [vehicleId, setVehicleId] = useState(request.vehicle_id ?? "");

  const convert = useApiMutation((body: Record<string, unknown>) =>
    appointmentsApi.fromServiceRequest(request.id, body),
  );

  async function submit() {
    if (form.missing(["scheduled_start"]).length > 0) return;
    if (!request.vehicle_id && !vehicleId) return;
    const booked = await convert.run({
      scheduled_start: toApiDateTime(new Date(form.values.scheduled_start)),
      duration_minutes: Number(form.values.duration_minutes) || 60,
      service_type: form.values.service_type,
      bay: form.values.bay || null,
      technician_id: form.values.technician_id || null,
      advisor_id: form.values.advisor_id || null,
      ...(request.vehicle_id ? {} : { vehicle_id: vehicleId }),
    });
    if (booked) {
      form.reset();
      onConverted();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Convert to an appointment"
      description="The request moves to CONVERTED and the booking lands on the diary, confirmed."
      footer={
        <>
          <Button onClick={onClose} disabled={convert.pending}>
            Cancel
          </Button>
          <Button variant="primary" pending={convert.pending} onClick={() => void submit()}>
            Convert
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
        <FormError error={convert.error} />
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

        {!request.vehicle_id ? (
          <Field label="Which vehicle" required hint="The request did not name one">
            <Select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
              <option value="">Choose a vehicle…</option>
              {owned.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

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
              maxLength={30}
              value={form.values.bay}
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

        <Field label="Advisor" hint="Optional">
          <Select
            value={form.values.advisor_id}
            onChange={(event) => form.set("advisor_id", event.target.value)}
          >
            <option value="">Unassigned</option>
            {staff.map((person) => (
              <option key={person.id} value={person.id}>
                {person.first_name} {person.last_name}
              </option>
            ))}
          </Select>
        </Field>

        <Notice tone="info">
          The slot is checked for clashes as it is booked. If the technician, bay or vehicle is
          already taken the conversion is refused and this request stays APPROVED.
        </Notice>
      </form>
    </Modal>
  );
}

function NewRequestModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { customers, vehiclesFor } = useReferences();
  const form = useForm({
    customer_id: "",
    title: "",
    description: "",
    priority: "STANDARD",
    vehicle_id: "",
    service_advisor_notes: "",
  });
  const create = useApiMutation((body: ServiceRequestCreate) => serviceRequestsApi.create(body));

  const owned = vehiclesFor(form.values.customer_id);

  async function submit() {
    if (form.missing(["customer_id", "title"]).length > 0) return;
    const created = await create.run({
      customer_id: form.values.customer_id,
      title: form.values.title,
      description: form.values.description || null,
      priority: form.values.priority,
      vehicle_id: form.values.vehicle_id || null,
      service_advisor_notes: form.values.service_advisor_notes || null,
    });
    if (created) {
      form.reset();
      onCreated();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New service request"
      description="Something a customer has asked for that is not yet a booking."
      footer={
        <>
          <Button onClick={onClose} disabled={create.pending}>
            Cancel
          </Button>
          <Button variant="primary" pending={create.pending} onClick={() => void submit()}>
            Raise request
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
        <Field label="Customer" required>
          <Select
            value={form.values.customer_id}
            onChange={(event) => {
              form.set("customer_id", event.target.value);
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
        <Field label="What is it about" required hint="One line, up to 200 characters">
          <Input
            maxLength={200}
            value={form.values.title}
            onChange={(event) => form.set("title", event.target.value)}
            placeholder="Grinding from the front when braking"
          />
        </Field>
        <Field label="Detail" hint="What the customer actually said">
          <Textarea
            rows={3}
            maxLength={5000}
            value={form.values.description}
            onChange={(event) => form.set("description", event.target.value)}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Priority">
            <Select
              value={form.values.priority}
              onChange={(event) => form.set("priority", event.target.value)}
            >
              {REQUEST_PRIORITIES.map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Vehicle"
            hint={form.values.customer_id ? "Optional" : "Choose the customer first"}
          >
            <Select
              value={form.values.vehicle_id}
              disabled={!form.values.customer_id}
              onChange={(event) => form.set("vehicle_id", event.target.value)}
            >
              <option value="">Not vehicle-specific</option>
              {owned.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Advisor notes">
          <Textarea
            rows={2}
            maxLength={2000}
            value={form.values.service_advisor_notes}
            onChange={(event) => form.set("service_advisor_notes", event.target.value)}
          />
        </Field>
        <Notice tone="info">
          A new request starts as NEW. Approve it before converting, or the shop will not schedule it.
        </Notice>
      </form>
    </Modal>
  );
}