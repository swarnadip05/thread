"use client";

import { Button, FieldLabel, Input } from "@thread/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authRequest, ApiClientError } from "@/auth/auth-client";
import { AuthHeading } from "./auth-heading";
import { PasswordStrength } from "./password-strength";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await authRequest("/password/reset", {
        method: "POST",
        body: JSON.stringify({ password, token }),
      });
      router.push("/auth/login?reset=success");
    } catch (reason) {
      setError(
        reason instanceof ApiClientError ? reason.message : "The password could not be reset.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <AuthHeading
        title="Choose a new password"
        description="Use a unique password you do not use elsewhere."
      />
      <form className="mt-7 grid gap-5" onSubmit={submit}>
        <div className="grid gap-2">
          <FieldLabel htmlFor="reset-password">New password</FieldLabel>
          <Input
            autoComplete="new-password"
            id="reset-password"
            minLength={10}
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <PasswordStrength password={password} />
        </div>
        {error ? (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        ) : null}
        <Button disabled={busy || !token} type="submit">
          {busy ? "Updating…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
