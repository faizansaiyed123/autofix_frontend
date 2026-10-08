"use client";

import { useState } from "react";

import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, KeyValue } from "@/components/ui/Card";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Field, FormError, Input, Select, Textarea, useForm } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader, SearchInput, Toolbar } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { inventoryApi, partsApi } from "@/lib/api/stock";
import type { InventoryTransaction, Part, PartCreate } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { formatDateTime, formatMoney, titleCase } from "@/lib/format";
import { PART_CATEGORIES } from "@/lib/status";

/**
 * The parts catalog.
 *
 * This screen sits behind the staff gate and shows what the shop paid for every
 * line. That is deliberate and it is the only place the figure appears: the
 * parts desk needs the margin to price anything, and the customer portal is a
 * separate module that never carries `unit_cost` at all.
 *
 * "On hand" is a running balance out of the ledger and nobody edits it here. A
 * part that has ever moved cannot be deleted, because its history would go with
 * it — the honest end of life for such a line is DISCONTINUED, which keeps the
 * number resolvable on every document that ever quoted it.
 */
export default function PartsPage() {
  const { can } = useSession();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const query = useApiQuery(
    () =>
      partsApi.list({
        page,
        size: 25,
        search: search || undefined,
        category: category || undefined,
        status: status || undefined,
        low_stock: lowStock ? true : undefined,
      }),
    [page, search, category, status, lowStock],
  );

  const categories = useApiQuery(() => partsApi.categories(), []);

  const columns: Column<Part>[] = [
    {
      key: "part_number",
      header: "Part number",
      render: (p) => (
        <div>
          <span className="font-medium text-ink-900">{p.part_number}</span>
          {p.sku ? <p className="text-xs text-ink-500">SKU {p.sku}</p> : null}
        </div>
      ),
    },
    {
      key: "name",
      header: "Name",
      render: (p) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-ink-900">{p.name}</p>
          {p.status !== "ACTIVE" ? <StatusBadge status={p.status} /> : null}
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (p) => <span className="text-xs text-ink-600">{titleCase(p.category)}</span>,
    },
    {
      key: "brand",
      header: "Brand",
      render: (p) => <span className="text-xs text-ink-600">{p.brand ?? "—"}</span>,
    },
    {
      key: "location",
      header: "Location",
      render: (p) => <span className="text-xs text-ink-600">{p.location ?? "—"}</span>,
    },
    {
      key: "on_hand",
      header: "On hand",
      numeric: true,
      render: (p) =>
        p.is_out_of_stock ? (
          <span className="font-semibold text-rose-700">
            {qty(p.quantity_on_hand)} {p.stock_status}
          </span>
        ) : p.is_low_stock ? (
          <span className="font-semibold text-amber-700">
            {qty(p.quantity_on_hand)} {p.stock_status}
          </span>
        ) : (
          qty(p.quantity_on_hand)
        ),
    },
    {
      key: "reorder_level",
      header: "Reorder at",
      numeric: true,
      render: (p) => <span className="text-ink-600">{qty(p.reorder_level)}</span>,
    },
    {
      key: "unit_cost",
      header: "Cost",
      numeric: true,
      headerClassName: "text-ink-700",
      render: (p) => <span className="text-ink-700">{formatMoney(p.unit_cost)}</span>,
    },
    {
      key: "unit_price",
      header: "Price",
      numeric: true,
      render: (p) => formatMoney(p.unit_price),
    },
    {
      key: "margin",
      header: "Margin",
      numeric: true,
      render: (p) => (
        <span className={p.margin > 0 ? "text-emerald-700" : "text-rose-700"}>
          {formatMoney(p.margin)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Parts"
        subtitle={query.data ? `${query.data.meta.total} in the catalog` : "The parts catalog"}
        actions={
          can("parts:write") ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              New part
            </Button>
          ) : null
        }
      />

      <Notice tone="info">
        Cost and margin are staff figures: the parts desk needs them to price anything, and the
        customer-facing portal is a separate module that never carries what the shop paid. Nothing on
        this screen is ever shown to a customer.
      </Notice>

      <Card className="mt-4" padded={false}>
        <Toolbar>
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Part number, name, brand"
            className="min-w-56 flex-1"
          />
          <Field label="Category" className="w-48">
            <Select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Any category</option>
              {(categories.data ?? PART_CATEGORIES).map((value) => (
                <option key={value} value={value}>
                  {titleCase(value)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" className="w-44">
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Any status</option>
              <option value="ACTIVE">Active</option>
              <option value="DISCONTINUED">Discontinued</option>
            </Select>
          </Field>
          <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={lowStock}
              onChange={(event) => {
                setLowStock(event.target.checked);
                setPage(1);
              }}
              className="size-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            At or below reorder level
          </label>
        </Toolbar>

        {query.loading && query.initial ? (
          <Loading label="Reading the catalog…" />
        ) : query.error ? (
          <div className="p-4">
            <ErrorState error={query.error} onRetry={query.refetch} />
          </div>
        ) : !query.data || query.data.data.length === 0 ? (
          <EmptyState
            title={lowStock ? "Nothing is below its reorder level" : "No parts match that"}
            description="A new catalog line starts with no stock; it is stocked in with a RECEIPT on the inventory ledger."
          />
        ) : (
          <>
            <DataTable
              rows={query.data.data}
              columns={columns}
              rowKey={(p) => p.id}
              onRowClick={(p) => setSelected(p.id)}
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

      {creating ? (
        <NewPartModal
          categories={categories.data ?? []}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            query.refetch();
          }}
        />
      ) : null}

      {selected ? (
        <PartModal
          partId={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            query.refetch();
          }}
        />
      ) : null}
    </>
  );
}

/** Stock quantities are decimals; rounding them to whole units would hide half an oil change. */
function qty(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** Numbers travel through a form as strings and are parsed on the way out. */
interface PartFormValues extends Record<string, unknown> {
  name: string;
  category: string;
  unit_cost: string;
  unit_price: string;
  reorder_level: string;
  brand: string;
  location: string;
  description: string;
}

const HISTORY_COLUMNS: Column<InventoryTransaction>[] = [
  {
    key: "when",
    header: "When",
    numeric: true,
    render: (m) => <span className="text-xs text-ink-600">{formatDateTime(m.created_at)}</span>,
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
      <span className={m.quantity < 0 ? "text-rose-700" : "text-emerald-700"}>
        {m.quantity > 0 ? `+${qty(m.quantity)}` : qty(m.quantity)}
      </span>
    ),
  },
  {
    key: "balance",
    header: "Balance",
    numeric: true,
    render: (m) => (
      <span className="text-xs text-ink-600">
        {qty(m.quantity_before)} → {qty(m.quantity_after)}
      </span>
    ),
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
];

function NewPartModal({
  categories,
  onClose,
  onCreated,
}: {
  categories: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const form = useForm({
    part_number: "",
    name: "",
    category: categories[0] ?? "OTHER",
    unit_cost: "0",
    unit_price: "0",
    reorder_level: "0",
    sku: "",
    description: "",
    brand: "",
    location: "",
  });
  const create = useApiMutation((body: PartCreate) => partsApi.create(body));

  async function submit() {
    if (form.missing(["part_number", "name", "category"]).length > 0) return;
    const created = await create.run({
      part_number: form.values.part_number.trim().toUpperCase(),
      name: form.values.name.trim(),
      category: form.values.category,
      unit_cost: Number(form.values.unit_cost) || 0,
      unit_price: Number(form.values.unit_price) || 0,
      reorder_level: Number(form.values.reorder_level) || 0,
      sku: form.values.sku || null,
      description: form.values.description || null,
      brand: form.values.brand || null,
      location: form.values.location || null,
    });
    if (created) {
      form.reset();
      onCreated();
    }
  }

  const options = categories.length > 0 ? categories : PART_CATEGORIES;

  return (
    <Modal
      open
      onClose={onClose}
      title="New part"
      description="A catalog line. It starts with no stock — the opening balance goes on the ledger as a RECEIPT."
      footer={
        <>
          <Button onClick={onClose} disabled={create.pending}>
            Cancel
          </Button>
          <Button variant="primary" pending={create.pending} onClick={() => void submit()}>
            Add to catalog
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

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Part number" required hint="The manufacturer's number, e.g. BOS0986A.">
            <Input
              value={form.values.part_number}
              onChange={(event) => form.set("part_number", event.target.value)}
            />
          </Field>
          <Field label="SKU" hint="Optional.">
            <Input
              value={form.values.sku}
              onChange={(event) => form.set("sku", event.target.value)}
            />
          </Field>
        </div>

        <Field label="Name" required>
          <Input
            value={form.values.name}
            onChange={(event) => form.set("name", event.target.value)}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Category" required>
            <Select
              value={form.values.category}
              onChange={(event) => form.set("category", event.target.value)}
            >
              {options.map((value) => (
                <option key={value} value={value}>
                  {titleCase(value)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Brand">
            <Input
              value={form.values.brand}
              onChange={(event) => form.set("brand", event.target.value)}
            />
          </Field>
          <Field label="Location" hint="The shelf or bin.">
            <Input
              value={form.values.location}
              onChange={(event) => form.set("location", event.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Unit cost" hint="What the shop pays.">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.values.unit_cost}
              onChange={(event) => form.set("unit_cost", event.target.value)}
            />
          </Field>
          <Field label="Unit price" hint="What the customer pays.">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.values.unit_price}
              onChange={(event) => form.set("unit_price", event.target.value)}
            />
          </Field>
          <Field label="Reorder at" hint="Warn at or below this.">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.values.reorder_level}
              onChange={(event) => form.set("reorder_level", event.target.value)}
            />
          </Field>
        </div>

        <Field label="Description">
          <Textarea
            rows={2}
            value={form.values.description}
            onChange={(event) => form.set("description", event.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}

function PartModal({
  partId,
  onClose,
  onChanged,
}: {
  partId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { can } = useSession();
  const query = useApiQuery(() => partsApi.get(partId), [partId]);
  const history = useApiQuery(
    () => inventoryApi.partHistory(partId, 50),
    [partId],
    { enabled: can("inventory:read") },
  );

  const part = query.data;

  return (
    <Modal
      open
      onClose={onClose}
      title={part ? `${part.part_number} · ${part.name}` : "Part"}
      description="Catalog details, pricing and everything the ledger has recorded against this part."
      width="max-w-3xl"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {query.loading && query.initial ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : !part ? (
        <EmptyState title="Part not found" />
      ) : (
        <PartEditor
          part={part}
          movements={history.data ?? []}
          historyError={history.error}
          historyLoading={history.loading && history.initial}
          canWrite={can("parts:write")}
          canDelete={can("parts:manage")}
          onClose={onClose}
          onSaved={() => {
            onChanged();
            query.refetch();
          }}
        />
      )}
    </Modal>
  );
}

function PartEditor({
  part,
  movements,
  historyError,
  historyLoading,
  canWrite,
  canDelete,
  onClose,
  onSaved,
}: {
  part: Part;
  movements: InventoryTransaction[];
  historyError: unknown;
  historyLoading: boolean;
  canWrite: boolean;
  canDelete: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const form = useForm<PartFormValues>({
    name: part.name,
    category: part.category,
    unit_cost: String(part.unit_cost),
    unit_price: String(part.unit_price),
    reorder_level: String(part.reorder_level),
    brand: part.brand ?? "",
    location: part.location ?? "",
    description: part.description ?? "",
  });
  const [status, setStatus] = useState<string>(part.status);

  const update = useApiMutation((body: Partial<PartCreate> & { status?: string }) =>
    partsApi.update(part.id, body),
  );
  const remove = useApiMutation(() => partsApi.remove(part.id));

  const blockedBy = deleteBlockedReason(part, movements, canDelete);

  async function save() {
    if (form.missing(["name", "category"]).length > 0) return;
    const saved = await update.run({
      name: form.values.name.trim(),
      category: form.values.category,
      unit_cost: Number(form.values.unit_cost) || 0,
      unit_price: Number(form.values.unit_price) || 0,
      reorder_level: Number(form.values.reorder_level) || 0,
      brand: form.values.brand || null,
      location: form.values.location || null,
      description: form.values.description || null,
      status,
    });
    if (saved) onSaved();
  }

  async function deletePart() {
    const done = await remove.run();
    if (done) {
      onSaved();
      onClose();
    }
  }

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <KeyValue label="On hand">
          <span className={part.is_low_stock ? "font-semibold text-amber-700" : ""}>
            {qty(part.quantity_on_hand)}{" "}
            <span className="text-xs text-ink-500">{part.stock_status}</span>
          </span>
        </KeyValue>
        <KeyValue label="Reorder at">{qty(part.reorder_level)}</KeyValue>
        <KeyValue label="Stock at cost">{formatMoney(part.stock_value)}</KeyValue>
        <KeyValue label="Margin">{formatMoney(part.margin)}</KeyValue>
      </dl>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="space-y-3"
      >
        <FormError error={update.error} />
        <FormError error={remove.error} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required>
            <Input
              value={form.values.name}
              disabled={!canWrite}
              onChange={(event) => form.set("name", event.target.value)}
            />
          </Field>
          <Field label="Category" required>
            <Select
              value={form.values.category}
              disabled={!canWrite}
              onChange={(event) => form.set("category", event.target.value)}
            >
              {PART_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {titleCase(value)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Brand">
            <Input
              value={form.values.brand}
              disabled={!canWrite}
              onChange={(event) => form.set("brand", event.target.value)}
            />
          </Field>
          <Field label="Location">
            <Input
              value={form.values.location}
              disabled={!canWrite}
              onChange={(event) => form.set("location", event.target.value)}
            />
          </Field>
          <Field label="Trading status" hint="Discontinued keeps the number resolvable.">
            <Select
              value={status}
              disabled={!canWrite}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="ACTIVE">Active</option>
              <option value="DISCONTINUED">Discontinued</option>
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Unit cost" hint="Staff only.">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.values.unit_cost}
              disabled={!canWrite}
              onChange={(event) => form.set("unit_cost", event.target.value)}
            />
          </Field>
          <Field label="Unit price">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.values.unit_price}
              disabled={!canWrite}
              onChange={(event) => form.set("unit_price", event.target.value)}
            />
          </Field>
          <Field label="Reorder at">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.values.reorder_level}
              disabled={!canWrite}
              onChange={(event) => form.set("reorder_level", event.target.value)}
            />
          </Field>
        </div>

        <Field label="Description">
          <Textarea
            rows={2}
            value={form.values.description}
            disabled={!canWrite}
            onChange={(event) => form.set("description", event.target.value)}
          />
        </Field>

        <Notice tone="info">
          The part number and SKU are fixed: renumbering a line would orphan the history already
          filed against the old number. On hand is not editable here either — it is the balance of
          the ledger and moves only through a stock movement.
        </Notice>

        {canWrite ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="primary" pending={update.pending}>
              Save changes
            </Button>
            {blockedBy ? null : (
              <Button variant="danger" pending={remove.pending} onClick={() => void deletePart()}>
                Delete line
              </Button>
            )}
          </div>
        ) : null}
      </form>

      {blockedBy ? (
        <Notice tone="info">
          <Badge tone="warning">Delete unavailable</Badge> {blockedBy}
        </Notice>
      ) : (
        <Notice tone="info">
          This line has never moved and is retired with nothing on the shelf, so it can be deleted
          outright. Any part that has moved is discontinued instead, which keeps its number resolvable
          on every document that quoted it.
        </Notice>
      )}

      <div>
        <CardHeader title="Ledger history" subtitle="Every movement of this part, newest first" />
        {historyLoading ? (
          <Loading />
        ) : historyError ? (
          <ErrorState error={historyError} />
        ) : movements.length === 0 ? (
          <EmptyState
            title="Nothing has ever moved"
            description="The opening balance has not been booked in yet — record a RECEIPT on the inventory ledger."
          />
        ) : (
          <DataTable rows={movements} columns={HISTORY_COLUMNS} rowKey={(m) => m.id} dense />
        )}
      </div>
    </div>
  );
}

function deleteBlockedReason(
  part: Part,
  movements: InventoryTransaction[],
  allowed: boolean,
): string | null {
  if (!allowed) return "Deleting a catalog line is held on a permission above parts:write.";
  if (part.status !== "DISCONTINUED")
    return `It is ${part.status}; retire it (DISCONTINUED) before it can be deleted.`;
  if (part.quantity_on_hand !== 0)
    return `There are still ${qty(part.quantity_on_hand)} unit(s) on the shelf, which is stock the shop owes itself.`;
  if (movements.length > 0)
    return `It has ${movements.length} movement(s) on the ledger and that history cannot be deleted — retire it instead.`;
  return null;
}
