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
import { customersApi } from "@/lib/api/shop";
import type { Customer } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";

/**
 * The shop's customer book.
 *
 * This is the whole shop's list, not the caller's own — it sits behind the staff
 * gate for exactly that reason. A customer reaches their own account through the
 * portal instead, where the account comes from the token and there is no id to
 * get wrong.
 */
export default function CustomersPage() {
  const { can } = useSession();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const query = useApiQuery(
    () =>
      customersApi.list({
        page,
        size: 25,
        search: search || undefined,
        customer_status: status || undefined,
      }),
    [page, search, status],
  );

  const columns: Column<Customer>[] = [
    {
      key: "name",
      header: "Customer",
      render: (c) => (
        <div>
          <Link href={`/customers/${c.id}`} className="font-medium text-brand-700 hover:underline">
            {c.first_name} {c.last_name}
          </Link>
          {c.company_name ? <p className="text-xs text-ink-500">{c.company_name}</p> : null}
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      render: (c) => (
        <div className="text-sm">
          {c.email ? <p>{c.email}</p> : null}
          {c.phone ? <p className="text-xs text-ink-500">{c.phone}</p> : null}
          {!c.email && !c.phone ? <span className="text-ink-400">—</span> : null}
        </div>
      ),
    },
    {
      key: "preferred",
      header: "Prefers",
      render: (c) => <span className="text-xs text-ink-600">{c.preferred_contact}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (c) => <StatusBadge status={c.customer_status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={query.data ? `${query.data.meta.total} in the book` : undefined}
        actions={
          can("customers:write") ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              New customer
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
            placeholder="Name, email, phone or company"
            className="min-w-64 flex-1"
          />
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="w-40"
          >
            <option value="">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </Select>
        </Toolbar>

        {query.loading && query.initial ? (
          <Loading />
        ) : query.error ? (
          <div className="p-4">
            <ErrorState error={query.error} onRetry={query.refetch} />
          </div>
        ) : !query.data || query.data.data.length === 0 ? (
          <EmptyState
            title={search ? "No customer matches that" : "No customers yet"}
            description={
              search
                ? "Try part of a name, an email address or a company."
                : "Add the first one to start booking work."
            }
          />
        ) : (
          <>
            <DataTable
              rows={query.data.data}
              columns={ columns}
              rowKey={(c) => c.id}
              onRowClick={(c) => router.push(`/customers/${c.id}`)}
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

      <NewCustomerModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          query.refetch();
          router.push(`/customers/${id}`);
        }}
      />
    </>
  );
}

function NewCustomerModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const form = useForm({
    first_name: "",
    last_name: "",
    company_name: "",
    email: "",
    phone: "",
    preferred_contact: "EMAIL",
  });
  const create = useApiMutation((body: Record<string, unknown>) => customersApi.create(body as never));

  async function submit() {
    const missing = form.missing(["first_name", "last_name"]);
    if (missing.length > 0) return;
    const created = await create.run({
      first_name: form.values.first_name,
      last_name: form.values.last_name,
      company_name: form.values.company_name || null,
      email: form.values.email || null,
      phone: form.values.phone || null,
      preferred_contact: form.values.preferred_contact,
    });
    if (created) {
      form.reset();
      onCreated(created.id);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New customer"
      description="An individual or a business — a company name is optional."
      footer={
        <>
          <Button onClick={onClose} disabled={create.pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} pending={create.pending}>
            Create customer
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
          <Field label="First name" required>
            <Input
              value={form.values.first_name}
              onChange={(e) => form.set("first_name", e.target.value)}
            />
          </Field>
          <Field label="Last name" required>
            <Input
              value={form.values.last_name}
              onChange={(e) => form.set("last_name", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Company" hint="Optional — for a business account">
          <Input
            value={form.values.company_name}
            onChange={(e) => form.set("company_name", e.target.value)}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email">
            <Input
              type="email"
              value={form.values.email}
              onChange={(e) => form.set("email", e.target.value)}
            />
          </Field>
          <Field label="Phone">
            <Input
              value={form.values.phone}
              onChange={(e) => form.set("phone", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Prefers to be contacted by">
          <Select
            value={form.values.preferred_contact}
            onChange={(e) => form.set("preferred_contact", e.target.value)}
          >
            <option value="EMAIL">Email</option>
            <option value="PHONE">Phone</option>
            <option value="SMS">Text message</option>
          </Select>
        </Field>
        <Notice tone="info">
          Accounts are linked to a portal login separately — a customer record exists whether or not
          anybody can sign in to it.
        </Notice>
      </form>
    </Modal>
  );
}