"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, KeyValue, KeyValueGrid } from "@/components/ui/Card";
import { Field, FormError, Input, Select, Textarea, useForm } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/Page";
import { ErrorState, Loading, Notice } from "@/components/ui/States";
import { portalApi } from "@/lib/api/portal";
import type { PortalInvoice } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { formatDate, formatMoney } from "@/lib/format";
import { PAYMENT_METHODS, REFERENCE_REQUIRED_METHODS } from "@/lib/status";

/**
 * One invoice, and the button that settles it.
 *
 * The totals shown here are the invoice's own. The portal never recomputes a
 * figure the backend already derived, because a second calculation in a browser
 * is a second answer to the same question.
 *
 * Payment is deliberately **partial by default** — the balance, not the total.
 * A bill can be settled over several visits and the remainder simply stays owed,
 * so the amount field starts at what is actually left and the person can lower it.
 */
export default function PortalInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [paying, setPaying] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const invoice = useApiQuery(() => portalApi.invoice(id), [id]);

  if (invoice.loading && invoice.initial) return <Loading />;
  if (invoice.error) {
    // Another customer's invoice is not found, not forbidden: a 403 would confirm
    // the id exists, which is the disclosure the check exists to prevent.
    return <ErrorState error={invoice.error} />;
  }

  const record = invoice.data;
  if (!record) return <ErrorState error={new Error("Invoice not found")} />;

  const payable = record.balance > 0 && record.status !== "DRAFT" && record.status !== "VOID";

  return (
    <>
      <PageHeader
        breadcrumb={<Link href="/portal/invoices" className="hover:underline">Invoices</Link>}
        title={record.invoice_number}
        subtitle={record.status_view.detail || undefined}
        actions={
          <>
            <Button
              pending={downloading}
              onClick={() => {
                setDownloading(true);
                portalApi
                  .downloadInvoice(id, `${record.invoice_number}.html`)
                  .catch(() => undefined)
                  .finally(() => setDownloading(false));
              }}
            >
              Download copy
            </Button>
            <Button variant="primary" disabled={!payable} onClick={() => setPaying(true)}>
              {record.balance > 0 ? `Pay ${formatMoney(record.balance)}` : "Settled"}
            </Button>
          </>
        }
      />

      {!payable && record.status !== "DRAFT" ? (
        <div className="mb-4">
          <Notice tone="info">
            {record.status === "VOID"
              ? "This invoice was written off by the shop, so there is nothing to pay."
              : "This invoice is fully settled."}
          </Notice>
        </div>
      ) : null}

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="The bill" subtitle="The shop's copy itemises every line; this is the document you settle." />
          <KeyValueGrid>
            <KeyValue label="Subtotal">{formatMoney(record.subtotal)}</KeyValue>
            <KeyValue label="Discount">{formatMoney(record.discount_amount)}</KeyValue>
            <KeyValue label="Tax">{formatMoney(record.tax_amount)}</KeyValue>
            <KeyValue label="Total">
              <span className="text-lg font-semibold">{formatMoney(record.total)}</span>
            </KeyValue>
            <KeyValue label="Already paid">{formatMoney(record.amount_paid)}</KeyValue>
            <KeyValue label="Balance">
              <span className={record.balance > 0 ? "text-lg font-semibold text-amber-700" : "text-lg font-semibold text-emerald-700"}>
                {formatMoney(record.balance)}
              </span>
            </KeyValue>
          </KeyValueGrid>
          {record.notes ? <p className="mt-4 text-sm text-ink-600">{record.notes}</p> : null}
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-ink-100 pt-3 text-sm">
            <span className="text-ink-500">
              Status <StatusBadge status={record.status} className="ml-1" />
            </span>
            <span className="text-ink-500">
              Dated <span className="text-ink-800">{formatDate(record.invoice_date)}</span>
            </span>
            <span className="text-ink-500">
              Due{" "}
              <span className={record.is_overdue ? "font-medium text-rose-700" : "text-ink-800"}>
                {record.is_overdue
                  ? `${formatDate(record.due_date)} · ${record.days_overdue} day(s) late`
                  : formatDate(record.due_date)}
              </span>
            </span>
          </div>
          <div className="mt-4">
            <Notice tone="info">
              The downloadable copy carries the itemised lines. Only what you approved on the
              estimate is ever charged, so anything here that you did not approve is worth a phone
              call.
            </Notice>
          </div>
        </Card>

        <Card>
          <CardHeader title="Settle it" />
          <p className="text-sm text-ink-600">
            {record.balance > 0
              ? `${formatMoney(record.balance)} is still owed on this invoice.`
              : "This invoice is settled."}
          </p>
          <div className="mt-4">
            <Button
              variant="primary"
              disabled={!payable}
              onClick={() => setPaying(true)}
              className="w-full"
            >
              {record.balance > 0 ? `Pay ${formatMoney(record.balance)}` : "Nothing to pay"}
            </Button>
          </div>
          <p className="mt-3 text-xs text-ink-500">
            Paying here moves the same balance the counter would move. A bill is settled only by
            money arriving, so it can never say it was paid when nothing was taken.
          </p>
        </Card>
      </div>

      <PayModal
        open={paying}
        invoice={record}
        onClose={() => setPaying(false)}
        onPaid={() => {
          setPaying(false);
          invoice.refetch();
        }}
      />
    </>
  );
}

