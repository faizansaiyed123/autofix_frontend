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
import { inspectionsApi } from "@/lib/api/shop";
import { estimatesApi } from "@/lib/api/work";
import type { Estimate, EstimateItemCreate } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { ESTIMATE_STATUSES } from "@/lib/status";
import { formatDate, formatDateTime, formatMoney, formatPercent } from "@/lib/format";

/**
 * The quoting book.
 *
 * Two figures sit side by side on every row and they answer different questions:
 * what the work would cost if all of it were done, and what the customer has
 * actually agreed to pay for so far. Quoting only the first is how a garage
 * loses track of what it is actually doing.
 */
export default function EstimatesPage() {
  const { can } = useSession();
  const router = useRouter();
  const { customerLabel, vehicleLabel } = useReferences();
  const [status, setStatus] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const query = useApiQuery(
    () =>
      estimatesApi.list({
        page,
        size: 25,
        status: status || undefined,
        customer_id: customerId || undefined,
        vehicle_id: vehicleId || undefined,
      }),
    [page, status, customerId, vehicleId],
  );

  const columns: Column<Estimate>[] = [
    {
      key: "number",
      header: "Estimate",
      render: (e) => (
        <Link href={`/estimates/${e.id}`} className="font-medium text-brand-700 hover:underline">
          {e.estimate_number}
        </Link>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (e) => <span className="text-sm">{customerLabel(e.customer_id)}</span>,
    },
    {
      key: "vehicle",
      header: "Vehicle",
      render: (e) => <span className="text-sm">{vehicleLabel(e.vehicle_id)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (e) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={e.status} />
          {e.is_expired ? <StatusBadge status="EXPIRED" /> : null}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      numeric: true,
      render: (e) => <span className="font-medium">{formatMoney(e.total)}</span>,
    },
    {
      key: "approved",
      header: "Approved",
      numeric: true,
      render: (e) => (
        <span className={e.approved_total > 0 ? "text-emerald-700" : "text-ink-400"}>
          {formatMoney(e.approved_total)}
        </span>
      ),
    },
    {
      key: "valid_until",
      header: "Valid until",
      numeric: true,
      render: (e) => (
        <span className={e.is_expired ? "text-xs font-medium text-rose-700" : "text-xs"}>
          {formatDate(e.valid_until)}
        </span>
      ),
    },
    {
      key: "sent_at",
      header: "Sent",
      numeric: true,
      render: (e) => <span className="text-xs text-ink-500">{formatDateTime(e.sent_at)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Estimates"
        subtitle={query.data ? `${query.data.meta.total} quoted` : undefined}
        actions={
          can("estimates:write") ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              New estimate
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
              {ESTIMATE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </label>
          <CustomerFilter
            value={customerId}
            onChange={(value) => {
              setCustomerId(value);
              // A vehicle belongs to one customer, so a narrower list invalidates
              // whatever vehicle was picked for the previous one.
              setVehicleId("");
              setPage(1);
            }}
          />
          <VehicleFilter
            customerId={customerId}
            value={vehicleId}
            onChange={(value) => {
              setVehicleId(value);
              setPage(1);
            }}
          />
        </Toolbar>

        {query.loading && query.initial ? (
          <Loading label="Reading the quote book…" />
        ) : query.error ? (
          <div className="p-4">
            <ErrorState error={query.error} onRetry={query.refetch} />
          </div>
        ) : !query.data || query.data.data.length === 0 ? (
          <EmptyState
            title="No estimates match"
            description="An estimate starts as a draft with its priced lines; sending it puts the choice in front of the customer."
          />
        ) : (
          <>
            <DataTable rows={query.data.data} columns={columns} rowKey={(e) => e.id} />
            <Pagination
              page={query.data.meta.page}
              pages={query.data.meta.pages}
              total={query.data.meta.total}
              onPage={setPage}
            />
          </>
        )}
      </Card>

      <NewEstimateModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          query.refetch();
          router.push(`/estimates/${id}`);
        }}
      />
    </>
  );
}

function CustomerFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { customers } = useReferences();
  return (
    <label className="block">
      <span className="sr-only">Customer</span>
      <Select value={value} onChange={(event) => onChange(event.target.value)} className="w-56">
        <option value="">Any customer</option>
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.first_name} {customer.last_name}
          </option>
        ))}
      </Select>
    </label>
  );
}

