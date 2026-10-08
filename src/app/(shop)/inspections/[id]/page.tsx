"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, KeyValue, KeyValueGrid } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Field, FormError, Input, Select, Textarea, useForm } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { useReferences } from "@/components/layout/ReferenceProvider";
import { inspectionsApi } from "@/lib/api/shop";
import type { Inspection, InspectionItem } from "@/lib/api/types";
import type { ApiError } from "@/lib/api/client";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { INSPECTION_CATEGORIES, INSPECTION_STATUSES } from "@/lib/status";
import { formatDateTime, formatNumber, titleCase } from "@/lib/format";

/**
 * The statuses an `InspectionItem` may carry.
 *
 * `INSPECTION_ITEM_STATUSES` says OK where the API's enum says GOOD, and omits
 * RECOMMENDED; offering the array's spelling would be rejected on every save, so
 * the values the API accepts are listed here.
 */
const ITEM_STATUSES = ["GOOD", "ATTENTION", "RECOMMENDED", "URGENT", "NOT_CHECKED"];

/** `InspectionRecommendation`, a closed set the API validates against. */
const RECOMMENDATIONS = [
  "PASS",
  "MONITOR",
  "ADJUST",
  "CLEAN",
  "LUBE",
  "REPAIR",
  "REPLACE",
  "INSPECT_FURTHER",
];

const INSPECTION_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["CANCELLED"],
  CANCELLED: [],
};

/** The API refuses any item change once an inspection is in one of these. */
const FROZEN_STATUSES = new Set(["COMPLETED", "CANCELLED"]);

interface ItemDraft {
  status: string;
  measurement: string;
  notes: string;
  recommendation: string;
}

const EMPTY_DRAFT: ItemDraft = {
  status: "GOOD",
  measurement: "",
  notes: "",
  recommendation: "",
};

/**
 * One inspection, and the findings on it.
 *
 * The items are grouped by category because that is how the customer reads the
 * report the API generates: a category takes the colour of its worst item, so a
 * flat list of forty rows would hide which system is actually the problem.
 */
