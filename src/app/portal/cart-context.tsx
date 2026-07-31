"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// CP-3a cart: client-side, localStorage-persisted (approved D-O7). Stores ONLY
// {productId, qty} + an idempotency token — never prices; the server re-derives
// every price at preview and submission. The token is minted per cart and
// reused across submit retries (double-click / network retry → the same order),
// then rotated after a successful submission.

export type CartLine = { productId: string; qty: number };

type CartState = { token: string; lines: CartLine[] };

const STORAGE_KEY = "olleik-cart-v1";
const MAX_QTY = 999;
const MAX_LINES = 100;

function freshState(): CartState {
  return { token: crypto.randomUUID(), lines: [] };
}

function loadState(): CartState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as CartState;
    if (
      typeof parsed?.token !== "string" ||
      !Array.isArray(parsed?.lines) ||
      parsed.lines.some(
        (l) => typeof l?.productId !== "string" || !Number.isInteger(l?.qty) || l.qty < 1,
      )
    ) {
      return freshState();
    }
    return parsed;
  } catch {
    return freshState();
  }
}

type CartContextValue = {
  lines: CartLine[];
  token: string;
  count: number; // total units across lines (badge)
  qtyOf: (productId: string) => number;
  add: (productId: string, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clearAfterSubmit: () => void; // empty + rotate the idempotency token
  ready: boolean; // false during SSR/first paint (before localStorage loads)
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CartState>(() => ({ token: "", lines: [] }));
  const [ready, setReady] = useState(false);

  // Hydrate from localStorage after mount — in a microtask callback, never
  // synchronously in the effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => {
      if (!alive) return;
      setState(loadState());
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full/blocked — cart still works for this page's lifetime
    }
  }, [state, ready]);

  const add = useCallback((productId: string, qty = 1) => {
    setState((s) => {
      const existing = s.lines.find((l) => l.productId === productId);
      if (existing) {
        return {
          ...s,
          lines: s.lines.map((l) =>
            l.productId === productId
              ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) }
              : l,
          ),
        };
      }
      if (s.lines.length >= MAX_LINES) return s; // cap; UI shows the limit
      return { ...s, lines: [...s.lines, { productId, qty: Math.min(MAX_QTY, qty) }] };
    });
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setState((s) =>
      qty < 1
        ? { ...s, lines: s.lines.filter((l) => l.productId !== productId) }
        : {
            ...s,
            lines: s.lines.map((l) =>
              l.productId === productId ? { ...l, qty: Math.min(MAX_QTY, Math.floor(qty)) } : l,
            ),
          },
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setState((s) => ({ ...s, lines: s.lines.filter((l) => l.productId !== productId) }));
  }, []);

  const clearAfterSubmit = useCallback(() => {
    setState(freshState());
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines: state.lines,
      token: state.token,
      count: state.lines.reduce((n, l) => n + l.qty, 0),
      qtyOf: (id) => state.lines.find((l) => l.productId === id)?.qty ?? 0,
      add,
      setQty,
      remove,
      clearAfterSubmit,
      ready,
    }),
    [state, add, setQty, remove, clearAfterSubmit, ready],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
