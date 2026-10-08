"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, KeyValue, KeyValueGrid } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { portalApi } from "@/lib/api/portal";
import type { PortalEstimateLine } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { formatDate, formatMoney } from "@/lib/format";

/**
 * One estimate, and a decision per line.
 *
 * Approval is **per line**, not per estimate: the shop records which parts of
 * the work were agreed, and only what was agreed is ever billed. So the buttons
 * sit on each row rather than at the foot of the page, and a line that is
 * already decided shows its verdict instead of a button.
 *
 * An expired estimate offers nothing: the shop would refuse the decision, so
 * asking for it here would only be a dead end.
 */
export default function PortalEstimateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [declining, setDeclining] = useState<PortalEstimateLine | null>(null);
  const [downloading, setDownloading] = useState(false);

  const estimate = useApiQuery(() => portalApi.estimate(id), [id]);
  const decide = useApiMutation((itemId: string, decision: "APPROVED" | "DECLINED", notes?: string | null) =>
    portalApi.decideEstimateItem(id, itemId, decision, notes),
  );
  const decline = useApiMutation((itemId: string, notes: string | null) =>
    portalApi.decideEstimateItem(id, itemId, "DECLINED", notes),
  );

  if (estimate.loading && estimate.initial) return <Loading />;
  if (estimate.error) return <ErrorState error={estimate.error} onRetry={estimate.refetch} />;

  const record = estimate.data;
  if (!record) return <ErrorState error={new Error("Estimate not found")} />;

  const pending = record.items.filter((line) => line.can_decide).length;

  const columns: Column<PortalEstimateLine>[] = [
    {
      key: "description",
      header: "Work",
      render: (line) => (
        <div>
          <p className="text-ink-800">{line.description}</p>
          <p className="text-xs text-ink-500">
            {line.item_type}
            {line.is_optional ? " · optional" : ""}
            {line.quantity !== 1 ? ` · ×${line.quantity}` : ""}
          </p>
        </div>
      ),
    },
    { key: "unit", header: "Each", numeric: true, render: (line) => formatMoney(line.unit_price) },
    { key: "total", header: "Line", numeric: true, render: (line) => formatMoney(line.line_total) },
    {
      key: "status",
      header: "Decision",
      render: (line) => <StatusBadge status={line.status} />,
    },
    {
      key: "actions",
      header: "",
      numeric: true,
      render: (line) =>
        line.can_decide ? (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="success"
              pending={decide.pending}
               onClick={() => decide.run(line.id, "APPROVED").then((r) => r && estimate.refetch())}
            >
              Approve
            </Button>
            <Button size="sm" onClick={() => setDeclining(line)}>
              Decline
            </Button>
          </div>
        ) : (
          <span className="text-xs text-ink-400">Decided</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={<Link href="/portal/estimates" className="hover:underline">Estimates</Link>}
        title={record.estimate_number}
        subtitle={record.status_view.detail || undefined}
        actions={
          <Button
            pending={downloading}
            onClick={() => {
              setDownloading(true);
              portalApi
                .downloadEstimate(id, `${record.estimate_number}.html`)
                .catch(() => router.refresh())
                .finally(() => setDownloading(false));
            }}
          >
            Download copy
          </Button>
        }
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="What we think it costs" />
          <KeyValueGrid>
            <KeyValue label="Total">{formatMoney(record.total)}</KeyValue>
            <KeyValue label="You have approved">{formatMoney(record.approved_total)}</KeyValue>
            <KeyValue label="Valid until">{formatDate(record.valid_until)}</KeyValue>
          </KeyValueGrid>
          {record.is_expired ? (
            <Notice tone="danger">
              This estimate has expired, so decisions on it will be refused. Ask the shop for a fresh
              one.
            </Notice>
          ) : pending > 0 ? (
            <Notice tone="info">
              {pending} line{pending === 1 ? "" : "s"} still need{pending === 1 ? "s" : ""} your
              decision. Only what you approve is ever charged.
            </Notice>
          ) : null}
          {record.notes ? <p className="mt-3 text-sm text-ink-600">{record.notes}</p> : null}
          {record.decline_reason ? (
            <p className="mt-2 text-sm text-ink-600">You told us: {record.decline_reason}</p>
          ) : null}
        </Card>

        <Card>
          <CardHeader title="Status" />
          <StatusBadge status={record.status} />
          <p className="mt-2 text-sm text-ink-600">{record.status_view.label}</p>
        </Card>
      </div>

      {decide.error || decline.error ? (
        <div className="mb-3">
          <Notice tone="danger">{(decide.error ?? decline.error)!.messageForUser}</Notice>
        </div>
      ) : null}

      <Card padded={false}>
        {record.items.length === 0 ? (
          <EmptyState title="No lines on this estimate" />
        ) : (
          <DataTable rows={record.items} columns={columns} rowKey={(line) => line.id} />
        )}
      </Card>

      <DeclineModal
        line={declining}
        pending={decline.pending}
        error={decline.error}
        onClose={() => setDeclining(null)}
        onConfirm={(notes) =>
          decline.run(declining!.id, notes).then((result) => {
            if (result) {
              setDeclining(null);
              estimate.refetch();
            }
          })
        }
      />
    </>
  );
}

function DeclineModal({
  line,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  line: PortalEstimateLine | null;
  pending: boolean;
  error: { messageForUser: string } | null;
  onClose: () => void;
  onConfirm: (notes: string | null) => void;
}) {
  const [notes, setNotes] = useState("");
  return (
    <Modal
      open={line !== null}
      onClose={onClose}
      title="Decline this line"
      description={line ? `${line.description} — ${formatMoney(line.line_total)}` : undefined}
      footer={
        <>
          <Button onClick={onClose} disabled={pending}>
            Keep it
          </Button>
          <Button variant="danger" pending={pending} onClick={() => onConfirm(notes || null)}>
            Decline this line
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <Notice tone="danger">{error.messageForUser}</Notice> : null}
        <p className="text-sm text-ink-600">
          Declining one line leaves the rest of the estimate open. Tell the shop why if it will save
          them a phone call.
        </p>
        <label className="block">
          <span className="mb-1 block text-xs font-medium tracking-wide text-ink-600 uppercase">
            Reason (optional)
          </span>
          <textarea
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="w-full rounded-lg bg-white px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-200 focus:ring-2 focus:ring-brand-500 focus:outline-none"
          />
        </label>
      </div>
    </Modal>
  );
}