export default function InspectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useSession();
  const { customerLabel, userName, vehicleLabel } = useReferences();

  const [adding, setAdding] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ItemDraft | null>(null);

  const inspection = useApiQuery(() => inspectionsApi.get(id), [id]);
  const setStatus = useApiMutation((status: string) => inspectionsApi.setStatus(id, status));
  const addItem = useApiMutation((body: InspectionItem) => inspectionsApi.addItem(id, body));
  const updateItem = useApiMutation(
    (itemId: string, body: ItemDraft) => inspectionsApi.updateItem(id, itemId, body),
  );
  const removeItem = useApiMutation((itemId: string) => inspectionsApi.removeItem(id, itemId));

  if (inspection.loading && inspection.initial) return <Loading label="Opening the inspection…" />;
  if (inspection.error) return <ErrorState error={inspection.error} onRetry={inspection.refetch} />;

  const record = inspection.data;
  if (!record) return <ErrorState error={new Error("Inspection not found")} />;

  const writable = can("inspections:write") && !FROZEN_STATUSES.has(record.status);
  const allowed = INSPECTION_TRANSITIONS[record.status] ?? [];

  function refresh() {
    inspection.refetch();
  }

  function startEditing(item: InspectionItem) {
    if (!item.id) return;
    setEditingItemId(item.id);
    setDraft({
      status: item.status,
      measurement: item.measurement ?? "",
      notes: item.notes ?? "",
      recommendation: item.recommendation ?? "",
    });
  }

  return (
    <>
      <PageHeader
        breadcrumb={<Link href="/inspections" className="hover:underline">Inspections</Link>}
        title={vehicleLabel(record.vehicle_id)}
        subtitle={`${formatNumber(record.items.length)} item(s) · inspected ${formatDateTime(record.created_at)}`}
        actions={
          <>
            <StatusBadge status={record.status} />
            <StatusBadge status={record.overall_condition} />
            {can("inspections:write") ? (
              <Button variant="primary" onClick={() => setAdding(true)} disabled={!writable}>
                Add item
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Inspection" subtitle="Who, what and how far" />
          <KeyValueGrid>
            <KeyValue label="Vehicle">{vehicleLabel(record.vehicle_id)}</KeyValue>
            <KeyValue label="Customer">{customerLabel(record.customer_id)}</KeyValue>
            <KeyValue label="Technician">
              {record.technician_id ? userName(record.technician_id) : "—"}
            </KeyValue>
            <KeyValue label="Mileage">{formatNumber(record.mileage)} mi</KeyValue>
            <KeyValue label="Condition">
              <StatusBadge status={record.overall_condition} />
            </KeyValue>
            <KeyValue label="From a check-in">{record.checkin_id ? "Yes" : "No"}</KeyValue>
          </KeyValueGrid>
          {record.overall_notes ? (
            <div className="mt-4 border-t border-ink-100 pt-3">
              <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">
                Overall notes
              </p>
              <p className="mt-0.5 text-sm whitespace-pre-line text-ink-700">{record.overall_notes}</p>
            </div>
          ) : null}
        </Card>

        <Card>
          <CardHeader title="Progress" subtitle="What this inspection may do next" />
          {can("inspections:write") ? (
            <>
              {allowed.length === 0 ? (
                <Notice tone="info">
                  {record.status} is final. The API refuses any further transition.
                </Notice>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {INSPECTION_STATUSES.map((option) => {
                    const reachable = allowed.includes(option);
                    const blocked = option === "COMPLETED" && record.items.length === 0;
                    return (
                      <Button
                        key={option}
                        size="sm"
                        variant={option === "CANCELLED" ? "danger" : "primary"}
                        disabled={!reachable || blocked}
                        pending={setStatus.pending}
                        title={
                          !reachable
                            ? `Not allowed from ${record.status} — the API permits ${allowed.join(", ")}`
                            : blocked
                              ? "An inspection with no items cannot be completed"
                              : undefined
                        }
                        onClick={() =>
                          setStatus.run(option).then((saved) => {
                            if (saved) refresh();
                          })
                        }
                      >
                        {titleCase(option)}
                      </Button>
                    );
                  })}
                </div>
              )}
              {record.items.length === 0 ? (
                <p className="mt-3 text-xs text-ink-500">
                  Record at least one item before completing — the API refuses an empty inspection.
                </p>
              ) : null}
              {setStatus.error ? (
                <div className="mt-3">
                  <Notice tone="danger">{setStatus.error.messageForUser}</Notice>
                </div>
              ) : null}
            </>
          ) : (
            <Notice tone="info">You do not have permission to change this inspection.</Notice>
          )}

          {!writable && can("inspections:write") ? (
            <div className="mt-3">
              <Notice tone="info">
                This inspection is {record.status}. Its items are frozen — the API refuses any
                change once an inspection reaches a final state.
              </Notice>
            </div>
          ) : null}
        </Card>
      </div>

      <ItemGroups
        inspection={record}
        writable={writable}
        editingItemId={editingItemId}
        draft={draft}
        setDraft={setDraft}
        pending={updateItem.pending}
        onEdit={startEditing}
        onCancel={() => {
          setEditingItemId(null);
          setDraft(null);
        }}
        onSave={(itemId) => {
          if (!draft) return;
          void updateItem.run(itemId, draft).then((saved) => {
            if (saved) {
              setEditingItemId(null);
              setDraft(null);
              refresh();
            }
          });
        }}
        onDelete={(item) => {
          if (!item.id) return;
          if (!confirm(`Remove "${item.item_name}" from this inspection?`)) return;
          void removeItem.run(item.id).then(() => {
            refresh();
          });
        }}
      />

      {removeItem.error ? (
        <div className="mt-4">
          <Notice tone="danger">{removeItem.error.messageForUser}</Notice>
        </div>
      ) : null}

      <AddItemModal
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={() => {
          setAdding(false);
          refresh();
        }}
        run={addItem.run}
        pending={addItem.pending}
        error={addItem.error}
      />
    </>
  );
}

function ItemGroups({
  inspection,
  writable,
  editingItemId,
  draft,
  setDraft,
  pending,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}: {
  inspection: Inspection;
  writable: boolean;
  editingItemId: string | null;
  draft: ItemDraft | null;
  setDraft: (draft: ItemDraft) => void;
  pending: boolean;
  onEdit: (item: InspectionItem) => void;
  onCancel: () => void;
  onSave: (itemId: string) => void;
  onDelete: (item: InspectionItem) => void;
}) {
  const grouped = groupByCategory(inspection.items);

  if (grouped.length === 0) {
    return (
      <Card padded={false}>
        <EmptyState
          title="No items recorded"
          description="An inspection is a list of findings; without any it cannot be completed."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map((group) => (
        <Card key={group.category} padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title={titleCase(group.category)}
              subtitle={`${group.items.length} item(s) — a category takes the colour of its worst item`}
            />
          </div>
          <DataTable
            rows={group.items}
            dense
            rowKey={(item) => item.id ?? `${group.category}-${item.item_name}`}
            columns={itemColumns({
              writable,
              editingItemId,
              draft,
              setDraft,
              pending,
              onEdit,
              onCancel,
              onSave,
              onDelete,
            })}
          />
        </Card>
      ))}
    </div>
  );
}

function itemColumns({
  writable,
  editingItemId,
  draft,
  setDraft,
  pending,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}: {
  writable: boolean;
  editingItemId: string | null;
  draft: ItemDraft | null;
  setDraft: (draft: ItemDraft) => void;
  pending: boolean;
  onEdit: (item: InspectionItem) => void;
  onCancel: () => void;
  onSave: (itemId: string) => void;
  onDelete: (item: InspectionItem) => void;
}): Column<InspectionItem>[] {
  return [
    {
      key: "item",
      header: "Item",
      render: (item) => (
        <div className="min-w-0">
          <p className="font-medium text-ink-800">{item.item_name}</p>
          {item.photos && item.photos.length > 0 ? (
            <a
              href={item.photos[0].photo_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-brand-700 hover:underline"
            >
              {item.photos.length} photo(s)
            </a>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => {
        if (!writable || item.id !== editingItemId) return <StatusBadge status={item.status} />;
        return (
          <Select
            value={draft?.status ?? item.status}
            onChange={(event) =>
              setDraft({ ...(draft ?? EMPTY_DRAFT), status: event.target.value })
            }
            className="min-w-36"
            aria-label="Item status"
          >
            {ITEM_STATUSES.map((option) => (
              <option key={option} value={option}>
                {titleCase(option)}
              </option>
            ))}
          </Select>
        );
      },
    },
    {
      key: "measurement",
      header: "Measurement",
      render: (item) => {
        if (!writable || item.id !== editingItemId) {
          return <span className="text-sm text-ink-700">{item.measurement ?? "—"}</span>;
        }
        return (
          <Input
            className="min-w-32"
            maxLength={100}
            value={draft?.measurement ?? ""}
            onChange={(event) => setDraft({ ...(draft ?? EMPTY_DRAFT), measurement: event.target.value })}
          />
        );
      },
    },
    {
      key: "recommendation",
      header: "Recommendation",
      render: (item) => {
        if (!writable || item.id !== editingItemId) {
          return <span className="text-sm text-ink-700">{item.recommendation ?? "—"}</span>;
        }
        return (
          <Select
            value={draft?.recommendation ?? ""}
            onChange={(event) =>
              setDraft({ ...(draft ?? EMPTY_DRAFT), recommendation: event.target.value })
            }
            className="min-w-40"
            aria-label="Recommendation"
          >
            <option value="">None</option>
            {RECOMMENDATIONS.map((option) => (
              <option key={option} value={option}>
                {titleCase(option)}
              </option>
            ))}
          </Select>
        );
      },
    },
    {
      key: "notes",
      header: "Notes",
      render: (item) => {
        if (!writable || item.id !== editingItemId) {
          return <span className="text-sm text-ink-700">{item.notes ?? "—"}</span>;
        }
        return (
          <Textarea
            rows={1}
            maxLength={2000}
            value={draft?.notes ?? ""}
            onChange={(event) => setDraft({ ...(draft ?? EMPTY_DRAFT), notes: event.target.value })}
          />
        );
      },
    },
    {
      key: "actions",
      header: "",
      numeric: true,
      render: (item) => {
        if (!writable || !item.id) return null;
        const itemId = item.id;
        if (itemId !== editingItemId) {
          return (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onEdit(item)}
                className="text-xs font-medium text-brand-700 hover:underline"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(item)}
                className="text-xs text-ink-500 hover:underline"
              >
                Remove
              </button>
            </div>
          );
        }
        return (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="text-xs text-ink-500 hover:underline"
            >
              Cancel
            </button>
            <Button size="sm" variant="primary" pending={pending} onClick={() => onSave(itemId)}>
              Save
            </Button>
          </div>
        );
      },
    },
  ];
}

function groupByCategory(items: InspectionItem[]): { category: string; items: InspectionItem[] }[] {
  const buckets = new Map<string, InspectionItem[]>();
  const order: string[] = [];

  for (const item of items) {
    if (!buckets.has(item.category)) {
      buckets.set(item.category, []);
      order.push(item.category);
    }
    buckets.get(item.category)?.push(item);
  }

  // Categories the shop's own list knows come first, in their documented order;
  // anything else the shop typed itself follows rather than disappearing.
  const known = INSPECTION_CATEGORIES.filter((category) => buckets.has(category));
  const custom = order.filter((category) => !INSPECTION_CATEGORIES.includes(category));

  return [...known, ...custom].map((category) => ({
    category,
    items: buckets.get(category) ?? [],
  }));
}

function AddItemModal({
  open,
  onClose,
  onAdded,
  run,
  pending,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  run: (body: InspectionItem) => Promise<InspectionItem | null>;
  pending: boolean;
  error: ApiError | null;
}) {
  const form = useForm({
    category: INSPECTION_CATEGORIES[0],
    item_name: "",
    status: "GOOD",
    measurement: "",
    recommendation: "",
    notes: "",
    photo_url: "",
    photo_caption: "",
  });

  async function submit() {
    // The API rejects an item with no category, so it is checked rather than
    // defaulted silently.
    if (form.missing(["category", "item_name"]).length > 0) return;
    const saved = await run({
      category: form.values.category,
      item_name: form.values.item_name,
      status: form.values.status,
      measurement: form.values.measurement || null,
      recommendation: form.values.recommendation || null,
      notes: form.values.notes || null,
      photo_url: form.values.photo_url || null,
      photo_caption: form.values.photo_caption || null,
    });
    if (saved) {
      form.reset();
      onAdded();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add inspection item"
      description="One finding. The customer's report is built entirely from these."
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" pending={pending} onClick={() => void submit()}>
            Add item
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
        <FormError error={error} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category" required hint="Drives the grouping in the customer report">
            <Select
              value={form.values.category}
              onChange={(event) => form.set("category", event.target.value)}
            >
              {INSPECTION_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {titleCase(category)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={form.values.status}
              onChange={(event) => form.set("status", event.target.value)}
            >
              {ITEM_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="What was checked" required hint="Up to 100 characters">
          <Input
            maxLength={100}
            value={form.values.item_name}
            onChange={(event) => form.set("item_name", event.target.value)}
            placeholder="Front pads, coolant level, …"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Measurement" hint="Optional, up to 100 characters">
            <Input
              maxLength={100}
              value={form.values.measurement}
              onChange={(event) => form.set("measurement", event.target.value)}
              placeholder="4 mm"
            />
          </Field>
          <Field label="Recommendation" hint="Optional — the API only accepts these values">
            <Select
              value={form.values.recommendation}
              onChange={(event) => form.set("recommendation", event.target.value)}
            >
              <option value="">None</option>
              {RECOMMENDATIONS.map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Notes">
          <Textarea
            rows={2}
            maxLength={2000}
            value={form.values.notes}
            onChange={(event) => form.set("notes", event.target.value)}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Photo URL" hint="Optional, up to 500 characters">
            <Input
              maxLength={500}
              value={form.values.photo_url}
              onChange={(event) => form.set("photo_url", event.target.value)}
            />
          </Field>
          <Field label="Photo caption" hint="Optional, up to 200 characters">
            <Input
              maxLength={200}
              value={form.values.photo_caption}
              onChange={(event) => form.set("photo_caption", event.target.value)}
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}