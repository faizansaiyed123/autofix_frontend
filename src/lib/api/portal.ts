/**
 * Customer endpoints derive ownership from the signed-in token; callers cannot
 * choose another customer ID. Internal repair-order and inspection details stay private.
 */
import { api, downloadDocument, type Query } from "@/lib/api/client";
import type {
  PortalAccountSummary,
  PortalAppointment,
  PortalAppointmentCreate,
  PortalDecisionResult,
  PortalEstimate,
  PortalInvoice,
  PortalPayment,
  PortalPaymentCreate,
  PortalPaymentResult,
  PortalServiceRequest,
  PortalServiceRequestCreate,
  PortalVehicle,
  PortalVehicleHistory,
} from "@/lib/api/types";

export const portalApi = {
  summary: () => api.get<PortalAccountSummary>("/portal/"),

  vehicles: () => api.get<PortalVehicle[]>("/portal/vehicles"),
  vehicleHistory: (vehicleId: string) =>
    api.get<PortalVehicleHistory>(`/portal/vehicles/${vehicleId}`),

  appointments: (query?: Query) => api.get<PortalAppointment[]>("/portal/appointments", query),
  /** Refused at the form if the slot clashes with work already in a bay. */
  bookAppointment: (body: PortalAppointmentCreate) =>
    api.post<PortalAppointment>("/portal/appointments", body),

  serviceRequests: () => api.get<PortalServiceRequest[]>("/portal/service-requests"),
  createServiceRequest: (body: PortalServiceRequestCreate) =>
    api.post<PortalServiceRequest>("/portal/service-requests", body),

  estimates: (query?: Query) => api.get<PortalEstimate[]>("/portal/estimates", query),
  estimate: (id: string) => api.get<PortalEstimate>(`/portal/estimates/${id}`),
  /** Per-line, exactly as at the counter — the same service underneath. */
  decideEstimateItem: (estimateId: string, itemId: string, decision: "APPROVED" | "DECLINED", notes?: string | null) =>
    api.post<PortalDecisionResult>(`/portal/estimates/${estimateId}/items/${itemId}/decision`, {
      decision,
      notes: notes ?? null,
    }),
  downloadEstimate: (id: string, filename: string) =>
    downloadDocument(`/portal/estimates/${id}/document`, filename),

  invoices: (query?: Query) => api.get<PortalInvoice[]>("/portal/invoices", query),
  invoice: (id: string) => api.get<PortalInvoice>(`/portal/invoices/${id}`),
  downloadInvoice: (id: string, filename: string) =>
    downloadDocument(`/portal/invoices/${id}/document`, filename),

  payments: () => api.get<PortalPayment[]>("/portal/payments"),
  /** Somebody else's invoice is not found, never paid. */
  payInvoice: (invoiceId: string, body: PortalPaymentCreate) =>
    api.post<PortalPaymentResult>(`/portal/invoices/${invoiceId}/payments`, body),
};