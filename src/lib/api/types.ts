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

/* ----------------------------------------------------------------- reports -- */

export interface ReportPeriod {
  start_date: string;
  end_date: string;
  days: number;
  granularity: string;
}

export interface DashboardReport {
  period: ReportPeriod;
  generated_for: string;
  revenue: {
    invoiced_total: number;
    collected_total: number;
    outstanding_balance: number;
    overdue_balance: number;
    overdue_count: number;
  };
  work: {
    repair_orders_open: number;
    repair_orders_in_progress: number;
    repair_orders_on_hold: number;
    repair_orders_awaiting_qc: number;
    completed_in_period: number;
    part_requests_pending: number;
  };
  money: {
    invoices_draft: number;
    invoices_issued: number;
    invoices_partially_paid: number;
    invoices_paid: number;
  };
  operations: {
    low_stock_count: number;
    out_of_stock_count: number;
    inventory_cost_value: number;
    appointments_today: number;
    vehicles_in_shop: number;
    pending_part_requests: number;
    unread_notifications: number;
  };
}

export interface RevenuePoint {
  period_start: string;
  invoiced: number;
  collected: number;
}

export interface RevenueReport {
  period: ReportPeriod;
  invoiced_total: number;
  invoice_count: number;
  average_invoice: number;
  collected_total: number;
  payment_count: number;
  voided_total: number;
  void_count: number;
  outstanding_balance: number;
  outstanding_count: number;
  overdue_balance: number;
  overdue_count: number;
  invoiced_by_status: Record<string, number>;
  series: RevenuePoint[];
}

export interface RepairOrderSeriesPoint {
  period_start: string;
  opened: number;
  completed: number;
}

export interface RepairOrderReport {
  period: ReportPeriod;
  status_counts: Record<string, number>;
  total_orders: number;
  opened: number;
  completed: number;
  delivered: number;
  cancelled: number;
  completion_rate: number;
  average_cycle_hours: number;
  series: RepairOrderSeriesPoint[];
}

export interface TechnicianProductivity {
  technician_id: string;
  name: string;
  repair_orders_assigned: number;
  repair_orders_completed: number;
  tasks_completed: number;
  labor_hours_actual: number;
  labor_hours_billable: number;
  labor_revenue: number;
  average_cycle_hours: number;
}

export interface TechnicianTotals {
  technician_count: number;
  repair_orders_completed: number;
  tasks_completed: number;
  labor_hours_actual: number;
  labor_hours_billable: number;
  labor_revenue: number;
}

export interface TechnicianProductivityReport {
  period: ReportPeriod;
  technicians: TechnicianProductivity[];
  totals: TechnicianTotals;
}

export interface InventoryValueReport {
  as_of: string;
  cost_value: number;
  retail_value: number;
  potential_margin: number;
  part_count: number;
  units_on_hand: number;
  low_stock_count: number;
  out_of_stock_count: number;
  by_category: { category: string; cost_value: number; retail_value: number; part_count: number; units_on_hand: number }[];
  low_stock_items: {
    part_id: string;
    part_number: string;
    name: string;
    quantity_on_hand: number;
    reorder_level: number;
    stock_status: string;
    cost_value: number;
  }[];
  top_movers: { part_id: string; part_number: string; name: string; quantity_issued: number; value_issued: number }[];
}

export interface CustomerRetentionReport {
  period: ReportPeriod;
  customers_billed: number;
  new_customers: number;
  returning_customers: number;
  repeat_rate: number;
  settled_revenue: number;
  revenue_per_customer: number;
  top_customers: { customer_id: string; name: string; revenue: number; invoice_count: number }[];
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

