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
  LaborRecord,
  LaborRecordCreate,
  PartRequest,
  PartRequestCreate,
  PartRequestUpdate,
  Paginated,
  RepairOrder,
  RepairOrderCreate,
  RepairOrderSummary,
  RepairTask,
  TechnicianDashboard,
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

export const repairOrdersApi = {
  list: (query?: Query) => api.get<Paginated<RepairOrder>>("/repair_orders/", query),
  get: (id: string) => api.get<RepairOrder>(`/repair_orders/${id}`),
  summary: (id: string) => api.get<RepairOrderSummary>(`/repair_orders/${id}/summary`),
  create: (body: RepairOrderCreate) => api.post<RepairOrder>("/repair_orders/", body),
  update: (id: string, body: Partial<RepairOrderCreate>) =>
    api.patch<RepairOrder>(`/repair_orders/${id}`, body),
  remove: (id: string) => api.delete<void>(`/repair_orders/${id}`),
  setStatus: (id: string, status: string, reason?: string) =>
    api.patch<RepairOrder>(`/repair_orders/${id}/status`, undefined, { status, reason }),
  addTask: (id: string, body: { description: string; notes?: string | null; assigned_to_id?: string | null }) =>
    api.post<RepairTask>(`/repair_orders/${id}/tasks`, body),
  updateTask: (id: string, taskId: string, body: Record<string, unknown>) =>
    api.patch<RepairTask>(`/repair_orders/${id}/tasks/${taskId}`, body),
  removeTask: (id: string, taskId: string) =>
    api.delete<void>(`/repair_orders/${id}/tasks/${taskId}`),
  setTaskStatus: (id: string, taskId: string, status: string, notes?: string | null) =>
    api.patch<RepairTask>(`/repair_orders/${id}/tasks/${taskId}/status`, undefined, {
      status,
      notes: notes ?? null,
    }),
};

export const laborApi = {
  list: (query?: Query) => api.get<Paginated<LaborRecord>>("/labor/", query),
  get: (id: string) => api.get<LaborRecord>(`/labor/${id}`),
  create: (body: LaborRecordCreate) => api.post<LaborRecord>("/labor/", body),
  update: (id: string, body: Partial<LaborRecordCreate>) =>
    api.patch<LaborRecord>(`/labor/${id}`, body),
  remove: (id: string) => api.delete<void>(`/labor/${id}`),
  /**
   * `technician_id` is required by `GET /labor/dashboard`, so it is required
   * here too: passing nothing produced a 422, and "mine" has to be resolved by
   * the caller from the signed-in user rather than by the route.
   */
  dashboard: (technicianId: string) =>
    api.get<TechnicianDashboard>("/labor/dashboard", { technician_id: technicianId }),
};

export const partRequestsApi = {
  list: (query?: Query) => api.get<Paginated<PartRequest>>("/part_requests/", query),
  get: (id: string) => api.get<PartRequest>(`/part_requests/${id}`),
  create: (body: PartRequestCreate) => api.post<PartRequest>("/part_requests/", body),
  update: (id: string, body: PartRequestUpdate) =>
    api.patch<PartRequest>(`/part_requests/${id}`, body),
  remove: (id: string) => api.delete<void>(`/part_requests/${id}`),
  /** The verbs are `PartRequestStatus` values the backend accepts: APPROVED or REJECTED. */
  decide: (id: string, decision: "APPROVED" | "REJECTED", decisionReason?: string | null) =>
    api.post<PartRequest>(`/part_requests/${id}/decision`, {
      decision,
      decision_reason: decisionReason ?? null,
    }),
  fulfil: (id: string) => api.post<PartRequest>(`/part_requests/${id}/fulfil`),
  cancel: (id: string, reason?: string) =>
    api.post<PartRequest>(`/part_requests/${id}/cancel`, undefined, { reason }),
};

