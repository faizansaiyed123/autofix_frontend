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
  StockLevel,
  StockSummary,
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

