"use client";

// Admin demo store. React Context + useReducer + localStorage. Mirrors
// the shape of a real DB so swapping to Supabase later is mechanical —
// each action becomes a row insert/update/delete instead of a state patch.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import type {
  AdminState,
  Category,
  Customer,
  CustomerProduct,
  ID,
  Lead,
  Product,
} from "./types";
import { SEED_DATA } from "./mock-data";

const STORAGE_KEY = "olleik_admin_v1";

function makeId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}

type Action =
  // Categories
  | { type: "category/add"; input: Omit<Category, "id"> }
  | { type: "category/update"; id: ID; patch: Partial<Omit<Category, "id">> }
  | { type: "category/delete"; id: ID }
  // Products
  | { type: "product/add"; input: Omit<Product, "id" | "createdAt"> }
  | { type: "product/update"; id: ID; patch: Partial<Omit<Product, "id" | "createdAt">> }
  | { type: "product/delete"; id: ID }
  // Customers
  | { type: "customer/add"; input: Omit<Customer, "id" | "createdAt"> }
  | { type: "customer/update"; id: ID; patch: Partial<Omit<Customer, "id" | "createdAt">> }
  | { type: "customer/delete"; id: ID }
  // Customer pricing
  | { type: "customerProduct/upsert"; row: CustomerProduct }
  | { type: "customerProduct/remove"; customerId: ID; productId: ID }
  // Leads
  | { type: "lead/updateStatus"; id: ID; status: Lead["status"] }
  | { type: "lead/delete"; id: ID }
  // Meta
  | { type: "reset" }
  | { type: "hydrate"; state: AdminState };

function reducer(state: AdminState, action: Action): AdminState {
  switch (action.type) {
    case "hydrate":
      return action.state;
    case "reset":
      return SEED_DATA;

    case "category/add":
      return {
        ...state,
        categories: [...state.categories, { ...action.input, id: makeId("cat") }],
      };
    case "category/update":
      return {
        ...state,
        categories: state.categories.map((c) =>
          c.id === action.id ? { ...c, ...action.patch } : c
        ),
      };
    case "category/delete":
      return {
        ...state,
        categories: state.categories.filter((c) => c.id !== action.id),
        // Don't orphan products — keep them but they'll show "unknown" category.
      };

    case "product/add":
      return {
        ...state,
        products: [
          ...state.products,
          {
            ...action.input,
            id: makeId("p"),
            createdAt: new Date().toISOString(),
          },
        ],
      };
    case "product/update":
      return {
        ...state,
        products: state.products.map((p) =>
          p.id === action.id ? { ...p, ...action.patch } : p
        ),
      };
    case "product/delete":
      return {
        ...state,
        products: state.products.filter((p) => p.id !== action.id),
        customerProducts: state.customerProducts.filter(
          (cp) => cp.productId !== action.id
        ),
      };

    case "customer/add":
      return {
        ...state,
        customers: [
          ...state.customers,
          {
            ...action.input,
            id: makeId("c"),
            createdAt: new Date().toISOString(),
          },
        ],
      };
    case "customer/update":
      return {
        ...state,
        customers: state.customers.map((c) =>
          c.id === action.id ? { ...c, ...action.patch } : c
        ),
      };
    case "customer/delete":
      return {
        ...state,
        customers: state.customers.filter((c) => c.id !== action.id),
        customerProducts: state.customerProducts.filter(
          (cp) => cp.customerId !== action.id
        ),
      };

    case "customerProduct/upsert": {
      const existing = state.customerProducts.findIndex(
        (cp) =>
          cp.customerId === action.row.customerId &&
          cp.productId === action.row.productId
      );
      if (existing >= 0) {
        const next = [...state.customerProducts];
        next[existing] = action.row;
        return { ...state, customerProducts: next };
      }
      return {
        ...state,
        customerProducts: [...state.customerProducts, action.row],
      };
    }
    case "customerProduct/remove":
      return {
        ...state,
        customerProducts: state.customerProducts.filter(
          (cp) =>
            !(
              cp.customerId === action.customerId &&
              cp.productId === action.productId
            )
        ),
      };

    case "lead/updateStatus":
      return {
        ...state,
        leads: state.leads.map((l) =>
          l.id === action.id ? { ...l, status: action.status } : l
        ),
      };
    case "lead/delete":
      return {
        ...state,
        leads: state.leads.filter((l) => l.id !== action.id),
      };

    default:
      return state;
  }
}

type AdminContextValue = {
  state: AdminState;
  dispatch: React.Dispatch<Action>;
  hydrated: boolean;
  reset: () => void;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, SEED_DATA);
  const [hydrated, setHydrated] = useReducer((_: boolean, next: boolean) => next, false);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AdminState;
        if (parsed && Array.isArray(parsed.products)) {
          dispatch({ type: "hydrate", state: parsed });
        }
      }
    } catch {
      // Corrupt storage — fall back to seed.
    }
    setHydrated(true);
  }, []);

  // Persist on every change once hydrated.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Quota or disabled — ignore.
    }
  }, [state, hydrated]);

  const reset = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    dispatch({ type: "reset" });
  }, []);

  const value = useMemo<AdminContextValue>(
    () => ({ state, dispatch, hydrated, reset }),
    [state, hydrated, reset]
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside <AdminProvider>");
  return ctx;
}

// === Helpers ===

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
