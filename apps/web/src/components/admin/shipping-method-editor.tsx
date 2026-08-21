"use client";

import type { ShippingMethodDto } from "@thread/types";
import { Button, Input, Price } from "@thread/ui";
import { useState, type FormEvent } from "react";

import { apiRequest } from "@/auth/auth-client";

export function ShippingMethodEditor({
  accessToken,
  method,
  onUpdated,
}: {
  accessToken: string;
  method: ShippingMethodDto;
  onUpdated(method: ShippingMethodDto): void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const threshold = String(data.get("freeShippingThresholdPaise") ?? "").trim();
    try {
      const updated = await apiRequest<ShippingMethodDto>(
        `/checkout/admin/shipping-methods/${method.id}`,
        accessToken,
        {
          method: "PATCH",
          body: JSON.stringify({
            ratePaise: Number(data.get("ratePaise")),
            freeShippingThresholdPaise: threshold ? Number(threshold) : null,
            codEligible: data.get("codEligible") === "on",
            active: data.get("active") === "on",
          }),
        },
      );
      onUpdated(updated);
      setEditing(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Rate could not be updated.");
    } finally {
      setBusy(false);
    }
  };
  if (!editing)
    return (
      <div className="flex items-center justify-between gap-4 py-4">
        <div>
          <p className="font-semibold">{method.name}</p>
          <p className="mt-1 text-xs text-muted">
            {method.active ? "Active" : "Inactive"} · COD{" "}
            {method.codEligible ? "eligible" : "disabled"}
            {method.freeShippingThresholdPaise !== undefined
              ? ` · Free above ₹${(method.freeShippingThresholdPaise / 100).toLocaleString("en-IN")}`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Price amount={method.ratePaise} />
          <Button onClick={() => setEditing(true)} size="sm" variant="outline">
            Edit
          </Button>
        </div>
      </div>
    );
  return (
    <form className="grid gap-3 py-4 sm:grid-cols-2" onSubmit={submit}>
      <label className="grid gap-1 text-sm">
        Rate in paise
        <Input defaultValue={method.ratePaise} min="0" name="ratePaise" required type="number" />
      </label>
      <label className="grid gap-1 text-sm">
        Free threshold in paise
        <Input
          defaultValue={method.freeShippingThresholdPaise ?? ""}
          min="0"
          name="freeShippingThresholdPaise"
          type="number"
        />
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input
          className="size-5 accent-gold"
          defaultChecked={method.active}
          name="active"
          type="checkbox"
        />
        Active
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input
          className="size-5 accent-gold"
          defaultChecked={method.codEligible}
          name="codEligible"
          type="checkbox"
        />
        COD eligible
      </label>
      {error ? (
        <p className="text-sm text-error sm:col-span-2" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2 sm:col-span-2">
        <Button disabled={busy} size="sm" type="submit">
          {busy ? "Saving…" : "Save rate"}
        </Button>
        <Button onClick={() => setEditing(false)} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
      </div>
    </form>
  );
}
