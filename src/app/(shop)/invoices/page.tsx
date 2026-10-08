"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Field, FormError, Input, Select, useForm } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader, SearchInput, Toolbar } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { useReferences } from "@/components/layout/ReferenceProvider";
import { invoicesApi } from "@/lib/api/money";
import { repairOrdersApi } from "@/lib/api/work";
import type { Invoice, RepairOrder } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { formatDate, formatMoney, todayIso } from "@/lib/format";
import { INVOICE_STATUSES } from "@/lib/status";

/**
 * The shop's invoice book.
 *
 * Money on a bill is not derived here: subtotal, discount, tax and total are the
 * backend's figures, rounded to cents in the service layer, and the outstanding
 * balance is a property of the total less what has been paid. Adding the rows up
 * in the browser to double-check them would be a second answer to a question that
 * already has one.
 *
 * Overdue is not a status. A bill is late when its due date has passed and money
 * is still owed, which is what the API's `is_overdue` and `days_overdue` say, so
 * the badge column never gains an OVERDUE that the record does not carry.
 */
export default function InvoicesPage() {
  const { can } = useSession();
  const router = useRouter();
  const { customerLabel, vehicleText } = useReferences();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [raising, setRaising] = useState(false);

  const query = useApiQuery(
    () =>
      invoicesApi.list({
        page,
        size: 25,
        status: status || undefined,
        overdue_only: overdueOnly,
        unpaid_only: unpaidOnly,
        search: search || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      }),
    [page, search, status, unpaidOnly, overdueOnly, startDate, endDate],
  );

  const columns: Column<Invoice>[] = [
    {
      key: "number",
      header: "Invoice",
      render: (i) => (
        <Link
          href={`/invoices/${i.id}`}
          className="font-medium text-brand-700 hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {i.invoice_number}
        </Link>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (i) => <span className="text-sm">{customerLabel(i.customer_id)}</span>,
    },
    {
      key: "vehicle",
      header: "Vehicle",
      render: (i) => <span className="text-sm text-ink-600">{vehicleText(i.vehicle_id)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (i) => <StatusBadge status={i.status} />,
    },
    {
      key: "invoiced",
      header: "Invoiced",
      numeric: true,
      render: (i) => <span className="text-xs text-ink-600">{formatDate(i.invoice_date)}</span>,
    },
    {
      key: "due",
      header: "Due",
      numeric: true,
      render: (i) =>
        i.is_overdue ? (
          <div className="text-right">
            <p className="text-xs font-semibold text-rose-700">{formatDate(i.due_date)}</p>
            <p className="text-xs text-rose-600">{i.days_overdue} day(s) late</p>
          </div>
        ) : (
          <span className="text-xs text-ink-600">{formatDate(i.due_date)}</span>
        ),
    },
    {
      key: "total",
      header: "Total",
      numeric: true,
      render: (i) => formatMoney(i.total),
    },
    {
      key: "paid",
      header: "Paid",
      numeric: true,
      render: (i) => <span className="text-ink-600">{formatMoney(i.amount_paid)}</span>,
    },
    {
      key: "balance",
      header: "Balance",
      numeric: true,
      render: (i) =>
        i.balance > 0 ? (
          <span className="font-semibold text-ink-900">{formatMoney(i.balance)}</span>
        ) : (
          <span className="text-ink-400">{formatMoney(i.balance)}</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle={query.data ? `${query.data.meta.total} in the book` : "The shop's bills"}
        actions={
          can("invoices:write") ? (
            <Button variant="primary" onClick={() => setRaising(true)}>
              Raise invoice
            </Button>
          ) : null
        }
      />

      <Card padded={false}>
        <Toolbar>
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Invoice number"
            className="min-w-56 flex-1"
          />
          <Field label="Status" className="w-44">
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Any status</option>
              {INVOICE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
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
          <Toggle
            label="Unpaid only"
            checked={unpaidOnly}
            onChange={(checked) => {
              setUnpaidOnly(checked);
              setPage(1);
            }}
          />
          <Toggle
            label="Overdue only"
            checked={overdueOnly}
            onChange={(checked) => {
              setOverdueOnly(checked);
              setPage(1);
            }}
          />
        </Toolbar>

        {query.loading && query.initial ? (
          <Loading label="Reading the invoice book…" />
        ) : query.error ? (
          <div className="p-4">
            <ErrorState error={query.error} onRetry={query.refetch} />
          </div>
        ) : !query.data || query.data.data.length === 0 ? (
          <EmptyState
            title={search || status ? "No invoice matches that" : "No invoices yet"}
            description="An invoice is raised against work that has passed quality control, so nothing appears here until QC has signed the job off."
          />
        ) : (
          <>
            <DataTable
              rows={query.data.data}
              columns={columns}
              rowKey={(i) => i.id}
              dense
            />
            <Pagination
              page={query.data.meta.page}
              pages={query.data.meta.pages}
              total={query.data.meta.total}
              onPage={setPage}
            />
          </>
        )}
      </Card>

      <RaiseInvoiceModal
        open={raising}
        onClose={() => setRaising(false)}
        onCreated={(id) => {
          setRaising(false);
          query.refetch();
          router.push(`/invoices/${id}`);
        }}
      />
    </>
  );
}

/** A checkbox the desk can read at a glance, rather than a styled switch. */
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-ink-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
      />
      {label}
    </label>
  );
}

function plusDaysIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

/** The charge types a shop-added line can be. Mirrors the API's invoice item enum. */
const LINE_TYPES = ["LABOR", "PART", "SERVICE", "FEE", "DISCOUNT"];

interface ExtraLine {
  description: string;
  item_type: string;
  quantity: string;
  unit_price: string;
  discount_amount: string;
}

const EMPTY_LINE: ExtraLine = {
  description: "",
  item_type: "LABOR",
  quantity: "1",
  unit_price: "",
  discount_amount: "0",
};

/** What the API would refuse about one extra charge, said before the round trip. */
function extraLineProblem(line: ExtraLine): string | null {
  if (line.description.trim() === "") return null;
  if (line.item_type !== "DISCOUNT" && !(Number(line.quantity) > 0))
    return "Quantity must be greater than zero.";
  if (!(Number(line.unit_price) > 0)) return "A charge needs a unit price above zero.";
  if (line.discount_amount.trim() !== "" && Number(line.discount_amount) < 0)
    return "A discount cannot be negative.";
  return null;
}

function RaiseInvoiceModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  // Only work that has been inspected can be billed, so the picker asks the API
  // for the two billable statuses rather than every repair order and filtering
  // client-side — a bill raised against an uninspected job is refused anyway.
  const billable = useApiQuery<RepairOrder[]>(
    () =>
      Promise.all([
        repairOrdersApi.list({ page: 1, size: 100, status: "QC_PASSED" }).then((p) => p.data),
        repairOrdersApi.list({ page: 1, size: 100, status: "DELIVERED" }).then((p) => p.data),
      ]).then(([passed, delivered]) => [...passed, ...delivered]),
    [],
    { enabled: open },
  );

  const form = useForm({
    repair_order_id: "",
    invoice_date: todayIso(),
    due_date: plusDaysIso(30),
    tax_percent: "8.25",
    notes: "",
  });
  const [lines, setLines] = useState<ExtraLine[]>([]);
  const create = useApiMutation((body: Parameters<typeof invoicesApi.create>[0]) =>
    invoicesApi.create(body),
  );

  function updateLine(index: number, patch: Partial<ExtraLine>) {
    setLines((current) =>
      current.map((line, position) => (position === index ? { ...line, ...patch } : line)),
    );
  }

  function addLine() {
    setLines((current) => [...current, { ...EMPTY_LINE }]);
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, position) => position !== index));
  }

  async function submit() {
    const missing = form.missing(["repair_order_id"]);
    if (missing.length > 0) return;

    const extra = lines
      .filter((line) => line.description.trim() !== "")
      .map((line) => ({
        item_type: line.item_type,
        description: line.description.trim(),
        quantity: line.item_type === "DISCOUNT" ? 1 : Number(line.quantity) || 0,
        unit_price: Number(line.unit_price) || 0,
        discount_amount: line.item_type === "DISCOUNT" ? 0 : Number(line.discount_amount) || 0,
      }));

    const bad = extra.find((line) => line.quantity <= 0 || line.unit_price <= 0);
    if (bad) return;
    const created = await create.run({
      repair_order_id: form.values.repair_order_id,
      invoice_date: form.values.invoice_date || null,
      due_date: form.values.due_date || null,
      tax_rate: (Number(form.values.tax_percent) || 0) / 100,
      notes: form.values.notes || null,
      extra_items: extra,
    });
    if (created) {
      form.reset();
      setLines([]);
      onCreated(created.id);
    }
  }

  const orders = billable.data ?? [];
  const invalid = lines.filter((line) => extraLineProblem(line) !== null);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Raise an invoice"
      description="Against work that has passed quality control."
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose} disabled={create.pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            pending={create.pending}
            disabled={invalid.length > 0}
            onClick={() => void submit()}
          >
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

        <Field label="Repair order" required hint="Only jobs that passed QC or were delivered.">
          {billable.loading && billable.initial ? (
            <Input value="Loading…" disabled readOnly />
          ) : (
            <Select
              value={form.values.repair_order_id}
              onChange={(event) => form.set("repair_order_id", event.target.value)}
            >
              <option value="">Choose a repair order</option>
              {orders.map((ro) => (
                <option key={ro.id} value={ro.id}>
                  {ro.ro_number} · {ro.status}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Notice tone="info">
          The estimate lines the customer approved are copied across automatically. They become
          frozen the moment the invoice is issued and cannot be changed afterwards — only the extra
          charges added here can be corrected, and only while the invoice is a draft.
        </Notice>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Invoice date">
            <Input
              type="date"
              value={form.values.invoice_date}
              onChange={(event) => form.set("invoice_date", event.target.value)}
            />
          </Field>
          <Field label="Due date" hint="Cannot be earlier than the invoice date.">
            <Input
              type="date"
              value={form.values.due_date}
              onChange={(event) => form.set("due_date", event.target.value)}
            />
          </Field>
          <Field label="Tax rate %" hint="Enter 8.25 for 8.25%.">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.values.tax_percent}
              onChange={(event) => form.set("tax_percent", event.target.value)}
            />
          </Field>
        </div>

        <Field label="Notes" hint="Internal — not shown on the customer's copy.">
          <Input
            value={form.values.notes}
            onChange={(event) => form.set("notes", event.target.value)}
          />
        </Field>

        <div className="rounded-lg ring-1 ring-ink-200">
          <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-3 py-2">
            <p className="text-xs font-semibold tracking-wide text-ink-600 uppercase">
              Extra shop charges
            </p>
            <Button size="sm" onClick={addLine}>
              Add a charge
            </Button>
          </div>
          {lines.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink-500">
              None. Work agreed at the counter can be added here as a manual line.
            </p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {lines.map((line, index) => (
                <li key={index} className="space-y-2 px-3 py-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
                    <Input
                      value={line.description}
                      placeholder="What was charged for"
                      onChange={(event) => updateLine(index, { description: event.target.value })}
                    />
                    <Select
                      value={line.item_type}
                      onChange={(event) => updateLine(index, { item_type: event.target.value })}
                    >
                      {LINE_TYPES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label="Qty" className="w-20">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.item_type === "DISCOUNT" ? "1" : line.quantity}
                        disabled={line.item_type === "DISCOUNT"}
                        onChange={(event) => updateLine(index, { quantity: event.target.value })}
                      />
                    </Field>
                    <Field label="Unit price" className="w-32">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.unit_price}
                        onChange={(event) => updateLine(index, { unit_price: event.target.value })}
                      />
                    </Field>
                    {line.item_type === "DISCOUNT" ? (
                      <p className="pb-2 text-xs text-ink-500">
                        A discount is one line of one amount; it cannot carry its own discount.
                      </p>
                    ) : (
                      <Field label="Discount" className="w-28">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.discount_amount}
                          onChange={(event) =>
                            updateLine(index, { discount_amount: event.target.value })
                          }
                        />
                      </Field>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => removeLine(index)}>
                      Remove
                    </Button>
                  </div>
                  {extraLineProblem(line) ? (
                    <p className="text-xs text-rose-700">{extraLineProblem(line)}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <Notice tone="info">
          The totals are derived by the server from the lines and the tax rate — the draft is created
          with them already calculated.
        </Notice>
      </form>
    </Modal>
  );
}
