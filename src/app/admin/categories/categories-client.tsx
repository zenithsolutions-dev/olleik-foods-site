"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useAdmin } from "@/lib/admin/store";
import type { Category } from "@/lib/admin/types";

export function CategoriesClient() {
  const { state, dispatch, hydrated } = useAdmin();
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of state.products) map[p.categoryId] = (map[p.categoryId] ?? 0) + 1;
    return map;
  }, [state.products]);

  if (!hydrated) return <p className="text-sm text-muted">Loading…</p>;

  function startEdit(c: Category) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditDesc(c.description ?? "");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* List */}
      <div className="rounded-2xl border border-[var(--border)] bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-brand-mist/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Products</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {state.categories.map((c) => (
              <tr key={c.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3">
                  {editingId === c.id ? (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-md border border-[var(--border)] bg-background px-2 py-1 text-sm"
                    />
                  ) : (
                    <span className="font-medium">{c.name}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">
                  {editingId === c.id ? (
                    <input
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-md border border-[var(--border)] bg-background px-2 py-1 text-sm"
                    />
                  ) : (
                    c.description ?? "—"
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-muted">
                  {counts[c.id] ?? 0}
                </td>
                <td className="px-4 py-3 text-right">
                  {editingId === c.id ? (
                    <div className="flex justify-end gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          dispatch({
                            type: "category/update",
                            id: c.id,
                            patch: {
                              name: editName.trim() || c.name,
                              description: editDesc.trim() || undefined,
                            },
                          });
                          setEditingId(null);
                        }}
                        className="font-medium text-brand hover:text-accent"
                      >
                        Save
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="text-muted">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-3 text-xs">
                      <button type="button" onClick={() => startEdit(c)} className="font-medium text-brand hover:text-accent">
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if ((counts[c.id] ?? 0) > 0) {
                            window.alert(
                              `Can't delete — ${counts[c.id]} products still use this category. Move them first.`
                            );
                            return;
                          }
                          if (window.confirm(`Delete "${c.name}"?`)) {
                            dispatch({ type: "category/delete", id: c.id });
                          }
                        }}
                        className="text-red-700 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add form */}
      <aside className="rounded-2xl border border-[var(--border)] bg-surface p-5">
        <h3 className="font-display text-lg font-semibold text-brand-deep">
          Add a category
        </h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const name = newName.trim();
            if (!name) return;
            dispatch({
              type: "category/add",
              input: { name, description: newDesc.trim() || undefined },
            });
            setNewName("");
            setNewDesc("");
          }}
          className="mt-4 space-y-3"
        >
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted">Name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Bread & Bakery"
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted">Description (optional)</label>
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Buns, baguettes, focaccia…"
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={!newName.trim()}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
          >
            <Plus size={14} /> Add category
          </button>
        </form>
      </aside>
    </div>
  );
}
