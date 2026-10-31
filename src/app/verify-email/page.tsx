"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, FormError, Input } from "@/components/ui/Form";
import { ApiError } from "@/lib/api/client";
import { authApi } from "@/lib/api/auth";
import { useSession } from "@/lib/auth/AuthProvider";
import { COMPANY_NAME } from "@/lib/config";

type ViewState =
  | "loading"
  | "ready"
  | "verifying"
  | "missing"
  | "failed"
  | "resent";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { acceptTokens } = useSession();
  const started = useRef(false);
  const [state, setState] = useState<ViewState>("loading");
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [resendError, setResendError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const url = new URL(window.location.href);
    const linkToken = new URLSearchParams(url.hash.slice(1)).get("token");
    window.history.replaceState(null, "", "/verify-email");

    if (!linkToken) {
      setState("missing");
      return;
    }

    setToken(linkToken);
    setState("ready");
  }, []);

  async function verifyEmail() {
    if (!token) {
      setState("missing");
      return;
    }

    setPending(true);
    setError(null);
    setState("verifying");
    try {
      await acceptTokens(await authApi.verifyEmail(token));
      setToken("");
      router.replace("/portal");
    } catch (caught) {
      setToken("");
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, caught, "This link could not be verified."),
      );
      setState("failed");
    } finally {
      setPending(false);
    }
  }

  async function resend(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setResendError(null);
    try {
      await authApi.resendVerification(email.trim());
      setState("resent");
    } catch (caught) {
      setResendError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, caught, "Could not request another email."),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-5 py-10">
      <div className="w-full max-w-[460px]">
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
          {state === "loading" || state === "verifying" ? (
            <div className="py-6 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                <span className="size-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
              </span>
              <h1 className="mt-5 text-2xl font-semibold tracking-tight">
                {state === "loading"
                  ? "Preparing your verification link"
                  : "Verifying your email"}
              </h1>
              <p className="mt-3 text-sm leading-6 text-ink-500">
                {state === "loading"
                  ? "Removing the one-time token from the address bar before continuing."
                  : "We're confirming your address and preparing your customer account."}
              </p>
            </div>
          ) : state === "ready" ? (
            <>
              <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                ✉
              </span>
              <h1 className="mt-5 text-2xl font-semibold tracking-tight">
                Confirm your email address
              </h1>
              <p className="mt-3 text-sm leading-6 text-ink-500">
                Your verification link is ready. Select the button below to
                activate your account. This extra step prevents automatic email
                scanners from consuming the one-time link.
              </p>
              <Button
                type="button"
                pending={pending}
                onClick={verifyEmail}
                className="mt-6 min-h-11 w-full rounded-xl"
              >
                Verify email address
              </Button>
              <p className="mt-4 text-center text-xs text-ink-400">
                The link is valid for 24 hours and can be used once.
              </p>
            </>
          ) : (
            <>
              <span
                className={
                  "flex size-12 items-center justify-center rounded-2xl " +
                  (state === "resent"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-brand-50 text-brand-700")
                }
              >
                {state === "resent" ? "✓" : "✉"}
              </span>
              <h1 className="mt-5 text-2xl font-semibold tracking-tight">
                {state === "resent"
                  ? "Check your inbox"
                  : state === "missing"
                    ? "Verification link needed"
                    : "This link needs attention"}
              </h1>
              <p className="mt-3 text-sm leading-6 text-ink-500">
                {state === "resent"
                  ? "If an account needs verification, we'll send a new link to the address you provided."
                  : state === "missing"
                    ? "Open the verification link from your email, or request another message below."
                    : "The link may have expired or already been used. Request another verification email below."}
              </p>
              {error ? (
                <div className="mt-4">
                  <FormError error={error} />
                </div>
              ) : null}
              <form onSubmit={resend} className="mt-6 space-y-4">
                <Field label="Email address" required>
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="min-h-11 rounded-xl"
                  />
                </Field>
                <Button
                  type="submit"
                  pending={pending}
                  className="min-h-11 w-full rounded-xl"
                >
                  Resend verification email
                </Button>
                <FormError error={resendError} />
              </form>
              <div className="mt-5 border-t border-ink-100 pt-4 text-center text-sm text-ink-500">
                <Link
                  href="/register"
                  className="font-semibold text-brand-700 hover:text-brand-900"
                >
                  Create a new account
                </Link>
                <span className="mx-2 text-ink-300">·</span>
                <Link
                  href="/login"
                  className="font-semibold text-brand-700 hover:text-brand-900"
                >
                  Sign in
                </Link>
              </div>
            </>
          )}
        </section>
        <p className="mt-5 text-center text-xs text-ink-400">
          Verification runs only after you explicitly confirm the action.
        </p>
      </div>
    </main>
  );
}
