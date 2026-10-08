"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, KeyValue } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Field, FormError, Input, Textarea, useForm } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader, StatTile } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { purchaseOrdersApi } from "@/lib/api/stock";
import type { PurchaseOrder, PurchaseOrderItem } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";

/**
 * One purchase order, with the three things that can happen to it.
 *
 * The lines are frozen the moment the order is sent, because the supplier may
 * already hold the goods — a correction is cancelling this order and raising
 * another, not editing a document that has left the building. RECEIVED and
 * PARTIALLY_RECEIVED are not statuses anyone picks here: they mean goods arrived,
 * so they are reached only by booking a delivery in.
 */
export default function PurchaseOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const { can } = useSession();
  const [cancelling, setCancelling] = useState(false);
  const [receiving, setReceiving] = useState(false);

  const query = useApiQuery(() => purchaseOrdersApi.get(orderId), [orderId]);

  const send = useApiMutation(() => purchaseOrdersApi.send(orderId));

  const order = query.data;
  const writable = can("purchase_orders:write");
  const canSend = !!order && writable && order.status === "DRAFT" && order.item_count > 0;
  const canCancel = !!order && writable && !order.is_terminal;
  const canBookIn = canReceive(order);

  async function doSend() {
    const done = await send.run();
    if (done) query.refetch();
  }

  if (query.loading && query.initial) return <Loading label="Reading the order…" />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} />;
  if (!order) return <ErrorState error={new Error("No order data")} />;

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href="/purchase-orders" className="hover:underline">
            Purchase orders
          </Link>
        }
        title={order.po_number}
        subtitle={`${order.supplier_name ?? "Supplier"} · ordered ${formatDate(order.order_date)}`}
        actions={
          <>
            <StatusBadge status={order.status} />
            {writable ? (
              <>
                <Button
                  variant="secondary"
                  disabled={!canSend}
                  title={
                    order.status !== "DRAFT"
                      ? "Only a draft can be sent — a sent order is with the supplier."
                      : order.item_count === 0
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
                    order.is_terminal
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
      />

      {order.is_overdue ? (
        <Notice tone="danger">
          This order was expected {formatDate(order.expected_delivery_date)} and has not been fully
          received. Chase the supplier, or cancel it and raise another.
        </Notice>
      ) : order.is_editable ? (
        <Notice tone="info">
          This order is a draft, so its lines can still be changed. Sending freezes them.
        </Notice>
      ) : (
        <Notice tone="info">
          Only a draft is editable. This order has been sent, so the lines are what the supplier was
          asked for; a correction is cancelling it and raising another.
        </Notice>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Lines" subtitle={`${order.items.length} line(s) on this order`} />
          {order.items.length === 0 ? (
            <EmptyState
              title="No lines"
              description="An order with nothing on it is not an order, and the API refuses to raise one."
            />
          ) : (
            <DataTable
              rows={order.items}
              columns={LINE_COLUMNS}
              rowKey={(item) => item.id}
              dense
            />
          )}
          {order.notes ? (
            <p className="mt-4 text-sm text-ink-600">
              <span className="font-medium">Notes: </span>
              {order.notes}
            </p>
          ) : null}
          {order.cancel_reason ? (
            <p className="mt-2 text-sm text-rose-700">
              <span className="font-medium">Cancel reason: </span>
              {order.cancel_reason}
            </p>
          ) : null}
        </Card>

        <Card>
          <CardHeader title="Order" subtitle="As the server calculates it" />
          <dl className="space-y-2 text-sm">
            <Row label="Supplier">{order.supplier_name ?? "—"}</Row>
            <Row label="Status">
              <StatusBadge status={order.status} />
            </Row>
            <Row label="Order date">{formatDate(order.order_date)}</Row>
            <Row label="Expected">{formatDate(order.expected_delivery_date)}</Row>
            <Row label="Sent">{formatDate(order.sent_at)}</Row>
            <Row label="Received">{formatDate(order.received_at)}</Row>
          </dl>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatTile label="Subtotal" value={formatMoney(order.subtotal, order.currency)} />
            <StatTile label="Tax" value={formatMoney(order.tax_amount, order.currency)} />
            <StatTile label="Shipping" value={formatMoney(order.shipping_amount, order.currency)} />
            <StatTile
              label="Total"
              value={formatMoney(order.total_amount, order.currency)}
              tone="info"
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
            <KeyValue label="Units ordered">{formatNumber(order.total_units_ordered)}</KeyValue>
            <KeyValue label="Units received">{formatNumber(order.total_units_received)}</KeyValue>
          </div>
        </Card>
      </div>

      {send.error ? (
        <div className="mt-4">
          <FormError error={send.error} />
        </div>
      ) : null}

      {cancelling ? (
        <CancelModal
          order={order}
          onClose={() => setCancelling(false)}
          onCancelled={() => {
            setCancelling(false);
            query.refetch();
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
  {
    key: "complete",
    header: "Complete",
    render: (item) =>
      item.is_fully_received ? <Badge tone="success">Fully received</Badge> : <span className="text-ink-400">—</span>,
  },
];

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
          <Button
            variant="primary"
            pending={receive.pending}
            disabled={blocked}
            onClick={() => void submit()}
          >
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
