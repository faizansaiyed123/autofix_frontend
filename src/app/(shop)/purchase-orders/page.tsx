"use client";

import { useState } from "react";

import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, KeyValue } from "@/components/ui/Card";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Field, FormError, Input, Select, Textarea, useForm } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader, StatTile, Toolbar } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { inventoryApi, purchaseOrdersApi, suppliersApi } from "@/lib/api/stock";
import type { PurchaseOrder, PurchaseOrderItem } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { PURCHASE_ORDER_STATUSES } from "@/lib/status";

/**
 * The order book.
 *
 * An order walks DRAFT → SENT → (PARTIALLY_RECEIVED) → RECEIVED, and only the
 * receiving step moves it past SENT: PARTIALLY_RECEIVED and RECEIVED are facts
 * about goods that arrived, so there is no control here that names them. Sending
 * freezes the lines, because the supplier may already hold the goods and a
 * correction is then a cancellation and a new order, not an edit.
 *
 * The detail is rendered here rather than on another screen because receiving is
 * a bench job: the person holding the delivery note is standing at this list.
 */
export default function PurchaseOrdersPage() {
  const { can } = useSession();
  const [status, setStatus] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  const summary = useApiQuery(() => purchaseOrdersApi.summary(), []);
  const suppliers = useApiQuery(
    () => suppliersApi.active(),
    [],
    { enabled: can("suppliers:read") },
  );

  const query = useApiQuery(
    () =>
      purchaseOrdersApi.list({
        page,
        size: 25,
        status: status || undefined,
        supplier_id: supplierId || undefined,
        overdue_only: overdueOnly,
      }),
    [page, status, supplierId, overdueOnly],
  );

  const columns: Column<PurchaseOrder>[] = [
    {
      key: "po_number",
      header: "PO number",
      render: (po) => (
        <button
          type="button"
          className="font-medium text-brand-700 hover:underline"
          onClick={(event) => {
            event.stopPropagation();
            setSelected(po.id);
          }}
        >
          {po.po_number}
        </button>
      ),
    },
    {
      key: "supplier",
      header: "Supplier",
      render: (po) => <span className="text-sm">{po.supplier_name ?? "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (po) => <StatusBadge status={po.status} />,
    },
    {
      key: "order_date",
      header: "Ordered",
      numeric: true,
      render: (po) => <span className="text-xs text-ink-600">{formatDate(po.order_date)}</span>,
    },
    {
      key: "expected",
      header: "Expected",
      numeric: true,
      render: (po) =>
        po.is_overdue ? (
          <span className="text-xs font-semibold text-rose-700">
            {formatDate(po.expected_delivery_date)} · late
          </span>
        ) : (
          <span className="text-xs text-ink-600">{formatDate(po.expected_delivery_date)}</span>
        ),
    },
    {
      key: "units",
      header: "Units",
      numeric: true,
      render: (po) => (
        <span className="text-xs text-ink-600">
          {formatNumber(po.total_units_received)} / {formatNumber(po.total_units_ordered)}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      numeric: true,
      render: (po) => formatMoney(po.total_amount, po.currency),
    },
  ];

  return (
    <>
      <PageHeader
        title="Purchase orders"
        subtitle={query.data ? `${query.data.meta.total} in the order book` : "What the shop has on order"}
      />

      {summary.error ? (
        <div className="mb-4">
          <ErrorState error={summary.error} onRetry={summary.refetch} />
        </div>
      ) : summary.loading && summary.initial ? (
        <Loading label="Reading the order book…" />
      ) : summary.data ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Orders" value={formatNumber(summary.data.total_orders)} />
          <StatTile
            label="Drafts"
            value={formatNumber(summary.data.draft_orders)}
            hint="Not sent yet, still editable"
            tone={summary.data.draft_orders > 0 ? "info" : "neutral"}
          />
          <StatTile
            label="Open"
            value={formatNumber(summary.data.open_orders)}
            hint="Sent and not yet fully received"
            tone={summary.data.open_orders > 0 ? "warning" : "neutral"}
          />
          <StatTile
            label="Overdue"
            value={formatNumber(summary.data.overdue_orders)}
            tone={summary.data.overdue_orders > 0 ? "danger" : "neutral"}
            hint="Past the expected delivery date"
          />
          <StatTile
            label="Committed"
            value={formatMoney(summary.data.total_committed)}
            hint="Money promised to suppliers"
          />
          <StatTile
            label="Received value"
            value={formatMoney(summary.data.total_received_value)}
            tone="success"
            hint="Goods actually booked in"
          />
          <StatTile label="Received" value={formatNumber(summary.data.received_orders)} />
          <StatTile label="Cancelled" value={formatNumber(summary.data.cancelled_orders)} />
        </div>
      ) : null}

      <Card padded={false}>
        <Toolbar>
          <Field label="Status" className="w-52">
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Any status</option>
              {PURCHASE_ORDER_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Supplier" className="w-64">
            <Select
              value={supplierId}
              onChange={(event) => {
                setSupplierId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Every supplier</option>
              {(suppliers.data ?? []).map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(event) => {
                setOverdueOnly(event.target.checked);
                setPage(1);
              }}
              className="size-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            Past the expected date
          </label>
        </Toolbar>

        {query.loading && query.initial ? (
          <Loading />
        ) : query.error ? (
          <div className="p-4">
            <ErrorState error={query.error} onRetry={query.refetch} />
          </div>
        ) : !query.data || query.data.data.length === 0 ? (
          <EmptyState
            title="No purchase orders match that"
            description="Orders are raised by the parts desk — from the low-stock list or by hand."
          />
        ) : (
          <>
            <DataTable
              rows={query.data.data}
              columns={columns}
              rowKey={(po) => po.id}
              onRowClick={(po) => setSelected(po.id)}
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

      <Notice tone="info">
        An order has no status picker. SENT is the desk sending it, CANCELLED is the desk calling it
        off, and PARTIALLY_RECEIVED or RECEIVED are reached only by booking a delivery in — because
        those two mean goods physically arrived.
      </Notice>

      {selected ? (
        <OrderModal
          orderId={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            query.refetch();
            summary.refetch();
          }}
        />
      ) : null}
    </>
  );
}

/**
 * `StockLevel` is not in `@/lib/api/types` yet. It is unpaginated over the whole
 * catalog, which makes it the one call that can back a part picker without a
 * hundred-row ceiling.
 */
interface PartOption {
  part_id: string;
  part_number: string;
  name: string;
  unit_cost: number;
}

function qty(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

const LINE_COLUMNS: Column<PurchaseOrderItem>[] = [
  {
    key: "line_number",
    header: "#",
    numeric: true,
    render: (item) => <span className="text-xs text-ink-500">{item.line_number}</span>,
  },
  {
    key: "part_number",
    header: "Part number",
    render: (item) => (
      <span className="text-sm font-medium text-ink-900">{item.part_number}</span>
    ),
  },
  {
    key: "part_name",
    header: "Part",
    render: (item) => <span className="text-sm text-ink-700">{item.part_name}</span>,
  },
  {
    key: "ordered",
    header: "Ordered",
    numeric: true,
    render: (item) => qty(item.quantity_ordered),
  },
  {
    key: "received",
    header: "Received",
    numeric: true,
    render: (item) => (
      <span className={item.quantity_received > 0 ? "text-emerald-700" : "text-ink-400"}>
        {qty(item.quantity_received)}
      </span>
    ),
  },
  {
    key: "outstanding",
    header: "Outstanding",
    numeric: true,
    render: (item) =>
      item.quantity_outstanding > 0 ? (
        <span className="font-medium text-amber-700">{qty(item.quantity_outstanding)}</span>
      ) : (
        <span className="text-ink-400">0</span>
      ),
    },
  {
    key: "unit_cost",
    header: "Unit cost",
    numeric: true,
    render: (item) => formatMoney(item.unit_cost),
  },
  {
    key: "line_total",
    header: "Line total",
    numeric: true,
    render: (item) => formatMoney(item.line_total),
  },
];

function OrderModal({
  orderId,
  onClose,
  onChanged,
}: {
  orderId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { can } = useSession();
  const query = useApiQuery(() => purchaseOrdersApi.get(orderId), [orderId]);
  const [cancelling, setCancelling] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [addingLine, setAddingLine] = useState(false);

  const order = query.data;
  const writable = can("purchase_orders:write");

  const send = useApiMutation(() => purchaseOrdersApi.send(orderId));
  const removeItem = useApiMutation((itemId: string) =>
    purchaseOrdersApi.removeItem(orderId, itemId),
  );

  const canSend = !!order && writable && order.status === "DRAFT" && order.item_count > 0;
  const canCancel = !!order && writable && !order.is_terminal;
  const canBookIn = canReceive(order);

  async function doSend() {
    const done = await send.run();
    if (done) {
      query.refetch();
      onChanged();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={order?.po_number ?? "Purchase order"}
      description={
        order
          ? `${order.supplier_name ?? "Supplier"} · ordered ${formatDate(order.order_date)}`
          : undefined
      }
      width="max-w-3xl"
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          {writable ? (
            <>
              <Button
                variant="secondary"
                disabled={!canSend}
                title={
                  order && order.status !== "DRAFT"
                    ? "Only a draft can be sent — a sent order is with the supplier."
                    : order && order.item_count === 0
                      ? "An order with no lines commits the shop to nothing."
                      : "Send this order to the supplier"
                }
                pending={send.pending}
                onClick={() => void doSend()}
              >
                Send
              </Button>
              <Button
                variant="danger"
                disabled={!canCancel}
                title={
                  order?.is_terminal
                    ? "This order is closed; it accepts nothing further."
                    : "Call this order off"
                }
                onClick={() => setCancelling(true)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!canBookIn}
                title={receiveBlockedReason(order)}
                onClick={() => setReceiving(true)}
              >
                Receive
              </Button>
            </>
          ) : null}
        </>
      }
    >
      {query.loading && query.initial ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : !order ? (
        <EmptyState title="Order not found" />
      ) : (
        <div className="space-y-4">
          {send.error ? <FormError error={send.error} /> : null}
          {removeItem.error ? <FormError error={removeItem.error} /> : null}

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={order.status} />
            {order.is_editable ? (
              <Badge tone="info">Draft — the lines can still be changed</Badge>
            ) : (
              <Badge tone="neutral">
                {order.status === "SENT" || order.status === "PARTIALLY_RECEIVED"
                  ? "Sent — the lines are frozen"
                  : "Closed"}
              </Badge>
            )}
            {order.is_overdue ? <Badge tone="danger">Past the expected date</Badge> : null}
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <KeyValue label="Subtotal">{formatMoney(order.subtotal, order.currency)}</KeyValue>
            <KeyValue label="Tax">{formatMoney(order.tax_amount, order.currency)}</KeyValue>
            <KeyValue label="Shipping">
              {formatMoney(order.shipping_amount, order.currency)}
            </KeyValue>
            <KeyValue label="Total">
              <span className="font-semibold">{formatMoney(order.total_amount, order.currency)}</span>
            </KeyValue>
            <KeyValue label="Expected">{formatDate(order.expected_delivery_date)}</KeyValue>
            <KeyValue label="Sent">{formatDate(order.sent_at)}</KeyValue>
            <KeyValue label="Units received">
              {formatNumber(order.total_units_received)} / {formatNumber(order.total_units_ordered)}
            </KeyValue>
            <KeyValue label="Lines">{formatNumber(order.item_count)}</KeyValue>
          </dl>

          {order.cancel_reason ? (
            <Notice tone="danger">Cancelled — {order.cancel_reason}</Notice>
          ) : null}

          <Notice tone="info">
            Only a draft is editable. Once sent, the supplier may already hold the goods, so a
            correction is cancelling the order and raising another rather than editing this one.
          </Notice>

          <div>
            <CardHeader
              title="Lines"
              subtitle={`${order.items.length} line(s)`}
              actions={
                order.is_editable && writable ? (
                  <Button size="sm" variant="primary" onClick={() => setAddingLine(true)}>
                    Add a line
                  </Button>
                ) : null
              }
            />
            {order.items.length === 0 ? (
              <EmptyState
                title="No lines"
                description="An order with nothing on it is not an order, and the API refuses to raise one."
              />
            ) : (
              <DataTable
                rows={order.items}
                columns={
                  order.is_editable && writable
                    ? [
                        ...LINE_COLUMNS,
                        {
                          key: "actions",
                          header: "",
                          numeric: true,
                          render: (item: PurchaseOrderItem) => (
                            <button
                              type="button"
                              className="text-xs text-rose-700 hover:underline"
                              disabled={removeItem.pending}
                              onClick={() =>
                                void removeItem.run(item.id).then(() => query.refetch())
                              }
                            >
                              Remove
                            </button>
                          ),
                        },
                      ]
                    : LINE_COLUMNS
                }
                rowKey={(item) => item.id}
                dense
              />
            )}
          </div>

          {addingLine ? (
            <AddLineModal
              order={order}
              onClose={() => setAddingLine(false)}
              onAdded={() => {
                setAddingLine(false);
                query.refetch();
              }}
            />
          ) : null}

          {cancelling ? (
            <CancelModal
              order={order}
              onClose={() => setCancelling(false)}
              onCancelled={() => {
                setCancelling(false);
                query.refetch();
                onChanged();
              }}
            />
          ) : null}

          {receiving ? (
            <ReceiveModal
              order={order}
              onClose={() => setReceiving(false)}
              onReceived={() => {
                setReceiving(false);
                query.refetch();
                onChanged();
              }}
            />
          ) : null}
        </div>
      )}
    </Modal>
  );
}

function canReceive(order: PurchaseOrder | null): boolean {
  if (!order) return false;
  if (order.status !== "SENT" && order.status !== "PARTIALLY_RECEIVED") return false;
  return order.items.some((item) => item.quantity_outstanding > 0);
}

function receiveBlockedReason(order: PurchaseOrder | null): string {
  if (!order) return "Nothing loaded.";
  if (order.status === "DRAFT") return "Send the order to the supplier before booking anything in.";
  if (order.status === "RECEIVED") return "This order is fully received.";
  if (order.status === "CANCELLED") return "A cancelled order takes no delivery.";
  if (!order.items.some((item) => item.quantity_outstanding > 0))
    return "Every line on this order has already been received.";
  return "Book a delivery in against this order";
}

function AddLineModal({
  order,
  onClose,
  onAdded,
}: {
  order: PurchaseOrder;
  onClose: () => void;
  onAdded: () => void;
}) {
  const catalog = useApiQuery<PartOption[]>(
    () => inventoryApi.stockLevels() as Promise<PartOption[]>,
    [],
  );
  const form = useForm({ part_id: "", quantity_ordered: "1", unit_cost: "", notes: "" });
  const addItem = useApiMutation((body: Record<string, unknown>) =>
    purchaseOrdersApi.addItem(order.id, body),
  );

  // The same part twice would make the receipt maths ambiguous, so the parts
  // already on the order are not offered.
  const taken = new Set(order.items.map((item) => item.part_id));
  const options = (catalog.data ?? []).filter((part) => !taken.has(part.part_id));
  const chosen = options.find((part) => part.part_id === form.values.part_id);
  const quantity = Number(form.values.quantity_ordered);

  async function submit() {
    if (!form.values.part_id || !(quantity > 0)) return;
    const added = await addItem.run({
      part_id: form.values.part_id,
      quantity_ordered: quantity,
      unit_cost:
        form.values.unit_cost === ""
          ? (chosen?.unit_cost ?? 0)
          : Number(form.values.unit_cost) || 0,
      notes: form.values.notes || null,
    });
    if (added) {
      form.reset();
      onAdded();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add a line"
      description="Only while the order is a draft. Sending freezes the lines."
      footer={
        <>
          <Button onClick={onClose} disabled={addItem.pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            pending={addItem.pending}
            disabled={!form.values.part_id || !(quantity > 0)}
            onClick={() => void submit()}
          >
            Add line
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
        <FormError error={addItem.error} />

        <Field label="Part" required>
          {catalog.loading && catalog.initial ? (
            <Input value="Loading…" disabled readOnly />
          ) : (
            <Select
              value={form.values.part_id}
              onChange={(event) => form.set("part_id", event.target.value)}
            >
              <option value="">Choose a part</option>
              {options.map((part) => (
                <option key={part.part_id} value={part.part_id}>
                  {part.part_number} · {part.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Quantity" required>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.values.quantity_ordered}
              onChange={(event) => form.set("quantity_ordered", event.target.value)}
            />
          </Field>
          <Field
            label="Unit cost"
            hint={chosen ? `Catalog cost ${formatMoney(chosen.unit_cost)}.` : "What the supplier quoted."}
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.values.unit_cost}
              placeholder={chosen ? String(chosen.unit_cost) : "0.00"}
              onChange={(event) => form.set("unit_cost", event.target.value)}
            />
          </Field>
        </div>

        <Field label="Notes">
          <Input
            value={form.values.notes}
            onChange={(event) => form.set("notes", event.target.value)}
          />
        </Field>

        <Notice tone="info">
          The unit cost here is what this supplier quoted, not the catalog cost. A purchase order is
          an agreement with one supplier at one price, and the catalog is a separate fact that the
          order must not overwrite.
        </Notice>
      </form>
    </Modal>
  );
}

function CancelModal({
  order,
  onClose,
  onCancelled,
}: {
  order: PurchaseOrder;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const form = useForm({ reason: "" });
  const cancel = useApiMutation((reason: string) =>
    purchaseOrdersApi.cancel(order.id, reason || undefined),
  );

  async function submit() {
    const done = await cancel.run(form.values.reason.trim());
    if (done) {
      form.reset();
      onCancelled();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Cancel this purchase order"
      description="The paperwork ends; goods already on the shelf do not go back."
      footer={
        <>
          <Button onClick={onClose} disabled={cancel.pending}>
            Keep the order
          </Button>
          <Button variant="danger" pending={cancel.pending} onClick={() => void submit()}>
            Cancel order
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
        <Field label="Reason" hint="Optional, but it is what the next person will read.">
          <Textarea
            rows={3}
            value={form.values.reason}
            onChange={(event) => form.set("reason", event.target.value)}
          />
        </Field>
        <Notice tone="info">
          Cancelling a partly received order does not un-buy what is already on the shelf: those
          parts were paid for and the ledger keeps them. Only the order closes.
        </Notice>
      </form>
    </Modal>
  );
}

function ReceiveModal({
  order,
  onClose,
  onReceived,
}: {
  order: PurchaseOrder;
  onClose: () => void;
  onReceived: () => void;
}) {
  const outstanding = order.items.filter((item) => item.quantity_outstanding > 0);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [costs, setCosts] = useState<Record<string, string>>({});
  const notesForm = useForm({ notes: "" });
  const receive = useApiMutation(
    (items: { item_id: string; quantity: number; unit_cost?: number }[]) =>
      purchaseOrdersApi.receive(order.id, { items, notes: notesForm.values.notes || null }),
  );

  function quantityFor(item: PurchaseOrderItem): number {
    const raw = quantities[item.id];
    if (raw === undefined) return item.quantity_outstanding;
    return Number(raw) || 0;
  }

  const overOrdered = outstanding.find(
    (item) => quantityFor(item) > item.quantity_outstanding + 0.005,
  );
  const negative = outstanding.find((item) => quantityFor(item) < 0);
  const anyQuantity = outstanding.some((item) => quantityFor(item) > 0);
  const blocked =
    outstanding.length === 0 || !anyQuantity || !!overOrdered || !!negative || receive.pending;

  async function submit() {
    if (blocked) return;
    const items = outstanding
      .filter((item) => quantityFor(item) > 0)
      .map((item) => {
        const cost = costs[item.id];
        return {
          item_id: item.id,
          quantity: Number(quantityFor(item).toFixed(2)),
          ...(cost === undefined || cost === "" ? {} : { unit_cost: Number(cost) || 0 }),
        };
      });
    if (items.length === 0) return;
    const done = await receive.run(items);
    if (done) onReceived();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Book a delivery in"
      description={`${order.po_number} · ${order.supplier_name ?? "supplier"}`}
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose} disabled={receive.pending}>
            Cancel
          </Button>
          <Button variant="primary" pending={receive.pending} disabled={blocked} onClick={() => void submit()}>
            Receive
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
        <FormError error={receive.error} />

        <ul className="divide-y divide-ink-100 rounded-lg ring-1 ring-ink-200">
          {outstanding.map((item) => {
            const quantity = quantityFor(item);
            return (
              <li key={item.id} className="space-y-2 px-3 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm text-ink-900">{item.part_name}</p>
                  <p className="text-xs text-ink-500">
                    {item.part_number} · {qty(item.quantity_outstanding)} outstanding of{" "}
                    {qty(item.quantity_ordered)}
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <Field
                    label="Received now"
                    className="w-28"
                    error={
                      quantity < 0
                        ? "A quantity cannot be negative."
                        : quantity > item.quantity_outstanding + 0.005
                          ? "More than was ordered."
                          : null
                    }
                  >
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max={item.quantity_outstanding}
                      value={quantities[item.id] ?? String(item.quantity_outstanding)}
                      onChange={(event) =>
                        setQuantities((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field
                    label="Unit cost on this receipt"
                    className="w-44"
                    hint={`Ordered at ${formatMoney(item.unit_cost)}.`}
                  >
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Same as the order"
                      value={costs[item.id] ?? ""}
                      onChange={(event) =>
                        setCosts((current) => ({ ...current, [item.id]: event.target.value }))
                      }
                    />
                  </Field>
                </div>
              </li>
            );
          })}
        </ul>

        <Field label="Notes" hint="Optional — a delivery note number, a discrepancy.">
          <Input
            value={notesForm.values.notes}
            onChange={(event) => notesForm.set("notes", event.target.value)}
          />
        </Field>

        <Notice tone="info">
          A receipt may quote a different unit cost from the order: prices move, and what arrived is a
          fact. The catalog is left alone — only the ledger carries the cost of this delivery.
        </Notice>
        <Notice tone="info">
          Receiving books one ledger receipt per line, all in one transaction. If any line cannot be
          booked in, no stock moves at all.
        </Notice>
      </form>
    </Modal>
  );
}
