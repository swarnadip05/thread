"use client";

import { Button, FieldLabel, Input } from "@thread/ui";
import Link from "next/link";
import { useState } from "react";
import { authRequest } from "@/auth/auth-client";
import { AuthHeading } from "./auth-heading";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      await authRequest("/password/forgot", { method: "POST", body: JSON.stringify({ email }) });
    } finally {
      setBusy(false);
      setSent(true);
    }
  };
  if (sent)
    return (
      <div>
        <AuthHeading
          title="Check your inbox"
          description="If an account exists for that email, reset instructions have been sent."
        />
        <Link
          className="mt-7 inline-block text-sm font-semibold underline underline-offset-4"
          href="/auth/login"
        >
          Return to sign in
        </Link>
      </div>
    );
  return (
    <div>
      <AuthHeading
        title="Reset your password"
        description="Enter your email and we’ll send instructions if an account is available."
      />
      <form className="mt-7 grid gap-5" onSubmit={submit}>
        <div className="grid gap-2">
          <FieldLabel htmlFor="forgot-email">Email address</FieldLabel>
          <Input
            id="forgot-email"
            inputMode="email"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <Button disabled={busy} type="submit">
          {busy ? "Sending…" : "Send reset instructions"}
        </Button>
      </form>
    </div>
  );
}
