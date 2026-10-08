/**
 * Response and request shapes, mirroring the backend's Pydantic schemas.
 *
 * These are hand-written rather than generated so they carry no build step, but
 * they are deliberately literal: a field is optional here exactly when the
 * schema marks it optional, because the alternative — a type that claims every
 * field is always present — pushes the real problem (a null the backend can
 * return) into the page, where it becomes a crash instead of a blank.
 */

export interface PaginationMeta {
  page: number;
  size: number;
  total: number;
  pages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

/* ------------------------------------------------------------------ auth -- */

export type Role =
  | "OWNER"
  | "SERVICE_ADVISOR"
  | "TECHNICIAN"
  | "PARTS_STAFF"
  | "CUSTOMER";

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface CurrentUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  is_active: boolean;
  is_staff: boolean;
  roles: string[];
}

export interface PermissionBundle {
  roles: string[];
  permissions: string[];
}

/* -------------------------------------------------------------- customers -- */

export type CustomerStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type ContactMethod = "EMAIL" | "PHONE" | "SMS";
export type AddressType = "PRIMARY" | "BILLING" | "OTHER";

export interface Address {
  id?: string;
  street: string;
  city: string;
  state?: string | null;
  postal_code?: string | null;
  country: string;
  address_type: AddressType;
}

export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  preferred_contact: ContactMethod;
  customer_status: CustomerStatus;
  notes: string | null;
  user_id: string | null;
  addresses: Address[];
}

export interface CustomerCreate {
  first_name: string;
  last_name: string;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  preferred_contact?: ContactMethod;
  customer_status?: CustomerStatus;
  notes?: string | null;
  addresses?: Address[] | null;
}

export type CustomerUpdate = Partial<CustomerCreate>;

/* --------------------------------------------------------------- vehicles -- */

export type VehicleStatus = "ACTIVE" | "IN_SHOP" | "ARCHIVED";

export interface MileageRecord {
  id: string;
  vehicle_id: string;
  mileage: number;
  source: string;
  notes: string | null;
  created_at: string;
}

export interface Vehicle {
  id: string;
  customer_id: string;
  vin: string | null;
  license_plate: string | null;
  make: string;
  model: string;
  year: number | null;
  trim: string | null;
  engine: string | null;
  transmission: string | null;
  mileage: number | null;
  color: string | null;
  fuel_type: string | null;
  purchase_date: string | null;
  notes: string | null;
  status: VehicleStatus;
  mileage_records: MileageRecord[];
}

export interface VehicleCreate {
  customer_id: string;
  make: string;
  model: string;
  vin?: string | null;
  license_plate?: string | null;
  year?: number | null;
  trim?: string | null;
  engine?: string | null;
  transmission?: string | null;
  mileage?: number | null;
  color?: string | null;
  fuel_type?: string | null;
  purchase_date?: string | null;
  notes?: string | null;
  status?: VehicleStatus;
}

export type VehicleUpdate = Partial<VehicleCreate>;

/* ----------------------------------------------------------- notifications -- */

export interface Notification {
  id: string;
  notification_type: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  priority: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationList {
  notifications: Notification[];
  total: number;
  unread_count: number;
}

export interface NotificationSummary {
  unread_count: number;
  high_priority_unread: number;
  latest_unread_at: string | null;
}

/* ------------------------------------------------------------------ users -- */

export interface ShopUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  is_active: boolean;
  is_staff: boolean;
  roles: string[];
}

export interface UserCreate {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  roles?: Role[];
  phone?: string | null;
  is_active?: boolean;
  is_staff?: boolean;
}

