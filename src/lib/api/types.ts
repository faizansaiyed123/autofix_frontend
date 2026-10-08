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

