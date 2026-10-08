/**
 * The workshop: what was quoted, what was authorised, who is doing it, and
 * whether the work passed inspection.
 */
import { api, type Query } from "@/lib/api/client";
import type {
  Estimate,
  EstimateCreate,
  EstimateItem,
  EstimateItemCreate,
  EstimateItemUpdate,
  EstimateSummary,
  EstimateUpdate,
  Paginated,
} from "@/lib/api/types";

export const estimatesApi = {
  list: (query?: Query) => api.get<Paginated<Estimate>>("/estimates/", query),
  get: (id: string) => api.get<Estimate>(`/estimates/${id}`),
  summary: (id: string) => api.get<EstimateSummary>(`/estimates/${id}/summary`),
  create: (body: EstimateCreate) => api.post<Estimate>("/estimates/", body),
  update: (id: string, body: EstimateUpdate) => api.patch<Estimate>(`/estimates/${id}`, body),
  remove: (id: string) => api.delete<void>(`/estimates/${id}`),
  send: (id: string) => api.post<Estimate>(`/estimates/${id}/send`),
  cancel: (id: string, reason?: string) =>
    api.post<Estimate>(`/estimates/${id}/cancel`, undefined, { reason }),
  setStatus: (id: string, status: string, reason?: string) =>
    api.patch<Estimate>(`/estimates/${id}/status`, undefined, { status, reason }),
  addItem: (id: string, body: EstimateItemCreate) =>
    api.post<EstimateItem>(`/estimates/${id}/items`, body),
  updateItem: (id: string, itemId: string, body: EstimateItemUpdate) =>
    api.patch<EstimateItem>(`/estimates/${id}/items/${itemId}`, body),
  removeItem: (id: string, itemId: string) => api.delete<void>(`/estimates/${id}/items/${itemId}`),
  /**
   * Recorded at the counter, on the customer's behalf.
   *
   * The verbs are the item statuses themselves: the backend coerces `decision`
   * against `EstimateItemStatus` and rejects `PENDING`, so anything that is not
   * `APPROVED` or `DECLINED` is a 422 rather than a silent no-op.
   */
  decideItem: (id: string, itemId: string, decision: "APPROVED" | "DECLINED", notes?: string | null) =>
    api.post<Estimate>(`/estimates/${id}/items/${itemId}/decision`, {
      decision,
      notes: notes ?? null,
    }),
};

