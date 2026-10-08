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
import { qcApi, repairOrdersApi } from "@/lib/api/work";
import type { ApiError } from "@/lib/api/client";
import type { QCCheckItem, QCQueueItem, QualityCheck } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { QC_STATUSES } from "@/lib/status";
import { formatDateTime, formatNumber } from "@/lib/format";

/**
 * The last gate before a vehicle goes home.
 *
 * Two lists on one screen because they are two different questions. The queue is
 * work nobody has looked at yet; the checks are the history of what was looked
 * at, including the attempts that failed and sent a job back for rework — kept,
 * not overwritten, because a defect that is quietly erased is a defect that
 * ships twice.
 *
 * The verdicts are enforced by the backend against real data, so the two rules
 * that decide whether an inspector can act are shown rather than discovered: pass
 * is refused while a blocking check fails, and nobody may inspect their own work.
 */
export default function QualityControlPage() {
  const { can, user } = useSession();
  const { vehicleLabel, userName } = useReferences();
  const [tab, setTab] = useState<"queue" | "checks">("queue");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [openCheckId, setOpenCheckId] = useState<string | null>(null);

  const mayPerform = can("qc:perform");

  const queue = useApiQuery(() => qcApi.queue(), []);
  const checks = useApiQuery(
    () => qcApi.list({ page, size: 25, status: status || undefined }),
    [page, status],
    { enabled: tab === "checks" },
  );
  // The checks API returns RO ids, so the recent orders are loaded once to put
  // numbers on the rows instead of ids.
  const orders = useApiQuery(
    () => repairOrdersApi.list({ size: 100 }).then((result) => result.data),
    [],
    { enabled: can("repair_orders:read") },
  );

  const start = useApiMutation((repairOrderId: string) =>
    qcApi.create({ repair_order_id: repairOrderId }),
  );

  const roNumberById = new Map((orders.data ?? []).map((ro) => [ro.id, ro.ro_number]));
  const selected = checks.data?.data.find((check) => check.id === openCheckId) ?? null;

  const queueColumns: Column<QCQueueItem>[] = [
    {
      key: "ro",
      header: "Repair order",
      render: (item) => (
        <Link
          href={`/repair-orders/${item.repair_order_id}`}
          className="font-medium text-brand-700 hover:underline"
        >
          {item.ro_number}
        </Link>
      ),
    },
    {
      key: "vehicle",
      header: "Vehicle",
      render: (item) => <span className="text-sm">{vehicleLabel(item.vehicle_id)}</span>,
    },
    {
      key: "technician",
      header: "Technician",
      render: (item) => (
        <span className="text-sm">{item.technician_id ? userName(item.technician_id) : "—"}</span>
      ),
    },
    {
      key: "completed_at",
      header: "Completed",
      numeric: true,
      render: (item) => <span className="text-xs text-ink-500">{formatDateTime(item.completed_at)}</span>,
    },
    {
      key: "open_check",
      header: "Inspection",
      render: (item) =>
        item.has_open_check ? (
          <StatusBadge status="IN_PROGRESS" />
        ) : (
          <span className="text-xs text-ink-400">Not started</span>
        ),
    },
    {
      key: "actions",
      header: "",
      numeric: true,
      render: (item) => {
        const own = user && item.technician_id === user.id;
        const block = !mayPerform
          ? "You do not hold qc:perform"
          : item.has_open_check
            ? "This order already has an open check — finish it first"
            : own
              ? "You did this work, so you cannot inspect it"
              : null;
        return (
          <div className="flex flex-col items-end gap-1">
            <Button
              size="sm"
              variant="primary"
              disabled={block !== null}
              title={block ?? undefined}
              pending={start.pending}
              onClick={() =>
                start.run(item.repair_order_id).then((created) => {
                  if (created) {
                    queue.refetch();
                    checks.refetch();
                  }
                })
              }
            >
              Start check
            </Button>
            {block ? <span className="text-xs text-ink-500">{block}</span> : null}
          </div>
        );
      },
    },
  ];

  const checkColumns: Column<QualityCheck>[] = [
    {
      key: "attempt",
      header: "Attempt",
      numeric: true,
      render: (check) => <span className="tabular font-medium">#{check.attempt_number}</span>,
    },
    {
      key: "ro",
      header: "Repair order",
      render: (check) => (
        <Link
          href={`/repair-orders/${check.repair_order_id}`}
          className="font-medium text-brand-700 hover:underline"
        >
          {roNumberById.get(check.repair_order_id) ?? "Open"}
        </Link>
      ),
    },
    {
      key: "inspector",
      header: "Inspector",
      render: (check) => (
        <span className="text-sm">{check.inspector_id ? userName(check.inspector_id) : "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (check) => (
        <div className="min-w-0">
          <StatusBadge status={check.status} />
          {check.failure_reason ? (
            <p className="mt-1 line-clamp-2 text-xs text-ink-500">{check.failure_reason}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "blocking",
      header: "Blocking failures",
      numeric: true,
      render: (check) => {
        const failing = check.checks.filter((item) => item.blocking && !item.passed).length;
        return (
          <span className={failing > 0 ? "font-medium text-rose-700" : "text-ink-500"}>
            {formatNumber(failing)}
          </span>
        );
      },
    },
    {
      key: "completed_at",
      header: "Completed",
      numeric: true,
      render: (check) => (
        <span className="text-xs text-ink-500">{formatDateTime(check.completed_at)}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Quality control"
        subtitle="Finished work waiting on an inspector, and the record of every inspection"
      />

      {start.error ? (
        <div className="mb-4">
          <Notice tone="danger">{start.error.messageForUser}</Notice>
        </div>
      ) : null}

      <div className="mb-4 flex gap-2" role="tablist" aria-label="Quality control">
        <Button
          variant={tab === "queue" ? "primary" : "secondary"}
          onClick={() => setTab("queue")}
          aria-pressed={tab === "queue"}
        >
          Queue
        </Button>
        <Button
          variant={tab === "checks" ? "primary" : "secondary"}
          onClick={() => setTab("checks")}
          aria-pressed={tab === "checks"}
        >
          Checks
        </Button>
      </div>

      {tab === "queue" ? (
        <Card padded={false}>
          {queue.loading && queue.initial ? (
            <Loading label="Reading the queue…" />
          ) : queue.error ? (
            <div className="p-4">
              <ErrorState error={queue.error} onRetry={queue.refetch} />
            </div>
          ) : !queue.data || queue.data.length === 0 ? (
            <EmptyState
              title="Nothing waiting on inspection"
              description="A repair order appears here once its work is COMPLETED."
            />
          ) : (
            <DataTable rows={queue.data} columns={queueColumns} rowKey={(item) => item.repair_order_id} />
          )}
        </Card>
      ) : (
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
                {QC_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </label>
          </Toolbar>
          {checks.loading && checks.initial ? (
            <Loading label="Reading the inspection record…" />
          ) : checks.error ? (
            <div className="p-4">
              <ErrorState error={checks.error} onRetry={checks.refetch} />
            </div>
          ) : !checks.data || checks.data.data.length === 0 ? (
            <EmptyState title="No checks yet" description="Open one from the queue to start an inspection." />
          ) : (
            <>
              <DataTable
                rows={checks.data.data}
                columns={checkColumns}
                rowKey={(check) => check.id}
                onRowClick={(check) => setOpenCheckId(check.id)}
              />
              <Pagination
                page={checks.data.meta.page}
                pages={checks.data.meta.pages}
                total={checks.data.meta.total}
                onPage={setPage}
              />
            </>
          )}
        </Card>
      )}

      <CheckDetailModal
        check={selected}
        mayPerform={mayPerform}
        roNumber={selected ? roNumberById.get(selected.repair_order_id) : undefined}
        onClose={() => setOpenCheckId(null)}
        onChanged={() => checks.refetch()}
      />
    </>
  );
}

/* --------------------------------------------------------------- the modal -- */

function CheckDetailModal({
  check,
  mayPerform,
  roNumber,
  onClose,
  onChanged,
}: {
  check: QualityCheck | null;
  mayPerform: boolean;
  roNumber?: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [overriding, setOverriding] = useState<QCCheckItem | null>(null);
  const [failing, setFailing] = useState(false);
  const [addingPhoto, setAddingPhoto] = useState(false);

  const reverify = useApiMutation((id: string) => qcApi.reverify(id));
  const pass = useApiMutation((id: string) => qcApi.pass(id));
  const fail = useApiMutation((id: string, reason: string) => qcApi.fail(id, reason));
  const addPhoto = useApiMutation((id: string, url: string, caption: string) =>
    qcApi.addPhoto(id, { photo_url: url, caption: caption || null }),
  );

  if (!check) return null;

  const blockingFailures = check.checks.filter((item) => item.blocking && !item.passed);
  const open = !check.is_terminal;

  async function refresh() {
    onChanged();
    onClose();
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={`Inspection · attempt ${check.attempt_number}`}
        description={`${roNumber ?? "Repair order"} · started ${formatDateTime(check.started_at)}`}
        width="max-w-3xl"
        footer={
          <>
            <Button onClick={onClose}>Close</Button>
            {mayPerform && open ? (
              <Button
                pending={reverify.pending}
                onClick={() => reverify.run(check.id).then(() => onChanged())}
              >
                Re-verify
              </Button>
            ) : null}
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={check.status} />
            <span className="text-xs text-ink-500">Completed {formatDateTime(check.completed_at)}</span>
          </div>

          {check.failure_reason ? (
            <Notice tone="danger">Sent back: {check.failure_reason}</Notice>
          ) : null}

          {reverify.error ? <Notice tone="danger">{reverify.error.messageForUser}</Notice> : null}
          {pass.error ? <Notice tone="danger">{pass.error.messageForUser}</Notice> : null}
          {fail.error ? <Notice tone="danger">{fail.error.messageForUser}</Notice> : null}
          {addPhoto.error ? <Notice tone="danger">{addPhoto.error.messageForUser}</Notice> : null}

          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-ink-600 uppercase">
              Verification checks
            </p>
            <ul className="space-y-2">
              {check.checks.map((item) => (
                <li key={item.id} className="rounded-lg border border-ink-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={item.passed ? "PASSED" : "FAILED"} />
                      <span className="text-sm font-medium text-ink-900">{item.check_type}</span>
                      {item.blocking ? (
                        <span className="text-xs text-rose-700">Blocking</span>
                      ) : (
                        <span className="text-xs text-ink-500">Not blocking</span>
                      )}
                    </div>
                    {mayPerform && open ? (
                      <Button size="sm" variant="ghost" onClick={() => setOverriding(item)}>
                        Override
                      </Button>
                    ) : null}
                  </div>
                  {item.evidence ? (
                    <p className="mt-1 text-xs text-ink-600">{item.evidence}</p>
                  ) : null}
                  {item.notes ? <p className="mt-1 text-xs text-ink-500">Note: {item.notes}</p> : null}
                  <p className="mt-1 text-xs text-ink-400">
                    {item.auto_verified
                      ? "Verified automatically from shop records"
                      : "Overridden by an inspector — a manual verdict survives re-verification, an automatic one does not"}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-ink-600 uppercase">Photos</p>
            {check.photos.length === 0 ? (
              <p className="text-sm text-ink-500">No photos attached to this inspection.</p>
            ) : (
              <ul className="space-y-1">
                {check.photos.map((photo) => (
                  <li key={photo.id} className="text-sm">
                    <a
                      href={photo.photo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-700 hover:underline"
                    >
                      {photo.caption || photo.photo_url}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {mayPerform && open ? (
              addingPhoto ? (
                <PhotoForm
                  pending={addPhoto.pending}
                  onCancel={() => setAddingPhoto(false)}
                  onSubmit={async (url, caption) => {
                    const added = await addPhoto.run(check.id, url, caption);
                    if (added) {
                      setAddingPhoto(false);
                      onChanged();
                    }
                  }}
                />
              ) : (
                <Button className="mt-2" size="sm" onClick={() => setAddingPhoto(true)}>
                  Add a photo by URL
                </Button>
              )
            ) : null}
          </div>

          {mayPerform && open ? (
            <div className="rounded-lg border border-ink-200 p-3">
              <p className="mb-2 text-xs font-medium tracking-wide text-ink-600 uppercase">Verdict</p>
              {blockingFailures.length > 0 ? (
                <Notice tone="danger">
                  Pass is refused while a blocking check fails:{" "}
                  {blockingFailures.map((item) => item.check_type).join(", ")}. Override a check or
                  fix the work first.
                </Notice>
              ) : (
                <Notice tone="success">
                  No blocking check is failing, so this inspection can be passed.
                </Notice>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="success"
                  pending={pass.pending}
                  disabled={blockingFailures.length > 0}
                  title={
                    blockingFailures.length > 0
                      ? "A blocking check is failing"
                      : "Moves the repair order to QC_PASSED, ready for delivery"
                  }
                  onClick={() => pass.run(check.id).then(() => refresh())}
                >
                  Pass
                </Button>
                <Button variant="danger" onClick={() => setFailing(true)}>
                  Fail and send back…
                </Button>
              </div>
              <p className="mt-2 text-xs text-ink-500">
                Failing sends the repair order back to IN_PROGRESS for rework, and this attempt is
                kept — the next one is attempt {check.attempt_number + 1}.
              </p>
            </div>
          ) : (
            <Notice tone="info">
              {check.is_terminal
                ? `This inspection was decided as ${check.status} and cannot be changed — raise a new attempt instead.`
                : "You do not hold qc:perform, so you cannot change this inspection."}
            </Notice>
          )}
        </div>
      </Modal>

      {overriding ? (
        <OverrideModal
          checkId={check.id}
          item={overriding}
          onClose={() => setOverriding(null)}
          onSaved={() => {
            setOverriding(null);
            onChanged();
          }}
        />
      ) : null}

      {failing ? (
        <FailModal
          pending={fail.pending}
          error={fail.error}
          onClose={() => setFailing(false)}
          onFailed={async (reason) => {
            const failed = await fail.run(check.id, reason);
            if (failed) refresh();
          }}
        />
      ) : null}
    </>
  );
}

function PhotoForm({
  pending,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  onCancel: () => void;
  onSubmit: (url: string, caption: string) => Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");

  return (
    <form
      className="mt-2 space-y-2 rounded-lg border border-ink-200 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (url.trim()) void onSubmit(url.trim(), caption.trim());
      }}
    >
      <Field label="Photo URL" required>
        <Input value={url} onChange={(event) => setUrl(event.target.value)} />
      </Field>
      <Field label="Caption">
        <Input value={caption} onChange={(event) => setCaption(event.target.value)} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" pending={pending} disabled={!url.trim()}>
          Attach
        </Button>
        <Button type="button" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function OverrideModal({
  checkId,
  item,
  onClose,
  onSaved,
}: {
  checkId: string;
  item: QCCheckItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [passed, setPassed] = useState(item.passed);
  const [blocking, setBlocking] = useState(item.blocking);
  const [notes, setNotes] = useState(item.notes ?? "");
  const save = useApiMutation((body: { passed: boolean; blocking: boolean; notes: string | null }) =>
    qcApi.overrideCheck(checkId, item.check_type, body),
  );

  async function submit() {
    const saved = await save.run({ passed, blocking, notes: notes.trim() || null });
    if (saved) onSaved();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Override ${item.check_type}`}
      description="Your verdict replaces what the shop records said, and re-verification will not overwrite it."
      footer={
        <>
          <Button onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button variant="primary" pending={save.pending} onClick={() => void submit()}>
            Record verdict
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
        {item.evidence ? (
          <p className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
            The automatic check saw: {item.evidence}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Verdict" required>
            <Select
              value={passed ? "pass" : "fail"}
              onChange={(event) => setPassed(event.target.value === "pass")}
            >
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
            </Select>
          </Field>
          <Field label="Blocking" hint="A failing blocking check stops the order being passed">
            <Select
              value={blocking ? "yes" : "no"}
              onChange={(event) => setBlocking(event.target.value === "yes")}
            >
              <option value="yes">Blocking</option>
              <option value="no">Not blocking</option>
            </Select>
          </Field>
        </div>
        <Field label="Why">
          <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

function FailModal({
  pending,
  error,
  onClose,
  onFailed,
}: {
  pending: boolean;
  error: ApiError | null;
  onClose: () => void;
  onFailed: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");

  return (
    <Modal
      open
      onClose={onClose}
      title="Fail this inspection"
      description="The order goes back to the technician for rework."
      footer={
        <>
          <Button onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            pending={pending}
            disabled={!reason.trim()}
            onClick={() => void onFailed(reason.trim())}
          >
            Fail and send back
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (reason.trim()) void onFailed(reason.trim());
        }}
      >
        <FormError error={error} />
        <Field label="What is wrong" required hint="A rework loop with no explanation repeats itself">
          <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}