function VehicleFilter({
  customerId,
  value,
  onChange,
}: {
  customerId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { vehiclesFor } = useReferences();
  return (
    <label className="block">
      <span className="sr-only">Vehicle</span>
      <Select value={value} onChange={(event) => onChange(event.target.value)} className="w-56">
        <option value="">Any vehicle</option>
        {vehiclesFor(customerId).map((vehicle) => (
          <option key={vehicle.id} value={vehicle.id}>
            {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}
          </option>
        ))}
      </Select>
    </label>
  );
}

/* ----------------------------------------------------------- the line editor -- */

const ITEM_TYPES = [
  { value: "LABOR", label: "Labour", hint: "Bills hours x rate" },
  { value: "PART", label: "Part", hint: "Bills quantity x unit price" },
  { value: "FEE", label: "Fee", hint: "Bills quantity x unit price" },
  { value: "SERVICE", label: "Service", hint: "Bills quantity x unit price" },
];

interface LineDraft {
  key: string;
  item_type: string;
  description: string;
  labor_hours: string;
  labor_rate: string;
  part_number: string;
  part_name: string;
  quantity: string;
  unit_price: string;
  discount_amount: string;
  is_optional: boolean;
  notes: string;
}

let draftCounter = 0;

function blankLine(): LineDraft {
  draftCounter += 1;
  return {
    key: `line-${draftCounter}`,
    item_type: "LABOR",
    description: "",
    labor_hours: "",
    labor_rate: "",
    part_number: "",
    part_name: "",
    quantity: "1",
    unit_price: "",
    discount_amount: "",
    is_optional: false,
    notes: "",
  };
}

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * What this line will come to, as the user types it.
 *
 * Mirrors the backend's `compute_line_total` so the figure under the row is not a
 * surprise — but it is only ever a preview of an unsaved line. Once the line is
 * saved the stored `line_total` from the API is what every page shows, because
 * the backend rounds to cents in a second place this function cannot see.
 */
function previewLineTotal(draft: LineDraft): number {
  const gross =
    draft.item_type === "LABOR"
      ? toNumber(draft.labor_hours) * toNumber(draft.labor_rate)
      : toNumber(draft.quantity) * toNumber(draft.unit_price);
  return Math.max(gross - toNumber(draft.discount_amount), 0);
}

/** The per-type requirements the backend enforces, checked before it has to. */
function lineProblem(draft: LineDraft): string | null {
  if (!draft.description.trim()) return "every line needs a description";
  if (draft.item_type === "LABOR") {
    if (toNumber(draft.labor_hours) <= 0) return `"${draft.description}" needs labour hours above zero`;
    if (toNumber(draft.labor_rate) <= 0) return `"${draft.description}" needs an hourly rate above zero`;
    return null;
  }
  if (toNumber(draft.quantity) <= 0) return `"${draft.description}" needs a quantity above zero`;
  if (toNumber(draft.unit_price) <= 0) return `"${draft.description}" needs a unit price above zero`;
  return null;
}

function toPayload(draft: LineDraft): EstimateItemCreate {
  const base = {
    description: draft.description.trim(),
    is_optional: draft.is_optional,
    notes: draft.notes.trim() || null,
    discount_amount: toNumber(draft.discount_amount),
  };
  if (draft.item_type === "LABOR") {
    return {
      ...base,
      item_type: "LABOR",
      labor_hours: toNumber(draft.labor_hours),
      labor_rate: toNumber(draft.labor_rate),
      quantity: 1,
      unit_price: 0,
    };
  }
  return {
    ...base,
    item_type: draft.item_type,
    labor_hours: null,
    labor_rate: null,
    part_number: draft.part_number.trim() || null,
    part_name: draft.part_name.trim() || null,
    quantity: toNumber(draft.quantity),
    unit_price: toNumber(draft.unit_price),
  };
}

function LineEditor({
  lines,
  onChange,
}: {
  lines: LineDraft[];
  onChange: (next: LineDraft[]) => void;
}) {
  function patch(key: string, values: Partial<LineDraft>) {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...values } : line)));
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium tracking-wide text-ink-600 uppercase">
        Lines
        <span className="ml-2 font-normal text-ink-500 normal-case">
          Labour bills hours x rate; parts, fees and services bill quantity x unit price.
        </span>
      </p>

      {lines.length === 0 ? (
        <p className="rounded-lg bg-ink-50 px-3 py-4 text-center text-sm text-ink-500">
          No lines yet. An estimate cannot be sent to the customer until it has at least one.
        </p>
      ) : null}

      {lines.map((line, index) => {
        const problem = lineProblem(line);
        return (
          <div key={line.key} className="rounded-lg border border-ink-200 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-ink-700">Line {index + 1}</p>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-ink-600">
                  <input
                    type="checkbox"
                    checked={line.is_optional}
                    onChange={(event) => patch(line.key, { is_optional: event.target.checked })}
                    className="size-3.5 rounded border-ink-300"
                  />
                  Optional
                </label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onChange(lines.filter((l) => l.key !== line.key))}
                >
                  Remove
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Type">
                <Select
                  value={line.item_type}
                  onChange={(event) => patch(line.key, { item_type: event.target.value })}
                >
                  {ITEM_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Description" required>
                <Input
                  value={line.description}
                  onChange={(event) => patch(line.key, { description: event.target.value })}
                />
              </Field>
            </div>

            {line.item_type === "LABOR" ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Field label="Hours" required>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={line.labor_hours}
                    onChange={(event) => patch(line.key, { labor_hours: event.target.value })}
                  />
                </Field>
                <Field label="Hourly rate" required>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.labor_rate}
                    onChange={(event) => patch(line.key, { labor_rate: event.target.value })}
                  />
                </Field>
                <Field label="Line preview">
                  <p className="tabular px-3 py-2 text-sm text-ink-900">
                    {formatMoney(previewLineTotal(line))}
                  </p>
                </Field>
              </div>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Part number">
                  <Input
                    value={line.part_number}
                    onChange={(event) => patch(line.key, { part_number: event.target.value })}
                  />
                </Field>
                <Field label="Part name">
                  <Input
                    value={line.part_name}
                    onChange={(event) => patch(line.key, { part_name: event.target.value })}
                  />
                </Field>
                <Field label="Quantity" required>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.quantity}
                    onChange={(event) => patch(line.key, { quantity: event.target.value })}
                  />
                </Field>
                <Field label="Unit price" required>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unit_price}
                    onChange={(event) => patch(line.key, { unit_price: event.target.value })}
                  />
                </Field>
              </div>
            )}

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field label="Discount" hint="Taken off this line only">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.discount_amount}
                  onChange={(event) => patch(line.key, { discount_amount: event.target.value })}
                />
              </Field>
              <Field label="Line preview" className="sm:col-span-2">
                <p className="tabular px-3 py-2 text-sm font-medium text-ink-900">
                  {formatMoney(previewLineTotal(line))}
                  <span className="ml-2 text-xs font-normal text-ink-500">
                    the saved total comes from the API once the line exists
                  </span>
                </p>
              </Field>
            </div>

            <Field label="Notes" className="mt-3">
              <Textarea
                rows={2}
                value={line.notes}
                onChange={(event) => patch(line.key, { notes: event.target.value })}
              />
            </Field>

            {problem ? (
              <p className="mt-2 text-xs text-rose-700">{problem}</p>
            ) : null}
          </div>
        );
      })}

      <Button onClick={() => onChange([...lines, blankLine()])}>Add line</Button>
    </div>
  );
}

