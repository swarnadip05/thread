"use client";

import type { AuthSessionDto, CheckoutAddressDto } from "@thread/types";
import { Button, Input } from "@thread/ui";
import { Loader2, Navigation } from "lucide-react";
import { useState, type FormEvent } from "react";

import { apiRequest, authRequest } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";

export function CheckoutAddressForm({
  accessToken,
  onCreated,
  onCancel,
}: {
  accessToken?: string | null;
  onCreated(address: CheckoutAddressDto): void;
  onCancel?: (() => void) | undefined;
}) {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationSuccess, setLocationSuccess] = useState("");
  const [error, setError] = useState("");

  const [fullName, setFullName] = useState(auth.user?.name ?? "");
  const [phone, setPhone] = useState(auth.user?.phone ?? "");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [landmark, setLandmark] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [type, setType] = useState<"home" | "work" | "other">("home");
  const [isDefault, setIsDefault] = useState(true);

  const detectLocation = () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setLocating(true);
    setLocationSuccess("");
    setError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
            {
              headers: {
                Accept: "application/json",
              },
            },
          );
          if (!res.ok) throw new Error("Could not resolve address from coordinates.");
          const data = (await res.json()) as {
            address?: Record<string, string>;
          };
          const addr = data.address || {};

          const detectedPostalCode = addr.postcode || "";
          const detectedCity =
            addr.city || addr.town || addr.village || addr.municipality || addr.county || "";
          const detectedDistrict =
            addr.state_district || addr.district || addr.county || detectedCity || "";
          const detectedState = addr.state || "";
          const detectedStreet = [addr.suburb, addr.road, addr.neighbourhood]
            .filter(Boolean)
            .join(", ");

          if (detectedPostalCode) setPostalCode(detectedPostalCode);
          if (detectedCity) setCity(detectedCity);
          if (detectedDistrict) setDistrict(detectedDistrict);
          if (detectedState) setState(detectedState);
          if (detectedStreet && !addressLine2) setAddressLine2(detectedStreet);

          setLocationSuccess(
            `📍 Location detected: ${[detectedCity, detectedState, detectedPostalCode].filter(Boolean).join(", ")}`,
          );
        } catch (geoError) {
          setError(
            geoError instanceof Error
              ? geoError.message
              : "Unable to auto-detect location. Please enter manually.",
          );
        } finally {
          setLocating(false);
        }
      },
      (geoErr) => {
        setLocating(false);
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setError("Location access denied. Please fill in your delivery address manually below.");
        } else {
          setError("Unable to retrieve your location. Please fill in your address manually below.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      let activeToken = accessToken;

      // If user is not authenticated yet, register guest session instantly
      if (!activeToken) {
        const guestSession = await authRequest<AuthSessionDto>("/guest", {
          method: "POST",
          body: JSON.stringify({
            name: fullName.trim() || "Valued Customer",
            phone: phone.trim() || undefined,
          }),
        });
        auth.establish(guestSession);
        activeToken = guestSession.accessToken;
      }

      const address = await apiRequest<CheckoutAddressDto>("/checkout/addresses", activeToken, {
        method: "POST",
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || undefined,
          landmark: landmark.trim() || undefined,
          city: city.trim(),
          district: district.trim(),
          state: state.trim(),
          postalCode: postalCode.trim(),
          country: "India",
          type,
          isDefault,
        }),
      });

      onCreated(address);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Address could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="mt-5 rounded-lg border border-ink/15 bg-paper p-5" onSubmit={submit}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-gold/40 bg-gold/5 p-3.5">
        <div>
          <p className="text-sm font-semibold text-charcoal">Quick Delivery Address</p>
          <p className="text-xs text-muted">
            Auto-detect your PIN code, city, and state with 1-click GPS location.
          </p>
        </div>
        <Button
          className="gap-2 text-xs font-semibold"
          disabled={locating}
          onClick={detectLocation}
          size="sm"
          type="button"
          variant="outline"
        >
          {locating ? (
            <>
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin text-gold" />
              Detecting location…
            </>
          ) : (
            <>
              <Navigation aria-hidden="true" className="size-3.5 text-gold" />
              📍 Use My Current Location
            </>
          )}
        </Button>
      </div>

      {locationSuccess ? (
        <p className="mb-4 rounded-md bg-success/10 p-3 text-xs font-medium text-success">
          {locationSuccess}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          Receiver Full Name <span className="text-error">*</span>
          <Input
            autoComplete="name"
            name="fullName"
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Rahul Sharma"
            required
            value={fullName}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Contact Phone Number <span className="text-error">*</span>
          <Input
            autoComplete="tel"
            inputMode="tel"
            name="phone"
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit mobile number"
            required
            value={phone}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium sm:col-span-2">
          Flat / House No. / Building / Floor <span className="text-error">*</span>
          <Input
            autoComplete="address-line1"
            name="addressLine1"
            onChange={(e) => setAddressLine1(e.target.value)}
            placeholder="e.g. Flat 302, Green Valley Apartments"
            required
            value={addressLine1}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium sm:col-span-2">
          Street / Area / Colony <span className="font-normal text-muted">(optional)</span>
          <Input
            autoComplete="address-line2"
            name="addressLine2"
            onChange={(e) => setAddressLine2(e.target.value)}
            placeholder="e.g. Main Street, Sector 4"
            value={addressLine2}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium sm:col-span-2">
          Landmark <span className="font-normal text-muted">(optional)</span>
          <Input
            name="landmark"
            onChange={(e) => setLandmark(e.target.value)}
            placeholder="e.g. Near Metro Station / Behind City Mall"
            value={landmark}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          PIN Code <span className="text-error">*</span>
          <Input
            autoComplete="postal-code"
            inputMode="numeric"
            name="postalCode"
            onChange={(e) => setPostalCode(e.target.value)}
            placeholder="6-digit PIN code"
            required
            value={postalCode}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          City / Town <span className="text-error">*</span>
          <Input
            autoComplete="address-level2"
            name="city"
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Kolkata"
            required
            value={city}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          District <span className="text-error">*</span>
          <Input
            name="district"
            onChange={(e) => setDistrict(e.target.value)}
            placeholder="e.g. South 24 Parganas"
            required
            value={district}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          State <span className="text-error">*</span>
          <Input
            autoComplete="address-level1"
            name="state"
            onChange={(e) => setState(e.target.value)}
            placeholder="e.g. West Bengal"
            required
            value={state}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Address Type
          <select
            className="min-h-11 rounded-md border border-ink/20 bg-paper px-3 text-sm"
            name="type"
            onChange={(e) => setType(e.target.value as "home" | "work" | "other")}
            value={type}
          >
            <option value="home">Home</option>
            <option value="work">Work</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            checked={isDefault}
            className="size-5 accent-gold"
            name="isDefault"
            onChange={(e) => setIsDefault(e.target.checked)}
            type="checkbox"
          />
          Make this my default address
        </label>
      </div>

      {error ? (
        <p className="mt-4 rounded-md bg-error/10 p-3 text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex items-center justify-end gap-3">
        {onCancel ? (
          <Button onClick={onCancel} type="button" variant="outline">
            Cancel
          </Button>
        ) : null}
        <Button className="font-semibold" disabled={busy} type="submit" variant="gold">
          {busy ? "Saving delivery address…" : "Deliver to this address"}
        </Button>
      </div>
    </form>
  );
}
