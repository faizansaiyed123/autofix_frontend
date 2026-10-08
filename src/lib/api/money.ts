/**
 * Money. Both routers are shop-wide, so a payment listed here may be any
 * customer's — the till's book, not one account. A customer settles their own
 * bill through `portal.ts` instead, which resolves the invoice from the token.
 */
import { api, type Query } from "@/lib/api/client";
import type {
  Invoice,
  InvoiceItem,
  InvoiceSummary,
  Paginated,
  Payment,
  PaymentSummary,
} from "@/lib/api/types";

export const invoicesApi = {
  list: (query?: Query) => api.get<Paginated<Invoice>>("/invoices/", query),
  get: (id: string) => api.get<Invoice>(`/invoices/${id}`),
  summary: (id: string) => api.get<InvoiceSummary>(`/invoices/${id}/summary`),
  /** Raised against a repair order that has passed QC; totals are derived from the lines. */
  create: (body: {
    repair_order_id: string;
    invoice_date?: string | null;
    due_date?: string | null;
    tax_rate?: number | null;
    notes?: string | null;
    customer_notes?: string | null;
    extra_items?: unknown[];
  }) => api.post<Invoice>("/invoices/", body),
  update: (id: string, body: Record<string, unknown>) => api.patch<Invoice>(`/invoices/${id}`, body),
  remove: (id: string) => api.delete<void>(`/invoices/${id}`),
  issue: (id: string) => api.post<Invoice>(`/invoices/${id}/issue`),
  void: (id: string, reason: string) => api.post<Invoice>(`/invoices/${id}/void`, undefined, { reason }),
  addItem: (id: string, body: Record<string, unknown>) =>
    api.post<InvoiceItem>(`/invoices/${id}/items`, body),
  updateItem: (id: string, itemId: string, body: Record<string, unknown>) =>
    api.patch<InvoiceItem>(`/invoices/${id}/items/${itemId}`, body),
  removeItem: (id: string, itemId: string) => api.delete<void>(`/invoices/${id}/items/${itemId}`),
  /** Deliberately absent: a generic status endpoint. A bill is settled by a payment. */
};

export const paymentsApi = {
  list: (query?: Query) => api.get<Paginated<Payment>>("/payments/", query),
  get: (id: string) => api.get<Payment>(`/payments/${id}`),
  summary: (query?: Query) => api.get<PaymentSummary>("/payments/summary", query),
  record: (body: {
    invoice_id: string;
    amount: number;
    method?: string;
    payment_date?: string | null;
    reference?: string | null;
    notes?: string | null;
  }) => api.post<Payment>("/payments/", body),
  /** A payment is an event, never edited — a wrong one is reversed, and the row survives. */
  void: (id: string, reason: string) => api.post<Payment>(`/payments/${id}/void`, { reason }),
};