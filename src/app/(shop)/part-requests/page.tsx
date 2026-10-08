"use client";

import Link from "next/link";
import { useState } from "react";

import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader, Toolbar } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { useReferences } from "@/components/layout/ReferenceProvider";
import { partRequestsApi, repairOrdersApi } from "@/lib/api/work";
import type { ApiError } from "@/lib/api/client";
import type { PartRequest, RepairOrder } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { PART_REQUEST_STATUSES } from "@/lib/status";
import { formatDateTime, formatNumber } from "@/lib/format";

/**
 * The parts desk queue.
 *
 * The list arrives without RO numbers — the API returns ids — so one shared
 * query loads the recent repair orders and resolves both the number in this
 * table and the picker in the "raise a request" dialog. One request instead of
 * one per row, and no id ever reaches the screen.
 *
 * A requester cannot decide their own request. That is the whole point of the
 * separation: the technician who wants a part does not get to be the one who
 * says yes to it.
 */
export default function PartRequestsPage() {
  const { can } = useSession();
  const { userName, staff } = useReferences();
  const [status, setStatus] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [rejecting, setRejecting] = useState<PartRequest | null>(null);

  const orders = useApiQuery(
    () => repairOrdersApi.list({ size: 100 }).then((result) => result.data),
    [],
    { enabled: can("repair_orders:read") },
  );

  const query = useApiQuery(
    () =>
      partRequestsApi.list({
        page,
        size: 25,
        status: status || undefined,
        requested_by_id: requestedBy || undefined,
      }),
    [page, status, requestedBy],
  );

  const decide = useApiMutation(
    (id: string, decision: "APPROVED" | "REJECTED", reason?: string) =>
      partRequestsApi.decide(id, decision, reason ?? null),
  );
  const fulfil = useApiMutation((id: string) => partRequestsApi.fulfil(id));

  const roNumberById = new Map((orders.data ?? []).map((ro) => [ro.id, ro.ro_number]));
  const mayDecide = can("part_requests:approve");

  const columns: Column<PartRequest>[] = [
    {
      key: "part",
      header: "Part",
      render: (request) => (
        <div className="min-w-0">
          <p className="font-medium text-ink-900">{request.part_name}</p>
          {request.part_number ? <p className="text-xs text-ink-500">{request.part_number}</p> : null}
          <p className="mt-1 line-clamp-2 text-xs text-ink-500">{request.reason}</p>
        </div>
      ),
    },
    {
      key: "number",
      header: "Number",
      numeric: true,
      render: (request) => <span className="tabular text-xs text-ink-500">#{request.id.slice(0, 8)}</span>,
    },
    {
      key: "quantity",
      header: "Qty",
      numeric: true,
      render: (request) => <span className="tabular text-sm">{formatNumber(request.quantity, 2)}</span>,
    },
    {
      key: "ro",
      header: "Repair order",
      render: (request) => (
        <Link
          href={`/repair-orders/${request.repair_order_id}`}
          className="text-sm font-medium text-brand-700 hover:underline"
        >
          {roNumberById.get(request.repair_order_id) ?? "Open"}
        </Link>
      ),
    },
    {
      key: "requested_by",
      header: "Requested by",
      render: (request) => (
        <span className="text-sm">
          {request.requested_by_id ? userName(request.requested_by_id) : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (request) => (
        <div className="min-w-0">
          <StatusBadge status={request.status} />
          {request.decision_reason ? (
            <p className="mt-1 text-xs text-ink-500">{request.decision_reason}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "decided_at",
      header: "Decided",
      numeric: true,
      render: (request) => (
        <span className="text-xs text-ink-500">{formatDateTime(request.decided_at)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      numeric: true,
      render: (request) => (
        <div className="flex items-center justify-end gap-2">
          {!mayDecide ? (
            <span className="text-xs text-ink-400">
              {request.status === "PENDING" ? "Awaiting parts" : "—"}
            </span>
          ) : request.status === "PENDING" ? (
            <>
              <Button
                size="sm"
                variant="success"
                pending={decide.pending}
                onClick={() => decide.run(request.id, "APPROVED").then(() => query.refetch())}
              >
                Approve
              </Button>
              <Button size="sm" variant="danger" onClick={() => setRejecting(request)}>
                Reject
              </Button>
            </>
          ) : request.status === "APPROVED" ? (
            <Button
              size="sm"
              pending={fulfil.pending}
              onClick={() => fulfil.run(request.id).then(() => query.refetch())}
            >
              Fulfill
            </Button>
          ) : (
            <span className="text-xs text-ink-400">Closed</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Part requests"
        subtitle={query.data ? `${query.data.meta.total} raised` : undefined}
        actions={
          can("part_requests:write") ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Raise a request
            </Button>
          ) : null
        }
      />

      {decide.error ? (
        <div className="mb-4">
          <Notice tone="danger">{decide.error.messageForUser}</Notice>
        </div>
      ) : null}
      {fulfil.error ? (
        <div className="mb-4">
          <Notice tone="danger">{fulfil.error.messageForUser}</Notice>
        </div>
      ) : null}

      <div className="mb-4">
        <Notice tone="info">
          Approving, rejecting and fulfilling are held by parts staff and the owner. Whoever raised
          a request cannot be the one who decides it.
        </Notice>
      </div>

      <Card padded={false}>
        <Toolbar>
          <label className="block">
            <span className="sr-only">Status</span>
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="w-44"
            >
              <option value="">Any status</option>
              {PART_REQUEST_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="sr-only">Requested by</span>
            <Select
              value={requestedBy}
              onChange={(event) => {
                setRequestedBy(event.target.value);
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
        </Toolbar>

        {query.loading && query.initial ? (
          <Loading label="Reading the queue…" />
        ) : query.error ? (
          <div className="p-4">
            <ErrorState error={query.error} onRetry={query.refetch} />
          </div>
        ) : !query.data || query.data.data.length === 0 ? (
          <EmptyState
            title="No part requests match"
            description="A technician raises one when the job needs a part the shop does not have on hand."
          />
        ) : (
          <>
            <DataTable rows={query.data.data} columns={columns} rowKey={(request) => request.id} />
            <Pagination
              page={query.data.meta.page}
              pages={query.data.meta.pages}
              total={query.data.meta.total}
              onPage={setPage}
            />
          </>
        )}
      </Card>

      <NewPartRequestModal
        open={creating}
        orders={orders.data ?? []}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          query.refetch();
        }}
      />

      <RejectRequestModal
        request={rejecting}
        pending={decide.pending}
        error={decide.error}
        onClose={() => setRejecting(null)}
        onRejected={() => {
          setRejecting(null);
          query.refetch();
        }}
      />
    </>
  );
}

/* ----------------------------------------------------------------- modals -- */

function NewPartRequestModal({
  open,
  orders,
  onClose,
  onCreated,
}: {
  open: boolean;
  orders: RepairOrder[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [roId, setRoId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [partName, setPartName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [problems, setProblems] = useState<string[]>([]);

  const create = useApiMutation((body: Parameters<typeof partRequestsApi.create>[0]) =>
    partRequestsApi.create(body),
  );

  // The backend refuses a request against an order that is DRAFT, COMPLETED,
  // DELIVERED or CANCELLED, so only the orders it will accept are offered.
  const requestable = orders.filter((ro) =>
    ["APPROVED", "IN_PROGRESS", "ON_HOLD"].includes(ro.status),
  );
  const selected = orders.find((ro) => ro.id === roId);

  async function submit() {
    const found: string[] = [];
    if (!roId) found.push("Choose the repair order that needs the part");
    if (!partName.trim()) found.push("Name the part");
    if (Number(quantity) <= 0) found.push("Quantity must be greater than zero");
    if (!reason.trim()) found.push("Say why the part is needed");
    setProblems(found);
    if (found.length > 0) return;

    const created = await create.run({
      repair_order_id: roId,
      repair_task_id: taskId || null,
      part_number: partNumber.trim() || null,
      part_name: partName.trim(),
      quantity: Number(quantity),
      reason: reason.trim(),
    });
    if (created) {
      setRoId("");
      setTaskId("");
      setPartNumber("");
      setPartName("");
      setQuantity("1");
      setReason("");
      onCreated();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Raise a part request"
      description="It goes to the parts desk as PENDING. You will not be the one who approves it."
      footer={
        <>
          <Button onClick={onClose} disabled={create.pending}>
            Cancel
          </Button>
          <Button variant="primary" pending={create.pending} onClick={() => void submit()}>
            Send to parts
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
        {problems.length > 0 ? (
          <Notice tone="danger">
            <ul className="list-disc space-y-0.5 pl-4">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </Notice>
        ) : null}

        <Field
          label="Repair order"
          required
          hint={
            requestable.length === 0
              ? "No order is currently authorised and unfinished — a part can only be requested while work is live."
              : "Only orders that are APPROVED, IN_PROGRESS or ON_HOLD can take a request."
          }
        >
          <Select
            value={roId}
            onChange={(event) => {
              setRoId(event.target.value);
              setTaskId("");
            }}
          >
            <option value="">Choose an order</option>
            {requestable.map((ro) => (
              <option key={ro.id} value={ro.id}>
                {ro.ro_number} — {ro.status}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Task" hint="Optional">
          <Select value={taskId} onChange={(event) => setTaskId(event.target.value)} disabled={!selected}>
            <option value="">Not against a task</option>
            {(selected?.tasks ?? []).map((task) => (
              <option key={task.id} value={task.id}>
                {task.sequence + 1}. {task.description}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Part number">
            <Input value={partNumber} onChange={(event) => setPartNumber(event.target.value)} />
          </Field>
          <Field label="Part name" required>
            <Input value={partName} onChange={(event) => setPartName(event.target.value)} />
          </Field>
          <Field label="Quantity" required>
            <Input
              type="number"
              min="0"
              step="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Why it is needed" required>
          <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>

        <Notice tone="info">
          Parts staff approve or reject, then mark it fulfilled once the part is staged for the job.
          You cannot approve your own request.
        </Notice>
      </form>
    </Modal>
  );
}

function RejectRequestModal({
  request,
  pending,
  error,
  onClose,
  onRejected,
}: {
  request: PartRequest | null;
  pending: boolean;
  error: ApiError | null;
  onClose: () => void;
  onRejected: () => void;
}) {
  const [reason, setReason] = useState("");
  const reject = useApiMutation((id: string, why: string) =>
    partRequestsApi.decide(id, "REJECTED", why),
  );
  const busy = pending || reject.pending;

  async function submit() {
    if (!request) return;
    const rejected = await reject.run(request.id, reason.trim());
    if (rejected) {
      setReason("");
      onRejected();
    }
  }

  return (
    <Modal
      open={request !== null}
      onClose={onClose}
      title="Reject this request"
      description="The technician is told what you said, so a reason is not optional in practice."
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" pending={busy} onClick={() => void submit()}>
            Reject request
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
        <FormError error={reject.error ?? error} />
        {request ? (
          <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm">
            <p className="font-medium text-ink-900">{request.part_name}</p>
            <p className="text-xs text-ink-600">
              {formatNumber(request.quantity, 2)} · asked because: {request.reason}
            </p>
          </div>
        ) : null}
        <Field label="Reason" required>
          <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}