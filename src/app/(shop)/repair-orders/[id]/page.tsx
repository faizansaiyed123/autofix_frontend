"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, KeyValue, KeyValueGrid } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { useReferences } from "@/components/layout/ReferenceProvider";
import { laborApi, repairOrdersApi } from "@/lib/api/work";
import type { LaborRecord, RepairTask } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";

/**
 * One job, from authorisation to handover.
 *
 * Three backend rules shape this page, and each is stated in the interface
 * rather than left to be discovered:
 *
 *  - The task breakdown freezes once work starts. An order that is IN_PROGRESS
 *    or later can still have a task reassigned — that is bookkeeping, not
 *    structure — but it cannot be re-described or have a job added to it.
 *  - An order cannot COMPLETE while any task is still open, and cannot start
 *    with no tasks at all.
 *  - Labour may only be logged while the order is IN_PROGRESS or ON_HOLD. Hours
 *    are evidence of work performed, so there is nothing to log before the work
 *    starts or after it has finished.
 *
 * There is deliberately no money on this page. The estimate stays the source of
 * truth for pricing; the order tracks execution.
 */
export default function RepairOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useSession();
  const { customerLabel, vehicleLabel, userName, staff } = useReferences();
  const [nextStatus, setNextStatus] = useState("");
  const [reason, setReason] = useState("");
  const [editingTask, setEditingTask] = useState<RepairTask | null>(null);
  const [loggingLabour, setLoggingLabour] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const order = useApiQuery(() => repairOrdersApi.get(id), [id]);
  const labour = useApiQuery(
    () => laborApi.list({ repair_order_id: id, size: 100 }).then((page) => page.data),
    [id],
    { enabled: can("labor:read") },
  );

  const setStatus = useApiMutation((status: string, why: string) =>
    repairOrdersApi.setStatus(id, status, why || undefined),
  );
  const setTaskStatus = useApiMutation((taskId: string, status: string) =>
    repairOrdersApi.setTaskStatus(id, taskId, status),
  );
  const removeTask = useApiMutation((taskId: string) => repairOrdersApi.removeTask(id, taskId));

  if (order.loading && order.initial) return <Loading label="Opening the repair order…" />;
  if (order.error) return <ErrorState error={order.error} onRetry={order.refetch} />;

  const ro = order.data;
  if (!ro) return <ErrorState error={new Error("Repair order not found")} />;

  const terminal = ro.status === "DELIVERED" || ro.status === "CANCELLED";
  const tasksEditable = ro.status === "DRAFT" || ro.status === "APPROVED";
  const labourLoggable = ro.status === "IN_PROGRESS" || ro.status === "ON_HOLD";
  const mayWriteOrder = can("repair_orders:write");
  const mayWriteTasks = can("tasks:write");
  const mayWriteLabour = can("labor:write");

  const options = reachableStatuses(ro.status, ro.tasks.length > 0, ro.all_tasks_done);
  const statusBlock = terminal
    ? `This order is ${ro.status}, which is final — nothing further will change on it.`
    : nextStatus === "IN_PROGRESS" && ro.tasks.length === 0
      ? "Work cannot start until the order has at least one task."
      : nextStatus === "COMPLETED" && !ro.all_tasks_done
        ? "Every task must be completed or skipped before the order can be completed."
        : null;

  async function changeTaskStatus(taskId: string, status: string) {
    setBusyTaskId(taskId);
    await setTaskStatus.run(taskId, status);
    setBusyTaskId(null);
    order.refetch();
  }

  async function changeStatus() {
    if (!nextStatus) return;
    const changed = await setStatus.run(nextStatus, reason.trim());
    if (changed) {
      setNextStatus("");
      setReason("");
      order.refetch();
    }
  }

  const taskColumns: Column<RepairTask>[] = [
    {
      key: "sequence",
      header: "#",
      numeric: true,
      render: (task) => <span className="tabular text-xs text-ink-500">{task.sequence + 1}</span>,
    },
    {
      key: "description",
      header: "Task",
      render: (task) => (
        <div className="min-w-0">
          <p className="font-medium text-ink-900">{task.description}</p>
          {task.notes ? <p className="text-xs text-ink-500">{task.notes}</p> : null}
        </div>
      ),
    },
    {
      key: "assignee",
      header: "Assigned to",
      render: (task) => (
        <span className="text-sm">{task.assigned_to_id ? userName(task.assigned_to_id) : "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (task) => <StatusBadge status={task.status} />,
    },
    {
      key: "completed_at",
      header: "Completed",
      numeric: true,
      render: (task) => (
        <span className="text-xs text-ink-500">{formatDateTime(task.completed_at)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      numeric: true,
      render: (task) => (
        <div className="flex items-center justify-end gap-2">
          {mayWriteTasks ? (
            <Select
              aria-label={`Status for ${task.description}`}
              value={task.status}
              disabled={terminal || busyTaskId === task.id}
              title={
                terminal
                  ? "A delivered or cancelled order accepts no task changes"
                  : "Only the states this task can move to are listed"
              }
              onChange={(event) => void changeTaskStatus(task.id, event.target.value)}
              className="w-36"
            >
              {reachableTaskStatuses(task.status).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          ) : null}
          {mayWriteTasks && tasksEditable ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditingTask(task)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={removeTask.pending && busyTaskId === task.id}
                onClick={() => {
                  setBusyTaskId(task.id);
                  removeTask.run(task.id).then(() => {
                    setBusyTaskId(null);
                    order.refetch();
                  });
                }}
              >
                Delete
              </Button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  const labourColumns: Column<LaborRecord>[] = [
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
      key: "technician",
      header: "Technician",
      render: (record) => (
        <span className="text-sm">{record.technician_id ? userName(record.technician_id) : "—"}</span>
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
      render: (record) => <span className="tabular text-xs">{formatNumber(record.billable_hours, 2)}</span>,
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
        breadcrumb={<Link href="/repair-orders" className="hover:underline">Repair orders</Link>}
        title={ro.ro_number}
        subtitle={`${vehicleLabel(ro.vehicle_id)} · ${customerLabel(ro.customer_id)}`}
        actions={
          <>
            <StatusBadge status={ro.status} />
            {ro.all_tasks_done && ro.tasks.length > 0 ? (
              <span className="text-xs text-emerald-700">All tasks done</span>
            ) : null}
          </>
        }
      />

      {setStatus.error ? (
        <div className="mb-4">
          <Notice tone="danger">{setStatus.error.messageForUser}</Notice>
        </div>
      ) : null}

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="The job" subtitle="Authorisation, bay and milestones" />
          <KeyValueGrid>
            <KeyValue label="Estimate">
              {ro.estimate_id ? (
                <Link href={`/estimates/${ro.estimate_id}`} className="text-brand-700 hover:underline">
                  Open the estimate
                </Link>
              ) : (
                <span className="text-ink-500">Not raised from an estimate</span>
              )}
            </KeyValue>
            <KeyValue label="Appointment">
              {ro.appointment_id ? (
                <Link href="/appointments" className="text-brand-700 hover:underline">
                  From a booking
                </Link>
              ) : (
                <span className="text-ink-500">Walk-in</span>
              )}
            </KeyValue>
            <KeyValue label="Advisor">
              {ro.advisor_id ? userName(ro.advisor_id) : "Unassigned"}
            </KeyValue>
            <KeyValue label="Technician">
              {ro.technician_id ? userName(ro.technician_id) : "Unassigned"}
            </KeyValue>
            <KeyValue label="Bay">{ro.bay ?? "—"}</KeyValue>
            <KeyValue label="Odometer">
              {formatNumber(ro.odometer_in)} → {formatNumber(ro.odometer_out)}
            </KeyValue>
            <KeyValue label="Promised">{formatDateTime(ro.promised_at)}</KeyValue>
            <KeyValue label="Started">{formatDateTime(ro.started_at)}</KeyValue>
            <KeyValue label="Completed">{formatDateTime(ro.completed_at)}</KeyValue>
            <KeyValue label="Delivered">{formatDateTime(ro.delivered_at)}</KeyValue>
            <KeyValue label="Internal notes" className="col-span-2 sm:col-span-3">
              {ro.notes ?? <span className="text-ink-500">None</span>}
            </KeyValue>
            <KeyValue label="Customer notes" className="col-span-2 sm:col-span-3">
              {ro.customer_notes ?? <span className="text-ink-500">None</span>}
            </KeyValue>
            {ro.cancel_reason ? (
              <KeyValue label="Cancelled because" className="col-span-2 sm:col-span-3">
                {ro.cancel_reason}
              </KeyValue>
            ) : null}
          </KeyValueGrid>
        </Card>

        <Card>
          <CardHeader
            title="Move this order on"
            subtitle="Only the states this order can reach are offered"
          />
          {mayWriteOrder ? (
            <div className="space-y-3">
              {options.length === 0 ? (
                <Notice tone="info">{terminal ? `A ${ro.status} order is final.` : "Nothing to move to."}</Notice>
              ) : (
                <Field label="New status" required>
                  <Select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
                    <option value="">Choose a state</option>
                    {options.map((option) => (
                      <option key={option.value} value={option.value} disabled={option.blocked}>
                        {option.value}
                        {option.blocked ? ` — ${option.reason}` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {nextStatus === "CANCELLED" ? (
                <Field label="Why" hint="Kept against the order">
                  <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
                </Field>
              ) : null}
              <Button
                variant="primary"
                className="w-full"
                pending={setStatus.pending}
                disabled={!nextStatus || statusBlock !== null}
                onClick={() => void changeStatus()}
              >
                Apply
              </Button>
              {statusBlock ? <Notice tone="info">{statusBlock}</Notice> : null}
              <p className="text-xs text-ink-500">
                An order cannot complete while a task is still open, and money is not tracked here —
                the estimate stays the source of truth for pricing.
              </p>
            </div>
          ) : (
            <p className="text-sm text-ink-500">
              This order is {ro.status}. You do not hold the permission to change its status.
            </p>
          )}
        </Card>
      </div>

      <Card padded={false} className="mb-4">
        <div className="px-5 pt-5">
          <CardHeader
            title="Tasks"
            subtitle={
              tasksEditable
                ? "The breakdown can be changed while the order is DRAFT or APPROVED"
                : "Frozen — the breakdown cannot be changed once work has started"
            }
          />
        </div>
        {setTaskStatus.error ? (
          <div className="px-5 pb-3">
            <Notice tone="danger">{setTaskStatus.error.messageForUser}</Notice>
          </div>
        ) : null}
        {ro.tasks.length === 0 ? (
          <EmptyState
            title="No tasks on this order"
            description="Work cannot start, and the order cannot complete, until the job is broken down into tasks."
          />
        ) : (
          <DataTable rows={ro.tasks} columns={taskColumns} rowKey={(task) => task.id} />
        )}
      </Card>

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title="Labour"
            subtitle="Hours worked against this order — evidence, not an invoice"
            actions={
              <Button
                variant={labourLoggable ? "primary" : "secondary"}
                size="sm"
                disabled={!labourLoggable || !mayWriteLabour}
                title={
                  !mayWriteLabour
                    ? "You do not hold labor:write"
                    : `Labour can only be recorded while the order is IN_PROGRESS or ON_HOLD — this one is ${ro.status}`
                }
                onClick={() => setLoggingLabour(true)}
              >
                Log labour
              </Button>
            }
          />
        </div>
        <div className="px-5 pb-3">
          {!mayWriteLabour ? (
            <p className="text-xs text-ink-500">You do not hold the permission to log time.</p>
          ) : labourLoggable ? null : (
            <Notice tone="info">
              Labour can only be recorded while the order is IN_PROGRESS or ON_HOLD. This order is{" "}
              {ro.status}, so there is no work in progress to record hours against.
            </Notice>
          )}
        </div>
        {labour.loading && labour.initial ? (
          <Loading />
        ) : !labour.data || labour.data.length === 0 ? (
          <EmptyState title="No labour logged" description="Nobody has recorded time against this order yet." />
        ) : (
          <DataTable rows={labour.data} columns={labourColumns} rowKey={(record) => record.id} dense />
        )}
      </Card>

      {editingTask ? (
        <TaskModal
          roId={id}
          task={editingTask}
          staff={staff}
          editable={tasksEditable}
          onClose={() => setEditingTask(null)}
          onSaved={() => {
            setEditingTask(null);
            order.refetch();
          }}
        />
      ) : null}

      {loggingLabour ? (
        <LogLabourModal
          roId={id}
          tasks={ro.tasks}
          onClose={() => setLoggingLabour(false)}
          onLogged={() => {
            setLoggingLabour(false);
            labour.refetch();
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------- the state machines -- */

interface StatusOption {
  value: string;
  /** True when the backend will refuse this move from the current state. */
  blocked: boolean;
  reason: string;
}

/**
 * The statuses reachable from `status`, mirroring the backend's transition table.
 *
 * Offering a state the machine refuses would turn every one of them into a 422
 * the user has to interpret, so a move that is blocked by a rule rather than by
 * the machine is listed but disabled, with the rule spelled out.
 */
function reachableStatuses(status: string, hasTasks: boolean, allTasksDone: boolean): StatusOption[] {
  const transitions: Record<string, string[]> = {
    DRAFT: ["APPROVED", "CANCELLED"],
    APPROVED: ["IN_PROGRESS", "CANCELLED"],
    IN_PROGRESS: ["ON_HOLD", "COMPLETED", "CANCELLED"],
    ON_HOLD: ["IN_PROGRESS", "CANCELLED"],
    COMPLETED: ["QC_PASSED", "IN_PROGRESS", "CANCELLED"],
    QC_PASSED: ["DELIVERED", "COMPLETED"],
    DELIVERED: [],
    CANCELLED: [],
  };

  return (transitions[status] ?? []).map((value) => {
    if (value === "IN_PROGRESS" && status === "APPROVED" && !hasTasks) {
      return { value, blocked: true, reason: "no tasks on the order" };
    }
    if (value === "COMPLETED" && (status === "IN_PROGRESS" || status === "ON_HOLD") && !allTasksDone) {
      return { value, blocked: true, reason: "tasks still open" };
    }
    return { value, blocked: false, reason: "" };
  });
}

function reachableTaskStatuses(status: string): string[] {
  const transitions: Record<string, string[]> = {
    PENDING: ["PENDING", "IN_PROGRESS", "COMPLETED", "SKIPPED"],
    IN_PROGRESS: ["IN_PROGRESS", "COMPLETED", "SKIPPED", "PENDING"],
    COMPLETED: ["COMPLETED", "IN_PROGRESS", "PENDING"],
    SKIPPED: ["SKIPPED", "IN_PROGRESS", "PENDING"],
  };
  return transitions[status] ?? [status];
}

/* ----------------------------------------------------------------- modals -- */

function TaskModal({
  roId,
  task,
  staff,
  editable,
  onClose,
  onSaved,
}: {
  roId: string;
  task: RepairTask;
  staff: { id: string; first_name: string; last_name: string }[];
  editable: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [description, setDescription] = useState(task.description);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [assignee, setAssignee] = useState(task.assigned_to_id ?? "");
  const save = useApiMutation((body: Record<string, unknown>) =>
    repairOrdersApi.updateTask(roId, task.id, body),
  );

  async function submit() {
    const body: Record<string, unknown> = { assigned_to_id: assignee || null };
    if (editable) {
      body.description = description.trim();
      body.notes = notes.trim() || null;
    }
    const saved = await save.run(body);
    if (saved) onSaved();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit task"
      description={
        editable
          ? undefined
          : "Work has started, so the breakdown is frozen. Only the assignee can still change."
      }
      footer={
        <>
          <Button onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button variant="primary" pending={save.pending} onClick={() => void submit()}>
            Save task
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
        <FormError error={save.error} />
        {editable ? (
          <>
            <Field label="Description" required>
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
            <Field label="Notes">
              <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </Field>
          </>
        ) : null}
        <Field label="Assigned to">
          <Select value={assignee} onChange={(event) => setAssignee(event.target.value)}>
            <option value="">Unassigned</option>
            {staff.map((person) => (
              <option key={person.id} value={person.id}>
                {person.first_name} {person.last_name}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Modal>
  );
}

function LogLabourModal({
  roId,
  tasks,
  onClose,
  onLogged,
}: {
  roId: string;
  tasks: RepairTask[];
  onClose: () => void;
  onLogged: () => void;
}) {
  const [description, setDescription] = useState("");
  const [actualHours, setActualHours] = useState("");
  const [billableHours, setBillableHours] = useState("");
  const [rate, setRate] = useState("");
  const [taskId, setTaskId] = useState("");
  const [performedAt, setPerformedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [problems, setProblems] = useState<string[]>([]);

  const create = useApiMutation((body: Parameters<typeof laborApi.create>[0]) =>
    laborApi.create(body),
  );

  async function submit() {
    const found: string[] = [];
    if (!description.trim()) found.push("Describe the work that was done");
    if (Number(actualHours) <= 0) found.push("Actual hours must be greater than zero");
    if (billableHours && Number(billableHours) < 0) found.push("Billable hours cannot be negative");
    setProblems(found);
    if (found.length > 0) return;

    const created = await create.run({
      repair_order_id: roId,
      description: description.trim(),
      actual_hours: Number(actualHours),
      billable_hours: billableHours ? Number(billableHours) : null,
      hourly_rate: rate ? Number(rate) : 0,
      repair_task_id: taskId || null,
      performed_at: performedAt || null,
      notes: notes.trim() || null,
    });
    if (created) onLogged();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Log labour"
      description="Actual hours are what was worked; billable hours are what will be charged."
      footer={
        <>
          <Button onClick={onClose} disabled={create.pending}>
            Cancel
          </Button>
          <Button variant="primary" pending={create.pending} onClick={() => void submit()}>
            Record
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

        <Field label="Work done" required>
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Front brake pads, road test"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Actual hours" required>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={actualHours}
              onChange={(event) => setActualHours(event.target.value)}
            />
          </Field>
          <Field label="Billable hours" hint="Leave blank to bill the actual hours">
            <Input
              type="number"
              min="0"
              step="0.1"
              value={billableHours}
              onChange={(event) => setBillableHours(event.target.value)}
            />
          </Field>
          <Field label="Hourly rate" hint="Stored on this record">
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
          <Field label="Task" hint="Optional">
            <Select value={taskId} onChange={(event) => setTaskId(event.target.value)}>
              <option value="">Not against a task</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.sequence + 1}. {task.description}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Performed at" hint="Leave blank for now">
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
    </Modal>
  );
}