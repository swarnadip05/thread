"use client";

import { Button, Skeleton } from "@thread/ui";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";
import { slugify } from "./product-editor-helpers";

interface Taxonomy {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  audience?: string;
  sortOrder?: number;
  parentId?: string | null;
}
const fieldClass = "min-h-11 rounded-md border border-ink/20 bg-paper px-3 text-sm";
export function TaxonomyAdmin({ kind }: { kind: "categories" | "collections" }) {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<Taxonomy[]>([]);
  const [editing, setEditing] = useState<Taxonomy | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const label = kind === "categories" ? "Category" : "Collection";
  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      setItems(await apiRequest<Taxonomy[]>(`/admin/${kind}`, accessToken));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load records.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, kind]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  function edit(item: Taxonomy | null) {
    setEditing(item);
    setName(item?.name ?? "");
    setSlug(item?.slug ?? "");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/admin/${kind}${editing ? `/${editing.id}` : ""}`, accessToken, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({
          name,
          slug,
          active: data.has("active"),
          ...(kind === "categories"
            ? {
                audience: data.get("audience"),
                sortOrder: Number(data.get("sortOrder")),
                parentId: data.get("parentId") || null,
              }
            : {}),
        }),
      });
      edit(null);
      await load();
      setNotice(`${label} saved. Assign it to products in the product editor.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(item: Taxonomy) {
    if (
      !accessToken ||
      !window.confirm(`Delete “${item.name}”? Assigned records must be deactivated instead.`)
    )
      return;
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/admin/${kind}/${item.id}`, accessToken, { method: "DELETE" });
      if (editing?.id === item.id) edit(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <h1 className="text-3xl font-semibold">
        {kind === "categories" ? "Categories" : "Collections"}
      </h1>
      {error ? (
        <p className="mt-5 rounded-md bg-paper p-4 text-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-5 text-sm" role="status">
          {notice}
        </p>
      ) : null}
      <form
        key={editing?.id ?? `new-${items.length}`}
        className="mt-6 rounded-lg bg-paper p-6 text-ink"
        onSubmit={submit}
      >
        <h2 className="mb-5 text-xl font-semibold">
          {editing ? "Edit" : "Add"} {label.toLowerCase()}
        </h2>
        <fieldset className="grid gap-4 sm:grid-cols-2" disabled={busy}>
          <label className="grid gap-1 text-sm">
            Name
            <input
              className={fieldClass}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!editing && (!slug || slug === slugify(name)))
                  setSlug(slugify(event.target.value));
              }}
              maxLength={100}
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            Slug
            <input
              className={fieldClass}
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              maxLength={160}
              required
            />
          </label>
          {kind === "categories" ? (
            <>
              <label className="grid gap-1 text-sm">
                Audience
                <select
                  className={fieldClass}
                  name="audience"
                  defaultValue={editing?.audience ?? "unisex"}
                >
                  {["men", "women", "unisex", "accessories"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Sort order
                <input
                  className={fieldClass}
                  type="number"
                  min={0}
                  max={10000}
                  name="sortOrder"
                  defaultValue={editing?.sortOrder ?? 0}
                  required
                />
              </label>
              <label className="grid gap-1 text-sm">
                Parent category
                <select
                  className={fieldClass}
                  name="parentId"
                  defaultValue={editing?.parentId ?? ""}
                >
                  <option value="">No parent</option>
                  {items
                    .filter((item) => item.id !== editing?.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
            </>
          ) : null}
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" name="active" defaultChecked={editing?.active ?? true} />
            Active
          </label>
          <div className="flex gap-3 sm:col-span-2">
            <Button type="submit">{busy ? "Saving…" : `Save ${label.toLowerCase()}`}</Button>
            {editing ? (
              <Button type="button" variant="outline" onClick={() => edit(null)}>
                Cancel
              </Button>
            ) : null}
          </div>
        </fieldset>
      </form>
      <section className="mt-6 divide-y divide-ink/10 rounded-lg bg-paper p-6 text-ink">
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : items.length ? (
          items.map((item) => (
            <article
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-4 py-4"
            >
              <div>
                <h2 className="font-semibold">{item.name}</h2>
                <p className="mt-1 text-sm text-muted">
                  {item.slug} · {item.active ? "Active" : "Inactive"}
                </p>
              </div>
              <div className="flex gap-4 text-sm">
                <Link
                  className="min-h-11 content-center underline"
                  href={`/${kind === "categories" ? "category" : "collection"}/${item.slug}`}
                >
                  View
                </Link>
                <button
                  className="min-h-11 underline"
                  type="button"
                  disabled={busy}
                  onClick={() => edit(item)}
                >
                  Edit
                </button>
                <button
                  className="min-h-11 text-error underline"
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(item)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        ) : (
          <p>No {kind} yet.</p>
        )}
      </section>
    </div>
  );
}
