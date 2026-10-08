/**
 * Stock, suppliers and the order book.
 *
 * `unit_cost` appears in these responses because the catalog is behind the staff
 * gate and the parts desk needs the margin. It is deliberately absent from the
 * portal, which never shows a customer what the shop paid.
 */
import { api, type Query } from "@/lib/api/client";
import type {
  InventoryTransaction,
  InventoryTransactionCreate,
  LowStockAlert,
  Paginated,
  Part,
  PartCreate,
  PurchaseOrder,
  PurchaseOrderSummary,
  ReceiveResult,
  StockLevel,
  StockSummary,
  Supplier,
} from "@/lib/api/types";

export const partsApi = {
  list: (query?: Query) => api.get<Paginated<Part>>("/parts/", query),
  get: (id: string) => api.get<Part>(`/parts/${id}`),
  categories: () => api.get<string[]>("/parts/categories"),
  lowStock: (includeDiscontinued = false) =>
    api.get<LowStockAlert[]>("/parts/low-stock", { include_discontinued: includeDiscontinued }),
  create: (body: PartCreate) => api.post<Part>("/parts/", body),
  update: (id: string, body: Partial<PartCreate> & { status?: string }) =>
    api.patch<Part>(`/parts/${id}`, body),
  remove: (id: string) => api.delete<void>(`/parts/${id}`),
};

export const inventoryApi = {
  list: (query?: Query) => api.get<Paginated<InventoryTransaction>>("/inventory/transactions", query),
  create: (body: InventoryTransactionCreate) =>
    api.post<InventoryTransaction>("/inventory/transactions", body),
  get: (id: string) => api.get<InventoryTransaction>(`/inventory/transactions/${id}`),
  /** The only way stock moves: each row records the balance either side of itself. */
  partHistory: (partId: string, limit = 50) =>
    api.get<InventoryTransaction[]>(`/inventory/parts/${partId}/history`, { limit }),
  stockLevels: (query?: Query) => api.get<StockLevel[]>("/inventory/stock-levels", query),
  stockSummary: () => api.get<StockSummary>("/inventory/stock-summary"),
  lowStock: (includeDiscontinued = false) =>
    api.get<LowStockAlert[]>("/inventory/low-stock", {
      include_discontinued: includeDiscontinued,
    }),
};

export const suppliersApi = {
  list: (query?: Query) => api.get<Paginated<Supplier>>("/suppliers/", query),
  active: (preferredOnly = false) =>
    api.get<Supplier[]>("/suppliers/active", { preferred_only: preferredOnly }),
  get: (id: string) => api.get<Supplier>(`/suppliers/${id}`),
  summary: (id: string) => api.get<Record<string, unknown>>(`/suppliers/${id}/summary`),
  create: (body: Record<string, unknown>) => api.post<Supplier>("/suppliers/", body),
  update: (id: string, body: Record<string, unknown>) => api.patch<Supplier>(`/suppliers/${id}`, body),
  /** A supplier the shop has ever ordered from cannot be deleted, only retired. */
  remove: (id: string) => api.delete<void>(`/suppliers/${id}`),
  deactivate: (id: string) => api.post<Supplier>(`/suppliers/${id}/deactivate`),
};

export const purchaseOrdersApi = {
  list: (query?: Query) => api.get<Paginated<PurchaseOrder>>("/purchase_orders/", query),
  get: (id: string) => api.get<PurchaseOrder>(`/purchase_orders/${id}`),
  byNumber: (poNumber: string) =>
    api.get<PurchaseOrder>(`/purchase_orders/by-number/${encodeURIComponent(poNumber)}`),
  summary: () => api.get<PurchaseOrderSummary>("/purchase_orders/summary"),
  create: (body: Record<string, unknown>) => api.post<PurchaseOrder>("/purchase_orders/", body),
  update: (id: string, body: Record<string, unknown>) =>
    api.patch<PurchaseOrder>(`/purchase_orders/${id}`, body),
  remove: (id: string) => api.delete<void>(`/purchase_orders/${id}`),
  send: (id: string) => api.post<PurchaseOrder>(`/purchase_orders/${id}/send`),
  cancel: (id: string, reason?: string) =>
    api.post<PurchaseOrder>(`/purchase_orders/${id}/cancel`, { reason: reason ?? null }),
  setStatus: (id: string, status: string) =>
    api.patch<PurchaseOrder>(`/purchase_orders/${id}/status`, { status }),
  /** One RECEIPT per line, all in one transaction — a bad line cannot half-book the good ones. */
  receive: (id: string, body: { items: { item_id: string; quantity: number; unit_cost?: number }[]; notes?: string | null }) =>
    api.post<ReceiveResult>(`/purchase_orders/${id}/receive`, body),
  addItem: (id: string, body: Record<string, unknown>) =>
    api.post<PurchaseOrder>(`/purchase_orders/${id}/items`, body),
  updateItem: (id: string, itemId: string, body: Record<string, unknown>) =>
    api.patch<PurchaseOrder>(`/purchase_orders/${id}/items/${itemId}`, body),
  removeItem: (id: string, itemId: string) =>
    api.delete<void>(`/purchase_orders/${id}/items/${itemId}`),
  /** Builds a draft a buyer edits — an order is never placed on their behalf. */
  fromLowStock: (body: {
    supplier_id: string;
    expected_delivery_date?: string | null;
    tax_amount?: number;
    shipping_amount?: number;
    notes?: string | null;
    shortage_multiplier?: number;
    part_ids?: string[] | null;
    include_discontinued?: boolean;
  }) => api.post<PurchaseOrder>("/purchase_orders/from-low-stock", body),
};