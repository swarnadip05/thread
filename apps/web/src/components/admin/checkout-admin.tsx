"use client";

import type { CheckoutAdminDto, CheckoutSettingsDto, ShippingMethodDto } from "@thread/types";
import { Button, ErrorState, Skeleton } from "@thread/ui";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { apiRequest } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";

import { ShippingMethodForm } from "./shipping-method-form";
import { ShippingMethodEditor } from "./shipping-method-editor";

export function CheckoutAdmin() {
  const auth = useAuth();
  const [configuration, setConfiguration] = useState<CheckoutAdminDto | null>(null);
  const [showShippingForm, setShowShippingForm] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const load = useCallback(async () => {
    if (!auth.accessToken) return;
    try {
      setConfiguration(
        await apiRequest<CheckoutAdminDto>("/checkout/admin/configuration", auth.accessToken),
      );
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Checkout settings could not be loaded.",
      );
    }
  }, [auth.accessToken]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const addShippingMethod = (method: ShippingMethodDto) => {
    setConfiguration((current) =>
      current ? { ...current, shippingMethods: [...current.shippingMethods, method] } : current,
    );
    setShowShippingForm(false);
  };
  const updateShippingMethod = (method: ShippingMethodDto) => {
    setConfiguration((current) =>
      current
        ? {
            ...current,
            shippingMethods: current.shippingMethods.map((item) =>
              item.id === method.id ? method : item,
            ),
          }
        : current,
    );
  };

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!auth.accessToken || !configuration) return;
    setSaved(false);
    const data = new FormData(event.currentTarget);
    const maxValue = String(data.get("codMaximumOrderPaise") ?? "").trim();
    try {
      const settings = await apiRequest<CheckoutSettingsDto>(
        "/checkout/admin/settings",
        auth.accessToken,
        {
          method: "PATCH",
          body: JSON.stringify({
            reservationMinutes: Number(data.get("reservationMinutes")),
            guestCheckoutEnabled: false,
            codEnabled: data.get("codEnabled") === "on",
            codMinimumOrderPaise: Number(data.get("codMinimumOrderPaise")),
            codMaximumOrderPaise: maxValue ? Number(maxValue) : null,
            codPostalPrefixes: String(data.get("codPostalPrefixes"))
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
            codConfirmationRequired: data.get("codConfirmationRequired") === "on",
          }),
        },
      );
      setConfiguration({ ...configuration, settings });
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Settings could not be saved.");
    }
  };

  if (!configuration && !error)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  if (!configuration)
    return (
      <ErrorState className="text-ink" description={error} title="Checkout admin unavailable" />
    );

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-paper/60">Operations</p>
      <h1 className="mt-2 text-3xl font-semibold">Checkout configuration</h1>
      <p className="mt-2 text-sm text-paper/65">
        Rates, thresholds and COD availability remain disabled until explicitly configured.
      </p>

      <section className="mt-8 rounded-lg bg-paper p-6 text-ink">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Shipping methods</h2>
            <p className="mt-1 text-sm text-muted">
              Manual rates are checked during every checkout.
            </p>
          </div>
          <Button
            onClick={() => setShowShippingForm((value) => !value)}
            size="sm"
            variant="outline"
          >
            {showShippingForm ? "Close" : "Add method"}
          </Button>
        </div>
        {showShippingForm && auth.accessToken ? (
          <ShippingMethodForm accessToken={auth.accessToken} onCreated={addShippingMethod} />
        ) : null}
        <div className="mt-6 divide-y divide-ink/10">
          {configuration.shippingMethods.map((method) => (
            <ShippingMethodEditor
              accessToken={auth.accessToken ?? ""}
              key={method.id}
              method={method}
              onUpdated={updateShippingMethod}
            />
          ))}
          {configuration.shippingMethods.length === 0 ? (
            <p className="py-5 text-sm text-muted">No shipping method is configured.</p>
          ) : null}
        </div>
      </section>

      <section className="mt-6 rounded-lg bg-paper p-6 text-ink">
        <h2 className="text-xl font-semibold">Reservation and COD rules</h2>
        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={saveSettings}>
          <label className="grid gap-1 text-sm">
            Reservation minutes
            <input
              className="min-h-11 rounded-md border px-3"
              defaultValue={configuration.settings.reservationMinutes}
              max="60"
              min="5"
              name="reservationMinutes"
              required
              type="number"
            />
          </label>
          <label className="grid gap-1 text-sm">
            COD minimum order in paise
            <input
              className="min-h-11 rounded-md border px-3"
              defaultValue={configuration.settings.codMinimumOrderPaise}
              min="0"
              name="codMinimumOrderPaise"
              required
              type="number"
            />
          </label>
          <label className="grid gap-1 text-sm">
            COD maximum order in paise
            <input
              className="min-h-11 rounded-md border px-3"
              defaultValue={configuration.settings.codMaximumOrderPaise ?? ""}
              min="0"
              name="codMaximumOrderPaise"
              type="number"
            />
          </label>
          <label className="grid gap-1 text-sm">
            COD postal prefixes
            <input
              className="min-h-11 rounded-md border px-3"
              defaultValue={configuration.settings.codPostalPrefixes.join(", ")}
              name="codPostalPrefixes"
            />
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input
              className="size-5 accent-gold"
              defaultChecked={configuration.settings.codEnabled}
              name="codEnabled"
              type="checkbox"
            />
            Enable COD
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input
              className="size-5 accent-gold"
              defaultChecked={configuration.settings.codConfirmationRequired}
              name="codConfirmationRequired"
              type="checkbox"
            />
            Require COD confirmation
          </label>
          <Button className="sm:col-span-2" type="submit">
            Save checkout settings
          </Button>
          {saved ? (
            <p className="text-sm font-semibold text-success sm:col-span-2" role="status">
              Checkout settings saved.
            </p>
          ) : null}
        </form>
      </section>
      {error ? (
        <p className="mt-5 text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
