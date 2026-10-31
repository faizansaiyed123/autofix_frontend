"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, FormError, Input } from "@/components/ui/Form";
import { ApiError } from "@/lib/api/client";
import { authApi } from "@/lib/api/auth";
import { COMPANY_NAME } from "@/lib/config";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await authApi.requestPasswordReset(email.trim());
      setSent(true);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, caught, "Could not submit the request."),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-5 py-10">
      <div className="w-full max-w-[440px]">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-3 text-ink-900"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-ink-950 text-white">
            ⚒
          </span>
          <span className="text-sm font-semibold">{COMPANY_NAME}</span>
        </Link>
        <section className="rounded-2xl border border-ink-200/80 bg-white p-6 shadow-xl shadow-ink-900/5 sm:p-8">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <svg
              className="size-6"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4.5 8.5 12 13l7.5-4.5M6 5h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          {!sent ? (
            <>
              <h1 className="mt-5 text-2xl font-semibold tracking-tight">
                Reset your password
              </h1>
              <p className="mt-3 text-sm leading-6 text-ink-500">
                Enter the email address connected to your AutoFix account. We'll
                send a secure reset link if an account matches.
              </p>
              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <Field label="Email address" required>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="email"
                    className="min-h-11 rounded-xl"
                    placeholder="you@example.com"
                  />
                </Field>
                <FormError error={error} />
                <Button
                  type="submit"
                  pending={pending}
                  className="min-h-11 w-full rounded-xl"
                >
                  Send reset link
                </Button>
              </form>
            </>
          ) : (
            <>
              <h1 className="mt-5 text-2xl font-semibold tracking-tight">
                Check your email
              </h1>
              <p className="mt-3 text-sm leading-6 text-ink-500">
                If an account matches{" "}
                <strong className="break-all text-ink-800">
                  {email.trim()}
                </strong>
                , a password reset message will arrive shortly. The link expires
                in 60 minutes.
              </p>
              <div className="mt-5 rounded-xl border border-brand-100 bg-brand-50/70 p-4 text-xs leading-5 text-ink-600">
                If you don't see it, check your spam folder. For security, this
                page doesn't reveal whether an account exists.
              </div>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="mt-5 w-full text-sm font-semibold text-brand-700 hover:text-brand-900"
              >
                Try another email
              </button>
            </>
          )}
        </section>
        <p className="mt-5 text-center text-sm text-ink-500">
          <Link
            href="/login"
            className="font-semibold text-brand-700 hover:text-brand-900"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
