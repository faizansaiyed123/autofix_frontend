"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { StatusBadge, YesNo } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, KeyValue, KeyValueGrid } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Field, FormError, Input, Select, Textarea, useForm } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { appointmentsApi, customersApi } from "@/lib/api/shop";
import { estimatesApi, repairOrdersApi } from "@/lib/api/work";
import { invoicesApi } from "@/lib/api/money";
import type { Appointment, Customer, CustomerStatus, ContactMethod, Estimate, Invoice, RepairOrder, Vehicle } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";

/**
 * One customer, and everything the shop knows about them.
 *
 * The history is assembled from the shop's own records — appointments, estimates,
 * repair orders and invoices — rather than from a per-customer summary endpoint.
 * Those are four queries that already exist and are already filtered, so a
 * summary table here would be a second place for the same numbers to go stale.
 */
export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useSession();
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const customer = useApiQuery(() => customersApi.get(id), [id]);
  const vehicles = useApiQuery(() => customersApi.vehicles(id), [id]);
  const appointments = useApiQuery(
    () => appointmentsApi.list({ customer_id: id, size: 10 }).then((p) => p.data),
    [id],
  );
  const estimates = useApiQuery(
    () => estimatesApi.list({ customer_id: id, size: 10 }).then((p) => p.data),
    [id],
  );
  const repairOrders = useApiQuery(
    () => repairOrdersApi.list({ customer_id: id, size: 10 }).then((p) => p.data),
    [id],
  );
  const invoices = useApiQuery(
    () => invoicesApi.list({ customer_id: id, size: 10 }).then((p) => p.data),
    [id],
  );

  if (customer.loading && customer.initial) return <Loading label="Opening the account…" />;
  if (customer.error) return <ErrorState error={customer.error} onRetry={customer.refetch} />;

  const record = customer.data;
  if (!record) return <ErrorState error={new Error("Customer not found")} />;

  return (
    <>
      <PageHeader
        breadcrumb={<Link href="/customers" className="hover:underline">Customers</Link>}
        title={`${record.first_name} ${record.last_name}`}
        subtitle={record.company_name ?? undefined}
        actions={
          <>
            <StatusBadge status={record.customer_status} />
            {can("customers:write") ? (
              <Button onClick={() => setEditing(true)}>Edit</Button>
            ) : null}
          </>
        }
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Contact" />
          <KeyValueGrid className="grid-cols-2">
            <KeyValue label="Email">
              {record.email ? (
                <a href={`mailto:${record.email}`} className="text-brand-700 hover:underline">
                  {record.email}
                </a>
              ) : (
                "—"
              )}
            </KeyValue>
            <KeyValue label="Phone">{record.phone ?? "—"}</KeyValue>
            <KeyValue label="Prefers">{record.preferred_contact}</KeyValue>
            <KeyValue label="Portal login">
              {record.user_id ? (
                <YesNo value={true} trueLabel="Linked" />
              ) : (
                <span className="text-ink-500">Not linked</span>
              )}
            </KeyValue>
          </KeyValueGrid>
          {record.notes ? (
            <p className="mt-3 border-t border-ink-100 pt-3 text-sm whitespace-pre-line text-ink-600">
              {record.notes}
            </p>
          ) : null}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Addresses"
            subtitle="Reused on billing and delivery paperwork"
          />
          {record.addresses.length === 0 ? (
            <EmptyState title="No addresses on file" />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {record.addresses.map((address, index) => (
                <li key={address.id ?? index} className="rounded-lg bg-ink-50 p-3 text-sm">
                  <p className="mb-1 text-xs font-medium tracking-wide text-ink-500 uppercase">
                    {address.address_type}
                  </p>
                  <p className="text-ink-800">{address.street}</p>
                  <p className="text-ink-600">
                    {[address.city, address.state, address.postal_code].filter(Boolean).join(", ")}
                  </p>
                  <p className="text-ink-500">{address.country}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mb-4">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Vehicles"
              actions={
                <Link href="/vehicles" className="text-sm text-brand-700 hover:underline">
                  Vehicle book
                </Link>
              }
            />
          </div>
          {vehicles.loading ? (
            <Loading />
          ) : !vehicles.data || vehicles.data.length === 0 ? (
            <EmptyState
              title="No vehicles on this account"
              description="Add one from the vehicle book to start booking work against it."
            />
          ) : (
            <DataTable
              rows={vehicles.data}
              dense
              rowKey={(v) => v.id}
              columns={vehicleColumns}
            />
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="Appointments" subtitle="The ten most recent" />
          </div>
          {appointments.loading ? (
            <Loading />
          ) : !appointments.data || appointments.data.length === 0 ? (
            <EmptyState title="No appointments yet" />
          ) : (
            <DataTable rows={appointments.data} dense rowKey={(a) => a.id} columns={appointmentColumns} />
          )}
        </Card>

        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="Estimates" subtitle="The ten most recent" />
          </div>
          {estimates.loading ? (
            <Loading />
          ) : !estimates.data || estimates.data.length === 0 ? (
            <EmptyState title="No estimates yet" />
          ) : (
            <DataTable rows={estimates.data} dense rowKey={(e) => e.id} columns={estimateColumns} />
          )}
        </Card>

        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="Repair orders" subtitle="The ten most recent" />
          </div>
          {repairOrders.loading ? (
            <Loading />
          ) : !repairOrders.data || repairOrders.data.length === 0 ? (
            <EmptyState title="No repair orders yet" />
          ) : (
            <DataTable rows={repairOrders.data} dense rowKey={(r) => r.id} columns={repairOrderColumns} />
          )}
        </Card>

        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="Invoices" subtitle="The ten most recent" />
          </div>
          {invoices.loading ? (
            <Loading />
          ) : !invoices.data || invoices.data.length === 0 ? (
            <EmptyState title="No invoices yet" />
          ) : (
            <DataTable rows={invoices.data} dense rowKey={(i) => i.id} columns={invoiceColumns} />
          )}
        </Card>
      </div>

      <EditCustomerModal
        open={editing}
        customer={record}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          customer.refetch();
        }}
        onDeleted={() => router.push("/customers")}
      />
    </>
  );
}

const vehicleColumns: Column<Vehicle>[] = [
  {
    key: "vehicle",
    header: "Vehicle",
    render: (v) => (
      <Link href={`/vehicles/${v.id}`} className="font-medium text-brand-700 hover:underline">
        {[v.year, v.make, v.model].filter(Boolean).join(" ")}
      </Link>
    ),
  },
  {
    key: "plate",
    header: "Plate / VIN",
    render: (v) => (
      <span className="text-xs text-ink-600">
        {v.license_plate ?? "—"}
        {v.vin ? <span className="block text-ink-400">{v.vin}</span> : null}
      </span>
    ),
  },
  { key: "mileage", header: "Mileage", numeric: true, render: (v) => formatNumber(v.mileage) },
  { key: "status", header: "Status", render: (v) => <StatusBadge status={v.status} /> },
];

const appointmentColumns: Column<Appointment>[] = [
  {
    key: "when",
    header: "When",
    render: (a) => <span className="text-xs">{formatDateTime(a.scheduled_start)}</span>,
  },
  { key: "service", header: "Service", render: (a) => a.service_type },
  { key: "status", header: "Status", render: (a) => <StatusBadge status={a.status} /> },
];

const estimateColumns: Column<Estimate>[] = [
  {
    key: "number",
    header: "Estimate",
    render: (e) => (
      <Link href={`/estimates/${e.id}`} className="font-medium text-brand-700 hover:underline">
        {e.estimate_number}
      </Link>
    ),
  },
  { key: "total", header: "Total", numeric: true, render: (e) => formatMoney(e.total) },
  { key: "status", header: "Status", render: (e) => <StatusBadge status={e.status} /> },
];

const repairOrderColumns: Column<RepairOrder>[] = [
  {
    key: "number",
    header: "RO",
    render: (r) => (
      <Link href={`/repair-orders/${r.id}`} className="font-medium text-brand-700 hover:underline">
        {r.ro_number}
      </Link>
    ),
  },
  { key: "bay", header: "Bay", render: (r) => r.bay ?? "—" },
  { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
];

const invoiceColumns: Column<Invoice>[] = [
  {
    key: "number",
    header: "Invoice",
    render: (i) => (
      <Link href={`/invoices/${i.id}`} className="font-medium text-brand-700 hover:underline">
        {i.invoice_number}
      </Link>
    ),
  },
  { key: "balance", header: "Balance", numeric: true, render: (i) => formatMoney(i.balance) },
  {
    key: "status",
    header: "Status",
    render: (i) => (
      <span className="flex items-center gap-1.5">
        <StatusBadge status={i.status} />
        {i.is_overdue ? <StatusBadge status="OVERDUE" /> : null}
      </span>
    ),
  },
];

function EditCustomerModal({
  open,
  customer,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  customer: Customer;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const { can } = useSession();
  const form = useForm({
    first_name: customer.first_name,
    last_name: customer.last_name,
    company_name: customer.company_name ?? "",
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    preferred_contact: customer.preferred_contact,
    customer_status: customer.customer_status,
    notes: customer.notes ?? "",
  });
  const save = useApiMutation(() =>
    customersApi.update(customer.id, {
      first_name: form.values.first_name,
      last_name: form.values.last_name,
      company_name: form.values.company_name || null,
      email: form.values.email || null,
      phone: form.values.phone || null,
      preferred_contact: form.values.preferred_contact,
      customer_status: form.values.customer_status,
      notes: form.values.notes || null,
    }),
  );
  const remove = useApiMutation(() => customersApi.remove(customer.id));

  async function submit() {
    const updated = await save.run();
    if (updated) onSaved();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${customer.first_name} ${customer.last_name}`}
      description="Editing a customer does not touch what they are billed."
      footer={
        <>
          {can("customers:manage") ? (
            <Button
              variant="danger"
              className="mr-auto"
              pending={remove.pending}
              onClick={() => {
                if (confirm("Delete this customer? Only a customer with no history can be removed.")) {
                  remove.run().then((ok) => {
                    if (ok !== null) onDeleted();
                  });
                }
              }}
            >
              Delete
            </Button>
          ) : null}
          <Button onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button variant="primary" pending={save.pending} onClick={() => void submit()}>
            Save
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
        <FormError error={save.error ?? remove.error} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name" required>
            <Input value={form.values.first_name} onChange={(e) => form.set("first_name", e.target.value)} />
          </Field>
          <Field label="Last name" required>
            <Input value={form.values.last_name} onChange={(e) => form.set("last_name", e.target.value)} />
          </Field>
        </div>
        <Field label="Company">
          <Input
            value={form.values.company_name}
            onChange={(e) => form.set("company_name", e.target.value)}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email">
            <Input type="email" value={form.values.email} onChange={(e) => form.set("email", e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={form.values.phone} onChange={(e) => form.set("phone", e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Prefers">
            <Select
              value={form.values.preferred_contact}
              onChange={(e) => form.set("preferred_contact", e.target.value as ContactMethod)}
            >
              <option value="EMAIL">Email</option>
              <option value="PHONE">Phone</option>
              <option value="SMS">Text message</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={form.values.customer_status}
              onChange={(e) => form.set("customer_status", e.target.value as CustomerStatus)}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </Select>
          </Field>
        </div>
        <Field label="Notes">
          <Textarea rows={3} value={form.values.notes} onChange={(e) => form.set("notes", e.target.value)} />
        </Field>
        {!customer.user_id ? (
          <Notice tone="info">
            This account has no portal login, so nothing on it is visible to the customer online.
          </Notice>
        ) : null}
      </form>
    </Modal>
  );
}