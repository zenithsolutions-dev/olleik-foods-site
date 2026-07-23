"use client";

import { useMemo, useState } from "react";
import { Plus, CornerDownRight } from "lucide-react";
import type { Category } from "@/lib/admin/types";
import { createCategory, updateCategory, deleteCategory } from "./actions";

export function CategoriesClient({
  categories,
  counts,
  live,
}: {
  categories: Category[];
  counts: Record<string, number>;
  live: boolean;
}) {
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newParent, setNewParent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editParent, setEditParent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tree ordering: each top-level category followed by its children (indented).
  const ordered = useMemo(() => {
    const parents = categories.filter((c) => !c.parentId);
    const childrenOf = (id: string) => categories.filter((c) => c.parentId === id);
    const rows: { cat: Category; depth: 0 | 1 }[] = [];
    for (const p of parents) {
      rows.push({ cat: p, depth: 0 });
      for (const child of childrenOf(p.id)) rows.push({ cat: child, depth: 1 });
    }
    // Orphans (parent missing) fall back to top level.
    for (const c of categories) {
      if (c.parentId && !categories.some((x) => x.id === c.parentId)) {
        rows.push({ cat: c, depth: 0 });
      }
    }
    return rows;
  }, [categories]);

  // Valid parents: top-level categories only (one level of nesting), and a
  // category that has children can't be moved under another.
  const hasChildren = (id: string) => categories.some((c) => c.parentId === id);
  const parentOptions = (selfId: string | null) =>
    categories.filter((c) => !c.parentId && c.id !== selfId);

  function startEdit(c: Category) {
    setError(null);
    setEditingId(c.id);
    setEditName(c.name);
    setEditDesc(c.description ?? "");
    setEditParent(c.parentId ?? "");
  }

  async function run(action: () => Promise<{ ok: true } | { ok: false; message: string }>) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    return true;
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const ok = await run(() =>
      createCategory({
        name,
        description: newDesc.trim() || undefined,
        parentId: newParent || null,
      }),
    );
    if (ok) {
      setNewName("");
      setNewDesc("");
      setNewParent("");
    }
  }

  async function handleSaveEdit(c: Category) {
    const ok = await run(() =>
      updateCategory(c.id, {
        name: editName.trim() || c.name,
        description: editDesc.trim() || undefined,
        parentId: editParent || null,
      }),
    );
    if (ok) setEditingId(null);
  }

  async function handleDelete(c: Category) {
    // Client-side guards mirror the server guards for a faster message.
    if ((counts[c.id] ?? 0) > 0) {
      setError(
        `Can't delete "${c.name}" — ${counts[c.id]} product${counts[c.id] === 1 ? "" : "s"} still use it. Reassign them first.`,
      );
      return;
    }
    if (hasChildren(c.id)) {
      setError(`Can't delete "${c.name}" — it still has subcategories. Move or delete them first.`);
      return;
    }
    if (!window.confirm(`Delete "${c.name}"?`)) return;
    await run(() => deleteCategory(c.id));
  }

  return (
    <div className="space-y-4">
      {!live && (
        <p className="rounded-lg bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          Showing demo seed data — Supabase isn&apos;t configured, so changes
          won&apos;t persist.
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>
      )}

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
              {categories.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted">
                    No categories yet.
                  </td>
                </tr>
              )}
              {ordered.map(({ cat: c, depth }) => (
                <tr key={c.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3">
                    {editingId === c.id ? (
                      <div className="space-y-1.5">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded-md border border-[var(--border)] bg-background px-2 py-1 text-sm"
                        />
                        {/* Parent select: hidden while this category has children
                            (it must stay top-level; the server enforces too). */}
                        {!hasChildren(c.id) && (
                          <select
                            value={editParent}
                            onChange={(e) => setEditParent(e.target.value)}
                            className="w-full rounded-md border border-[var(--border)] bg-background px-2 py-1 text-xs"
                          >
                            <option value="">Top-level category</option>
                            {parentOptions(c.id).map((p) => (
                              <option key={p.id} value={p.id}>
                                Under: {p.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ) : (
                      <span className={`font-medium ${depth === 1 ? "inline-flex items-center gap-1.5 pl-4 text-foreground/85" : ""}`}>
                        {depth === 1 && <CornerDownRight size={12} className="text-muted-soft" />}
                        {c.name}
                      </span>
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
                          disabled={busy}
                          onClick={() => handleSaveEdit(c)}
                          className="font-medium text-brand hover:text-accent disabled:opacity-50"
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
                          disabled={busy}
                          onClick={() => handleDelete(c)}
                          className="text-red-700 hover:text-red-900 disabled:opacity-50"
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
          <form onSubmit={handleAdd} className="mt-4 space-y-3">
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
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted">Parent category (optional)</label>
              <select
                value={newParent}
                onChange={(e) => setNewParent(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm"
              >
                <option value="">Top-level category</option>
                {parentOptions(null).map((p) => (
                  <option key={p.id} value={p.id}>
                    Under: {p.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-muted-soft">
                One level only — e.g. Dairy &gt; Cheese. Margin rules on a parent apply to its
                subcategories unless the subcategory has its own rule.
              </p>
            </div>
            <button
              type="submit"
              disabled={!newName.trim() || busy}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
            >
              <Plus size={14} /> Add category
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
