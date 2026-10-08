"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader, StatTile, Toolbar } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { useReferences } from "@/components/layout/ReferenceProvider";
import { laborApi, repairOrdersApi } from "@/lib/api/work";
import type { LaborRecord } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";

/**
 * The shop's labour records.
 *
 * Two things on this screen are worth stating plainly. First, a labour record is
 * evidence: it is the only record that anybody worked those hours, so deleting
 * one removes the fact rather than correcting it — the dialog says so before the
 * button is offered. Second, actual hours and billable hours are different
 * numbers on purpose, and the gap between them is what the shop gives away.
 *
 * The summary tiles are the current page only. They are a reading of what is on
 * screen, not a shop-wide figure, and they are labelled as such so nobody quotes
 * them as the month's labour.
 */
export default function LabourPage() {
  const { can } = useSession();
  const { userName, staff } = useReferences();
  const [technicianId, setTechnicianId] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<LaborRecord | null>(null);

  const query = useApiQuery(
    () =>
      laborApi.list({
        page,
        size: 25,
        technician_id: technicianId || undefined,
      }),
    [page, technicianId],
  );

  // Labour rows carry RO ids. The recent orders are loaded once to put numbers and
  // statuses on the table; without the status there is no way to warn before a
  // write the backend will refuse.
  const orders = useApiQuery(
    () => repairOrdersApi.list({ size: 100 }).then((result) => result.data),
    [],
    { enabled: can("repair_orders:read") },
  );

  const roById = new Map((orders.data ?? []).map((ro) => [ro.id, ro]));
  const rows = query.data?.data ?? [];

  const pageActual = rows.reduce((sum, record) => sum + record.actual_hours, 0);
  const pageBillable = rows.reduce((sum, record) => sum + record.billable_hours, 0);
  const pageCost = rows.reduce((sum, record) => sum + record.labor_cost, 0);

  const columns: Column<LaborRecord>[] = [
    {
      key: "technician",
      header: "Technician",
      render: (record) => (
        <span className="text-sm">
          {record.technician_id ? userName(record.technician_id) : "Unassigned"}
        </span>
      ),
    },
    {
      key: "ro",
      header: "Repair order",
      render: (record) => (
        <Link
          href={`/repair-orders/${record.repair_order_id}`}
          className="text-sm font-medium text-brand-700 hover:underline"
        >
          {roById.get(record.repair_order_id)?.ro_number ?? "Open"}
        </Link>
      ),
    },
    {
      key: "description",
      header: "Work",
      render: (record) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-900">{record.description}</p>
          {record.notes ? <p className="text-xs text-ink-500">{record.notes}</p> : null}
        </div>
      ),
    },
    {
      key: "actual",
      header: "Actual h",
      numeric: true,
      render: (record) => <span className="tabular text-xs">{formatNumber(record.actual_hours, 2)}</span>,
    },
    {
      key: "billable",
      header: "Billable h",
      numeric: true,
      render: (record) => (
        <span
          className={
            record.billable_hours < record.actual_hours
              ? "tabular text-xs font-medium text-amber-700"
              : "tabular text-xs"
          }
        >
          {formatNumber(record.billable_hours, 2)}
        </span>
      ),
    },
    {
      key: "rate",
      header: "Rate",
      numeric: true,
      render: (record) => <span className="tabular text-xs">{formatMoney(record.hourly_rate)}</span>,
    },
    {
      key: "cost",
      header: "Cost",
      numeric: true,
      render: (record) => (
        <span className="tabular text-sm font-medium">{formatMoney(record.labor_cost)}</span>
      ),
    },
    {
      key: "performed_at",
      header: "Performed",
      numeric: true,
      render: (record) => (
        <span className="text-xs text-ink-500">{formatDateTime(record.performed_at)}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Labour"
        subtitle={query.data ? `${query.data.meta.total} record(s) on file` : undefined}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Actual hours on this page"
          value={formatNumber(pageActual, 2)}
          hint="Hours worked"
        />
        <StatTile
          label="Billable hours on this page"
          value={formatNumber(pageBillable, 2)}
          hint={
            pageBillable < pageActual
              ? `${formatNumber(pageActual - pageBillable, 2)}h worked but not charged`
              : "Hours charged for"
          }
          tone={pageBillable < pageActual ? "warning" : "neutral"}
        />
        <StatTile label="Cost on this page" value={formatMoney(pageCost)} hint="This page only" />
      </div>

      <Card padded={false}>
        <Toolbar>
          <label className="block">
            <span className="sr-only">Technician</span>
            <Select
              value={technicianId}
              onChange={(event) => {
                setTechnicianId(event.target.value);
                setPage(1);
              }}
              className="w-52"
            >
              <option value="">Anyone</option>
              {staff.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.first_name} {person.last_name}
                </option>
              ))}
            </Select>
          </label>
          <p className="text-xs text-ink-500">
            Hours are logged on a repair order, while it is IN_PROGRESS or ON_HOLD. Open a repair
            order to log new time.
          </p>
        </Toolbar>

        {query.loading && query.initial ? (
          <Loading label="Reading the labour records…" />
        ) : query.error ? (
          <div className="p-4">
            <ErrorState error={query.error} onRetry={query.refetch} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No labour records match"
            description="Time is recorded against a repair order, by a technician, while the job is being worked on."
          />
        ) : (
          <>
            <DataTable
              rows={rows}
              columns={columns}
              rowKey={(record) => record.id}
              onRowClick={can("labor:write") ? (record) => setEditing(record) : undefined}
              dense
            />
            <Pagination
              page={query.data?.meta.page ?? page}
              pages={query.data?.meta.pages ?? 1}
              total={query.data?.meta.total ?? 0}
              onPage={setPage}
            />
          </>
        )}
      </Card>

      {editing ? (
        <EditLabourModal
          record={editing}
          roNumber={roById.get(editing.repair_order_id)?.ro_number}
          roStatus={roById.get(editing.repair_order_id)?.status}
          staff={staff}
          onClose={() => setEditing(null)}
          onChanged={() => {
            setEditing(null);
            query.refetch();
          }}
        />
      ) : null}
    </>
  );
}

