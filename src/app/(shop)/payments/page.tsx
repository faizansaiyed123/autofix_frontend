"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { BarList } from "@/components/charts/Chart";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, KeyValue } from "@/components/ui/Card";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Field, FormError, Input, Select, Textarea, useForm } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader, SearchInput, StatTile, Toolbar } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { useReferences } from "@/components/layout/ReferenceProvider";
import { invoicesApi, paymentsApi } from "@/lib/api/money";
import type { Invoice, Payment } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { PAYMENT_METHODS, REFERENCE_REQUIRED_METHODS } from "@/lib/status";

/**
 * The till.
 *
 * Voids are counted on their own line rather than netted away. A day with a bad
 * afternoon at the counter should read as a bad afternoon, not as a slightly
 * quiet one; the net figure is what the bank will agree with, but it is not what
 * happened.
 *
 * A payment is an event, not a document. There is no edit and no delete here —
 * a wrong one is voided with a reason and the row survives, because "we took
 * 400 and it should have been 40" is a fact about the day worth keeping.
 */
export default function PaymentsPage() {
  const { can } = useSession();
  const { userName, customerLabel } = useReferences();
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [voiding, setVoiding] = useState<string | null>(null);

  const range = {
    start_date: startDate || undefined,
    end_date: endDate || undefined,
  };

  const list = useApiQuery(
    () =>
      paymentsApi.list({
        page,
        size: 25,
        method: method || undefined,
        status: status || undefined,
        search: search || undefined,
        ...range,
      }),
    [page, search, method, status, startDate, endDate],
  );

  const summary = useApiQuery(
    () => paymentsApi.summary(range),
    [startDate, endDate],
  );

  /**
   * A payment record carries no customer, so the name is read off the invoice it
   * belongs to. Fetching the distinct invoices on this page rather than every
   * invoice keeps that to a handful of requests, and the lookup is keyed so a
   * bill settled twice costs one request rather than two.
   */
  const invoiceIds = useMemo(
    () => Array.from(new Set((list.data?.data ?? []).map((payment) => payment.invoice_id))),
    [list.data],
  );
  const invoiceKey = invoiceIds.join(",");
  const invoices = useApiQuery<Record<string, Invoice>>(
    () =>
      Promise.all(invoiceIds.map((id) => invoicesApi.get(id))).then((rows) =>
        Object.fromEntries(rows.map((row) => [row.id, row])),
      ),
    [invoiceKey],
    { enabled: invoiceIds.length > 0 && can("invoices:read") },
  );

  const selectedPayment = list.data?.data.find((p) => p.id === selected) ?? null;
  const totals = summary.data?.totals;

  const columns: Column<Payment>[] = [
    {
      key: "date",
      header: "Date",
      numeric: true,
      render: (p) => <span className="text-xs text-ink-600">{formatDate(p.payment_date)}</span>,
    },
    {
      key: "invoice",
      header: "Invoice",
      render: (p) => {
        const invoice = invoices.data?.[p.invoice_id];
        return (
          <Link
            href={`/invoices/${p.invoice_id}`}
            className="font-medium text-brand-700 hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {invoice?.invoice_number ?? "Open the bill"}
          </Link>
        );
      },
    },
    {
      key: "customer",
      header: "Customer",
      render: (p) => {
        const invoice = invoices.data?.[p.invoice_id];
        if (!invoice) return <span className="text-ink-400">—</span>;
        return <span className="text-sm">{customerLabel(invoice.customer_id)}</span>;
      },
    },
    {
      key: "amount",
      header: "Amount",
      numeric: true,
      render: (p) =>
        p.status === "VOID" ? (
          <span className="text-ink-400 line-through">{formatMoney(p.amount)}</span>
        ) : (
          <span className="font-semibold text-ink-900">{formatMoney(p.amount)}</span>
        ),
    },
    {
      key: "method",
      header: "Method",
      render: (p) => <span className="text-xs text-ink-700">{p.method}</span>,
    },
    {
      key: "reference",
      header: "Reference",
      render: (p) =>
        p.reference ? (
          <span className="text-xs text-ink-600">{p.reference}</span>
        ) : REFERENCE_REQUIRED_METHODS.has(p.method) ? (
          <span className="text-xs text-amber-700">Missing</span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: "by",
      header: "Recorded by",
      render: (p) => <span className="text-xs text-ink-600">{userName(p.recorded_by_id)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle={list.data ? `${list.data.meta.total} recorded` : "The till"}
      />

      {summary.error ? (
        <div className="mb-4">
          <ErrorState error={summary.error} onRetry={summary.refetch} />
        </div>
      ) : summary.loading && summary.initial ? (
        <Loading label="Counting the till…" />
      ) : totals ? (
        <>
          <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatTile
              label="Received"
              value={formatMoney(totals.total_received)}
              hint={`${formatNumber(totals.payment_count)} payment(s) taken`}
            />
            <StatTile
              label="Voided"
              value={formatMoney(totals.total_voided)}
              hint={`${formatNumber(totals.void_count)} reversed`}
              tone={totals.void_count > 0 ? "warning" : "neutral"}
            />
            <StatTile
              label="Net received"
              value={formatMoney(totals.net_received)}
              hint="What the bank will agree with"
              tone="success"
            />
            <StatTile label="Payments" value={formatNumber(totals.payment_count)} />
            <StatTile
              label="Voids"
              value={formatNumber(totals.void_count)}
              tone={totals.void_count > 0 ? "warning" : "neutral"}
            />
          </div>
          <Notice tone="info">
            A voided payment is counted separately, never folded into the received figure: a reversal
            is something that happened at the till, so a bad afternoon shows up as itself instead of
            quietly making the day look quieter than it was.
          </Notice>
        </>
      ) : null}

      <Card className="mt-4" padded={false}>
        <Toolbar>
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Bank or till reference"
            className="min-w-56 flex-1"
          />
          <Field label="Method" className="w-44">
            <Select
              value={method}
              onChange={(event) => {
                setMethod(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Any method</option>
              {PAYMENT_METHODS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" className="w-40">
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Any status</option>
              <option value="RECORDED">Recorded</option>
              <option value="VOID">Void</option>
            </Select>
          </Field>
          <Field label="From" className="w-40">
            <Input
              type="date"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                setPage(1);
              }}
            />
          </Field>
          <Field label="To" className="w-40">
            <Input
              type="date"
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value);
                setPage(1);
              }}
            />
          </Field>
        </Toolbar>

        {list.loading && list.initial ? (
          <Loading label="Reading the till…" />
        ) : list.error ? (
          <div className="p-4">
            <ErrorState error={list.error} onRetry={list.refetch} />
          </div>
        ) : !list.data || list.data.data.length === 0 ? (
          <EmptyState
            title="No payments here"
            description="Payments appear as they are recorded against an invoice at the till."
          />
        ) : (
          <>
            <DataTable
              rows={list.data.data}
              columns={columns}
              rowKey={(p) => p.id}
              onRowClick={(p) => setSelected(p.id)}
              dense
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

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="By method" subtitle="Received in this period, net of reversals" />
          {totals ? (
            Object.keys(totals.by_method).length === 0 ? (
              <EmptyState title="Nothing taken yet" />
            ) : (
              <BarList
                format={(value) => formatMoney(value)}
                items={Object.entries(totals.by_method).map(([key, value]) => ({
                  label: key,
                  value,
                }))}
              />
            )
          ) : (
            <Loading label="Reading the till…" />
          )}
        </Card>

        <Card>
          <CardHeader title="A payment is an event" subtitle="What the till does and does not do" />
          <ul className="space-y-2 text-sm text-ink-700">
            <li>
              Nothing here can be edited or deleted. A payment that turns out to be wrong is voided
              with a reason, and the row stays as the record of what happened.
            </li>
            <li>
              Voiding twice changes nothing — the row is already void, so there is no second reversal
              to make.
            </li>
            <li>
              A bank transfer or cheque carries a reference. Money that leaves no paper trail cannot
              be matched to a statement, so the till will not accept it without one.
            </li>
          </ul>
        </Card>
      </div>

      {selected ? (
        <PaymentDetailModal
          paymentId={selected}
          invoice={invoices.data?.[selectedPayment?.invoice_id ?? ""]}
          canRefund={can("payments:refund")}
          onClose={() => setSelected(null)}
          onVoidRequested={(id) => setVoiding(id)}
        />
      ) : null}

      {voiding ? (
        <VoidPaymentModal
          paymentId={voiding}
          onClose={() => setVoiding(null)}
          onVoided={() => {
            setVoiding(null);
            setSelected(null);
            list.refetch();
            summary.refetch();
          }}
        />
      ) : null}
    </>
  );
}

function PaymentDetailModal({
  paymentId,
  invoice,
  canRefund,
  onClose,
  onVoidRequested,
}: {
  paymentId: string;
  invoice: Invoice | undefined;
  canRefund: boolean;
  onClose: () => void;
  onVoidRequested: (id: string) => void;
}) {
  const { userName } = useReferences();
  const query = useApiQuery(() => paymentsApi.get(paymentId), [paymentId]);

  if (query.loading && query.initial) {
    return (
      <Modal open onClose={onClose} title="Payment">
        <Loading />
      </Modal>
    );
  }
  if (query.error) {
    return (
      <Modal open onClose={onClose} title="Payment">
        <ErrorState error={query.error} onRetry={query.refetch} />
      </Modal>
    );
  }
  const payment = query.data;
  if (!payment) return null;

  const alreadyVoid = payment.status === "VOID";

  return (
    <Modal
      open
      onClose={onClose}
      title="Payment"
      description={
        invoice
          ? `Against ${invoice.invoice_number} · balance ${formatMoney(invoice.balance)}`
          : "Recorded against an invoice"
      }
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          {canRefund && !alreadyVoid ? (
            <Button variant="danger" onClick={() => onVoidRequested(payment.id)}>
              Void payment
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          <KeyValue label="Amount">
            <span className={alreadyVoid ? "text-ink-400 line-through" : "font-semibold"}>
              {formatMoney(payment.amount)}
            </span>
          </KeyValue>
          <KeyValue label="Status">
            <StatusBadge status={payment.status} />
          </KeyValue>
          <KeyValue label="Method">{payment.method}</KeyValue>
          <KeyValue label="Date">{formatDate(payment.payment_date)}</KeyValue>
          <KeyValue label="Reference">
            {payment.reference ?? (
              <span className="text-ink-400">
                {REFERENCE_REQUIRED_METHODS.has(payment.method)
                  ? "Missing — this method should have had one"
                  : "None"}
              </span>
            )}
          </KeyValue>
          <KeyValue label="Recorded by">{userName(payment.recorded_by_id)}</KeyValue>
        </dl>

        {payment.notes ? (
          <div>
            <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Notes</p>
            <p className="mt-1 text-sm text-ink-700">{payment.notes}</p>
          </div>
        ) : null}

        {payment.void_reason ? (
          <Notice tone="danger">
            Voided {formatDate(payment.voided_at)} — {payment.void_reason}
          </Notice>
        ) : null}

        {alreadyVoid ? (
          <Notice tone="info">
            This payment has already been voided. Voiding it again would change nothing, so the
            control is not offered.
          </Notice>
        ) : !canRefund ? (
          <Notice tone="info">
            Reversing a payment is a shop decision about what leaves the till, so it is held on its
            own permission rather than on the one that takes the money.
          </Notice>
        ) : (
          <Notice tone="info">
            A payment cannot be edited or deleted. If this one is wrong, void it with a reason: the
            row stays, the money goes back on the invoice&apos;s balance, and the day still counts it.
          </Notice>
        )}
      </div>
    </Modal>
  );
}

function VoidPaymentModal({
  paymentId,
  onClose,
  onVoided,
}: {
  paymentId: string;
  onClose: () => void;
  onVoided: () => void;
}) {
  const form = useForm({ reason: "" });
  const voidPayment = useApiMutation((reason: string) => paymentsApi.void(paymentId, reason));

  async function submit() {
    if (form.missing(["reason"]).length > 0) return;
    const done = await voidPayment.run(form.values.reason.trim());
    if (done) {
      form.reset();
      onVoided();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Void this payment"
      description="The money goes back on the invoice's balance and the row stays on the record."
      footer={
        <>
          <Button onClick={onClose} disabled={voidPayment.pending}>
            Cancel
          </Button>
          <Button variant="danger" pending={voidPayment.pending} onClick={() => void submit()}>
            Void payment
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
        <FormError error={voidPayment.error} />
        <Field label="Reason" required hint="Why the payment is being reversed.">
          <Textarea
            rows={3}
            value={form.values.reason}
            onChange={(event) => form.set("reason", event.target.value)}
          />
        </Field>
        <Notice tone="info">
          A payment cannot be edited or deleted. Voiding it is the only reversal there is, and the
          reason is kept against the row.
        </Notice>
      </form>
    </Modal>
  );
}
