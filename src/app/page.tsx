import Link from "next/link";

import { COMPANY_NAME } from "@/lib/config";

function WorkshopMark({ small = false }: { small?: boolean }) {
  return (
    <span
      className={
        "flex shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white " +
        (small ? "size-8 rounded-lg" : "size-10")
      }
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={small ? "size-4" : "size-5"}
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

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="size-4"
    >
      <path
        d="M4.5 15.5 15 5M6 5h9v9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const capabilities = [
  {
    title: "Customers and vehicles",
    description:
      "Keep customer details, vehicle records and service history together, instead of piecing them together for every visit.",
  },
  {
    title: "Bookings and inspections",
    description:
      "Work from the diary and check-in through inspection findings, notes and evidence.",
  },
  {
    title: "Estimates and repair work",
    description:
      "Turn approved work into repair orders, assign tasks and technicians, and follow progress through quality control.",
  },
  {
    title: "Parts and payments",
    description:
      "Connect stock, suppliers and purchase orders with the estimates, invoices and payments for each job.",
  },
];

const serviceSteps = [
  {
    stage: "Front desk",
    title: "Request and book",
    description:
      "A customer asks for service. The workshop reviews the request and arranges the appointment.",
  },
  {
    stage: "Assessment",
    title: "Check and estimate",
    description:
      "Record the vehicle's arrival, inspect the work and send an estimate for the customer to review.",
  },
  {
    stage: "Service bay",
    title: "Repair and verify",
    description:
      "Move agreed work into a repair order, track tasks and parts, then record the quality-control decision.",
  },
  {
    stage: "Accounts",
    title: "Invoice and close",
    description:
      "Issue the invoice, record payment and keep the service record with the customer's vehicle.",
  },
];

const customerTools = [
  "Their registered vehicles",
  "Service requests and appointments",
  "Estimate decisions, including individual lines",
  "Invoices, balances and payment status",
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-ink-900">
      <header className="border-b border-white/10 bg-ink-950 text-white">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-2 px-3 py-4 sm:gap-5 sm:px-8 sm:py-5 lg:px-12">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 sm:gap-3"
            aria-label={COMPANY_NAME + " home"}
          >
            <WorkshopMark />
            <span>
              <span className="block text-[13px] font-semibold tracking-[-0.02em] sm:text-[15px]">
                {COMPANY_NAME}
              </span>
              <span className="mt-0.5 hidden text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-400 sm:block">
                Workshop operations
              </span>
            </span>
          </Link>

          <nav
            className="hidden items-center gap-8 text-[13px] font-medium text-ink-300 md:flex"
            aria-label="Main navigation"
          >
            <a href="#platform" className="transition-colors hover:text-white">
              Platform
            </a>
            <a href="#workflow" className="transition-colors hover:text-white">
              How it works
            </a>
            <a href="#customers" className="transition-colors hover:text-white">
              Customer portal
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/login"
              className="px-1 py-2 text-[12px] font-semibold text-ink-200 transition-colors hover:text-white sm:px-3 sm:text-[13px]"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex min-h-9 items-center gap-1.5 bg-brand-500 px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-brand-400 sm:min-h-10 sm:gap-2 sm:px-4 sm:text-[13px]"
            >
              Create account <ArrowIcon />
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-ink-800 bg-ink-950 text-white">
        <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-16 sm:px-8 sm:pb-20 sm:pt-20 lg:px-12 lg:pb-24 lg:pt-24">
          <div className="max-w-[900px]">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-300 sm:text-[11px]">
              Workshop management
            </p>
            <h1 className="mt-6 font-serif text-[2.8rem] leading-[0.98] tracking-[-0.06em] text-white sm:text-[4.3rem] lg:text-[6.1rem]">
              Run the workshop.
              <span className="mt-2 block text-brand-300">
                Keep every job moving.
              </span>
            </h1>
            <p className="mt-7 max-w-[640px] text-[15px] leading-7 text-ink-300 sm:text-[17px] sm:leading-8">
              {COMPANY_NAME} connects the front desk and the service bay.
              Manage customer requests, appointments, inspections, estimates,
              repair orders, parts, invoices and payments around the same
              service record.
            </p>
            <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-7">
              <Link
                href="/register"
                className="inline-flex min-h-12 items-center gap-3 bg-brand-500 px-5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-400"
              >
                Create a customer account <ArrowIcon />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 border-b border-white/20 pb-1 text-[13px] font-semibold text-ink-200 transition-colors hover:border-white hover:text-white"
              >
                Sign in to AutoFix
              </Link>
            </div>
            <p className="mt-7 max-w-[520px] text-[11px] leading-5 text-ink-400">
              One place for workshop teams to manage the job, and for customers
              to follow their own vehicles and service.
            </p>
          </div>


        </div>
      </section>

      <section
        id="platform"
        className="scroll-mt-8 border-b border-ink-200 bg-white"
      >
        <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end lg:gap-16">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-700 sm:text-[11px]">
                The workshop, connected
              </p>
              <h2 className="mt-4 max-w-md font-serif text-4xl leading-[1.02] tracking-[-0.05em] sm:text-5xl">
                The details belong together.
              </h2>
            </div>
            <p className="max-w-[650px] text-[14px] leading-7 text-ink-500 sm:text-[15px] sm:leading-8">
              A service visit touches more than one desk. AutoFix keeps the
              customer, vehicle, work, parts and money connected as the job
              moves through the garage.
            </p>
          </div>

          <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
            {capabilities.map((item) => (
              <article key={item.title} className="border-t border-ink-200 pt-5">
                <h3 className="mt-5 font-serif text-[1.55rem] leading-tight tracking-[-0.03em]">
                  {item.title}
                </h3>
                <p className="mt-3 text-[13px] leading-6 text-ink-500">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="scroll-mt-8 border-b border-ink-200 bg-brand-50">
        <div className="mx-auto grid max-w-[1320px] gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20 lg:px-12 lg:py-24">
          <div className="max-w-md">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-700 sm:text-[11px]">
              How the work moves
            </p>
            <h2 className="mt-4 font-serif text-4xl leading-[1.02] tracking-[-0.05em] sm:text-5xl">
              A clear hand-off at every stage.
            </h2>
            <p className="mt-5 text-[14px] leading-7 text-ink-500 sm:text-[15px] sm:leading-8">
              From the first request to the final payment, each part of the
              service visit has a place in the record. Staff can see what has
              happened and what needs attention next.
            </p>
            <Link
              href="/login"
              className="mt-7 inline-flex items-center gap-2 border-b border-ink-400 pb-1 text-[13px] font-semibold text-ink-900 transition-colors hover:border-brand-400 hover:text-white"
            >
              Sign in to your workspace <ArrowIcon />
            </Link>
          </div>

          <ol className="border-t border-ink-200">
            {serviceSteps.map((step) => (
              <li
                key={step.stage}
                className="grid gap-2 border-b border-ink-200 py-5 sm:grid-cols-[110px_0.75fr_1.25fr] sm:gap-5 sm:py-6"
              >
                <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-brand-700 sm:pt-1">
                  {step.stage}
                </span>
                <h3 className="font-serif text-[1.35rem] leading-tight tracking-[-0.025em] text-ink-900">
                  {step.title}
                </h3>
                <p className="max-w-[440px] text-[13px] leading-6 text-ink-500">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="customers"
        className="scroll-mt-8 border-b border-ink-200 bg-ink-50"
      >
        <div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:gap-20 lg:px-12 lg:py-24">
          <div className="max-w-[650px]">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-700 sm:text-[11px]">
              For your customers
            </p>
            <h2 className="mt-4 font-serif text-4xl leading-[1.02] tracking-[-0.05em] sm:text-5xl">
              Keep customers informed without bringing them into the workshop.
            </h2>
            <p className="mt-5 text-[14px] leading-7 text-ink-500 sm:text-[15px] sm:leading-8">
              Each customer has access to their own account. They can follow
              service, review proposed work and see what is due, while
              workshop-only records stay in the staff workspace.
            </p>
            <Link
              href="/register"
              className="mt-7 inline-flex min-h-11 items-center gap-3 bg-brand-500 px-5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-400"
            >
              Create a customer account <ArrowIcon />
            </Link>
          </div>

          <div>
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-400">
              Customer account access
            </p>
            <ul className="border-t border-ink-200">
              {customerTools.map((tool) => (
                <li
                  key={tool}
                  className="grid grid-cols-[12px_1fr] items-center gap-3 border-b border-ink-200 py-4"
                >
                  <span className="size-1.5 bg-brand-500" aria-hidden="true" />
                  <span className="text-[13px] font-medium text-ink-800 sm:text-sm">
                    {tool}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-ink-950 text-white">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-7 px-5 py-14 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12 lg:py-16">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-200">
              {COMPANY_NAME}
            </p>
            <h2 className="mt-3 font-serif text-3xl leading-tight tracking-[-0.04em] sm:text-4xl">
              Spend less time chasing the job. More time getting it done.
            </h2>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Link
              href="/login"
              className="border-b border-white/20 pb-1 text-[13px] font-semibold text-ink-200 transition-colors hover:border-white hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex min-h-11 items-center gap-3 bg-brand-500 px-5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-400"
            >
              Create account <ArrowIcon />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-100 bg-white text-ink-900">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-4 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <div className="flex items-center gap-3">
            <WorkshopMark small />
            <span className="text-[13px] font-semibold">{COMPANY_NAME}</span>
            <span className="text-[11px] text-ink-500">
              Workshop operations
            </span>
          </div>
          <div className="flex gap-6 text-[12px] text-ink-500">
            <Link href="/login" className="transition-colors hover:text-white">
              Sign in
            </Link>
            <Link href="/register" className="transition-colors hover:text-white">
              Create account
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
