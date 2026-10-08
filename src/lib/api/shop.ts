/**
 * Front-desk endpoints: the people, their cars, the diary and what happens on
 * arrival. Every one of these sits behind the backend's staff gate, so they are
 * shop-wide lists rather than "mine" views — a customer reads their own account
 * through `portal.ts` instead.
 */
import { api, type Query } from "@/lib/api/client";
import type {
  Appointment,
  CalendarResponse,
  ConflictCheckResponse,
  Customer,
  CustomerCreate,
  CustomerUpdate,
  MileageRecord,
  Paginated,
  ServiceRequest,
  ServiceRequestCreate,
  ServiceRequestUpdate,
  Vehicle,
  VehicleCreate,
  VehicleStatus,
  VehicleUpdate,
} from "@/lib/api/types";

export const customersApi = {
  list: (query?: Query) => api.get<Paginated<Customer>>("/customers/", query),
  search: (q: string, limit = 20) =>
    api.get<Customer[]>("/customers/search", { q, limit }),
  get: (id: string) => api.get<Customer>(`/customers/${id}`),
  create: (body: CustomerCreate) => api.post<Customer>("/customers/", body),
  update: (id: string, body: CustomerUpdate) => api.patch<Customer>(`/customers/${id}`, body),
  remove: (id: string) => api.delete<void>(`/customers/${id}`),
  vehicles: (id: string) => api.get<Vehicle[]>(`/customers/${id}/vehicles`),
};

export const vehiclesApi = {
  list: (query?: Query) => api.get<Paginated<Vehicle>>("/vehicles/", query),
  search: (q: string, limit = 20) => api.get<Vehicle[]>("/vehicles/search", { q, limit }),
  get: (id: string) => api.get<Vehicle>(`/vehicles/${id}`),
  create: (body: VehicleCreate) => api.post<Vehicle>("/vehicles/", body),
  update: (id: string, body: VehicleUpdate) => api.patch<Vehicle>(`/vehicles/${id}`, body),
  remove: (id: string) => api.delete<void>(`/vehicles/${id}`),
  setStatus: (id: string, status: VehicleStatus) =>
    api.patch<Vehicle>(`/vehicles/${id}/status`, undefined, { status }),
  mileage: (id: string) => api.get<MileageRecord[]>(`/vehicles/${id}/mileage`),
  addMileage: (id: string, body: { mileage: number; source?: string; notes?: string | null }) =>
    api.post<MileageRecord>(`/vehicles/${id}/mileage`, body),
};

export const serviceRequestsApi = {
  list: (query?: Query) => api.get<Paginated<ServiceRequest>>("/service_requests/", query),
  get: (id: string) => api.get<ServiceRequest>(`/service_requests/${id}`),
  create: (body: ServiceRequestCreate) => api.post<ServiceRequest>("/service_requests/", body),
  update: (id: string, body: ServiceRequestUpdate) =>
    api.patch<ServiceRequest>(`/service_requests/${id}`, body),
  remove: (id: string) => api.delete<void>(`/service_requests/${id}`),
  setStatus: (id: string, status: string) =>
    api.patch<ServiceRequest>(`/service_requests/${id}/status`, undefined, { status }),
};

export const appointmentsApi = {
  list: (query?: Query) => api.get<Paginated<Appointment>>("/appointments/", query),
  get: (id: string) => api.get<Appointment>(`/appointments/${id}`),
  create: (body: Record<string, unknown>) => api.post<Appointment>("/appointments/", body),
  update: (id: string, body: Record<string, unknown>) =>
    api.patch<Appointment>(`/appointments/${id}`, body),
  remove: (id: string) => api.delete<void>(`/appointments/${id}`),
  setStatus: (id: string, status: string, cancellationReason?: string | null) =>
    api.patch<Appointment>(`/appointments/${id}/status`, {
      status,
      cancellation_reason: cancellationReason ?? null,
    }),
  calendar: (query?: Query) => api.get<CalendarResponse>("/appointments/calendar", query),
  checkConflicts: (body: {
    scheduled_start: string;
    duration_minutes: number;
    technician_id?: string | null;
    bay?: string | null;
    vehicle_id?: string | null;
    exclude_appointment_id?: string | null;
  }) => api.post<ConflictCheckResponse>("/appointments/check-conflicts", body),
  fromServiceRequest: (id: string, body: Record<string, unknown>) =>
    api.post<Appointment>(`/appointments/from-service-request/${id}`, body),
};

