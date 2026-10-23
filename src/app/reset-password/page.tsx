"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, FormError, Input } from "@/components/ui/Form";
import { ApiError } from "@/lib/api/client";
import { authApi } from "@/lib/api/auth";
import { COMPANY_NAME } from "@/lib/config";
import { useSession } from "@/lib/auth/AuthProvider";

export default function ResetPasswordPage() {
  const { invalidateSession } = useSession();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    setToken(new URLSearchParams(url.hash.slice(1)).get("token") ?? "");
    window.history.replaceState(null, "", "/reset-password");
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!token) {
      setError(new ApiError(400, "This reset link is missing or invalid.", "This reset link is missing or invalid."));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(new ApiError(422, "Passwords do not match.", "Passwords do not match."));
      return;
    }
    setPending(true);
    try {
      await authApi.confirmPasswordReset(token, newPassword);
      // The backend revokes existing refresh tokens; clear this browser's stale session too.
      invalidateSession();
      setToken("");
      setDone(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, caught, "Could not reset your password."));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-5 py-10">
      <div className="w-full max-w-[440px]">
        <Link href="/" className="mb-8 flex items-center justify-center gap-3 text-ink-900"><span className="flex size-10 items-center justify-center rounded-xl bg-ink-950 text-white">⚒</span><span className="text-sm font-semibold">{COMPANY_NAME}</span></Link>
        <section className="rounded-2xl border border-ink-200/80 bg-white p-6 shadow-xl shadow-ink-900/5 sm:p-8">
          {!done ? <><h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1><p className="mt-3 text-sm leading-6 text-ink-500">Use a unique password with at least 8 characters. Reset links expire after 60 minutes and work once.</p><form onSubmit={onSubmit} className="mt-6 space-y-4"><Field label="New password" required><Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={8} maxLength={72} autoComplete="new-password" className="min-h-11 rounded-xl" /></Field><Field label="Confirm new password" required><Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} maxLength={72} autoComplete="new-password" className="min-h-11 rounded-xl" /></Field><FormError error={error} /><Button type="submit" pending={pending} className="min-h-11 w-full rounded-xl">Update password</Button></form></> : <><span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">✓</span><h1 className="mt-5 text-2xl font-semibold tracking-tight">Password updated</h1><p className="mt-3 text-sm leading-6 text-ink-500">Your password has been changed and existing sessions have been signed out. Sign in again with your new password.</p><Link href="/login?reset=success" className="mt-6 flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">Continue to sign in</Link></>}
        </section>
        <p className="mt-5 text-center text-sm text-ink-500"><Link href="/login" className="font-semibold text-brand-700 hover:text-brand-900">Back to sign in</Link></p>
      </div>
    </main>
  );
}