/* ------------------------------------------------------------ new estimate -- */

function NewEstimateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { customers, vehiclesFor, vehicleLabel } = useReferences();
  const [customerId, setCustomerId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [inspectionId, setInspectionId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([blankLine()]);
  const [problems, setProblems] = useState<string[]>([]);

  const inspections = useApiQuery(
    () =>
      inspectionsApi
        .list({ vehicle_id: vehicleId, size: 50 })
        .then((page) => page.data),
    [vehicleId],
    { enabled: Boolean(vehicleId) && open },
  );

  const create = useApiMutation((body: Parameters<typeof estimatesApi.create>[0]) =>
    estimatesApi.create(body),
  );

  const vehicles = customerId ? vehiclesFor(customerId) : [];

  async function submit() {
    const found: string[] = [];
    if (!customerId) found.push("Choose a customer");
    if (!vehicleId) found.push("Choose the vehicle this estimate is for");
    for (const line of lines) {
      const problem = lineProblem(line);
      if (problem) found.push(problem);
    }
    setProblems(found);
    if (found.length > 0) return;

    const created = await create.run({
      customer_id: customerId,
      vehicle_id: vehicleId,
      inspection_id: inspectionId || null,
      valid_until: validUntil || null,
      tax_rate: toNumber(taxRate),
      notes: notes.trim() || null,
      items: lines.map(toPayload),
    });
    if (created) {
      setCustomerId("");
      setVehicleId("");
      setInspectionId("");
      setValidUntil("");
      setTaxRate("0");
      setNotes("");
      setLines([blankLine()]);
      onCreated(created.id);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New estimate"
      description="It starts as a draft. Lines can be changed freely until it is sent to the customer."
      width="max-w-3xl"
      footer={
        <>
          <Button onClick={onClose} disabled={create.pending}>
            Cancel
          </Button>
          <Button variant="primary" pending={create.pending} onClick={() => void submit()}>
            Create draft
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
                setInspectionId("");
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
          <Field
            label="Vehicle"
            required
            hint={customerId ? undefined : "Pick a customer first — the backend refuses a vehicle that is not theirs."}
          >
            <Select
              value={vehicleId}
              onChange={(event) => {
                setVehicleId(event.target.value);
                setInspectionId("");
              }}
              disabled={!customerId}
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

        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label="Inspection"
            hint={vehicleId ? "Optional — what the estimate came out of" : undefined}
          >
            <Select value={inspectionId} onChange={(event) => setInspectionId(event.target.value)}>
              <option value="">None</option>
              {(inspections.data ?? []).map((inspection) => (
                <option key={inspection.id} value={inspection.id}>
                  {formatDate(inspection.created_at)} — {inspection.overall_condition}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Valid until" hint="After this date the estimate expires">
            <Input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
          </Field>
          <Field label="Tax rate" hint={`A rate from 0 to 1 — ${formatPercent(0.08, 0)} for eight per cent`}>
            <Input
              type="number"
              min="0"
              max="1"
              step="0.001"
              value={taxRate}
              onChange={(event) => setTaxRate(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Notes">
          <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>

        <LineEditor lines={lines} onChange={setLines} />
      </form>
    </Modal>
  );
}