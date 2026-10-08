"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { FormError } from "@/components/ui/Form";
import { useSession } from "@/lib/auth/AuthProvider";
import { ApiError } from "@/lib/api/client";
import { COMPANY_NAME } from "@/lib/config";

/**
 * Sign in.
 *
 * The `next` parameter is honoured, but only after the session is known — which
 * is what decides whether the destination was reachable at all. A customer sent
 * to a staff link is sent to their own account instead of to a wall of 403s.
 */
export default function LoginPage() {
  const { login, status, isCustomer } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("next");
    // Only follow the requested page when it is one this person can actually
    // open: a customer following `/audit` gets their account, not a refusal.
    const isStaffOnly = Boolean(requested && !requested.startsWith("/portal") && requested !== "/");
    if (requested && !(isStaffOnly && isCustomer)) {
      router.replace(requested);
    } else {
      router.replace(isCustomer ? "/portal" : "/dashboard");
    }
  }, [status, isCustomer, router]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(email, password);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, caught, "Could not sign in"));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-white">{COMPANY_NAME}</h1>
          <p className="mt-1 text-sm text-ink-400">Sign in to continue</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl bg-white p-6 shadow-xl ring-1 ring-white/10"
        >
          <Field label="Email" required>
            <Input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@garage.example"
            />
          </Field>

          <Field label="Password" required>
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>

          <FormError error={error} />

          <Button type="submit" variant="primary" pending={pending} className="w-full">
            Sign in
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-ink-400">
          Staff use the workshop screens. Customers sign in here too and land on their own account.
        </p>
      </div>
    </main>
  );
}