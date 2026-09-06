"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, FieldLabel, Input } from "@thread/ui";
import type { AuthSessionDto } from "@thread/types";
import { loginSchema, type LoginInput } from "@thread/validation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { authRequest, API_URL } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";
import { AuthHeading } from "./auth-heading";
import { PhoneLoginForm } from "./phone-login-form";

const subscribeToHydration = () => () => {};

export function LoginForm({
  googleEnabled,
  phoneEnabled,
  admin = false,
}: {
  admin?: boolean;
  googleEnabled: boolean;
  phoneEnabled: boolean;
}) {
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [serverError, setServerError] = useState("");
  const router = useRouter();
  const auth = useAuth();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const submit = handleSubmit(async (values) => {
    setServerError("");
    try {
      const session = await authRequest<AuthSessionDto>("/login", {
        method: "POST",
        body: JSON.stringify(values),
      });
      if (
        admin &&
        !session.user.roles.some((role) =>
          ["super_admin", "admin", "catalog_manager", "order_manager", "support_agent"].includes(
            role,
          ),
        )
      ) {
        throw new Error("This account does not have admin access.");
      }
      auth.establish(session);
      const roles = session.user.roles;
      const destination = session.user.mustChangePassword
        ? "/account/change-password"
        : roles.includes("super_admin") ||
            roles.includes("admin") ||
            roles.includes("order_manager")
          ? "/admin"
          : roles.includes("catalog_manager")
            ? "/admin/products"
            : roles.includes("support_agent")
              ? "/admin/orders"
              : "/account";
      router.push(destination);
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Sign in is unavailable. Please try again.",
      );
    }
  });
  return (
    <div>
      <AuthHeading
        title={admin ? "Admin sign in" : "Welcome back"}
        description={
          admin
            ? "Sign in with your THREAD staff account."
            : "Sign in securely to continue to your THREAD account."
        }
      />
      {phoneEnabled ? (
        <div
          className="mt-7 grid grid-cols-2 rounded-md bg-ink/5 p-1"
          role="tablist"
          aria-label="Sign in method"
        >
          <button
            className={`min-h-10 rounded-sm text-sm font-semibold ${mode === "email" ? "bg-paper shadow-subtle" : ""}`}
            onClick={() => setMode("email")}
            role="tab"
            aria-selected={mode === "email"}
            type="button"
          >
            Email
          </button>
          <button
            className={`min-h-10 rounded-sm text-sm font-semibold ${mode === "phone" ? "bg-paper shadow-subtle" : ""}`}
            onClick={() => setMode("phone")}
            role="tab"
            aria-selected={mode === "phone"}
            type="button"
          >
            Phone
          </button>
        </div>
      ) : null}
      {mode === "phone" ? (
        <PhoneLoginForm
          onAuthenticated={(session) => {
            auth.establish(session);
            router.push("/account");
          }}
        />
      ) : (
        <form className="mt-7 grid gap-5" onSubmit={submit} method="post" noValidate>
          <div className="grid gap-2">
            <FieldLabel htmlFor="login-email">Email address</FieldLabel>
            <Input
              disabled={!hydrated}
              autoComplete="email"
              id="login-email"
              inputMode="email"
              {...register("email")}
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email ? <p className="text-sm text-error">{errors.email.message}</p> : null}
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="login-password">Password</FieldLabel>
              <Link
                className="text-xs font-medium underline underline-offset-4"
                href="/auth/forgot-password"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              disabled={!hydrated}
              autoComplete="current-password"
              id="login-password"
              type="password"
              {...register("password")}
              aria-invalid={Boolean(errors.password)}
            />
            {errors.password ? (
              <p className="text-sm text-error">{errors.password.message}</p>
            ) : null}
          </div>
          {serverError ? (
            <p className="text-sm text-error" role="alert">
              {serverError}
            </p>
          ) : null}
          <Button disabled={!hydrated || isSubmitting} type="submit">
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      )}
      {googleEnabled ? (
        <>
          <div className="my-6 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-ink/10" />
            OR
            <span className="h-px flex-1 bg-ink/10" />
          </div>
          <Button asChild className="w-full" variant="outline">
            <a href={`${API_URL}/api/v1/auth/google/start`}>Continue with Google</a>
          </Button>
        </>
      ) : null}
      {!admin ? (
        <p className="mt-7 text-center text-sm text-muted">
          New to THREAD?{" "}
          <Link
            className="font-semibold text-ink underline underline-offset-4"
            href="/auth/register"
          >
            Create an account
          </Link>
        </p>
      ) : null}
    </div>
  );
}
