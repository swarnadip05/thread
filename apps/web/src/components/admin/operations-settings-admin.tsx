"use client";

import type { OperationsSettingsDto } from "@thread/types";
import { Button, ErrorState, Input, Skeleton } from "@thread/ui";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { apiRequest } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";

export function OperationsSettingsAdmin() {
  const auth = useAuth();
  const [settings, setSettings] = useState<OperationsSettingsDto | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const load = useCallback(async () => {
    if (!auth.accessToken) return;
    try {
      setSettings(
        await apiRequest<OperationsSettingsDto>("/admin/operations/settings", auth.accessToken),
      );
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Settings could not be loaded.");
    }
  }, [auth.accessToken]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!auth.accessToken || !settings) return;
    const data = new FormData(event.currentTarget);
    setSaved(false);
    try {
      setSettings(
        await apiRequest<OperationsSettingsDto>("/admin/operations/settings", auth.accessToken, {
          method: "PATCH",
          body: JSON.stringify({
            business: {
              brandName: data.get("brandName"),
              legalName: data.get("legalName"),
              addressLine1: data.get("addressLine1"),
              locality: data.get("locality"),
              district: data.get("district"),
              city: data.get("city"),
              postalCode: data.get("postalCode"),
              state: data.get("state"),
              country: data.get("country"),
              phone: data.get("phone"),
              whatsappNumber: data.get("whatsappNumber"),
              email: data.get("email"),
              gstin: data.get("gstin"),
              foundedYear: Number(data.get("foundedYear")),
            },
            returnWindowDays: Number(data.get("returnWindowDays")),
            requireInspectionBeforeRestock: data.get("requireInspectionBeforeRestock") === "on",
            onlinePaymentsEnabled: data.get("onlinePaymentsEnabled") === "on",
            maintenanceMode: data.get("maintenanceMode") === "on",
            seo: {
              defaultTitle: data.get("defaultTitle"),
              defaultDescription: data.get("defaultDescription"),
            },
          }),
        }),
      );
      setSaved(true);
      setError("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Settings could not be saved.");
    }
  };
  if (!settings && !error) return <Skeleton className="h-[520px] w-full" />;
  if (!settings)
    return <ErrorState className="text-ink" description={error} title="Settings unavailable" />;
  const business = settings.business;
  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-paper/60">Configuration</p>
      <h1 className="mt-2 text-3xl font-semibold">Business settings</h1>
      <p className="mt-2 text-sm text-paper/65">
        Public business content is separate from secret provider credentials, which remain
        environment-only.
      </p>
      <form className="mt-7 space-y-6" onSubmit={save}>
        <fieldset className="grid gap-4 rounded-lg bg-paper p-6 text-ink md:grid-cols-2">
          <legend className="px-2 text-lg font-semibold">THREAD / SNAP CART details</legend>
          {[
            ["brandName", "Brand name", business.brandName],
            ["legalName", "Legal name", business.legalName],
            ["addressLine1", "Address line", business.addressLine1],
            ["locality", "Locality", business.locality],
            ["district", "District", business.district],
            ["city", "City", business.city],
            ["postalCode", "Postal code", business.postalCode],
            ["state", "State", business.state],
            ["country", "Country", business.country],
            ["phone", "Phone", business.phone],
            ["whatsappNumber", "WhatsApp number", business.whatsappNumber],
            ["email", "Email", business.email],
            ["gstin", "GSTIN", business.gstin],
            ["foundedYear", "Founded year", String(business.foundedYear)],
          ].map(([name, label, value]) => (
            <label className="grid gap-1 text-sm" key={name}>
              {label}
              <Input defaultValue={value} name={name} required />
            </label>
          ))}
        </fieldset>
        <fieldset className="grid gap-4 rounded-lg bg-paper p-6 text-ink md:grid-cols-2">
          <legend className="px-2 text-lg font-semibold">Operational policy</legend>
          <label className="grid gap-1 text-sm">
            Return window in days
            <Input
              defaultValue={settings.returnWindowDays}
              max="90"
              min="1"
              name="returnWindowDays"
              required
              type="number"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Default SEO title
            <Input defaultValue={settings.seo.defaultTitle} name="defaultTitle" required />
          </label>
          <label className="grid gap-1 text-sm md:col-span-2">
            Default SEO description
            <Input
              defaultValue={settings.seo.defaultDescription}
              name="defaultDescription"
              required
            />
          </label>
          {[
            [
              "requireInspectionBeforeRestock",
              "Require inspection before restocking",
              settings.requireInspectionBeforeRestock,
            ],
            ["onlinePaymentsEnabled", "Online payments enabled", settings.onlinePaymentsEnabled],
            ["maintenanceMode", "Maintenance mode", settings.maintenanceMode],
          ].map(([name, label, checked]) => (
            <label className="flex min-h-11 items-center gap-3 text-sm" key={String(name)}>
              <input
                className="size-5 accent-gold"
                defaultChecked={Boolean(checked)}
                name={String(name)}
                type="checkbox"
              />
              {label}
            </label>
          ))}
        </fieldset>
        <section className="rounded-lg bg-paper p-6 text-ink">
          <h2 className="text-lg font-semibold">Policy pages</h2>
          <p className="mt-1 text-sm text-muted">
            Content remains editable in the content records; client-review flags are preserved.
          </p>
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {settings.policyPages.map((page) => (
              <li className="rounded-md border border-ink/10 p-3 text-sm" key={page.slug}>
                <span className="font-semibold">{page.title}</span>
                <span className="ml-2 text-muted">/{page.slug}</span>
              </li>
            ))}
          </ul>
        </section>
        <Button type="submit">Save operational settings</Button>
        {saved ? (
          <span className="ml-4 text-sm font-semibold text-success" role="status">
            Settings saved.
          </span>
        ) : null}
        {error ? (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