function PayModal({
  open,
  invoice,
  onClose,
  onPaid,
}: {
  open: boolean;
  invoice: PortalInvoice;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [maxAmount, setMaxAmount] = useState<number | null>(null);
  const form = useForm({
    amount: invoice.balance > 0 ? invoice.balance.toFixed(2) : "",
    method: "CARD",
    reference: "",
    notes: "",
  });

  const pay = useApiMutation(() =>
    portalApi.payInvoice(invoice.id, {
      amount: Number(form.values.amount),
      method: form.values.method,
      reference: form.values.reference || null,
      notes: form.values.notes || null,
    }),
  );

  const needsReference = REFERENCE_REQUIRED_METHODS.has(form.values.method);
  const amount = Number(form.values.amount);
  const overpaying = amount > invoice.balance;

  async function submit() {
    if (!(amount > 0)) return;
    if (needsReference && !form.values.reference.trim()) return;
    const result = await pay.run();
    if (result) {
      form.reset();
      setMaxAmount(null);
      onPaid();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Settle ${invoice.invoice_number}`}
      description={`${formatMoney(invoice.balance)} outstanding.`}
      footer={
        <>
          <Button onClick={onClose} disabled={pay.pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            pending={pay.pending}
            disabled={overpaying || (needsReference && !form.values.reference.trim())}
            onClick={() => void submit()}
          >
            Pay
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
        <FormError error={pay.error} />

        <Field
          label="How much"
          required
          error={overpaying ? `That is more than the ${formatMoney(invoice.balance)} owed. Pay the balance or less.` : null}
          hint="A bill can be settled in part — the rest simply stays owed."
        >
          <Input
            type="number"
            step="0.01"
            min="0.01"
            max={maxAmount ?? invoice.balance}
            value={form.values.amount}
            onChange={(event) => {
              setMaxAmount(Number(event.target.value));
              form.set("amount", event.target.value);
            }}
          />
        </Field>
        <button
          type="button"
          className="text-xs font-medium text-brand-700 hover:underline"
          onClick={() => form.set("amount", invoice.balance.toFixed(2))}
        >
          Pay the full balance
        </button>

        <Field label="How are you paying">
          <Select
            value={form.values.method}
            onChange={(event) => form.set("method", event.target.value)}
          >
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {method.replace("_", " ").toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>

        {needsReference ? (
          <Field
            label="Reference"
            required
            hint="A transfer or cheque with no reference cannot be matched to a statement, so the shop has to have one."
          >
            <Input
              value={form.values.reference}
              onChange={(event) => form.set("reference", event.target.value)}
              placeholder="Sort code and account, or the cheque number"
            />
          </Field>
        ) : null}

        <Field label="Anything to add">
          <Textarea
            rows={2}
            value={form.values.notes}
            onChange={(event) => form.set("notes", event.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}