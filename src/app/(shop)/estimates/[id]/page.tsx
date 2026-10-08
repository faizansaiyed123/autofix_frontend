"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, KeyValue, KeyValueGrid } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { useReferences } from "@/components/layout/ReferenceProvider";
import { estimatesApi } from "@/lib/api/work";
import type { Estimate, EstimateItem } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { formatDate, formatDateTime, formatMoney, formatNumber, formatPercent } from "@/lib/format";

/**
 * One quote, and the customer's decision on each of its lines.
 *
 * The important thing this page has to say out loud is that approval is per line
 * and only approved lines are billed. A customer who takes the brakes and
 * declines the polish is not a partial customer — they are a customer whose work
 * is exactly what they approved, and the estimate's `approved_total` is the
 * number that matters to both sides.
 *
 * Everything the customer-facing numbers depend on comes from the API. The
 * backend rounds every derived amount in a place the browser cannot reproduce,
 * so a total recomputed from the rows on screen would be a second, subtly
 * different answer to the same question.
 */
export default function EstimateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useSession();
  const { customerLabel, vehicleLabel } = useReferences();
  const [cancelling, setCancelling] = useState(false);
  const [lineItem, setLineItem] = useState<EstimateItem | "new" | null>(null);
  const [deciding, setDeciding] = useState<EstimateItem | null>(null);

  const query = useApiQuery(() => estimatesApi.get(id), [id]);

  const send = useApiMutation((estimateId: string) => estimatesApi.send(estimateId));
  const removeItem = useApiMutation((itemId: string) => estimatesApi.removeItem(id, itemId));

  if (query.loading && query.initial) return <Loading label="Opening the estimate…" />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const estimate = query.data;
  if (!estimate) return <ErrorState error={new Error("Estimate not found")} />;

  const isDraft = estimate.status === "DRAFT";
  const openForDecision =
    estimate.status === "SENT" || estimate.status === "PARTIALLY_APPROVED";
  const mayWrite = can("estimates:write");
  const mayDecide = can("estimates:approve");

  const pending = estimate.items.filter((item) => item.status === "PENDING");
  const approvedCount = estimate.items.filter((item) => item.status === "APPROVED").length;
  const declinedCount = estimate.items.filter((item) => item.status === "DECLINED").length;

  const sendBlock = sendBlockReason(estimate);

  const columns: Column<EstimateItem>[] = [
    {
      key: "description",
      header: "Line",
      render: (item) => (
        <div className="min-w-0">
          <p className="font-medium text-ink-900">{item.description}</p>
          <p className="text-xs text-ink-500">
            {item.item_type}
            {item.part_number ? ` · ${item.part_number}` : ""}
            {item.labor_hours != null && item.labor_rate != null
              ? ` · ${formatNumber(item.labor_hours, 2)}h at ${formatMoney(item.labor_rate)}`
              : ""}
          </p>
          {item.is_optional ? <Badge tone="neutral" className="mt-1">Optional</Badge> : null}
          {item.notes ? <p className="mt-1 text-xs text-ink-500">{item.notes}</p> : null}
        </div>
      ),
    },
    {
      key: "quantity",
      header: "Qty",
      numeric: true,
      render: (item) => (
        <span className="text-xs">{item.item_type === "LABOR" ? "—" : formatNumber(item.quantity, 2)}</span>
      ),
    },
    {
      key: "unit_price",
      header: "Unit",
      numeric: true,
      render: (item) => (
        <span className="text-xs">{item.item_type === "LABOR" ? "—" : formatMoney(item.unit_price)}</span>
      ),
    },
    {
      key: "discount",
      header: "Discount",
      numeric: true,
      render: (item) => <span className="text-xs text-ink-500">{formatMoney(item.discount_amount)}</span>,
    },
    {
      key: "line_total",
      header: "Line total",
      numeric: true,
      render: (item) => <span className="font-medium">{formatMoney(item.line_total)}</span>,
    },
    {
      key: "decision",
      header: "Customer's decision",
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: "actions",
      header: "",
      numeric: true,
      render: (item) => (
        <div className="flex items-center justify-end gap-2">
          {item.status === "PENDING" && openForDecision ? (
            mayDecide ? (
              <Button size="sm" onClick={() => setDeciding(item)}>
                Record decision
              </Button>
            ) : (
              <span className="text-xs text-ink-500">Awaiting the customer</span>
            )
          ) : null}
          {mayWrite && isDraft ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setLineItem(item)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                pending={removeItem.pending}
                onClick={() => removeItem.run(item.id).then(() => query.refetch())}
              >
                Remove
              </Button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={<Link href="/estimates" className="hover:underline">Estimates</Link>}
        title={estimate.estimate_number}
        subtitle={`${customerLabel(estimate.customer_id)} · ${vehicleLabel(estimate.vehicle_id)}`}
        actions={
          <>
            <StatusBadge status={estimate.status} />
            {estimate.is_expired ? <StatusBadge status="EXPIRED" /> : null}
            {mayWrite ? (
              <>
                <Button
                  pending={send.pending}
                  disabled={sendBlock !== null}
                  title={sendBlock ?? undefined}
                  onClick={() => send.run(id).then((result) => result && query.refetch())}
                >
                  Send to customer
                </Button>
                <Button
                  variant="danger"
                  disabled={!isCancellable(estimate.status)}
                  title={
                    isCancellable(estimate.status)
                      ? undefined
                      : `An estimate that is ${estimate.status} cannot be cancelled`
                  }
                  onClick={() => setCancelling(true)}
                >
                  Cancel
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {send.error ? <Notice tone="danger">{send.error.messageForUser}</Notice> : null}
      {estimate.is_expired ? (
        <div className="mb-4">
          <Notice tone="danger">
            This estimate expired on {formatDate(estimate.valid_until)}. It can no longer be sent or
            decided on.
          </Notice>
        </div>
      ) : null}

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Lines"
            subtitle={
              isDraft
                ? "Editable while the estimate is a draft"
                : "Frozen — the customer has seen this quote"
            }
            actions={
              mayWrite && isDraft ? (
                <Button size="sm" onClick={() => setLineItem("new")}>
                  Add line
                </Button>
              ) : null
            }
          />
          {estimate.items.length === 0 ? (
            <EmptyState
              title="No lines yet"
              description="An estimate cannot be sent until it has at least one priced line."
            />
          ) : (
            <DataTable rows={estimate.items} columns={columns} rowKey={(item) => item.id} />
          )}
          <p className="mt-3 text-xs text-ink-500">
            Only approved lines are billed. A declined line is not charged for, and an optional line
            the customer did not pick is not part of {formatMoney(estimate.approved_total)}.
          </p>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Money" subtitle="As the backend has it" />
            <dl className="space-y-2">
              <MoneyRow label="Subtotal" value={formatMoney(estimate.subtotal)} />
              <MoneyRow label="Discount" value={`- ${formatMoney(estimate.discount_amount)}`} />
              <MoneyRow
                label={`Tax at ${formatPercent(estimate.tax_rate)}`}
                value={formatMoney(estimate.tax_amount)}
              />
              <div className="flex items-baseline justify-between gap-3 border-t border-ink-200 pt-2">
                <dt className="text-sm font-semibold text-ink-900">Total</dt>
                <dd className="tabular text-base font-semibold text-ink-900">
                  {formatMoney(estimate.total)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-ink-700">Approved by the customer</dt>
                <dd className="tabular text-sm font-semibold text-emerald-700">
                  {formatMoney(estimate.approved_total)}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Decisions" subtitle="One per line" />
            <KeyValueGrid>
              <KeyValue label="Lines">{formatNumber(estimate.items.length)}</KeyValue>
              <KeyValue label="Pending">{formatNumber(pending.length)}</KeyValue>
              <KeyValue label="Approved">{formatNumber(approvedCount)}</KeyValue>
              <KeyValue label="Declined">{formatNumber(declinedCount)}</KeyValue>
            </KeyValueGrid>
          </Card>

          <Card>
            <CardHeader title="Record" />
            <KeyValueGrid>
              <KeyValue label="Valid until">
                {estimate.is_expired ? (
                  <span className="text-rose-700">{formatDate(estimate.valid_until)} (expired)</span>
                ) : (
                  formatDate(estimate.valid_until)
                )}
              </KeyValue>
              <KeyValue label="Sent">{formatDateTime(estimate.sent_at)}</KeyValue>
              <KeyValue label="Decided">{formatDateTime(estimate.decided_at)}</KeyValue>
              {estimate.customer_notes ? (
                <KeyValue label="Customer notes" className="col-span-2 sm:col-span-3">
                  {estimate.customer_notes}
                </KeyValue>
              ) : null}
              {estimate.decline_reason ? (
                <KeyValue label="Decline reason" className="col-span-2 sm:col-span-3">
                  {estimate.decline_reason}
                </KeyValue>
              ) : null}
              {estimate.notes ? (
                <KeyValue label="Notes" className="col-span-2 sm:col-span-3">
                  {estimate.notes}
                </KeyValue>
              ) : null}
            </KeyValueGrid>
          </Card>
        </div>
      </div>

      {openForDecision && pending.length > 0 ? (
        <Notice tone="info">
          {pending.length} line{pending.length === 1 ? "" : "s"} still {pending.length === 1 ? "has" : "have"} no
          decision. Recording one here is the advisor speaking for the customer at the counter.
        </Notice>
      ) : null}

      <CancelEstimateModal
        open={cancelling}
        estimateId={id}
        onClose={() => setCancelling(false)}
        onCancelled={() => {
          setCancelling(false);
          query.refetch();
        }}
      />

      {lineItem ? (
        <LineItemModal
          estimateId={id}
          item={lineItem === "new" ? null : lineItem}
          onClose={() => setLineItem(null)}
          onSaved={() => {
            setLineItem(null);
            query.refetch();
          }}
        />
      ) : null}

      {deciding ? (
        <DecisionModal
          estimateId={id}
          item={deciding}
          onClose={() => setDeciding(null)}
          onDecided={() => {
            setDeciding(null);
            query.refetch();
          }}
        />
      ) : null}
    </>
  );
}

function MoneyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-ink-700">{label}</dt>
      <dd className="tabular text-sm text-ink-900">{value}</dd>
    </div>
  );
}

/** Why the send button is unavailable, phrased for the person holding the click. */
function sendBlockReason(estimate: Estimate): string | null {
  if (estimate.status !== "DRAFT") return `Only a DRAFT estimate can be sent — this one is ${estimate.status}`;
  if (estimate.items.length === 0) return "Add at least one priced line before sending";
  if (estimate.is_expired) return "This estimate has already expired";
  return null;
}

/** A partially approved estimate has already had its lines decided on. */
function isCancellable(status: string): boolean {
  return status === "DRAFT" || status === "SENT" || status === "APPROVED";
}

/* ------------------------------------------------------------- the modals -- */

function CancelEstimateModal({
  open,
  estimateId,
  onClose,
  onCancelled,
}: {
  open: boolean;
  estimateId: string;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const [reason, setReason] = useState("");
  const cancel = useApiMutation((text: string) => estimatesApi.cancel(estimateId, text || undefined));

  async function submit() {
    const cancelled = await cancel.run(reason.trim());
    if (cancelled) {
      setReason("");
      onCancelled();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cancel this estimate"
      description="Cancelling is terminal — the estimate stays on the record, but nothing more can be decided on it."
      footer={
        <>
          <Button onClick={onClose} disabled={cancel.pending}>
            Keep it
          </Button>
          <Button variant="danger" pending={cancel.pending} onClick={() => void submit()}>
            Cancel estimate
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
        <FormError error={cancel.error} />
        <Field label="Reason" hint="Kept on the record against the estimate">
          <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

function DecisionModal({
  estimateId,
  item,
  onClose,
  onDecided,
}: {
  estimateId: string;
  item: EstimateItem;
  onClose: () => void;
  onDecided: () => void;
}) {
  const [decision, setDecision] = useState<"APPROVED" | "DECLINED">("APPROVED");
  const [notes, setNotes] = useState("");
  const decide = useApiMutation((choice: "APPROVED" | "DECLINED", note: string) =>
    estimatesApi.decideItem(estimateId, item.id, choice, note || null),
  );

  async function submit() {
    const recorded = await decide.run(decision, notes.trim());
    if (recorded) {
      setNotes("");
      onDecided();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Record the customer's decision"
      description="This is the customer's answer, written at the counter on their behalf."
      footer={
        <>
          <Button onClick={onClose} disabled={decide.pending}>
            Back
          </Button>
          <Button variant="primary" pending={decide.pending} onClick={() => void submit()}>
            Record decision
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
        <FormError error={decide.error} />
        <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm">
          <p className="font-medium text-ink-900">{item.description}</p>
          <p className="text-xs text-ink-600">{formatMoney(item.line_total)}</p>
        </div>
        <Field label="The customer" required>
          <Select
            value={decision}
            onChange={(event) => setDecision(event.target.value as "APPROVED" | "DECLINED")}
          >
            <option value="APPROVED">approves this line</option>
            <option value="DECLINED">declines this line</option>
          </Select>
        </Field>
        <Field label="Notes" hint="Recorded against the line, in the customer's words if you have them">
          <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        <Notice tone="info">
          A decision is final on that line, and only approved lines are billed. Other lines on this
          estimate can still be decided.
        </Notice>
      </form>
    </Modal>
  );
}

function LineItemModal({
  estimateId,
  item,
  onClose,
  onSaved,
}: {
  estimateId: string;
  item: EstimateItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = item !== null;
  const [itemType, setItemType] = useState(item?.item_type ?? "LABOR");
  const [description, setDescription] = useState(item?.description ?? "");
  const [laborHours, setLaborHours] = useState(item?.labor_hours != null ? String(item.labor_hours) : "");
  const [laborRate, setLaborRate] = useState(item?.labor_rate != null ? String(item.labor_rate) : "");
  const [partNumber, setPartNumber] = useState(item?.part_number ?? "");
  const [partName, setPartName] = useState(item?.part_name ?? "");
  const [quantity, setQuantity] = useState(item ? String(item.quantity) : "1");
  const [unitPrice, setUnitPrice] = useState(item ? String(item.unit_price) : "");
  const [discount, setDiscount] = useState(item ? String(item.discount_amount) : "");
  const [isOptional, setIsOptional] = useState(item?.is_optional ?? false);
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [problems, setProblems] = useState<string[]>([]);

  const addItem = useApiMutation((body: Parameters<typeof estimatesApi.addItem>[1]) =>
    estimatesApi.addItem(estimateId, body),
  );
  const updateItem = useApiMutation((itemId: string, body: Record<string, unknown>) =>
    estimatesApi.updateItem(estimateId, itemId, body),
  );

  const isLabour = itemType === "LABOR";

  const preview =
    isLabour
      ? Math.max(toNumber(laborHours) * toNumber(laborRate) - toNumber(discount), 0)
      : Math.max(toNumber(quantity) * toNumber(unitPrice) - toNumber(discount), 0);

  function validate(): string[] {
    const found: string[] = [];
    if (!description.trim()) found.push("The line needs a description");
    if (isLabour) {
      if (toNumber(laborHours) <= 0) found.push("Labour hours must be above zero");
      if (toNumber(laborRate) <= 0) found.push("An hourly rate is required");
    } else {
      if (toNumber(quantity) <= 0) found.push("Quantity must be above zero");
      if (toNumber(unitPrice) <= 0) found.push("A unit price above zero is required");
    }
    return found;
  }

  async function submit() {
    const found = validate();
    setProblems(found);
    if (found.length > 0) return;

    if (item) {
      // The type is immutable on an existing line: changing it would silently
      // re-interpret an amount that has already been calculated.
      const saved = await updateItem.run(item.id, {
        description: description.trim(),
        labor_hours: isLabour ? toNumber(laborHours) : null,
        labor_rate: isLabour ? toNumber(laborRate) : null,
        part_number: isLabour ? null : partNumber.trim() || null,
        part_name: isLabour ? null : partName.trim() || null,
        quantity: toNumber(quantity),
        unit_price: toNumber(unitPrice),
        discount_amount: toNumber(discount),
        is_optional: isOptional,
        notes: notes.trim() || null,
      });
      if (saved) onSaved();
      return;
    }

    const created = await addItem.run({
      item_type: itemType,
      description: description.trim(),
      labor_hours: isLabour ? toNumber(laborHours) : null,
      labor_rate: isLabour ? toNumber(laborRate) : null,
      part_number: isLabour ? null : partNumber.trim() || null,
      part_name: isLabour ? null : partName.trim() || null,
      quantity: toNumber(quantity),
      unit_price: toNumber(unitPrice),
      discount_amount: toNumber(discount),
      is_optional: isOptional,
      notes: notes.trim() || null,
    });
    if (created) onSaved();
  }

  const mutation = item ? updateItem : addItem;

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? "Edit line" : "Add line"}
      description={
        editing
          ? "The line type is fixed once a line exists — remove it and add a replacement instead."
          : undefined
      }
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose} disabled={mutation.pending}>
            Cancel
          </Button>
          <Button variant="primary" pending={mutation.pending} onClick={() => void submit()}>
            {editing ? "Save line" : "Add line"}
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
        <FormError error={mutation.error} />
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
          <Field label="Type" required hint={editing ? "Fixed on an existing line" : undefined}>
            <Select
              value={itemType}
              disabled={editing}
              onChange={(event) => setItemType(event.target.value)}
            >
              {ESTIMATE_ITEM_TYPES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description" required>
            <Input value={description} onChange={(event) => setDescription(event.target.value)} />
          </Field>
        </div>

        {isLabour ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Hours" required>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={laborHours}
                onChange={(event) => setLaborHours(event.target.value)}
              />
            </Field>
            <Field label="Hourly rate" required>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={laborRate}
                onChange={(event) => setLaborRate(event.target.value)}
              />
            </Field>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Part number">
              <Input value={partNumber} onChange={(event) => setPartNumber(event.target.value)} />
            </Field>
            <Field label="Part name">
              <Input value={partName} onChange={(event) => setPartName(event.target.value)} />
            </Field>
            <Field label="Quantity" required>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </Field>
            <Field label="Unit price" required>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value)}
              />
            </Field>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Discount" hint="Off this line only">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={discount}
              onChange={(event) => setDiscount(event.target.value)}
            />
          </Field>
          <Field label="Line preview">
            <p className="tabular px-3 py-2 text-sm font-medium">
              {formatMoney(preview)}
              <span className="ml-2 text-xs font-normal text-ink-500">
                the API recalculates this when it saves the line
              </span>
            </p>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={isOptional}
            onChange={(event) => setIsOptional(event.target.checked)}
            className="size-3.5 rounded border-ink-300"
          />
          Optional — the customer can take the rest without this line
        </label>

        <Field label="Notes">
          <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

const ESTIMATE_ITEM_TYPES = ["LABOR", "PART", "FEE", "SERVICE"];

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}