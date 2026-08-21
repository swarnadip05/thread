"use client";

import { Button, FieldLabel, Input } from "@thread/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authRequest, ApiClientError } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";
import { PasswordStrength } from "./password-strength";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const auth = useAuth();
  const router = useRouter();
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!auth.accessToken) return;
    setBusy(true);
    setError("");
    try {
      await authRequest("/change-password", {
        method: "POST",
        headers: { authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      await auth.logout();
      router.replace("/auth/login");
    } catch (reason) {
      setError(
        reason instanceof ApiClientError ? reason.message : "Password could not be changed.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mx-auto max-w-lg rounded-lg border border-ink/10 bg-paper p-6 shadow-subtle sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Security</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Change password</h1>
      {auth.user?.mustChangePassword ? (
        <p className="mt-3 text-sm text-error">
          You must replace the one-time bootstrap password before continuing.
        </p>
      ) : null}
      <form className="mt-7 grid gap-5" onSubmit={submit}>
        <div className="grid gap-2">
          <FieldLabel htmlFor="current-password">Current password</FieldLabel>
          <Input
            autoComplete="current-password"
            id="current-password"
            required
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="new-password">New password</FieldLabel>
          <Input
            autoComplete="new-password"
            id="new-password"
            required
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <PasswordStrength password={newPassword} />
        </div>
        {error ? (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        ) : null}
        <Button disabled={busy} type="submit">
          {busy ? "Updating…" : "Update password"}
        </Button>
      </form>
    </section>
  );
}
