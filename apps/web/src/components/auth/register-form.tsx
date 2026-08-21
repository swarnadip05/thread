"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Checkbox, FieldLabel, Input } from "@thread/ui";
import type { AuthSessionDto } from "@thread/types";
import { registerSchema, type RegisterInput } from "@thread/validation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { authRequest, ApiClientError } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";
import { AuthHeading } from "./auth-heading";
import { PasswordStrength } from "./password-strength";

export function RegisterForm() {
  const [accepted, setAccepted] = useState(false);
  const [serverError, setServerError] = useState("");
  const auth = useAuth();
  const router = useRouter();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    control,
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", name: "", password: "" },
  });
  const password = useWatch({ control, name: "password" });
  const submit = handleSubmit(async (values) => {
    if (!accepted) return;
    setServerError("");
    try {
      const session = await authRequest<AuthSessionDto>("/register", {
        method: "POST",
        body: JSON.stringify(values),
      });
      auth.establish(session);
      router.push("/account");
    } catch (error) {
      setServerError(
        error instanceof ApiClientError
          ? error.message
          : "Registration is unavailable. Please try again.",
      );
    }
  });
  return (
    <div>
      <AuthHeading
        title="Create your account"
        description="Join THREAD to keep your favourites and profile in one place."
      />
      <form className="mt-7 grid gap-5" onSubmit={submit} noValidate>
        <div className="grid gap-2">
          <FieldLabel htmlFor="register-name">Full name</FieldLabel>
          <Input
            autoComplete="name"
            id="register-name"
            {...register("name")}
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name ? <p className="text-sm text-error">{errors.name.message}</p> : null}
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="register-email">Email address</FieldLabel>
          <Input
            autoComplete="email"
            id="register-email"
            inputMode="email"
            {...register("email")}
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email ? <p className="text-sm text-error">{errors.email.message}</p> : null}
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="register-password">Password</FieldLabel>
          <Input
            autoComplete="new-password"
            id="register-password"
            type="password"
            {...register("password")}
            aria-invalid={Boolean(errors.password)}
          />
          <PasswordStrength password={password} />
          {errors.password ? <p className="text-sm text-error">{errors.password.message}</p> : null}
        </div>
        <label className="flex items-start gap-3 text-sm leading-5 text-muted">
          <Checkbox
            checked={accepted}
            className="mt-0.5"
            onCheckedChange={(checked) => setAccepted(checked === true)}
          />
          <span>
            I agree to the Terms and Privacy Policy. These documents will be finalized before
            launch.
          </span>
        </label>
        {serverError ? (
          <p className="text-sm text-error" role="alert">
            {serverError}
          </p>
        ) : null}
        <Button disabled={isSubmitting || !accepted} type="submit">
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-7 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link className="font-semibold text-ink underline underline-offset-4" href="/auth/login">
          Sign in
        </Link>
      </p>
    </div>
  );
}
