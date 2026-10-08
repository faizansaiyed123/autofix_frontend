"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Select } from "@/components/ui/Form";
import { PageHeader, Toolbar } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { notificationsApi } from "@/lib/api/insight";
import type { Notification } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { formatRelative } from "@/lib/format";

/**
 * The attention centre.
 *
 * Unread first, then newest. Pure recency buries the one item that needs action
 * under forty read ones, which is the opposite of what a screen called "attention"
 * is for. `priority` separates "something needs you" from "something happened",
 * so the first is shown as an emphasis rather than merely a sort key.
 *
 * Each notification names the record it is about, and that link is the point: a
 * notice you cannot act on from the notice is a notice you have to go and
 * re-find.
 */
export default function AttentionPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [type, setType] = useState<string>("");

  const query = useApiQuery(
    () =>
      notificationsApi.list({
        unread_only: unreadOnly,
        notification_type: type || undefined,
        limit: 100,
      }),
    [unreadOnly, type],
  );

  const markRead = useApiMutation((id: string) => notificationsApi.markRead(id));
  const markUnread = useApiMutation((id: string) => notificationsApi.markUnread(id));
  const markAll = useApiMutation(() => notificationsApi.markAllRead());

  const list = query.data;

  const columns: Column<Notification>[] = [
    {
      key: "title",
      header: "Notice",
      render: (n) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {!n.is_read ? <span className="size-2 shrink-0 rounded-full bg-brand-500" /> : null}
            <span className={n.is_read ? "text-ink-700" : "font-medium text-ink-900"}>{n.title}</span>
            {n.priority === "HIGH" ? <Badge tone="danger">Needs you</Badge> : null}
          </div>
          {n.body ? <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{n.body}</p> : null}
        </div>
      ),
    },
    {
      key: "type",
      header: "Kind",
      render: (n) => <span className="text-xs text-ink-500">{n.notification_type}</span>,
    },
    {
      key: "when",
      header: "When",
      numeric: true,
      render: (n) => <span className="text-xs text-ink-500">{formatRelative(n.created_at)}</span>,
    },
    {
      key: "actions",
      header: "",
      numeric: true,
      render: (n) => (
        <div className="flex items-center justify-end gap-2">
          {n.entity_type && n.entity_id ? (
            <Link
              href={entityHref(n)}
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              Open
            </Link>
          ) : null}
          {n.is_read ? (
            <button
              type="button"
              onClick={() => markUnread.run(n.id).then(() => query.refetch())}
              className="text-xs text-ink-500 hover:underline"
            >
              Mark unread
            </button>
          ) : (
            <button
              type="button"
              onClick={() => markRead.run(n.id).then(() => query.refetch())}
              className="text-xs text-ink-500 hover:underline"
            >
              Mark read
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Attention centre"
        subtitle={
          list
            ? `${list.unread_count} unread of ${list.total}`
            : "Everything waiting on a decision"
        }
        actions={
          <Button
            onClick={() => markAll.run().then(() => query.refetch())}
            pending={markAll.pending}
            disabled={(list?.unread_count ?? 0) === 0}
          >
            Mark all read
          </Button>
        }
      />

      {markAll.error ? <Notice tone="danger">{markAll.error.messageForUser}</Notice> : null}

      <Card padded={false}>
        <Toolbar>
          <label className="block">
            <span className="sr-only">Filter</span>
            <Select value={unreadOnly ? "unread" : "all"} onChange={(e) => setUnreadOnly(e.target.value === "unread")}>
              <option value="all">All notices</option>
              <option value="unread">Unread only</option>
            </Select>
          </label>
          <label className="block">
            <span className="sr-only">Kind</span>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Every kind</option>
              {KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </Select>
          </label>
        </Toolbar>

        {query.loading && query.initial ? (
          <Loading />
        ) : query.error ? (
          <div className="p-4">
            <ErrorState error={query.error} onRetry={query.refetch} />
          </div>
        ) : !list || list.notifications.length === 0 ? (
          <EmptyState
            title="Nothing waiting"
            description="When a bill is issued, a part request is raised or stock runs low, it appears here."
          />
        ) : (
          <DataTable
            rows={list.notifications}
            columns={columns}
            rowKey={(n) => n.id}
            empty={<EmptyState title="Nothing waiting" />}
          />
        )}
      </Card>
    </>
  );
}

const KINDS = [
  "ESTIMATE_SENT",
  "ESTIMATE_DECIDED",
  "INVOICE_ISSUED",
  "INVOICE_PAID",
  "APPOINTMENT_REQUESTED",
  "APPOINTMENT_CONFIRMED",
  "PART_REQUESTED",
  "PART_REQUEST_DECIDED",
  "LOW_STOCK",
  "QC_REQUIRED",
  "SERVICE_REQUEST",
];

/** A notice links to the record it is about, not to the list it came from. */
function entityHref(notification: Notification): string {
  switch (notification.entity_type) {
    case "estimate":
      return `/estimates/${notification.entity_id}`;
    case "invoice":
      return `/invoices/${notification.entity_id}`;
    case "appointment":
      return `/appointments`;
    case "service_request":
      return "/service-requests";
    case "part_request":
      return "/part-requests";
    case "part":
      return "/parts";
    case "repair_order":
      return `/repair-orders/${notification.entity_id}`;
    case "quality_check":
      return "/qc";
    default:
      return "/attention";
  }
}