"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Field, FormError, Input, Select, Textarea, useForm } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader, StatTile } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { useReferences } from "@/components/layout/ReferenceProvider";
import { invoicesApi, paymentsApi } from "@/lib/api/money";
import { repairOrdersApi } from "@/lib/api/work";
import type { Invoice, InvoiceItem, RepairOrder } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { formatDate, formatMoney, formatPercent, todayIso } from "@/lib/format";
import { PAYMENT_METHODS, REFERENCE_REQUIRED_METHODS } from "@/lib/status";

/**
 * One invoice, read as a document the customer is holding.
 *
 * The lines fall into two kinds and the difference is why half of them have no
 * buttons. A line copied from the estimate is what the customer agreed to,
 * frozen the moment the invoice went out; only a shop-added `MANUAL` line is the
 * shop's own arithmetic and may still be corrected, and only while the invoice is
 * a draft.
 *
 * There is no control here for payment state. `PARTIALLY_PAID` and `PAID` are
 * reachable only by recording a payment, because an invoice must never claim
 * money that was never taken — a status picker here would be exactly that claim.
 */
export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const invoiceId = params.id;
  const { can } = useSession();
  const { customerLabel, vehicleText } = useReferences();

  const [addingItem, setAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<InvoiceItem | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [paying, setPaying] = useState(false);

  const query = useApiQuery(() => invoicesApi.get(invoiceId), [invoiceId]);

  const invoice = query.data;
  const isDraft = invoice?.status === "DRAFT";
  const manualEditable = can("invoices:write") && isDraft;

  const repairOrderId = invoice?.repair_order_id ?? null;
  const repairOrder = useApiQuery<RepairOrder | null>(
    () => (repairOrderId ? repairOrdersApi.get(repairOrderId) : Promise.resolve(null)),
    [repairOrderId],
    { enabled: !!repairOrderId && can("repair_orders:read") },
  );

  const issue = useApiMutation(() => invoicesApi.issue(invoiceId));
  const removeItem = useApiMutation((itemId: string) => invoicesApi.removeItem(invoiceId, itemId));

  const canIssue =
    can("invoices:manage") &&
    isDraft &&
    (invoice?.items.length ?? 0) > 0 &&
    (invoice?.total ?? 0) > 0;
  const voidBlockedBy = voidBlockedReason(invoice);
  const payBlockedBy = paymentBlockedReason(invoice);

  const columns: Column<InvoiceItem>[] = [
    {
      key: "source",
      header: "Source",
      render: (item) => (
        <div>
          <StatusBadge status={item.source} />
          {item.source === "ESTIMATE" && manualEditable ? (
            <p className="mt-1 text-xs text-ink-500">Frozen — approved work</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (item) => (
        <div>
          <p className="text-sm text-ink-900">{item.description}</p>
          <p className="text-xs text-ink-500">
            {item.item_type}
            {item.reference ? ` · ${item.reference}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "part",
      header: "Part",
      render: (item) =>
        item.part_number ? (
          <div className="text-sm">
            <p>{item.part_number}</p>
            {item.part_name ? <p className="text-xs text-ink-500">{item.part_name}</p> : null}
          </div>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: "quantity",
      header: "Qty",
      numeric: true,
      render: (item) => item.quantity,
    },
    {
      key: "unit_price",
      header: "Unit",
      numeric: true,
      render: (item) => formatMoney(item.unit_price),
    },
    {
      key: "discount",
      header: "Discount",
      numeric: true,
      render: (item) =>
        item.discount_amount > 0 ? (
          <span className="text-ink-600">-{formatMoney(item.discount_amount)}</span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: "line_total",
      header: "Line total",
      numeric: true,
      render: (item) => formatMoney(item.line_total),
    },
    {
      key: "actions",
      header: "",
      numeric: true,
      render: (item) =>
        manualEditable && item.source === "MANUAL" ? (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="text-xs font-medium text-brand-700 hover:underline"
              onClick={(event) => {
                event.stopPropagation();
                setEditingItem(item);
              }}
            >
              Edit
            </button>
            <button
              type="button"
              className="text-xs text-rose-700 hover:underline disabled:text-ink-300"
              disabled={removeItem.pending}
              onClick={(event) => {
                event.stopPropagation();
                void removeItem.run(item.id).then(() => query.refetch());
              }}
            >
              Remove
            </button>
          </div>
        ) : (
          <span className="text-xs text-ink-300">—</span>
        ),
    },
  ];

  if (query.loading && query.initial) return <Loading label="Reading the invoice…" />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} />;
  if (!invoice) return <ErrorState error={new Error("No invoice data")} />;

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href="/invoices" className="hover:underline">
            Invoices
          </Link>
        }
        title={invoice.invoice_number}
        subtitle={`${customerLabel(invoice.customer_id)} · ${vehicleText(invoice.vehicle_id)}`}
        actions={
          <>
            <StatusBadge status={invoice.status} />
            {can("invoices:manage") ? (
              <Button
                variant="primary"
                disabled={!canIssue}
                title={canIssue ? "Send this bill to the customer" : issueBlockedReason(invoice)}
                pending={issue.pending}
                onClick={() => void issue.run().then(() => query.refetch())}
              >
                Issue
              </Button>
            ) : null}
            {can("invoices:manage") ? (
              <>
                <Button
                  variant="danger"
                  disabled={!!voidBlockedBy}
                  title={voidBlockedBy ?? "Write this invoice off, with a reason"}
                  onClick={() => setVoiding(true)}
                >
                  Void
                </Button>
                {can("payments:write") ? (
                  <Button
                    variant="success"
                    disabled={!!payBlockedBy}
                    title={payBlockedBy ?? "Take money against this bill"}
                    onClick={() => setPaying(true)}
                  >
                    Record payment
                  </Button>
                ) : null}
              </>
            ) : null}
          </>
        }
      />

      {isDraft ? (
        <Notice tone="info">
          This invoice has not been issued, so its lines can still be changed and the balance is not
          yet owed.
        </Notice>
      ) : (
        <Notice tone="info">
          This invoice has been issued. The lines are the copy the customer is holding and are frozen;
          only shop-added manual charges were ever editable, and that window closed at issue.
        </Notice>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Invoice" subtitle="Header and dates" />
          <dl className="space-y-2 text-sm">
            <Row label="Customer">{customerLabel(invoice.customer_id)}</Row>
            <Row label="Vehicle">{vehicleText(invoice.vehicle_id)}</Row>
            <Row label="Repair order">
              {repairOrder.data?.ro_number ? (
                <Link
                  href={`/repair-orders/${repairOrder.data.id}`}
                  className="text-brand-700 hover:underline"
                >
                  {repairOrder.data.ro_number}
                </Link>
              ) : (
                "—"
              )}
            </Row>
            <Row label="Invoice date">{formatDate(invoice.invoice_date)}</Row>
            <Row label="Due date">
              {invoice.is_overdue ? (
                <span className="font-medium text-rose-700">
                  {formatDate(invoice.due_date)} · {invoice.days_overdue} day(s) late
                </span>
              ) : (
                formatDate(invoice.due_date)
              )}
            </Row>
            <Row label="Issued">{formatDate(invoice.issued_at)}</Row>
            <Row label="Paid">{formatDate(invoice.paid_at)}</Row>
            {invoice.void_reason ? <Row label="Void reason">{invoice.void_reason}</Row> : null}
            {invoice.notes ? <Row label="Notes">{invoice.notes}</Row> : null}
          </dl>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Money"
            subtitle="As the server calculates it — never re-added from the lines below"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile label="Subtotal" value={formatMoney(invoice.subtotal)} hint="The charges" />
            <StatTile
              label="Discount"
              value={formatMoney(invoice.discount_amount)}
              hint="Taken off before tax"
            />
            <StatTile
              label="Tax"
              value={formatMoney(invoice.tax_amount)}
              hint={`${formatPercent(invoice.tax_rate, 2)} on the discounted amount`}
            />
            <StatTile label="Total" value={formatMoney(invoice.total)} tone="info" />
            <StatTile
              label="Paid"
              value={formatMoney(invoice.amount_paid)}
              tone={invoice.amount_paid > 0 ? "success" : "neutral"}
              hint="Recorded at the till"
            />
            <StatTile
              label="Balance"
              value={formatMoney(invoice.balance)}
              tone={invoice.balance > 0 ? "warning" : "neutral"}
              hint="Total less what has been paid"
            />
          </div>
          <p className="mt-4 text-xs text-ink-500">
            There is no status control for payment state on purpose: an invoice becomes part-paid or
            paid only by a payment being recorded against it. Take the money at the till, or void a
            payment that was wrong — a bill is never marked paid by hand.
          </p>
        </Card>
      </div>

      <Card className="mt-4" padded={false}>
        <CardHeader
          title="Charge lines"
          subtitle={`${invoice.items.length} line(s)`}
          actions={
            manualEditable ? (
              <Button size="sm" variant="primary" onClick={() => setAddingItem(true)}>
                Add a charge
              </Button>
            ) : null
          }
        />
        <div className="px-5 pb-4">
          <Notice tone="info">
            Lines marked ESTIMATE were copied from the estimate the customer approved. They cannot be
            edited or removed — the customer agreed to those figures. Lines marked MANUAL were added
            by the shop and can be corrected while this invoice is a draft.
          </Notice>
        </div>
        {invoice.items.length === 0 ? (
          <EmptyState
            title="No charge lines"
            description="An invoice cannot be issued with nothing on it."
          />
        ) : (
          <DataTable rows={invoice.items} columns={columns} rowKey={(item) => item.id} dense />
        )}
      </Card>

      {issue.error ? (
        <div className="mt-4">
          <Notice tone="danger">{issue.error.messageForUser}</Notice>
        </div>
      ) : null}

      {addingItem || editingItem ? (
        <ItemModal
          invoiceId={invoiceId}
          item={editingItem}
          onClose={() => {
            setAddingItem(false);
            setEditingItem(null);
          }}
          onSaved={() => {
            setAddingItem(false);
            setEditingItem(null);
            query.refetch();
          }}
        />
      ) : null}

      {voiding ? (
        <VoidModal
          invoice={invoice}
          onClose={() => setVoiding(false)}
          onVoided={() => {
            setVoiding(false);
            query.refetch();
          }}
        />
      ) : null}

      {paying ? (
        <RecordPaymentModal
          invoice={invoice}
          onClose={() => setPaying(false)}
          onRecorded={() => {
            setPaying(false);
            query.refetch();
          }}
        />
      ) : null}
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs tracking-wide text-ink-500 uppercase">{label}</dt>
      <dd className="text-right text-ink-900">{children}</dd>
    </div>
  );
}

/** Why the issue control is dead, in the words the desk would use. */
function issueBlockedReason(invoice: Invoice): string {
  if (invoice.status !== "DRAFT") return "This invoice has already been issued.";
  if (invoice.items.length === 0) return "Add at least one charge line before issuing.";
  if (invoice.total <= 0) return "A zero invoice has nothing to charge, so it cannot be issued.";
  return "Ready to issue.";
}

function voidBlockedReason(invoice: Invoice | null): string | null {
  if (!invoice) return "Nothing loaded.";
  if (invoice.status === "VOID") return "This invoice is already void.";
  if (invoice.status === "DRAFT")
    return "A draft was never sent, so it is deleted rather than voided.";
  if (invoice.amount_paid > 0)
    return `There is ${formatMoney(invoice.amount_paid)} recorded against this bill. The payment has to be voided first, at /payments.`;
  return null;
}

function paymentBlockedReason(invoice: Invoice | null): string | null {
  if (!invoice) return "Nothing loaded.";
  if (invoice.status === "VOID") return "A voided bill cannot take money.";
  if (invoice.status === "DRAFT") return "Issue the invoice first — a draft is not yet owed.";
  if (invoice.status === "PAID" || invoice.balance <= 0)
    return "This bill is settled — there is no balance to take.";
  return null;
}

const LINE_TYPES = ["LABOR", "PART", "SERVICE", "FEE", "DISCOUNT"];

function ItemModal({
  invoiceId,
  item,
  onClose,
  onSaved,
}: {
  invoiceId: string;
  item: InvoiceItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = item !== null;
  const form = useForm({
    item_type: item?.item_type ?? "LABOR",
    description: item?.description ?? "",
    quantity: String(item?.quantity ?? 1),
    unit_price: item ? String(item.unit_price) : "",
    discount_amount: String(item?.discount_amount ?? 0),
    part_number: item?.part_number ?? "",
    part_name: item?.part_name ?? "",
    notes: item?.notes ?? "",
  });

  const addItem = useApiMutation((body: Record<string, unknown>) =>
    invoicesApi.addItem(invoiceId, body),
  );
  const updateItem = useApiMutation((body: Record<string, unknown>) =>
    invoicesApi.updateItem(invoiceId, item?.id ?? "", body),
  );
  const save = editing ? updateItem : addItem;

  const isDiscount = form.values.item_type === "DISCOUNT";

  async function submit() {
    if (form.missing(["description", "unit_price"]).length > 0) return;
    const body: Record<string, unknown> = {
      description: form.values.description.trim(),
      quantity: isDiscount ? 1 : Number(form.values.quantity) || 0,
      unit_price: Number(form.values.unit_price) || 0,
      discount_amount: isDiscount ? 0 : Number(form.values.discount_amount) || 0,
      part_number: form.values.part_number || null,
      part_name: form.values.part_name || null,
      notes: form.values.notes || null,
    };
    // The item type is immutable once a line exists: re-interpreting it would
    // change what the customer was charged without saying so on the document.
    if (!editing) body.item_type = form.values.item_type;
    const saved = await save.run(body);
    if (saved) onSaved();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? "Correct a charge line" : "Add a charge line"}
      description="A shop-added line is the shop's own arithmetic and can be corrected while the invoice is a draft."
      footer={
        <>
          <Button onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button variant="primary" pending={save.pending} onClick={() => void submit()}>
            {editing ? "Save the line" : "Add the line"}
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
        <FormError error={save.error} />

        <Field label="Charge type" hint={editing ? "Fixed once the line exists." : undefined}>
          <Select
            value={form.values.item_type}
            disabled={editing}
            onChange={(event) => form.set("item_type", event.target.value)}
          >
            {LINE_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Description" required>
          <Input
            value={form.values.description}
            onChange={(event) => form.set("description", event.target.value)}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label="Quantity"
            hint={isDiscount ? "A discount is always a quantity of one." : undefined}
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              value={isDiscount ? "1" : form.values.quantity}
              disabled={isDiscount}
              onChange={(event) => form.set("quantity", event.target.value)}
            />
          </Field>
          <Field label="Unit price" required>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.values.unit_price}
              onChange={(event) => form.set("unit_price", event.target.value)}
            />
          </Field>
          {isDiscount ? (
            <Field label="Discount" hint="A discount line cannot carry its own discount.">
              <Input value="—" disabled readOnly />
            </Field>
          ) : (
            <Field label="Discount">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.values.discount_amount}
                onChange={(event) => form.set("discount_amount", event.target.value)}
              />
            </Field>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Part number" hint="Optional.">
            <Input
              value={form.values.part_number}
              onChange={(event) => form.set("part_number", event.target.value)}
            />
          </Field>
          <Field label="Part name" hint="Optional.">
            <Input
              value={form.values.part_name}
              onChange={(event) => form.set("part_name", event.target.value)}
            />
          </Field>
        </div>

        <Field label="Notes">
          <Textarea
            rows={2}
            value={form.values.notes}
            onChange={(event) => form.set("notes", event.target.value)}
          />
        </Field>

        <Notice tone="info">
          Changing a line recalculates the invoice totals on the server. The figures on this page are
          always the server&apos;s, never a sum of what is shown here.
        </Notice>
      </form>
    </Modal>
  );
}

function VoidModal({
  invoice,
  onClose,
  onVoided,
}: {
  invoice: Invoice;
  onClose: () => void;
  onVoided: () => void;
}) {
  const form = useForm({ reason: "" });
  const voidInvoice = useApiMutation((reason: string) => invoicesApi.void(invoice.id, reason));

  async function submit() {
    if (form.missing(["reason"]).length > 0) return;
    const done = await voidInvoice.run(form.values.reason.trim());
    if (done) {
      form.reset();
      onVoided();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Void this invoice"
      description="The bill is written off and the reason is kept on the record."
      footer={
        <>
          <Button onClick={onClose} disabled={voidInvoice.pending}>
            Cancel
          </Button>
          <Button variant="danger" pending={voidInvoice.pending} onClick={() => void submit()}>
            Void invoice
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
        <FormError error={voidInvoice.error} />
        <Field label="Reason" required hint="Why the bill is being written off.">
          <Textarea
            rows={3}
            value={form.values.reason}
            onChange={(event) => form.set("reason", event.target.value)}
          />
        </Field>
        <Notice tone="info">
          A voided invoice can never be reopened and takes no further money. If the work was still
          done, raise a new invoice against the repair order.
        </Notice>
      </form>
    </Modal>
  );
}

function RecordPaymentModal({
  invoice,
  onClose,
  onRecorded,
}: {
  invoice: Invoice;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const form = useForm({
    amount: invoice.balance > 0 ? invoice.balance.toFixed(2) : "",
    method: "CASH",
    payment_date: todayIso(),
    reference: "",
    notes: "",
  });
  const record = useApiMutation((body: Parameters<typeof paymentsApi.record>[0]) =>
    paymentsApi.record(body),
  );

  const needsReference = REFERENCE_REQUIRED_METHODS.has(form.values.method);
  const amount = Number(form.values.amount);
  const overBalance = amount > invoice.balance + 0.005;
  const underOneCent = !(amount > 0);

  async function submit() {
    if (underOneCent || overBalance) return;
    if (needsReference && form.missing(["reference"]).length > 0) return;
    const done = await record.run({
      invoice_id: invoice.id,
      amount: Number(amount.toFixed(2)),
      method: form.values.method,
      payment_date: form.values.payment_date || null,
      reference: form.values.reference || null,
      notes: form.values.notes || null,
    });
    if (done) {
      form.reset();
      onRecorded();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Record a payment"
      description={`${invoice.invoice_number} · balance ${formatMoney(invoice.balance)}`}
      footer={
        <>
          <Button onClick={onClose} disabled={record.pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            pending={record.pending}
            disabled={underOneCent || overBalance || (needsReference && !form.values.reference.trim())}
            onClick={() => void submit()}
          >
            Record payment
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
        <FormError error={record.error} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Amount"
            required
            hint={`At most the ${formatMoney(invoice.balance)} balance. An overpayment is a credit, not a negative bill.`}
            error={
              overBalance
                ? "More than the balance — record the difference as a credit instead."
                : underOneCent
                  ? "A payment has to be greater than zero."
                  : null
            }
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.values.amount}
              onChange={(event) => form.set("amount", event.target.value)}
            />
          </Field>
          <Field label="Payment date">
            <Input
              type="date"
              value={form.values.payment_date}
              onChange={(event) => form.set("payment_date", event.target.value)}
            />
          </Field>
        </div>

        <Field label="Method" required>
          <Select
            value={form.values.method}
            onChange={(event) => form.set("method", event.target.value)}
          >
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Reference"
          required={needsReference}
          hint={
            needsReference
              ? "Money that leaves no paper trail cannot be matched to a statement."
              : "Optional for this method."
          }
        >
          <Input
            value={form.values.reference}
            placeholder={needsReference ? "Bank reference or cheque number" : "Optional"}
            onChange={(event) => form.set("reference", event.target.value)}
          />
        </Field>

        <Field label="Notes">
          <Textarea
            rows={2}
            value={form.values.notes}
            onChange={(event) => form.set("notes", event.target.value)}
          />
        </Field>

        <Notice tone="info">
          <Badge tone="info">No status control</Badge> Recording this is the only thing that moves
          the invoice to PARTIALLY_PAID or PAID. If it was recorded in error, void the payment at the
          till rather than editing the bill.
        </Notice>
      </form>
    </Modal>
  );
}
