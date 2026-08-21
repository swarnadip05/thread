"use client";

import { Button, FieldLabel, Input } from "@thread/ui";
import type { AuthSessionDto } from "@thread/types";
import { useState } from "react";
import { authRequest, ApiClientError } from "@/auth/auth-client";

export function PhoneLoginForm({
  onAuthenticated,
}: {
  onAuthenticated: (session: AuthSessionDto) => void;
}) {
  const [phone, setPhone] = useState("+91");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!sent) {
        await authRequest("/phone/request", { method: "POST", body: JSON.stringify({ phone }) });
        setSent(true);
      } else
        onAuthenticated(
          await authRequest<AuthSessionDto>("/phone/verify", {
            method: "POST",
            body: JSON.stringify({ phone, code }),
          }),
        );
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Phone sign in is unavailable.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="mt-7 grid gap-5" onSubmit={submit}>
      <div className="grid gap-2">
        <FieldLabel htmlFor="phone">Phone number</FieldLabel>
        <Input
          disabled={sent}
          id="phone"
          inputMode="tel"
          onChange={(event) => setPhone(event.target.value)}
          value={phone}
        />
      </div>
      {sent ? (
        <div className="grid gap-2">
          <FieldLabel htmlFor="otp">Six-digit code</FieldLabel>
          <Input
            autoComplete="one-time-code"
            id="otp"
            inputMode="numeric"
            maxLength={6}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            value={code}
          />
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
      <Button disabled={busy || (sent ? code.length !== 6 : phone.length < 9)} type="submit">
        {busy ? "Please wait…" : sent ? "Verify code" : "Send code"}
      </Button>
    </form>
  );
}
