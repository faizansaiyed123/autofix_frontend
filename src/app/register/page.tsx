"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, FormError, Input } from "@/components/ui/Form";
import { ApiError } from "@/lib/api/client";
import { authApi } from "@/lib/api/auth";
import { COMPANY_NAME } from "@/lib/config";

export default function RegisterPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [resendError, setResendError] = useState<ApiError | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage("");
    if (password !== confirmPassword) {
      setError(new ApiError(422, "Passwords do not match.", "Passwords do not match."));
      return;
    }
    setPending(true);
    try {
      const result = await authApi.register({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        password,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
      setMessage(result.message);
      setSent(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, caught, "Could not create your account."));
    } finally {
      setPending(false);
    }
  }

  async function resendEmail() {
    setResendPending(true);
    setResendError(null);
    try {
      const result = await authApi.resendVerification(email.trim());
      setMessage(result.message);
    } catch (caught) {
      setResendError(caught instanceof ApiError ? caught : new ApiError(0, caught, "Could not request another email."));
    } finally {
      setResendPending(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[#f5f7fb] lg:grid-cols-[0.9fr_1.1fr]">
      <section className="relative hidden min-h-full overflow-hidden bg-ink-950 px-10 py-10 text-white lg:flex lg:flex-col xl:px-14">
        <div className="absolute -right-40 top-16 size-[28rem] rounded-full bg-brand-500/20 blur-[100px]" />
        <div className="absolute -bottom-40 -left-32 size-[25rem] rounded-full bg-sky-400/10 blur-[100px]" />
        <Link href="/" className="relative flex w-fit items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-brand-500 text-white shadow-lg shadow-brand-500/20"><svg className="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14.2 6.1a5 5 0 0 0-6.1 6.1L3.7 16.6a2.3 2.3 0 1 0 3.3 3.3l4.4-4.4a5 5 0 0 0 6.1-6.1l-3 3-3.1-3.1 2.8-3.2Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          <span><span className="block text-sm font-semibold">{COMPANY_NAME}</span><span className="mt-1 block text-[9px] uppercase tracking-[0.22em] text-ink-400">Workshop operations</span></span>
        </Link>
        <div className="relative my-auto max-w-lg py-16">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-200">Your vehicle, in view</p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.04em] xl:text-5xl">Keep every service detail close.</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-ink-300">Create a customer account to keep track of service requests, estimates, invoices and your vehicle information in one place.</p>
          <div className="mt-9 space-y-4">
            {["Review estimates when they're ready", "Follow service requests you send the workshop", "See invoices and payment status", "Access only your own customer information"].map((item) => <div key={item} className="flex items-center gap-3 text-sm text-ink-200"><span className="flex size-6 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300">✓</span>{item}</div>)}
          </div>
          <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs font-semibold text-white">Private customer access</p><p className="mt-2 text-sm leading-6 text-ink-400">Your account is separated from workshop staff screens. Confirm your email to activate access.</p></div>
        </div>
        <p className="relative text-xs text-ink-500">Secure signup with email confirmation.</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[480px]">
          <div className="mb-7 flex items-center gap-3 lg:hidden"><span className="flex size-10 items-center justify-center rounded-xl bg-brand-500 text-white">⚒</span><div><p className="text-sm font-semibold">{COMPANY_NAME}</p><p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink-500">Workshop operations</p></div></div>
          {!sent ? (
            <>
              <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">Create your account</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-ink-950">Start with AutoFix</h2><p className="mt-2 text-sm leading-6 text-ink-500">Add your details below. We'll send a verification link to your email.</p></div>
              <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-ink-200/80 bg-white p-5 shadow-xl shadow-ink-900/5 sm:p-7">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="First name" required><Input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" required minLength={1} maxLength={100} className="min-h-11 rounded-xl px-3.5" placeholder="First name" /></Field>
                  <Field label="Last name" required><Input value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" required minLength={1} maxLength={100} className="min-h-11 rounded-xl px-3.5" placeholder="Last name" /></Field>
                </div>
                <Field label="Email address" required hint="Use an email address you can open right now."><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required maxLength={255} className="min-h-11 rounded-xl px-3.5" placeholder="you@example.com" /></Field>
                <Field label="Phone number" hint="Optional"><Input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" maxLength={30} className="min-h-11 rounded-xl px-3.5" placeholder="+1 555 0100" /></Field>
                <Field label="Password" required hint="At least 8 characters. Use a unique password."><Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required minLength={8} maxLength={72} className="min-h-11 rounded-xl px-3.5" /></Field>
                <Field label="Confirm password" required><Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required minLength={8} maxLength={72} className="min-h-11 rounded-xl px-3.5" /></Field>
                <FormError error={error} />
                <Button type="submit" variant="primary" pending={pending} className="min-h-12 w-full rounded-xl text-sm">Create account</Button>
                <p className="text-center text-[11px] leading-5 text-ink-500">We will never ask you to choose a staff role during public signup.</p>
              </form>
            </>
          ) : (
            <div className="rounded-2xl border border-ink-200/80 bg-white p-6 shadow-xl shadow-ink-900/5 sm:p-8">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><svg className="size-6" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">Check your inbox</h2>
              <p className="mt-3 text-sm leading-6 text-ink-500">If this email can be registered, a verification message will be sent to <strong className="break-all font-semibold text-ink-800">{email.trim()}</strong>. Open the link in that message to verify your address and activate your account.</p>
              <div className="mt-5 rounded-xl border border-brand-100 bg-brand-50/70 p-4 text-xs leading-5 text-ink-600">The verification link expires after 24 hours. Check your spam folder if you don't see it.</div>
              {message ? <p className="mt-4 text-xs leading-5 text-ink-500">{message}</p> : null}
              <div className="mt-5"><Button type="button" variant="secondary" pending={resendPending} onClick={resendEmail} className="min-h-11 w-full rounded-xl">Resend verification email</Button><FormError error={resendError} /></div>
              <button type="button" onClick={() => { setSent(false); setError(null); }} className="mt-4 w-full text-center text-xs font-semibold text-brand-700 hover:text-brand-900">Use a different email</button>
            </div>
          )}
          <p className="mt-5 text-center text-sm text-ink-500">Already have an account? <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-900">Sign in</Link></p>
          <p className="mt-3 text-center text-xs text-ink-400"><Link href="/" className="hover:text-ink-700">Back to home</Link></p>
        </div>
      </section>
    </main>
  );
}
