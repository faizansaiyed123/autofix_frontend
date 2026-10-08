"use client";

/**
 * Reference data, loaded once and shared.
 *
 * Nearly every screen in the shop shows a customer, a vehicle or a member of
 * staff, and the API returns ids for all three. Rendering an id where a name
 * belongs is the single most common way a workshop screen becomes unusable, so
 * the lookups are resolved once at the shell and handed down.
 *
 * Each source is optional. A parts clerk may not hold `customers:read`, and a
 * 403 here must leave that one map empty rather than take the whole shell down —
 * the screen still works, it just cannot name what it is not allowed to look up.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";

import { customersApi, vehiclesApi } from "@/lib/api/shop";
import { usersApi } from "@/lib/api/insight";
import type { Customer, Paginated, ShopUser, Vehicle } from "@/lib/api/types";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { vehicleLabel } from "@/lib/format";

interface References {
  customerName: (id: string | null | undefined) => string;
  customerLabel: (id: string | null | undefined) => string;
  vehicleText: (id: string | null | undefined) => string;
  vehicleLabel: (id: string | null | undefined) => string;
  userName: (id: string | null | undefined) => string;
  customers: Customer[];
  vehicles: Vehicle[];
  staff: ShopUser[];
  /** Vehicles belonging to one customer, for pickers. */
  vehiclesFor: (customerId: string) => Vehicle[];
}

const EMPTY: References = {
  customerName: () => "—",
  customerLabel: () => "—",
  vehicleText: () => "—",
  vehicleLabel: () => "—",
  userName: () => "—",
  customers: [],
  vehicles: [],
  staff: [],
  vehiclesFor: () => [],
};

const ReferenceContext = createContext<References>(EMPTY);

/** The most rows the API will return in one page. */
const MAX_PAGE_SIZE = 100;

/**
 * A reference list, in full.
 *
 * The API refuses a page larger than 100 rows, so a shop with more
 * than that is walked page by page: the first answer carries the page
 * count, and the remaining pages are fetched alongside it. Stopping at
 * the first hundred would leave every row past it named as "—", which
 * reads as "we do not know this customer" at the counter.
 */
async function loadAll<T>(
  list: (query: { page: number; size: number }) => Promise<Paginated<T>>,
): Promise<T[]> {
  const first = await list({ page: 1, size: MAX_PAGE_SIZE });
  const pages = Math.max(1, first.meta?.pages ?? 1);
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, index) =>
      list({ page: index + 2, size: MAX_PAGE_SIZE }),
    ),
  );
  return [first.data, ...rest.map((page) => page.data)].flat();
}

export function ReferenceProvider({ children }: { children: ReactNode }) {
  const { can } = useSession();

  const customers = useApiQuery<Customer[]>(
    () => loadAll((query) => customersApi.list(query)),
    [],
    { enabled: can("customers:read") },
  );

  const vehicles = useApiQuery<Vehicle[]>(
    () => loadAll((query) => vehiclesApi.list(query)),
    [],
    { enabled: can("vehicles:read") },
  );

  const staff = useApiQuery<ShopUser[]>(
    () => loadAll((query) => usersApi.list(query)),
    [],
    { enabled: can("users:read") },
  );

  const value = useMemo<References>(() => {
    const customerById = new Map((customers.data ?? []).map((c) => [c.id, c]));
    const vehicleById = new Map((vehicles.data ?? []).map((v) => [v.id, v]));
    const userById = new Map((staff.data ?? []).map((u) => [u.id, u]));

    return {
      customers: customers.data ?? [],
      vehicles: vehicles.data ?? [],
      staff: staff.data ?? [],
      customerName: (id) => {
        const customer = id ? customerById.get(id) : undefined;
        return customer ? `${customer.first_name} ${customer.last_name}` : "—";
      },
      customerLabel: (id) => {
        const customer = id ? customerById.get(id) : undefined;
        if (!customer) return "—";
        const name = `${customer.first_name} ${customer.last_name}`;
        return customer.company_name ? `${name} · ${customer.company_name}` : name;
      },
      vehicleText: (id) => {
        const vehicle = id ? vehicleById.get(id) : undefined;
        return vehicle ? vehicleLabel(vehicle) : "—";
      },
      vehicleLabel: (id) => {
        const vehicle = id ? vehicleById.get(id) : undefined;
        return vehicle ? vehicleLabel(vehicle) : "—";
      },
      userName: (id) => {
        const person = id ? userById.get(id) : undefined;
        return person ? `${person.first_name} ${person.last_name}` : "—";
      },
      vehiclesFor: (customerId) => (vehicles.data ?? []).filter((v) => v.customer_id === customerId),
    };
  }, [customers.data, vehicles.data, staff.data]);

  return <ReferenceContext.Provider value={value}>{children}</ReferenceContext.Provider>;
}

export function useReferences(): References {
  return useContext(ReferenceContext);
}