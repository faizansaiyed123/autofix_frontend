"use client";

import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { portalApi } from "@/lib/api/portal";
import type { PortalPayment } from "@/lib/api/types";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { formatDate, formatMoney } from "@/lib/format";

/**
 * Payments this account has made.
 *
 * A payment is an event, not a document: there is nothing here to edit, because a
 * record of what a customer handed over is a fact about the till. A payment that
 * turns out to be wrong is reversed by the shop, which writes the correction on
 * the same row rather than deleting it.
 */
export default function PortalPaymentsPage() {
  const payments = useApiQuery(() => portalApi.payments());

  const columns: Column<PortalPayment>[] = [
    { key: "date", header: "Date", render: (p) => formatDate(p.payment_date) },
    {
      key: "invoice",
      header: "Against",
      render: (p) => (
        <Link href="/portal/invoices" className="font-medium text-brand-700 hover:underline">
          {p.invoice_number}
        </Link>
      ),
    },
    { key: "method", header: "Method", render: (p) => p.method.replace("_", " ").toLowerCase() },
    {
      key: "reference",
      header: "Reference",
      render: (p) => <span className="text-xs text-ink-600">{p.reference ?? "—"}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      numeric: true,
      render: (p) =>
        p.status === "VOID" ? (
          <span className="text-ink-400 line-through">{formatMoney(p.amount)}</span>
        ) : (
          <span className="font-medium text-ink-900">{formatMoney(p.amount)}</span>
        ),
    },
    { key: "status", header: "Status", render: (p) => p.status },
  ];

  if (payments.loading && payments.initial) return <Loading />;
  if (payments.error) return <ErrorState error={payments.error} onRetry={payments.refetch} />;

  return (
    <>
      <PageHeader title="Payments" subtitle="What you have paid the shop." />
      <Card padded={false}>
        {!payments.data || payments.data.length === 0 ? (
          <EmptyState
            title="No payments yet"
            description="Payments you make against an invoice appear here."
          />
        ) : (
          <>
            <DataTable
              rows={payments.data}
              columns={columns}
              rowKey={(p) => p.id}
              empty={<EmptyState title="No payments yet" />}
            />
            <Pagination page={1} pages={1} total={payments.data.length} onPage={() => undefined} />
          </>
        )}
      </Card>
    </>
  );
}