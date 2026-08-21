"use client";

import type { CheckoutAddressDto } from "@thread/types";
import { Button, Input } from "@thread/ui";
import { useState, type FormEvent } from "react";

import { apiRequest } from "@/auth/auth-client";

export function CheckoutAddressForm({
  accessToken,
  onCreated,
}: {
  accessToken: string;
  onCreated(address: CheckoutAddressDto): void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const address = await apiRequest<CheckoutAddressDto>("/checkout/addresses", accessToken, {
        method: "POST",
        body: JSON.stringify({
          fullName: data.get("fullName"),
          phone: data.get("phone"),
          addressLine1: data.get("addressLine1"),
          addressLine2: data.get("addressLine2") || undefined,
          landmark: data.get("landmark") || undefined,
          city: data.get("city"),
          district: data.get("district"),
          state: data.get("state"),
          postalCode: data.get("postalCode"),
          country: "India",
          type: data.get("type"),
          isDefault: data.get("isDefault") === "on",
        }),
      });
      event.currentTarget.reset();
      onCreated(address);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Address could not be saved.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
      <label className="grid gap-1 text-sm font-medium">
        Full name
        <Input autoComplete="name" name="fullName" required />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Phone
        <Input autoComplete="tel" name="phone" placeholder="+91…" required />
      </label>
      <label className="grid gap-1 text-sm font-medium sm:col-span-2">
        Address line 1
        <Input autoComplete="address-line1" name="addressLine1" required />
      </label>
      <label className="grid gap-1 text-sm font-medium sm:col-span-2">
        Address line 2 <span className="font-normal text-muted">(optional)</span>
        <Input autoComplete="address-line2" name="addressLine2" />
      </label>
      <label className="grid gap-1 text-sm font-medium sm:col-span-2">
        Landmark <span className="font-normal text-muted">(optional)</span>
        <Input name="landmark" />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        City
        <Input autoComplete="address-level2" name="city" required />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        District
        <Input name="district" required />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        State
        <Input autoComplete="address-level1" name="state" required />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Postal code
        <Input autoComplete="postal-code" inputMode="numeric" name="postalCode" required />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Address type
        <select className="min-h-11 rounded-md border border-ink/20 bg-paper px-3" name="type">
          <option value="home">Home</option>
          <option value="work">Work</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input className="size-5 accent-gold" name="isDefault" type="checkbox" />
        Make this my default address
      </label>
      {error ? (
        <p className="text-sm text-error sm:col-span-2" role="alert">
          {error}
        </p>
      ) : null}
      <Button className="sm:col-span-2" disabled={busy} type="submit">
        {busy ? "Saving address…" : "Save address"}
      </Button>
    </form>
  );
}
