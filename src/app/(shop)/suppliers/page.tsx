"use client";

import { useState } from "react";

import { Badge, StatusBadge, YesNo } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, KeyValue } from "@/components/ui/Card";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Field, FormError, Input, Select, Textarea, useForm } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader, SearchInput, Toolbar } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { suppliersApi } from "@/lib/api/stock";
import type { Supplier } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";

/**
 * The supplier list.
 *
 * A supplier the shop has ever ordered from cannot be deleted. The order book
 * quotes its name, the ledger quotes its deliveries, and removing the record
 * would leave every one of those documents naming a supplier that no longer
 * exists — so a supplier is deactivated instead, which takes it out of the order
 * pickers while keeping the history intact. Deletion is offered only for a
 * supplier nothing has ever been ordered from, and even then the control stays
 * dark with the reason beside it.
 */
export default function SuppliersPage() {
  const { can } = useSession();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [preferredOnly, setPreferredOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const query = useApiQuery(
    () =>
      suppliersApi.list({
        page,
        size: 25,
        search: search || undefined,
        status: status || undefined,
        preferred_only: preferredOnly,
      }),
    [page, search, status, preferredOnly],
  );

  const rows = (query.data?.data ?? []) as Supplier[];

  const columns: Column<Supplier>[] = [
    {
      key: "name",
      header: "Supplier",
      render: (s) => (
        <div>
          <p className="font-medium text-ink-900">{s.name}</p>
          {s.is_preferred ? <Badge tone="success">Preferred</Badge> : null}
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      render: (s) => <span className="text-sm text-ink-700">{s.contact_name ?? "—"}</span>,
    },
    {
      key: "reach",
      header: "Email / phone",
      render: (s) => (
        <div className="text-sm">
          {s.email ? <p>{s.email}</p> : null}
          {s.phone ? <p className="text-xs text-ink-500">{s.phone}</p> : null}
          {!s.email && !s.phone ? <span className="text-ink-400">—</span> : null}
        </div>
      ),
    },
    {
      key: "lead_time",
      header: "Lead time",
      numeric: true,
      render: (s) => (
        <span className="text-xs text-ink-600">
          {s.lead_time_days > 0 ? `${formatNumber(s.lead_time_days)} day(s)` : "—"}
        </span>
      ),
    },
    {
      key: "terms",
      header: "Terms",
      render: (s) => <span className="text-xs text-ink-600">{s.payment_terms ?? "—"}</span>,
    },
    {
      key: "preferred",
      header: "Preferred",
      render: (s) => <YesNo value={s.is_preferred} trueLabel="Preferred" falseLabel="" />,
    },
    {
      key: "status",
      header: "Status",
      render: (s) => <StatusBadge status={s.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Suppliers"
        subtitle={query.data ? `${query.data.meta.total} on the list` : "Who the shop buys from"}
        actions={
          can("suppliers:write") ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              New supplier
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
            placeholder="Name, contact, email"
            className="min-w-56 flex-1"
          />
          <Field label="Status" className="w-40">
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Any status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </Field>
          <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={preferredOnly}
              onChange={(event) => {
                setPreferredOnly(event.target.checked);
                setPage(1);
              }}
              className="size-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            Preferred only
          </label>
        </Toolbar>

        {query.loading && query.initial ? (
          <Loading label="Reading the list…" />
        ) : query.error ? (
          <div className="p-4">
            <ErrorState error={query.error} onRetry={query.refetch} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title={preferredOnly ? "No preferred suppliers" : "No suppliers match that"}
            description="Suppliers are a parts-department list: the order book and the ledger both quote them."
          />
        ) : (
          <>
            <DataTable
              rows={rows}
              columns={columns}
              rowKey={(s) => s.id}
              onRowClick={(s) => setSelected(s.id)}
              dense
            />
            <Pagination
              page={query.data?.meta.page ?? 1}
              pages={query.data?.meta.pages ?? 1}
              total={query.data?.meta.total ?? 0}
              onPage={setPage}
            />
          </>
        )}
      </Card>

      {creating ? (
        <NewSupplierModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            query.refetch();
          }}
        />
      ) : null}

      {selected ? (
        <SupplierModal
          supplierId={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            query.refetch();
          }}
        />
      ) : null}
    </>
  );
}

function asNumber(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function asText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

const SUPPLIER_STATUSES = ["ACTIVE", "INACTIVE"];

interface SupplierFormValues extends Record<string, unknown> {
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  account_number: string;
  website: string;
  lead_time_days: string;
  payment_terms: string;
  notes: string;
}

function NewSupplierModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const form = useForm<SupplierFormValues>({
    name: "",
    contact_name: "",
    email: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
    account_number: "",
    website: "",
    lead_time_days: "0",
    payment_terms: "",
    notes: "",
  });
  const create = useApiMutation((body: Record<string, unknown>) => suppliersApi.create(body));

  async function submit() {
    if (form.missing(["name"]).length > 0) return;
    const created = await create.run({
      name: form.values.name.trim(),
      contact_name: form.values.contact_name || null,
      email: form.values.email || null,
      phone: form.values.phone || null,
      address_line1: form.values.address_line1 || null,
      address_line2: form.values.address_line2 || null,
      city: form.values.city || null,
      state: form.values.state || null,
      postal_code: form.values.postal_code || null,
      country: form.values.country || null,
      account_number: form.values.account_number || null,
      website: form.values.website || null,
      lead_time_days: Number(form.values.lead_time_days) || 0,
      payment_terms: form.values.payment_terms || null,
      notes: form.values.notes || null,
    });
    if (created) {
      form.reset();
      onCreated();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New supplier"
      description="Somebody the shop buys parts and supplies from."
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose} disabled={create.pending}>
            Cancel
          </Button>
          <Button variant="primary" pending={create.pending} onClick={() => void submit()}>
            Add supplier
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
          <Field label="Name" required>
            <Input
              value={form.values.name}
              onChange={(event) => form.set("name", event.target.value)}
            />
          </Field>
          <Field label="Contact name">
            <Input
              value={form.values.contact_name}
              onChange={(event) => form.set("contact_name", event.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email">
            <Input
              type="email"
              value={form.values.email}
              onChange={(event) => form.set("email", event.target.value)}
            />
          </Field>
          <Field label="Phone">
            <Input
              value={form.values.phone}
              onChange={(event) => form.set("phone", event.target.value)}
            />
          </Field>
        </div>

        <Field label="Address line 1">
          <Input
            value={form.values.address_line1}
            onChange={(event) => form.set("address_line1", event.target.value)}
          />
        </Field>
        <Field label="Address line 2">
          <Input
            value={form.values.address_line2}
            onChange={(event) => form.set("address_line2", event.target.value)}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="City">
            <Input
              value={form.values.city}
              onChange={(event) => form.set("city", event.target.value)}
            />
          </Field>
          <Field label="State">
            <Input
              value={form.values.state}
              onChange={(event) => form.set("state", event.target.value)}
            />
          </Field>
          <Field label="Postcode">
            <Input
              value={form.values.postal_code}
              onChange={(event) => form.set("postal_code", event.target.value)}
            />
          </Field>
          <Field label="Country">
            <Input
              value={form.values.country}
              onChange={(event) => form.set("country", event.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Lead time (days)" hint="0 when it is not known.">
            <Input
              type="number"
              step="1"
              min="0"
              value={form.values.lead_time_days}
              onChange={(event) => form.set("lead_time_days", event.target.value)}
            />
          </Field>
          <Field label="Payment terms" hint="e.g. Net 30">
            <Input
              value={form.values.payment_terms}
              onChange={(event) => form.set("payment_terms", event.target.value)}
            />
          </Field>
          <Field label="Account number">
            <Input
              value={form.values.account_number}
              onChange={(event) => form.set("account_number", event.target.value)}
            />
          </Field>
        </div>

        <Field label="Website">
          <Input
            value={form.values.website}
            onChange={(event) => form.set("website", event.target.value)}
          />
        </Field>

        <Field label="Notes">
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

function SupplierModal({
  supplierId,
  onClose,
  onChanged,
}: {
  supplierId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { can } = useSession();
  const query = useApiQuery(() => suppliersApi.get(supplierId), [supplierId]);
  const summary = useApiQuery(() => suppliersApi.summary(supplierId), [supplierId]);

  const supplier = query.data as Supplier | null;

  return (
    <Modal
      open
      onClose={onClose}
      title={supplier?.name ?? "Supplier"}
      description="Contact details, trading status and everything the shop has bought from them."
      width="max-w-2xl"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {query.loading && query.initial ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : !supplier ? (
        <EmptyState title="Supplier not found" />
      ) : (
        <SupplierEditor
          supplier={supplier}
          summary={summary.data}
          summaryLoading={summary.loading && summary.initial}
          canWrite={can("suppliers:write")}
          onClose={onClose}
          onChanged={() => {
            onChanged();
            query.refetch();
            summary.refetch();
          }}
        />
      )}
    </Modal>
  );
}

function SupplierEditor({
  supplier,
  summary,
  summaryLoading,
  canWrite,
  onClose,
  onChanged,
}: {
  supplier: Supplier;
  summary: Record<string, unknown> | null;
  summaryLoading: boolean;
  canWrite: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const form = useForm<SupplierFormValues>({
    name: supplier.name,
    contact_name: supplier.contact_name ?? "",
    email: supplier.email ?? "",
    phone: supplier.phone ?? "",
    address_line1: supplier.address_line1 ?? "",
    address_line2: supplier.address_line2 ?? "",
    city: supplier.city ?? "",
    state: supplier.state ?? "",
    postal_code: supplier.postal_code ?? "",
    country: supplier.country ?? "",
    account_number: supplier.account_number ?? "",
    website: supplier.website ?? "",
    lead_time_days: String(supplier.lead_time_days ?? 0),
    payment_terms: supplier.payment_terms ?? "",
    notes: supplier.notes ?? "",
  });
  const [status, setStatus] = useState<string>(supplier.status);
  const [preferred, setPreferred] = useState<boolean>(supplier.is_preferred);

  const update = useApiMutation((body: Record<string, unknown>) =>
    suppliersApi.update(supplier.id, body),
  );
  const deactivate = useApiMutation(() => suppliersApi.deactivate(supplier.id));
  const remove = useApiMutation(() => suppliersApi.remove(supplier.id));

  const totalOrders = asNumber(summary?.total_orders);
  const deleteBlockedBy = deleteBlockedReason(totalOrders, canWrite);

  async function save() {
    if (form.missing(["name"]).length > 0) return;
    const saved = await update.run({
      name: form.values.name.trim(),
      contact_name: form.values.contact_name || null,
      email: form.values.email || null,
      phone: form.values.phone || null,
      address_line1: form.values.address_line1 || null,
      address_line2: form.values.address_line2 || null,
      city: form.values.city || null,
      state: form.values.state || null,
      postal_code: form.values.postal_code || null,
      country: form.values.country || null,
      account_number: form.values.account_number || null,
      website: form.values.website || null,
      lead_time_days: Number(form.values.lead_time_days) || 0,
      payment_terms: form.values.payment_terms || null,
      notes: form.values.notes || null,
      status,
      is_preferred: preferred,
    });
    if (saved) onChanged();
  }

  async function retire() {
    const done = await deactivate.run();
    if (done) onChanged();
  }

  async function deleteSupplier() {
    const done = await remove.run();
    if (done) {
      onChanged();
      onClose();
    }
  }

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <KeyValue label="Orders">{formatNumber(totalOrders)}</KeyValue>
        <KeyValue label="Open">{formatNumber(asNumber(summary?.open_orders))}</KeyValue>
        <KeyValue label="Units received">
          {formatNumber(asNumber(summary?.total_units_received))}
        </KeyValue>
        <KeyValue label="Spend">{formatMoney(asNumber(summary?.total_spend))}</KeyValue>
        <KeyValue label="Last order">{formatDate(asText(summary?.last_order_date))}</KeyValue>
        <KeyValue label="Last received">{formatDate(asText(summary?.last_received_at))}</KeyValue>
        <KeyValue label="Status">
          <StatusBadge status={supplier.status} />
        </KeyValue>
        <KeyValue label="Preferred">
          <YesNo value={supplier.is_preferred} trueLabel="Preferred" falseLabel="" />
        </KeyValue>
      </dl>

      {summaryLoading ? (
        <Loading label="Reading what the shop has bought…" />
      ) : totalOrders > 0 ? (
        <Notice tone="info">
          {formatNumber(totalOrders)} order(s) have been placed with this supplier. Spend counts only
          what actually arrived, so a draft or cancelled order never counts against them.
        </Notice>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="space-y-3"
      >
        <FormError error={update.error} />
        <FormError error={deactivate.error} />
        <FormError error={remove.error} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required>
            <Input
              value={form.values.name}
              disabled={!canWrite}
              onChange={(event) => form.set("name", event.target.value)}
            />
          </Field>
          <Field label="Contact name">
            <Input
              value={form.values.contact_name}
              disabled={!canWrite}
              onChange={(event) => form.set("contact_name", event.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email">
            <Input
              type="email"
              value={form.values.email}
              disabled={!canWrite}
              onChange={(event) => form.set("email", event.target.value)}
            />
          </Field>
          <Field label="Phone">
            <Input
              value={form.values.phone}
              disabled={!canWrite}
              onChange={(event) => form.set("phone", event.target.value)}
            />
          </Field>
        </div>

        <Field label="Address line 1">
          <Input
            value={form.values.address_line1}
            disabled={!canWrite}
            onChange={(event) => form.set("address_line1", event.target.value)}
          />
        </Field>
        <Field label="Address line 2">
          <Input
            value={form.values.address_line2}
            disabled={!canWrite}
            onChange={(event) => form.set("address_line2", event.target.value)}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="City">
            <Input
              value={form.values.city}
              disabled={!canWrite}
              onChange={(event) => form.set("city", event.target.value)}
            />
          </Field>
          <Field label="State">
            <Input
              value={form.values.state}
              disabled={!canWrite}
              onChange={(event) => form.set("state", event.target.value)}
            />
          </Field>
          <Field label="Postcode">
            <Input
              value={form.values.postal_code}
              disabled={!canWrite}
              onChange={(event) => form.set("postal_code", event.target.value)}
            />
          </Field>
          <Field label="Country">
            <Input
              value={form.values.country}
              disabled={!canWrite}
              onChange={(event) => form.set("country", event.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Lead time (days)">
            <Input
              type="number"
              step="1"
              min="0"
              value={form.values.lead_time_days}
              disabled={!canWrite}
              onChange={(event) => form.set("lead_time_days", event.target.value)}
            />
          </Field>
          <Field label="Payment terms">
            <Input
              value={form.values.payment_terms}
              disabled={!canWrite}
              onChange={(event) => form.set("payment_terms", event.target.value)}
            />
          </Field>
          <Field label="Account number">
            <Input
              value={form.values.account_number}
              disabled={!canWrite}
              onChange={(event) => form.set("account_number", event.target.value)}
            />
          </Field>
        </div>

        <Field label="Website">
          <Input
            value={form.values.website}
            disabled={!canWrite}
            onChange={(event) => form.set("website", event.target.value)}
          />
        </Field>

        <Field label="Notes">
          <Textarea
            rows={2}
            value={form.values.notes}
            disabled={!canWrite}
            onChange={(event) => form.set("notes", event.target.value)}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Trading status">
            <Select
              value={status}
              disabled={!canWrite}
              onChange={(event) => setStatus(event.target.value)}
            >
              {SUPPLIER_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Preferred" hint="Shown first in the parts desk's habits.">
            <Select
              value={preferred ? "yes" : "no"}
              disabled={!canWrite}
              onChange={(event) => setPreferred(event.target.value === "yes")}
            >
              <option value="no">Not preferred</option>
              <option value="yes">Preferred</option>
            </Select>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="primary" pending={update.pending} disabled={!canWrite}>
            Save changes
          </Button>
          {supplier.status === "ACTIVE" ? (
            <Button
              variant="secondary"
              pending={deactivate.pending}
              disabled={!canWrite}
              onClick={() => void retire()}
            >
              Deactivate
            </Button>
          ) : (
            <Badge tone="neutral">Deactivated — takes no new orders</Badge>
          )}
          {deleteBlockedBy ? null : (
            <Button variant="danger" pending={remove.pending} onClick={() => void deleteSupplier()}>
              Delete
            </Button>
          )}
        </div>
      </form>

      {deleteBlockedBy ? (
        <Notice tone="info">
          <Badge tone="warning">Delete unavailable</Badge> {deleteBlockedBy}
        </Notice>
      ) : (
        <Notice tone="info">
          Nothing has ever been ordered from this supplier, so the record can be removed outright.
          Once there is an order against it, deactivating is the only way it ends.
        </Notice>
      )}

      <Notice tone="info">
        Deactivating keeps the whole order book and every ledger movement that names this supplier.
        It simply disappears from the pickers, and new orders against it are refused.
      </Notice>
    </div>
  );
}

function deleteBlockedReason(totalOrders: number, allowed: boolean): string | null {
  if (!allowed) return "Editing suppliers is held on a permission you do not hold.";
  if (totalOrders > 0)
    return `The shop has ordered ${formatNumber(totalOrders)} time(s) from them. A supplier with an order book is retired, not removed — those documents quote the name.`;
  return null;
}
