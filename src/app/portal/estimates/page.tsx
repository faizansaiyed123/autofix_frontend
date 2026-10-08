"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { portalApi } from "@/lib/api/portal";
import type { PortalEstimate } from "@/lib/api/types";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { formatDate, formatMoney } from "@/lib/format";

/**
 * Estimates, and the ones waiting on the customer.
 *
 * `open_only` deliberately excludes expired estimates. Listing one as awaiting a
 * decision asks the customer to approve something that will then be refused —
 * an expired quote is not a live question.
 */
export default function PortalEstimatesPage() {
  const [openOnly, setOpenOnly] = useState(false);
  const estimates = useApiQuery(() => portalApi.estimates({ open_only: openOnly }), [openOnly]);

  const columns: Column<PortalEstimate>[] = [
    {
      key: "number",
      header: "Estimate",
      render: (e) => (
        <div>
          <Link href={`/portal/estimates/${e.id}`} className="font-medium text-brand-700 hover:underline">
            {e.estimate_number}
          </Link>
          {e.is_expired ? (
            <span className="ml-2">
              <Badge tone="neutral">Expired</Badge>
            </span>
          ) : null}
        </div>
      ),
    },
    { key: "total", header: "Total", numeric: true, render: (e) => formatMoney(e.total) },
    {
      key: "approved",
      header: "Approved",
      numeric: true,
      render: (e) => (
        <span className={e.approved_total > 0 ? "font-medium text-emerald-700" : "text-ink-500"}>
          {formatMoney(e.approved_total)}
        </span>
      ),
    },
    {
      key: "undecided",
      header: "Waiting on you",
      render: (e) => {
        const pending = e.items.filter((item) => item.can_decide).length;
        return pending > 0 ? (
          <Badge tone="warning">
            {pending} line{pending === 1 ? "" : "s"}
          </Badge>
        ) : (
          <span className="text-xs text-ink-400">Nothing</span>
        );
      },
    },
    { key: "valid", header: "Valid until", render: (e) => formatDate(e.valid_until) },
    {
      key: "status",
      header: "Status",
      render: (e) => (
        <span
          title={e.status_view.detail}
          className="inline-flex items-center rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-700"
        >
          {e.status_view.label}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Estimates"
        subtitle="What we think the work costs, and what you have agreed so far."
        actions={
          <div className="flex gap-2">
            <label className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-ink-200 ring-inset">
              <input
                type="checkbox"
                checked={openOnly}
                onChange={(event) => setOpenOnly(event.target.checked)}
                className="size-4 accent-brand-600"
              />
              Awaiting my decision
            </label>
          </div>
        }
      />

      <Card padded={false}>
        {estimates.loading && estimates.initial ? (
          <Loading />
        ) : estimates.error ? (
          <div className="p-4">
            <ErrorState error={estimates.error} onRetry={estimates.refetch} />
          </div>
        ) : !estimates.data || estimates.data.length === 0 ? (
          <EmptyState
            title={openOnly ? "Nothing waiting on you" : "No estimates yet"}
            description={
              openOnly
                ? "When we send you a quote, the lines you have not decided on appear here."
                : "Quotes appear here once the shop has priced the work."
            }
          />
        ) : (
          <DataTable
            rows={estimates.data}
            columns={columns}
            rowKey={(e) => e.id}
            empty={<EmptyState title="No estimates yet" />}
          />
        )}
      </Card>
    </>
  );
}