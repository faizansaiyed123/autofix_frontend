import Link from "next/link";

import { COMPANY_NAME } from "@/lib/config";

function ArrowIcon({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.5 15.5 15 5M6 5h9v9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function CheckIcon() {
  return <svg className="mt-0.5 size-4 shrink-0 text-emerald-600" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 10.2 3.2 3.1L15.5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const capabilities = [
  { number: "01", title: "Know what needs attention", description: "Bring bookings, check-ins, estimates and open jobs into one clear daily view.", icon: "◷" },
  { number: "02", title: "Keep every repair moving", description: "Follow repair orders, inspections, parts and quality checks through the workshop.", icon: "↗" },
  { number: "03", title: "Track the money clearly", description: "Connect estimates, invoices and payments so each job is easier to understand.", icon: "$" },
  { number: "04", title: "Keep customers informed", description: "Give customers their own place to review vehicles, requests, estimates and invoices.", icon: "◎" },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-ink-900">
      <header className="relative z-10 border-b border-white/10 bg-ink-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-12">
          <Link href="/" className="group flex items-center gap-3" aria-label={COMPANY_NAME + " home"}>
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-500 shadow-lg shadow-brand-500/25 transition-transform group-hover:-rotate-3">
              <svg className="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14.2 6.1a5 5 0 0 0-6.1 6.1L3.7 16.6a2.3 2.3 0 1 0 3.3 3.3l4.4-4.4a5 5 0 0 0 6.1-6.1l-3 3-3.1-3.1 2.8-3.2Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <span className="leading-tight"><span className="block text-[15px] font-semibold tracking-tight">{COMPANY_NAME}</span><span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.22em] text-ink-400">Workshop operations</span></span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-ink-300 md:flex" aria-label="Main navigation">
            <a href="#platform" className="transition-colors hover:text-white">Platform</a>
            <a href="#workflow" className="transition-colors hover:text-white">How it works</a>
            <a href="#customers" className="transition-colors hover:text-white">Customer portal</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="rounded-xl px-3 py-2.5 text-sm font-medium text-ink-200 transition-colors hover:bg-white/10 hover:text-white sm:px-4">Sign in</Link>
            <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition-all hover:-translate-y-0.5 hover:bg-brand-400 sm:px-4">Create account <ArrowIcon className="size-4" /></Link>
          </div>
        </div>
      </header>

      <section className="relative isolate bg-ink-950 text-white">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -right-40 -top-56 size-[34rem] rounded-full bg-brand-500/20 blur-[110px]" />
          <div className="absolute left-[38%] top-40 size-64 rounded-full bg-cyan-400/10 blur-[90px]" />
          <div className="absolute inset-0 opacity-[0.09]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />
        </div>
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-16 sm:px-8 sm:pb-24 sm:pt-20 lg:grid-cols-[0.94fr_1.06fr] lg:gap-12 lg:px-12 lg:pb-28 lg:pt-24">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-300/20 bg-brand-400/10 px-3.5 py-2 text-xs font-medium tracking-wide text-brand-100"><span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" />One connected view of your workshop</div>
            <h1 className="mt-7 text-4xl font-semibold leading-[1.08] tracking-[-0.045em] sm:text-5xl lg:text-[3.8rem]">Run the workshop.<span className="mt-2 block bg-gradient-to-r from-brand-300 via-sky-200 to-white bg-clip-text text-transparent">Not the paperwork.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-ink-300 sm:text-lg sm:leading-8">{COMPANY_NAME} brings service requests, repair orders, estimates, stock and payments into one practical workspace—so the team can focus on the next job, not the next spreadsheet.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white shadow-xl shadow-brand-500/20 transition-all hover:-translate-y-0.5 hover:bg-brand-400">Create a customer account <ArrowIcon className="size-4" /></Link>
              <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10">Sign in to your workspace</Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-400"><span className="inline-flex items-center gap-2"><CheckIcon />Workshop workflows</span><span className="inline-flex items-center gap-2"><CheckIcon />Customer self-service</span><span className="inline-flex items-center gap-2"><CheckIcon />Role-based access</span></div>
          </div>

          <div className="relative mx-auto w-full max-w-[620px] lg:ml-auto">
            <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-brand-400/15 via-transparent to-cyan-300/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#f8fafc] text-ink-900 shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between border-b border-ink-200/70 bg-white px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-lg bg-ink-950 text-white"><svg className="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 18V6m0 12h16M8 14l3-4 3 2 4-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span><div><p className="text-xs font-semibold sm:text-sm">Workshop overview</p><p className="text-[10px] text-ink-500">Example workspace preview</p></div></div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700">Today's view</span>
              </div>
              <div className="grid grid-cols-[64px_1fr] sm:grid-cols-[78px_1fr]">
                <aside className="flex min-h-[350px] flex-col items-center gap-4 border-r border-ink-200/70 bg-[#f1f5f9] py-5 sm:min-h-[400px]">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-md shadow-brand-600/20">⌂</span>
                  {["▦", "◷", "◇", "▤", "⚙"].map((item, i) => <span key={item} className={"flex size-8 items-center justify-center rounded-lg text-sm " + (i === 1 ? "bg-white text-brand-700 shadow-sm ring-1 ring-ink-200/70" : "text-ink-400")}>{item}</span>)}
                  <span className="mt-auto size-8 rounded-full bg-gradient-to-br from-amber-200 to-orange-400 ring-2 ring-white" />
                </aside>
                <div className="min-w-0 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-medium uppercase tracking-[0.15em] text-ink-500">Daily operations</p><h2 className="mt-1.5 text-lg font-semibold tracking-tight sm:text-xl">Good morning, team</h2></div><span className="rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-medium text-ink-600 ring-1 ring-ink-200">All work areas</span></div>
                  <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {[
                      ["Open jobs", "12", "Across the shop", "bg-brand-50 text-brand-700"],
                      ["Appointments", "08", "On the diary", "bg-violet-50 text-violet-700"],
                      ["Needs approval", "03", "Waiting on a decision", "bg-amber-50 text-amber-700"],
                      ["Low stock", "02", "Reorder to review", "bg-rose-50 text-rose-700"],
                    ].map(([label, value, helper, color]) => <div key={label} className="rounded-xl border border-ink-200/70 bg-white p-3 shadow-sm"><span className={"inline-flex size-6 items-center justify-center rounded-md text-[10px] " + color}>✦</span><p className="mt-3 text-xl font-semibold tracking-tight">{value}</p><p className="mt-0.5 text-[10px] font-semibold text-ink-700">{label}</p><p className="mt-1 hidden text-[9px] text-ink-400 sm:block">{helper}</p></div>)}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1.25fr_0.75fr]">
                    <div className="rounded-xl border border-ink-200/70 bg-white p-3.5 shadow-sm sm:p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold">Jobs in progress</p><span className="text-[10px] text-brand-700">View board ↗</span></div><div className="mt-4 space-y-3">
                      {[
                        ["Toyota Corolla", "Brake inspection", "In progress", "bg-brand-50 text-brand-700", "72%"],
                        ["Ford Transit", "Scheduled service", "Awaiting parts", "bg-amber-50 text-amber-700", "46%"],
                        ["Honda Civic", "Final quality check", "Review", "bg-emerald-50 text-emerald-700", "91%"],
                      ].map(([car, job, state, tone, progress]) => <div key={car} className="flex items-center gap-2.5"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs">🚘</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-1"><p className="truncate text-[10px] font-semibold sm:text-[11px]">{car}</p><span className={"rounded-md px-1.5 py-0.5 text-[9px] " + tone}>{state}</span></div><p className="mt-0.5 truncate text-[9px] text-ink-500">{job}</p><div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-brand-500" style={{ width: progress }} /></div></div></div>)}
                    </div></div>
                    <div className="rounded-xl border border-ink-200/70 bg-white p-3.5 shadow-sm sm:p-4"><p className="text-xs font-semibold">Next up</p><div className="mt-4 space-y-3">
                      {[["09:30", "Vehicle check-in", "Toyota · J. Parker"], ["10:15", "Estimate review", "Ford · M. Davis"], ["11:00", "Parts delivery", "Inventory"]].map(([time, title, meta]) => <div key={time} className="flex gap-2.5"><span className="pt-0.5 text-[9px] font-semibold text-brand-700">{time}</span><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-400" /><div><p className="text-[10px] font-semibold">{title}</p><p className="mt-0.5 text-[9px] text-ink-500">{meta}</p></div></div>)}
                    </div><div className="mt-4 rounded-lg bg-ink-950 p-3 text-white"><p className="text-[9px] uppercase tracking-wider text-ink-400">At a glance</p><p className="mt-1 text-xs font-semibold">One team. One workflow.</p><p className="mt-1 text-[9px] leading-4 text-ink-300">Keep handoffs clear from arrival to collection.</p></div></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-4 hidden rounded-xl border border-white/10 bg-ink-900/95 px-4 py-3 text-white shadow-xl backdrop-blur sm:block"><p className="text-[10px] text-ink-400">Built around the whole journey</p><p className="mt-1 text-xs font-semibold">Request → Repair → Invoice</p></div>
          </div>
        </div>
      </section>

      <section id="platform" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
        <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">Less chasing. More clarity.</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">The details of a garage, connected.</h2><p className="mt-4 max-w-xl text-base leading-7 text-ink-500">The important work already happens across the shop. AutoFix helps bring the records and handoffs together, from the front desk to the service bay and back to the customer.</p></div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map((item) => <article key={item.number} className="group rounded-2xl border border-ink-200/80 bg-white p-5 transition-all duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl hover:shadow-ink-900/5 sm:p-6"><div className="flex items-center justify-between"><span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-xl text-brand-700 transition-colors group-hover:bg-brand-600 group-hover:text-white">{item.icon}</span><span className="text-xs font-semibold tabular-nums text-ink-300">{item.number}</span></div><h3 className="mt-7 text-base font-semibold">{item.title}</h3><p className="mt-3 text-sm leading-6 text-ink-500">{item.description}</p></article>)}
        </div>
      </section>

      <section id="workflow" className="bg-[#f5f7fb]">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-2 lg:gap-20 lg:px-12 lg:py-24">
          <div className="relative overflow-hidden rounded-3xl bg-ink-950 p-6 text-white shadow-xl sm:p-8"><div className="absolute -right-12 -top-12 size-48 rounded-full bg-brand-500/20 blur-3xl" /><p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-brand-200">A connected workflow</p><div className="relative mt-8 space-y-0">
            {[["01", "Customer request", "Capture what needs attention."], ["02", "Workshop planning", "Turn the request into a clear next step."], ["03", "Repair and quality", "Follow the job, parts and checks."], ["04", "Estimate and invoice", "Keep decisions and payment status close."]].map(([n,title,description],i)=><div key={n} className="flex gap-4"><div className="flex flex-col items-center"><span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-brand-300/30 bg-brand-400/10 text-xs font-semibold text-brand-100">{n}</span>{i<3?<span className="my-1 h-10 w-px bg-gradient-to-b from-brand-300/50 to-white/10" />:null}</div><div className="pb-7"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-sm leading-5 text-ink-400">{description}</p></div></div>)}
          </div></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">From arrival to collection</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Make every handoff easier to follow.</h2><p className="mt-5 text-base leading-7 text-ink-500">A job rarely belongs to one person. AutoFix gives the front desk, technicians, parts staff and managers the views and permissions they need, while the backend enforces access to the records.</p><div className="mt-7 space-y-3">{["Role-based access for workshop teams", "A customer portal scoped to the customer's own account", "Operational history and audit records", "A clearer view of work, parts and payments"].map((line)=><div key={line} className="flex items-start gap-3 text-sm font-medium text-ink-700"><CheckIcon />{line}</div>)}</div><Link href="/login" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-900">Explore your workspace <ArrowIcon className="size-4" /></Link></div>
        </div>
      </section>

      <section id="customers" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
        <div className="grid gap-10 rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-sky-50 p-6 sm:p-9 lg:grid-cols-[1fr_0.75fr] lg:items-center lg:p-12">
          <div><span className="inline-flex rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-800">For your customers, too</span><h2 className="mt-5 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">A better view of the work done on their vehicle.</h2><p className="mt-4 max-w-xl text-base leading-7 text-ink-500">Customers can use their own account to follow requests, review estimates, see invoices and keep track of their vehicles—without access to workshop-only screens.</p><Link href="/register" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-ink-950 px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-ink-800">Create a customer account <ArrowIcon className="size-4" /></Link></div>
          <div className="rounded-2xl border border-white bg-white p-5 shadow-lg shadow-brand-900/5 sm:p-6"><div className="flex items-center justify-between border-b border-ink-100 pb-4"><div><p className="text-xs font-semibold">My vehicle</p><p className="mt-1 text-[11px] text-ink-400">Example customer view</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">Service history</span></div><div className="flex items-center gap-4 py-5"><span className="flex size-14 items-center justify-center rounded-2xl bg-ink-950 text-2xl text-white">🚙</span><div><p className="text-sm font-semibold">Vehicle account</p><p className="mt-1 text-xs text-ink-500">Requests, estimates and invoices in one place.</p></div></div><div className="space-y-2.5">
            {[["Service request", "Submitted to the workshop", "bg-brand-50 text-brand-700"], ["Estimate", "Review when it is ready", "bg-amber-50 text-amber-700"], ["Invoice", "See amount and payment status", "bg-emerald-50 text-emerald-700"]].map(([label,description,tone])=><div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 px-3.5 py-3"><div className="min-w-0"><p className="text-xs font-semibold">{label}</p><p className="mt-1 text-[11px] text-ink-500">{description}</p></div><span className={"shrink-0 rounded-lg px-2 py-1 text-[10px] font-medium " + tone}>View</span></div>)}
          </div></div>
        </div>
      </section>

      <section className="px-5 pb-16 sm:px-8 sm:pb-20 lg:px-12"><div className="mx-auto max-w-7xl overflow-hidden rounded-3xl bg-ink-950 px-6 py-10 text-center text-white sm:px-10 sm:py-14"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-200">Bring the workshop together</p><h2 className="mx-auto mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Keep the work moving, with fewer loose ends.</h2><p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-ink-300 sm:text-base">Sign in to your workspace or create a customer account to get started.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 px-5 text-sm font-semibold text-white hover:bg-white/10">Sign in</Link><Link href="/register" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white hover:bg-brand-400">Create account <ArrowIcon className="size-4" /></Link></div></div></section>

      <footer className="border-t border-ink-100 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12"><div className="flex items-center gap-2.5"><span className="flex size-8 items-center justify-center rounded-lg bg-ink-950 text-white">⚒</span><span>© {new Date().getFullYear()} {COMPANY_NAME}. Workshop operations, made clearer.</span></div><div className="flex gap-5"><Link href="/login" className="hover:text-ink-900">Sign in</Link><Link href="/register" className="hover:text-ink-900">Create account</Link></div></div></footer>
    </main>
  );
}