function EditLabourModal({
  record,
  roNumber,
  roStatus,
  staff,
  onClose,
  onChanged,
}: {
  record: LaborRecord;
  roNumber?: string;
  roStatus?: string;
  staff: { id: string; first_name: string; last_name: string }[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [description, setDescription] = useState(record.description);
  const [actualHours, setActualHours] = useState(String(record.actual_hours));
  const [billableHours, setBillableHours] = useState(String(record.billable_hours));
  const [rate, setRate] = useState(String(record.hourly_rate));
  const [technicianId, setTechnicianId] = useState(record.technician_id ?? "");
  const [performedAt, setPerformedAt] = useState(record.performed_at.slice(0, 16));
  const [notes, setNotes] = useState(record.notes ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const save = useApiMutation((body: Parameters<typeof laborApi.update>[1]) =>
    laborApi.update(record.id, body),
  );
  const remove = useApiMutation(() => laborApi.remove(record.id));

  // The backend refuses to change a labour record once its order has left
  // IN_PROGRESS or ON_HOLD, because the record is the evidence that the work
  // happened.
  const locked = roStatus !== undefined && !["IN_PROGRESS", "ON_HOLD"].includes(roStatus);
  const lockReason =
    roStatus === undefined
      ? null
      : locked
        ? `The repair order is ${roStatus}. Time can only be corrected while the order is IN_PROGRESS or ON_HOLD.`
        : null;

  async function submit() {
    const found: string[] = [];
    if (!description.trim()) found.push("Describe the work that was done");
    if (Number(actualHours) <= 0) found.push("Actual hours must be greater than zero");
    if (billableHours && Number(billableHours) < 0) found.push("Billable hours cannot be negative");
    setProblems(found);
    if (found.length > 0) return;

    const saved = await save.run({
      description: description.trim(),
      actual_hours: Number(actualHours),
      billable_hours: billableHours ? Number(billableHours) : null,
      hourly_rate: rate ? Number(rate) : 0,
      technician_id: technicianId || null,
      performed_at: performedAt || null,
      notes: notes.trim() || null,
    });
    if (saved) onChanged();
  }

  async function destroy() {
    const deleted = await remove.run();
    if (deleted !== null) onChanged();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Labour record"
      description={roNumber ? `Against ${roNumber}` : undefined}
      footer={
        <>
          <Button
            variant="danger"
            className="mr-auto"
            disabled={locked || remove.pending}
            title={lockReason ?? undefined}
            onClick={() => setConfirmingDelete(true)}
          >
            Delete
          </Button>
          <Button onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            pending={save.pending}
            disabled={locked}
            title={lockReason ?? undefined}
            onClick={() => void submit()}
          >
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
        {lockReason ? <Notice tone="info">{lockReason}</Notice> : null}
        {problems.length > 0 ? (
          <Notice tone="danger">
            <ul className="list-disc space-y-0.5 pl-4">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </Notice>
        ) : null}

        <Field label="Work done" required>
          <Input value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Actual hours" required hint="What was worked">
            <Input
              type="number"
              min="0"
              step="0.1"
              value={actualHours}
              onChange={(event) => setActualHours(event.target.value)}
            />
          </Field>
          <Field label="Billable hours" hint="What will be charged">
            <Input
              type="number"
              min="0"
              step="0.1"
              value={billableHours}
              onChange={(event) => setBillableHours(event.target.value)}
            />
          </Field>
          <Field label="Hourly rate">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Technician">
            <Select value={technicianId} onChange={(event) => setTechnicianId(event.target.value)}>
              <option value="">Unassigned</option>
              {staff.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.first_name} {person.last_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Performed at">
            <Input
              type="datetime-local"
              value={performedAt}
              onChange={(event) => setPerformedAt(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Notes">
          <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </form>

      {confirmingDelete ? (
        <Modal
          open
          onClose={() => setConfirmingDelete(false)}
          title="Delete this labour record?"
          description="Deleting removes the evidence that these hours were worked. It cannot be undone from here."
          footer={
            <>
              <Button onClick={() => setConfirmingDelete(false)} disabled={remove.pending}>
                Keep it
              </Button>
              <Button variant="danger" pending={remove.pending} onClick={() => void destroy()}>
                Delete the record
              </Button>
            </>
          }
        >
          <Notice tone="danger">
            {formatNumber(record.actual_hours, 2)}h of {record.description} will no longer be on
            file for {roNumber ?? "this order"}. If the hours were logged in error, correcting them
            is the better fix.
          </Notice>
        </Modal>
      ) : null}
    </Modal>
  );
}