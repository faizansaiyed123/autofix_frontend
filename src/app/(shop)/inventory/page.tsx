"use client";

import { useState, type ReactNode } from "react";

import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Field, FormError, Input, Select, useForm } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader, StatTile, Toolbar } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { useReferences } from "@/components/layout/ReferenceProvider";
import { inventoryApi } from "@/lib/api/stock";
import type {
  InventoryTransaction,
  InventoryTransactionCreate,
  StockLevel,
  StockSummary,
} from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { formatDateTime, formatMoney, titleCase } from "@/lib/format";
import { INVENTORY_TRANSACTION_TYPES } from "@/lib/status";

/**
 * The inventory ledger, and the shelf beside it.
 *
 * `quantity_on_hand` is a running balance that nobody types. Every change is a
 * row here that records the balance either side of itself, which is why the
 * movements tab shows before and after: one row has to be able to explain the
 * number on the parts catalog without anybody remembering.
 *
 * Direction is the field the desk gets wrong most often. A receipt arrives and an
 * issue leaves, so those two need nothing said; an adjustment and a transfer
 * could go either way, so the form makes the direction explicit rather than
 * letting the server refuse a guess.
 */
export default function InventoryPage() {
  const { can } = useSession();
  const [tab, setTab] = useState<"movements" | "stock">("movements");
  const [recording, setRecording] = useState(false);
  // Bumped after a write so the ledger re-reads itself; the movements tab owns
  // its own query and cannot see the level refetch below.
  const [ledgerNonce, setLedgerNonce] = useState(0);

  // Unpaginated over the whole catalog, so it doubles as the part lookup that
  // names the part on every movement row.
  const levels = useApiQuery<StockLevel[]>(() => inventoryApi.stockLevels(), []);

  const parts = levels.data ?? [];
  const partById = new Map(parts.map((level) => [level.part_id, level]));

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Every movement of stock, and what is on the shelf now"
        actions={
          can("inventory:write") ? (
            <Button variant="primary" onClick={() => setRecording(true)}>
              Record movement
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex gap-1 border-b border-ink-200">
        <TabButton active={tab === "movements"} onClick={() => setTab("movements")}>
          Movements
        </TabButton>
        <TabButton active={tab === "stock"} onClick={() => setTab("stock")}>
          Stock
        </TabButton>
      </div>

      {tab === "movements" ? (
        <MovementsTab partById={partById} nonce={ledgerNonce} />
      ) : (
        <StockTab levels={parts} loading={levels.loading && levels.initial} />
      )}

      {recording ? (
        <RecordMovementModal
          parts={parts}
          onClose={() => setRecording(false)}
          onRecorded={() => {
            setRecording(false);
            setLedgerNonce((n) => n + 1);
            levels.refetch();
          }}
        />
      ) : null}
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
        active
          ? "border-brand-600 text-brand-700"
          : "border-transparent text-ink-500 hover:text-ink-800"
      }`}
    >
      {children}
    </button>
  );
}

/** Stock quantities are decimals; whole-unit rounding would hide half an oil change. */
function qty(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** The ledger takes datetimes, so a date-only filter is widened to the whole day. */
function dayStart(value: string): string | undefined {
  return value ? `${value}T00:00` : undefined;
}

function dayEnd(value: string): string | undefined {
  return value ? `${value}T23:59` : undefined;
}

function MovementsTab({ partById, nonce }: { partById: Map<string, StockLevel>; nonce: number }) {
  const { userName } = useReferences();
  const [type, setType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  const query = useApiQuery(
    () =>
      inventoryApi.list({
        page,
        size: 25,
        transaction_type: type || undefined,
        start_date: dayStart(startDate),
        end_date: dayEnd(endDate),
      }),
    [page, type, startDate, endDate, nonce],
  );

  const columns: Column<InventoryTransaction>[] = [
    {
      key: "when",
      header: "When",
      numeric: true,
      render: (m) => <span className="text-xs text-ink-600">{formatDateTime(m.created_at)}</span>,
    },
    {
      key: "part",
      header: "Part",
      render: (m) => {
        const part = partById.get(m.part_id);
        if (!part) return <span className="text-xs text-ink-400">Unknown part</span>;
        return (
          <div className="text-sm">
            <p>{part.name}</p>
            <p className="text-xs text-ink-500">{part.part_number}</p>
          </div>
        );
      },
    },
    {
      key: "type",
      header: "Type",
      render: (m) => <StatusBadge status={m.transaction_type} />,
    },
    {
      key: "quantity",
      header: "Quantity",
      numeric: true,
      render: (m) => (
        <span className={m.quantity < 0 ? "font-medium text-rose-700" : "font-medium text-emerald-700"}>
          {m.quantity > 0 ? `+${qty(m.quantity)}` : qty(m.quantity)}
        </span>
      ),
    },
    {
      key: "before",
      header: "Before",
      numeric: true,
      render: (m) => <span className="text-xs text-ink-600">{qty(m.quantity_before)}</span>,
    },
    {
      key: "after",
      header: "After",
      numeric: true,
      render: (m) => <span className="text-xs text-ink-700">{qty(m.quantity_after)}</span>,
    },
    {
      key: "reference",
      header: "Reference",
      render: (m) => <span className="text-xs text-ink-600">{m.reference ?? "—"}</span>,
    },
    {
      key: "reason",
      header: "Reason",
      render: (m) => <span className="text-xs text-ink-500">{m.reason ?? "—"}</span>,
    },
    {
      key: "by",
      header: "Performed by",
      render: (m) => <span className="text-xs text-ink-600">{userName(m.performed_by_id)}</span>,
    },
  ];

  return (
    <Card padded={false}>
      <Toolbar>
        <Field label="Movement type" className="w-52">
          <Select
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Every movement</option>
            {INVENTORY_TRANSACTION_TYPES.map((value) => (
              <option key={value} value={value}>
                {titleCase(value)}
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
      </Toolbar>

      {query.loading && query.initial ? (
        <Loading label="Reading the ledger…" />
      ) : query.error ? (
        <div className="p-4">
          <ErrorState error={query.error} onRetry={query.refetch} />
        </div>
      ) : !query.data || query.data.data.length === 0 ? (
        <EmptyState
          title="Nothing has moved"
          description="Stock only moves through this ledger, so an empty ledger means an empty shelf."
        />
      ) : (
        <>
          <DataTable rows={query.data.data} columns={columns} rowKey={(m) => m.id} dense />
          <Pagination
            page={query.data.meta.page}
            pages={query.data.meta.pages}
            total={query.data.meta.total}
            onPage={setPage}
          />
        </>
      )}
    </Card>
  );
}

function StockTab({ levels, loading }: { levels: StockLevel[]; loading: boolean }) {
  const summary = useApiQuery<StockSummary>(() => inventoryApi.stockSummary(), []);

  const columns: Column<StockLevel>[] = [
    {
      key: "part_number",
      header: "Part number",
      render: (level) => (
        <span className="font-medium text-ink-900">{level.part_number}</span>
      ),
    },
    {
      key: "name",
      header: "Name",
      render: (level) => (
        <span className={level.is_low_stock ? "font-medium text-amber-800" : "text-sm"}>
          {level.name}
        </span>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (level) => <span className="text-xs text-ink-600">{titleCase(level.category)}</span>,
    },
    {
      key: "location",
      header: "Location",
      render: (level) => <span className="text-xs text-ink-600">{level.location ?? "—"}</span>,
    },
    {
      key: "on_hand",
      header: "On hand",
      numeric: true,
      render: (level) =>
        level.stock_status === "OUT" ? (
          <span className="font-semibold text-rose-700">0 · OUT</span>
        ) : level.is_low_stock ? (
          <span className="font-semibold text-amber-700">
            {qty(level.quantity_on_hand)} · LOW
          </span>
        ) : (
          qty(level.quantity_on_hand)
        ),
    },
    {
      key: "reorder_level",
      header: "Reorder at",
      numeric: true,
      render: (level) => <span className="text-ink-600">{qty(level.reorder_level)}</span>,
    },
    {
      key: "unit_cost",
      header: "Cost",
      numeric: true,
      render: (level) => <span className="text-ink-700">{formatMoney(level.unit_cost)}</span>,
    },
    {
      key: "stock_value",
      header: "Value at cost",
      numeric: true,
      render: (level) => formatMoney(level.stock_value),
    },
  ];

  if (summary.loading && summary.initial) return <Loading label="Counting the shelf…" />;
  if (summary.error) return <ErrorState error={summary.error} onRetry={summary.refetch} />;

  const totals = summary.data;

  return (
    <>
      {totals ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatTile label="Parts" value={qty(totals.total_parts)} />
          <StatTile label="Units on hand" value={qty(totals.total_units)} />
          <StatTile label="Stock at cost" value={formatMoney(totals.total_stock_value)} />
          <StatTile
            label="Low stock"
            value={qty(totals.low_stock_count)}
            tone={totals.low_stock_count > 0 ? "warning" : "neutral"}
            hint="At or below the reorder level"
          />
          <StatTile
            label="Out of stock"
            value={qty(totals.out_of_stock_count)}
            tone={totals.out_of_stock_count > 0 ? "danger" : "neutral"}
          />
        </div>
      ) : null}

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title="Stock levels"
            subtitle="A snapshot of right now — the balance out of the ledger, not a movement"
          />
        </div>
        {loading ? (
          <Loading />
        ) : levels.length === 0 ? (
          <EmptyState title="The catalog is empty" description="Add a part before stocking it." />
        ) : (
          <DataTable rows={levels} columns={columns} rowKey={(level) => level.part_id} dense />
        )}
      </Card>
    </>
  );
}

const DIRECTION_NOTE: Record<string, string> = {
  RECEIPT: "Goods arriving always adds to the balance.",
  RETURN: "A part coming back always adds to the balance.",
  ISSUE: "A part going to a job always comes off the shelf.",
  SCRAP: "Written-off stock always comes off the shelf.",
  ADJUSTMENT: "A correction can go either way, so the direction has to be stated.",
  TRANSFER: "A bin move can arrive or leave, so the direction has to be stated.",
};

function RecordMovementModal({
  parts,
  onClose,
  onRecorded,
}: {
  parts: StockLevel[];
  onClose: () => void;
  onRecorded: () => void;
}) {
  const form = useForm({
    part_id: "",
    transaction_type: "RECEIPT",
    quantity: "",
    direction: "",
    unit_cost: "",
    reference: "",
    reason: "",
    from_location: "",
    to_location: "",
  });
  const record = useApiMutation((body: InventoryTransactionCreate) =>
    inventoryApi.create(body),
  );

  const type = form.values.transaction_type;
  const needsDirection = type === "ADJUSTMENT" || type === "TRANSFER";
  const needsReason = type === "SCRAP" || type === "ADJUSTMENT";
  const direction = needsDirection ? form.values.direction : "";
  const quantity = Number(form.values.quantity);
  const selected = parts.find((part) => part.part_id === form.values.part_id);

  const problems = {
    part: form.values.part_id ? null : "Choose the part this movement is about.",
    quantity: quantity > 0 ? null : "A movement has to be greater than zero.",
    direction: needsDirection && direction === "" ? "State whether this adds or removes stock." : null,
    reason: needsReason && form.values.reason.trim() === "" ? "Say why — a blank reason is not a record." : null,
    location:
      type === "TRANSFER" && !form.values.to_location.trim() && !form.values.from_location.trim()
        ? "Name the other bin: where it arrives, or where it went."
        : null,
    negative:
      direction === "OUT" && selected && quantity > selected.quantity_on_hand
        ? `Only ${qty(selected.quantity_on_hand)} on hand, and stock cannot go negative.`
        : null,
  };
  const blocked = Object.values(problems).some(Boolean);

  function chooseType(next: string) {
    form.set("transaction_type", next);
    // The direction is only meaningful for the two types that can go either way,
    // so choosing any other type clears a stale one rather than sending a
    // contradiction the server would refuse.
    form.set("direction", next === "ADJUSTMENT" || next === "TRANSFER" ? form.values.direction : "");
  }

  async function submit() {
    if (blocked) return;
    const created = await record.run({
      part_id: form.values.part_id,
      transaction_type: type,
      quantity,
      direction: needsDirection ? direction : null,
      unit_cost: form.values.unit_cost === "" ? null : Number(form.values.unit_cost) || 0,
      reference: form.values.reference || null,
      reason: form.values.reason || null,
      from_location: form.values.from_location || null,
      to_location: form.values.to_location || null,
    });
    if (created) {
      form.reset();
      onRecorded();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Record a stock movement"
      description="The balance moves with this row and cannot go negative."
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose} disabled={record.pending}>
            Cancel
          </Button>
          <Button variant="primary" pending={record.pending} disabled={blocked} onClick={() => void submit()}>
            Record movement
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

        <Field label="Part" required error={problems.part}>
          <Select
            value={form.values.part_id}
            onChange={(event) => form.set("part_id", event.target.value)}
          >
            <option value="">Choose a part</option>
            {parts.map((part) => (
              <option key={part.part_id} value={part.part_id}>
                {part.part_number} · {part.name} ({qty(part.quantity_on_hand)} on hand)
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Movement type" required>
            <Select value={type} onChange={(event) => chooseType(event.target.value)}>
              {INVENTORY_TRANSACTION_TYPES.map((value) => (
                <option key={value} value={value}>
                  {titleCase(value)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Quantity"
            required
            error={problems.quantity ?? problems.negative}
            hint={selected ? `${qty(selected.quantity_on_hand)} currently on hand.` : undefined}
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.values.quantity}
              onChange={(event) => form.set("quantity", event.target.value)}
            />
          </Field>
        </div>

        {needsDirection ? (
          <Field
            label="Direction"
            required
            error={problems.direction}
            hint={DIRECTION_NOTE[type]}
          >
            <Select
              value={direction}
              onChange={(event) => form.set("direction", event.target.value)}
            >
              <option value="">Choose IN or OUT</option>
              <option value="IN">IN — adds to the shelf</option>
              <option value="OUT">OUT — comes off the shelf</option>
            </Select>
          </Field>
        ) : (
          <Notice tone="info">{DIRECTION_NOTE[type]}</Notice>
        )}

        {type === "RECEIPT" ? (
          <Field
            label="Unit cost"
            hint="Optional — the cost this stock came in at, kept on the ledger."
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.values.unit_cost}
              onChange={(event) => form.set("unit_cost", event.target.value)}
            />
          </Field>
        ) : null}

        {type === "TRANSFER" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="To location"
              required
              error={problems.location}
              hint="Where the stock is going."
            >
              <Input
                value={form.values.to_location}
                placeholder={selected?.location ?? "Bin, shelf or rack"}
                onChange={(event) => form.set("to_location", event.target.value)}
              />
            </Field>
            <Field label="From location" hint="Where it came from.">
              <Input
                value={form.values.from_location}
                placeholder={selected?.location ?? "Bin, shelf or rack"}
                onChange={(event) => form.set("from_location", event.target.value)}
              />
            </Field>
          </div>
        ) : null}

        <Field label="Reference" hint="Optional — a PO number, a delivery note, a job card.">
          <Input
            value={form.values.reference}
            onChange={(event) => form.set("reference", event.target.value)}
          />
        </Field>

        <Field
          label="Reason"
          required={needsReason}
          error={problems.reason}
          hint={
            needsReason
              ? type === "SCRAP"
                ? "Why the stock was written off."
                : "What the stock take found."
              : "Optional for this movement."
          }
        >
          <Input
            value={form.values.reason}
            onChange={(event) => form.set("reason", event.target.value)}
          />
        </Field>

        <Notice tone="info">
          Stock only moves through this ledger. On hand is never typed in anywhere else, and the row
          keeps the balance either side of itself so any number on the shelf can be explained.
        </Notice>
      </form>
    </Modal>
  );
}
