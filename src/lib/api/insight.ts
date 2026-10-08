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
  Notification,
  NotificationList,
  NotificationSummary,
  Paginated,
  ShopUser,
  UserCreate,
} from "@/lib/api/types";

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