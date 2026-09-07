"use client";

import { useState, type FormEvent } from "react";
import { Button, Input } from "@thread/ui";

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;
const apiUrl =
  process.env.NODE_ENV === "production" && /localhost|127\.0\.0\.1/.test(configuredApiUrl ?? "")
    ? null
    : configuredApiUrl || (process.env.NODE_ENV === "production" ? null : "http://localhost:4000");
const newsletterEmailKey = "thread:newsletter-email";
type NewsletterStatus = "duplicate" | "error" | "idle" | "submitting" | "success" | "validation";

export default function NewsletterForm() {
  const [status, setStatus] = useState<NewsletterStatus>("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "")
      .trim()
      .toLocaleLowerCase("en-IN");
    const consent = data.get("consent") === "on";
    if (!email || !consent) {
      setStatus("validation");
      return;
    }
    if (localStorage.getItem(newsletterEmailKey) === email) {
      setStatus("duplicate");
      return;
    }
    setStatus("submitting");
    if (!apiUrl) {
      setStatus("error");
      return;
    }
    try {
      const response = await fetch(`${apiUrl}/api/v1/public/newsletter`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, consent }),
      });
      if (response.status === 409) {
        setStatus("duplicate");
        return;
      }
      if (response.status === 400) {
        setStatus("validation");
        return;
      }
      if (!response.ok) throw new Error("Subscription failed.");
      localStorage.setItem(newsletterEmailKey, email);
      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  return (
    <form className="mt-7" onSubmit={submit}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          aria-describedby="newsletter-status"
          aria-invalid={status === "validation"}
          aria-label="Email address"
          autoComplete="email"
          className="border-paper/20 bg-paper text-ink sm:flex-1"
          name="email"
          placeholder="Email address"
          required
          type="email"
        />
        <Button disabled={status === "submitting"} type="submit" variant="gold">
          {status === "submitting" ? "Joining…" : "Join the list"}
        </Button>
      </div>
      <label className="mt-4 flex items-start gap-2 text-xs leading-5 text-paper/65">
        <input className="mt-1 size-4 accent-gold" name="consent" required type="checkbox" />
        <span>I agree to receive THREAD product and campaign updates by email.</span>
      </label>
      <p aria-live="polite" className="mt-3 min-h-5 text-sm" id="newsletter-status">
        {status === "success" ? "You’re on the THREAD list." : null}
        {status === "duplicate" ? "This email is already on the THREAD list." : null}
        {status === "validation" ? "Enter a valid email and confirm your consent." : null}
        {status === "error"
          ? "We couldn’t save your request right now. Please try again shortly."
          : null}
      </p>
    </form>
  );
}
