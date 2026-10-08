"use client";

import Link from "next/link";
import { useState } from "react";

import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { portalApi } from "@/lib/api/portal";
import type { PortalInvoice } from "@/lib/api/types";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { formatDate, formatMoney } from "@/lib/format";

export default function PortalInvoicesPage() {
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const invoices = useApiQuery(() => portalApi.invoices({ unpaid_only: unpaidOnly }), [unpaidOnly]);

  const columns: Column<PortalInvoice>[] = [
    {
      key: "number",
      header: "Invoice",
      render: (i) => (
        <div>
          <Link href={`/portal/invoices/${i.id}`} className="font-medium text-brand-700 hover:underline">
            {i.invoice_number}
          </Link>
          <p className="text-xs text-ink-500">dated {formatDate(i.invoice_date)}</p>
        </div>
      ),
    },
    { key: "total", header: "Total", numeric: true, render: (i) => formatMoney(i.total) },
    { key: "paid", header: "Paid", numeric: true, render: (i) => formatMoney(i.amount_paid) },
    {
      key: "balance",
      header: "Still owed",
      numeric: true,
      render: (i) =>
        i.balance > 0 ? (
          <span className="font-semibold text-amber-700">{formatMoney(i.balance)}</span>
        ) : (
          <span className="text-emerald-700">Settled</span>
        ),
    },
    {
      key: "due",
      header: "Due",
      render: (i) =>
        i.is_overdue ? (
          <span className="text-xs font-medium text-rose-700">
            {i.days_overdue} day(s) late
          </span>
        ) : (
          <span className="text-xs text-ink-600">{formatDate(i.due_date)}</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (i) => (
        <span title={i.status_view.detail}>
          <StatusBadge status={i.status} />
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Everything the shop has billed you."
        actions={
          <label className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-ink-200 ring-inset">
            <input
              type="checkbox"
              checked={unpaidOnly}
              onChange={(event) => setUnpaidOnly(event.target.checked)}
              className="size-4 accent-brand-600"
            />
            Unpaid only
          </label>
        }
      />

      <Card padded={false}>
        {invoices.loading && invoices.initial ? (
          <Loading />
        ) : invoices.error ? (
          <div className="p-4">
            <ErrorState error={invoices.error} onRetry={invoices.refetch} />
          </div>
        ) : !invoices.data || invoices.data.length === 0 ? (
          <EmptyState
            title={unpaidOnly ? "Nothing outstanding" : "No invoices yet"}
            description={
              unpaidOnly
                ? "You have settled everything the shop has billed."
                : "Invoices appear here once the work has been done and checked."
            }
          />
        ) : (
          <DataTable
            rows={invoices.data}
            columns={columns}
            rowKey={(i) => i.id}
            empty={<EmptyState title="No invoices yet" />}
          />
        )}
      </Card>
    </>
  );
}