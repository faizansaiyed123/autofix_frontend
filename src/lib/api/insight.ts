/**
 * Reports, the audit trail, staff accounts and the attention centre.
 *
 * The notifications router is the one API surface outside the staff gate, and
 * that is safe because every one of its queries filters on the signed-in user
 * server-side — there is no `recipient_id` parameter here to point at somebody
 * else's badge.
 */
import { api, type Query } from "@/lib/api/client";
import type {
  AuditEntityHistory,
  AuditLog,
  AuditLogSummary,
  CustomerRetentionReport,
  DashboardReport,
  InventoryValueReport,
  Notification,
  NotificationList,
  NotificationSummary,
  Paginated,
  RepairOrderReport,
  RevenueReport,
  ShopUser,
  TechnicianProductivityReport,
  UserCreate,
} from "@/lib/api/types";

export const reportsApi = {
  dashboard: (query?: Query) => api.get<DashboardReport>("/reports/dashboard", query),
  revenue: (query?: Query) => api.get<RevenueReport>("/reports/revenue", query),
  repairOrders: (query?: Query) => api.get<RepairOrderReport>("/reports/repair-orders", query),
  technicians: (query?: Query) =>
    api.get<TechnicianProductivityReport>("/reports/technicians", query),
  /** Gated on `inventory:read`, not `reports:read`: these figures are shop purchase cost. */
  inventoryValue: (query?: Query) => api.get<InventoryValueReport>("/reports/inventory-value", query),
  /** Gated on `reports:analytics` — OWNER only. These two rank named people. */
  customerRetention: (query?: Query) =>
    api.get<CustomerRetentionReport>("/reports/customer-retention", query),
};

export const auditApi = {
  list: (query?: Query) => api.get<Paginated<AuditLogSummary>>("/audit/", query),
  get: (id: string) => api.get<AuditLog>(`/audit/${id}`),
  /** Both vocabularies come back wrapped, so a caller reads `.actions` / `.entity_types`. */
actions: () => api.get<{ actions: string[] }>("/audit/actions"),
  entityTypes: () => api.get<{ entity_types: string[] }>("/audit/entity-types"),
  entityHistory: (entityType: string, entityId: string, limit = 50) =>
    api.get<AuditEntityHistory>(`/audit/entity/${entityType}/${entityId}`, { limit }),
};

export const usersApi = {
  list: (query?: Query) => api.get<Paginated<ShopUser>>("/users/", query),
  get: (id: string) => api.get<ShopUser>(`/users/${id}`),
  create: (body: UserCreate) => api.post<ShopUser>("/users/", body),
  update: (id: string, body: Record<string, unknown>) => api.patch<ShopUser>(`/users/${id}`, body),
  remove: (id: string) => api.delete<void>(`/users/${id}`),
};

export const notificationsApi = {
  list: (query?: Query) => api.get<NotificationList>("/notifications/", query),
  summary: () => api.get<NotificationSummary>("/notifications/summary"),
  unreadCount: () => api.get<{ unread_count: number }>("/notifications/unread-count"),
  markRead: (id: string) => api.post<Notification>(`/notifications/${id}/read`),
  markUnread: (id: string) => api.post<Notification>(`/notifications/${id}/unread`),
  markAllRead: () => api.post<{ message: string }>("/notifications/mark-all-read"),
};