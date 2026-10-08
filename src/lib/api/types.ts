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

/* ------------------------------------------------------- service requests -- */

export interface ServiceRequest {
  id: string;
  customer_id: string;
  vehicle_id: string | null;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  service_advisor_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceRequestCreate {
  customer_id: string;
  title: string;
  description?: string | null;
  priority?: string;
  vehicle_id?: string | null;
  service_advisor_notes?: string | null;
}

export type ServiceRequestUpdate = Partial<Omit<ServiceRequestCreate, "customer_id">> & {
  status?: string;
};

/* ------------------------------------------------------------ appointments -- */

export interface Appointment {
  id: string;
  customer_id: string;
  vehicle_id: string;
  service_request_id: string | null;
  service_type: string;
  scheduled_start: string;
  scheduled_end: string;
  duration_minutes: number;
  advisor_id: string | null;
  technician_id: string | null;
  bay: string | null;
  customer_concern: string | null;
  notes: string | null;
  status: string;
  cancellation_reason: string | null;
  checkin_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentCreate {
  customer_id: string;
  vehicle_id: string;
  service_type: string;
  scheduled_start: string;
  duration_minutes?: number;
  service_request_id?: string | null;
  advisor_id?: string | null;
  technician_id?: string | null;
  bay?: string | null;
  customer_concern?: string | null;
  notes?: string | null;
}

export interface CalendarDay {
  date: string;
  appointments: Appointment[];
}

export interface CalendarResponse {
  view: string;
  range_start: string;
  range_end: string;
  total: number;
  days: CalendarDay[];
}

export interface ConflictDetail {
  appointment_id: string;
  reason: string;
  scheduled_start: string;
  scheduled_end: string;
}

export interface ConflictCheckResponse {
  has_conflict: boolean;
  conflicts: ConflictDetail[];
}

/* --------------------------------------------------------------- check-ins -- */

export interface CheckIn {
  id: string;
  vehicle_id: string;
  customer_id: string;
  odometer: number;
  checkin_type: string;
  status: string;
  notes: string | null;
  expected_completion: string | null;
  tire_condition: string | null;
  fluid_levels: string | null;
  lights_status: string | null;
  service_advisor_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CheckInCreate {
  vehicle_id: string;
  customer_id: string;
  odometer: number;
  checkin_type?: string;
  notes?: string | null;
  expected_completion?: string | null;
  tire_condition?: string | null;
  fluid_levels?: string | null;
  lights_status?: string | null;
  service_advisor_id?: string | null;
}

/* ------------------------------------------------------------ inspections -- */

export interface InspectionPhoto {
  id?: string;
  photo_url: string;
  caption?: string | null;
}

export interface InspectionItem {
  id?: string;
  category: string;
  item_name: string;
  status: string;
  severity_color?: string;
  measurement: string | null;
  notes: string | null;
  recommendation: string | null;
  photo_url?: string | null;
  photo_caption?: string | null;
  photos?: InspectionPhoto[];
}

export interface Inspection {
  id: string;
  vehicle_id: string;
  customer_id: string;
  checkin_id: string | null;
  technician_id: string | null;
  mileage: number | null;
  overall_notes: string | null;
  status: string;
  overall_condition: string;
  items: InspectionItem[];
  created_at: string;
  updated_at: string;
}

export interface InspectionCreate {
  vehicle_id: string;
  customer_id: string;
  checkin_id?: string | null;
  technician_id?: string | null;
  mileage?: number | null;
  overall_notes?: string | null;
  items?: InspectionItem[];
}

export interface InspectionItemUpdate {
  category?: string | null;
  item_name?: string | null;
  status?: string | null;
  measurement?: string | null;
  notes?: string | null;
  recommendation?: string | null;
}

/* -------------------------------------------------------------- estimates -- */

export interface EstimateItem {
  id: string;
  item_type: string;
  description: string;
  labor_hours: number | null;
  labor_rate: number | null;
  part_number: string | null;
  part_name: string | null;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  is_optional: boolean;
  notes: string | null;
  status: string;
  line_total: number;
  customer_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EstimateItemCreate {
  item_type?: string;
  description: string;
  labor_hours?: number | null;
  labor_rate?: number | null;
  part_number?: string | null;
  part_name?: string | null;
  quantity?: number;
  unit_price?: number;
  discount_amount?: number;
  is_optional?: boolean;
  notes?: string | null;
}

export type EstimateItemUpdate = Partial<EstimateItemCreate> & { sequence?: number | null };

export interface EstimateUpdate {
  valid_until?: string | null;
  tax_rate?: number | null;
  notes?: string | null;
  customer_notes?: string | null;
}

export interface Estimate {
  id: string;
  estimate_number: string;
  customer_id: string;
  vehicle_id: string;
  inspection_id: string | null;
  service_request_id: string | null;
  created_by_id: string | null;
  status: string;
  subtotal: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  approved_total: number;
  valid_until: string | null;
  is_expired: boolean;
  notes: string | null;
  customer_notes: string | null;
  decline_reason: string | null;
  sent_at: string | null;
  decided_at: string | null;
  items: EstimateItem[];
  created_at: string;
  updated_at: string;
}

export interface EstimateCreate {
  customer_id: string;
  vehicle_id: string;
  inspection_id?: string | null;
  service_request_id?: string | null;
  valid_until?: string | null;
  tax_rate?: number;
  notes?: string | null;
  items?: EstimateItemCreate[];
}

export interface EstimateTotals {
  subtotal: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  approved_total: number;
}

export interface EstimateItemCounts {
  total: number;
  pending: number;
  approved: number;
  declined: number;
}

export interface EstimateSummary {
  estimate_id: string;
  estimate_number: string;
  status: string;
  is_expired: boolean;
  can_decide: boolean;
  valid_until: string | null;
  totals: EstimateTotals;
  counts: EstimateItemCounts;
}

/* ---------------------------------------------------------- repair orders -- */

export interface RepairTask {
  id: string;
  repair_order_id: string;
  description: string;
  notes: string | null;
  status: string;
  sequence: number;
  assigned_to_id: string | null;
  completed_at: string | null;
}

export interface RepairOrder {
  id: string;
  ro_number: string;
  customer_id: string;
  vehicle_id: string;
  estimate_id: string | null;
  appointment_id: string | null;
  advisor_id: string | null;
  technician_id: string | null;
  status: string;
  odometer_in: number | null;
  odometer_out: number | null;
  bay: string | null;
  promised_at: string | null;
  notes: string | null;
  customer_notes: string | null;
  cancel_reason: string | null;
  started_at: string | null;
  completed_at: string | null;
  delivered_at: string | null;
  all_tasks_done: boolean;
  tasks: RepairTask[];
  created_at: string;
  updated_at: string;
}

export interface RepairOrderCreate {
  customer_id: string;
  vehicle_id: string;
  estimate_id?: string | null;
  appointment_id?: string | null;
  advisor_id?: string | null;
  technician_id?: string | null;
  odometer_in?: number | null;
  odometer_out?: number | null;
  bay?: string | null;
  promised_at?: string | null;
  notes?: string | null;
  customer_notes?: string | null;
  tasks?: { description: string; notes?: string | null; assigned_to_id?: string | null }[];
}

export interface RepairOrderTaskCounts {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  skipped: number;
}

export interface RepairOrderSummary {
  repair_order_id: string;
  ro_number: string;
  status: string;
  is_terminal: boolean;
  tasks_editable: boolean;
  all_tasks_done: boolean;
  counts: RepairOrderTaskCounts;
}

/* ------------------------------------------------------------------ labor -- */

export interface LaborRecord {
  id: string;
  repair_order_id: string;
  repair_task_id: string | null;
  technician_id: string | null;
  description: string;
  actual_hours: number;
  billable_hours: number;
  hourly_rate: number;
  labor_cost: number;
  performed_at: string;
  notes: string | null;
}

export interface LaborRecordCreate {
  repair_order_id: string;
  description: string;
  actual_hours: number;
  billable_hours?: number | null;
  hourly_rate: number;
  repair_task_id?: string | null;
  technician_id?: string | null;
  performed_at?: string | null;
  notes?: string | null;
}

export interface TechnicianDashboardOpenTask {
  task_id: string;
  description: string;
  repair_order_id: string;
  ro_number: string;
  status: string;
}

export interface TechnicianDashboard {
  technician_id: string;
  open_task_count: number;
  in_progress_ro_count: number;
  hours_this_week: number;
  pending_part_request_count: number;
  open_tasks: TechnicianDashboardOpenTask[];
}

/* ---------------------------------------------------------- part requests -- */

export interface PartRequest {
  id: string;
  repair_order_id: string;
  repair_task_id: string | null;
  requested_by_id: string | null;
  decided_by_id: string | null;
  part_number: string | null;
  part_name: string;
  quantity: number;
  reason: string;
  status: string;
  decision_reason: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartRequestCreate {
  repair_order_id: string;
  part_name: string;
  reason: string;
  quantity?: number;
  part_number?: string | null;
  repair_task_id?: string | null;
}

export interface PartRequestUpdate {
  part_number?: string | null;
  part_name?: string | null;
  quantity?: number | null;
  reason?: string | null;
}

/* --------------------------------------------------------------------- qc -- */

export interface QCCheckItem {
  id: string;
  quality_check_id: string;
  check_type: string;
  passed: boolean;
  blocking: boolean;
  auto_verified: boolean;
  evidence: string | null;
  notes: string | null;
}

export interface QCPhoto {
  id: string;
  quality_check_id: string;
  photo_url: string;
  caption: string | null;
  created_at: string;
}

export interface QualityCheck {
  id: string;
  repair_order_id: string;
  inspector_id: string | null;
  status: string;
  attempt_number: number;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  failure_reason: string | null;
  is_terminal: boolean;
  passed: boolean;
  checks: QCCheckItem[];
  photos: QCPhoto[];
}

export interface QCQueueItem {
  repair_order_id: string;
  ro_number: string;
  customer_id: string;
  vehicle_id: string;
  technician_id: string | null;
  completed_at: string | null;
  has_open_check: boolean;
}

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

