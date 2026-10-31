"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, FormError, Input } from "@/components/ui/Form";
import { ApiError } from "@/lib/api/client";
import { COMPANY_NAME } from "@/lib/config";
import { useSession } from "@/lib/auth/AuthProvider";

function BrandMark() {
  return (
    <span className="flex size-11 items-center justify-center rounded-xl bg-brand-500 text-white shadow-lg shadow-brand-500/20">
      <svg
        className="size-5"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M14.2 6.1a5 5 0 0 0-6.1 6.1L3.7 16.6a2.3 2.3 0 1 0 3.3 3.3l4.4-4.4a5 5 0 0 0 6.1-6.1l-3 3-3.1-3.1 2.8-3.2Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export default function LoginPage() {
  const { login, status, isCustomer, invalidateSession } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const resetSuccessHandled = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetSucceeded = params.get("reset") === "success";
    setResetSuccess(resetSucceeded);
    if (resetSucceeded) {
      resetSuccessHandled.current = true;
      // The reset screen revoked the previous refresh-token generation. Clear
      // stale browser auth state before the login redirect effect can use it.
      invalidateSession();
      // Keep the success notice in component state, but remove the one-shot
      // flag so a subsequent successful sign-in is not invalidated as well.
      window.history.replaceState(window.history.state, "", "/login");
    }
  }, [invalidateSession]);

  useEffect(() => {
    if (resetSuccessHandled.current) return;
    if (status !== "authenticated") return;
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("next");
    const safeInternalPath = Boolean(
      requested &&
        requested.startsWith("/") &&
        !requested.startsWith("//") &&
        !requested.includes("\\"),
    );
    const isPortalPath = Boolean(
      requested &&
        (requested === "/portal" || requested.startsWith("/portal/")),
    );
    const isStaffOnly = Boolean(
      requested && requested !== "/" && !isPortalPath,
    );
    if (safeInternalPath && requested && !(isStaffOnly && isCustomer))
      router.replace(requested);
    else router.replace(isCustomer ? "/portal" : "/dashboard");
  }, [status, isCustomer, router]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    resetSuccessHandled.current = false;
    setPending(true);
    setError(null);
    try {
      await login(email, password);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, caught, "Could not sign in"),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[#f5f7fb] lg:grid-cols-[0.9fr_1.1fr]">
      <section className="relative hidden min-h-full overflow-hidden bg-ink-950 px-10 py-10 text-white lg:flex lg:flex-col xl:px-14">
        <div className="absolute -right-40 top-20 size-[28rem] rounded-full bg-brand-500/20 blur-[100px]" />
        <div className="absolute -bottom-40 -left-32 size-[25rem] rounded-full bg-sky-400/10 blur-[100px]" />
        <Link href="/" className="relative flex w-fit items-center gap-3">
          <BrandMark />
          <span>
            <span className="block text-sm font-semibold">{COMPANY_NAME}</span>
            <span className="mt-1 block text-[9px] uppercase tracking-[0.22em] text-ink-400">
              Workshop operations
            </span>
          </span>
        </Link>
        <div className="relative my-auto max-w-lg py-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-medium text-brand-100">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Everything in its place
          </div>
          <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-[-0.04em] xl:text-5xl">
            Good to have you back.
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-ink-300">
            Return to the work that matters. Keep jobs, customers and workshop
            decisions moving from one connected workspace.
          </p>
          <div className="mt-10 space-y-4">
            {[
              "See the day’s jobs and priorities",
              "Follow repairs from check-in to collection",
              "Keep estimates, invoices and parts connected",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 text-sm text-ink-200"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300">
                  ✓
                </span>
                {item}
              </div>
            ))}
          </div>
          <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-400">
              Built for the full service journey
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium">
              <span className="rounded-lg bg-white/10 px-3 py-2">Request</span>
              <span className="text-brand-300">→</span>
              <span className="rounded-lg bg-white/10 px-3 py-2">Repair</span>
              <span className="text-brand-300">→</span>
              <span className="rounded-lg bg-white/10 px-3 py-2">Review</span>
              <span className="text-brand-300">→</span>
              <span className="rounded-lg bg-white/10 px-3 py-2">Invoice</span>
            </div>
          </div>
        </div>
        <p className="relative text-xs text-ink-500">
          Secure access for workshop teams and customers.
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[430px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark />
            <div>
              <p className="text-sm font-semibold">{COMPANY_NAME}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink-500">
                Workshop operations
              </p>
            </div>
          </div>
          <div className="mb-7">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">
              Welcome back
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-ink-950">
              Sign in to AutoFix
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-500">
              Enter your account details to continue to your workspace.
            </p>
          </div>

          {resetSuccess ? (
            <div
              role="status"
              className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            >
              Your password has been updated. Sign in with your new password.
            </div>
          ) : null}

          <form
            onSubmit={onSubmit}
            className="space-y-5 rounded-2xl border border-ink-200/80 bg-white p-5 shadow-xl shadow-ink-900/5 sm:p-7"
          >
            <Field label="Email address" required>
              <Input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="min-h-11 rounded-xl px-3.5"
              />
            </Field>
            <Field label="Password" required>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="min-h-11 rounded-xl px-3.5 pr-20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  className="absolute inset-y-0 right-3 text-xs font-semibold text-ink-500 hover:text-ink-900"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </Field>
            <div className="-mt-1 flex justify-end">
              <Link
                href="/forgot-password"
                className="text-xs font-semibold text-brand-700 hover:text-brand-900"
              >
                Forgot password?
              </Link>
            </div>
            <FormError error={error} />
            <Button
              type="submit"
              variant="primary"
              pending={pending}
              className="min-h-12 w-full rounded-xl text-sm"
            >
              Sign in
            </Button>
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-ink-100" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">
                  New to AutoFix?
                </span>
              </div>
            </div>
            <Link
              href="/register"
              className="flex min-h-11 w-full items-center justify-center rounded-xl border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-800 transition-colors hover:border-brand-300 hover:bg-brand-50"
            >
              Create a customer account
            </Link>
          </form>
          <p className="mt-5 text-center text-xs leading-5 text-ink-500">
            Customers sign in here too and are taken directly to their own
            account.{" "}
            <Link
              href="/"
              className="font-medium text-brand-700 hover:text-brand-900"
            >
              Back to home
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
