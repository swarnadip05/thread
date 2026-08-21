"use client";

import type { ShippingMethodDto } from "@thread/types";
import { Button, Input } from "@thread/ui";
import { useState, type FormEvent } from "react";

import { apiRequest } from "@/auth/auth-client";

export function ShippingMethodForm({
  accessToken,
  onCreated,
}: {
  accessToken: string;
  onCreated(method: ShippingMethodDto): void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const nullableNumber = (name: string) => {
      const value = String(data.get(name) ?? "").trim();
      return value ? Number(value) : null;
    };
    try {
      const method = await apiRequest<ShippingMethodDto>(
        "/checkout/admin/shipping-methods",
        accessToken,
        {
          method: "POST",
          body: JSON.stringify({
            name: data.get("name"),
            description: data.get("description"),
            ratePaise: Number(data.get("ratePaise")),
            freeShippingThresholdPaise: nullableNumber("freeShippingThresholdPaise"),
            estimatedBusinessDaysMin: nullableNumber("estimatedBusinessDaysMin"),
            estimatedBusinessDaysMax: nullableNumber("estimatedBusinessDaysMax"),
            countries: String(data.get("countries"))
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
            postalPrefixes: String(data.get("postalPrefixes"))
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
            codEligible: data.get("codEligible") === "on",
            active: true,
            sortOrder: Number(data.get("sortOrder")),
          }),
        },
      );
      event.currentTarget.reset();
      onCreated(method);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Shipping method could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
      <label className="grid gap-1 text-sm">
        Name
        <Input name="name" required />
      </label>
      <label className="grid gap-1 text-sm">
        Sort order
        <Input defaultValue="0" min="0" name="sortOrder" required type="number" />
      </label>
      <label className="grid gap-1 text-sm sm:col-span-2">
        Description
        <Input name="description" required />
      </label>
      <label className="grid gap-1 text-sm">
        Rate in paise
        <Input min="0" name="ratePaise" required type="number" />
      </label>
      <label className="grid gap-1 text-sm">
        Free-shipping threshold in paise
        <Input min="0" name="freeShippingThresholdPaise" type="number" />
      </label>
      <label className="grid gap-1 text-sm">
        Minimum business days
        <Input min="1" name="estimatedBusinessDaysMin" type="number" />
      </label>
      <label className="grid gap-1 text-sm">
        Maximum business days
        <Input min="1" name="estimatedBusinessDaysMax" type="number" />
      </label>
      <label className="grid gap-1 text-sm">
        Countries, comma-separated
        <Input defaultValue="India" name="countries" required />
      </label>
      <label className="grid gap-1 text-sm">
        Postal prefixes, comma-separated
        <Input name="postalPrefixes" />
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input className="size-5 accent-gold" name="codEligible" type="checkbox" />
        Eligible for configured COD rules
      </label>
      {error ? (
        <p className="text-sm text-error sm:col-span-2" role="alert">
          {error}
        </p>
      ) : null}
      <Button className="sm:col-span-2" disabled={busy} type="submit">
        {busy ? "Saving…" : "Add shipping method"}
      </Button>
    </form>
  );
}
