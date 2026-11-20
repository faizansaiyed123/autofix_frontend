import Link from "next/link";

import { COMPANY_NAME } from "@/lib/config";

function WorkshopMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="size-7 text-[#a65336]"
    >
      <path
        d="M14.2 6.1a5 5 0 0 0-6.1 6.1L3.7 16.6a2.3 2.3 0 1 0 3.3 3.3l4.4-4.4a5 5 0 0 0 6.1-6.1l-3 3-3.1-3.1 2.8-3.2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
    number: "01",
    title: "Customers and vehicles",
    description:
      "Keep customer details, vehicle records and service history together, instead of piecing them together for every visit.",
  },
  {
    number: "02",
    title: "Bookings and inspections",
    description:
      "Work from the diary and check-in through inspection findings, notes and evidence.",
  },
  {
    number: "03",
    title: "Estimates and repair work",
    description:
      "Turn approved work into repair orders, assign tasks and technicians, and follow progress through quality control.",
  },
  {
    number: "04",
    title: "Parts and payments",
    description:
      "Connect stock, suppliers and purchase orders with the estimates, invoices and payments for each job.",
  },
];

const serviceSteps = [
  {
    number: "01",
    title: "Request and book",
    description:
      "A customer asks for service. The workshop reviews the request and arranges the appointment.",
  },
  {
    number: "02",
    title: "Check and estimate",
    description:
      "Record the vehicle's arrival, inspect the work and send an estimate for the customer to review.",
  },
  {
    number: "03",
    title: "Repair and verify",
    description:
      "Move agreed work into a repair order, track tasks and parts, then record the quality-control decision.",
  },
  {
    number: "04",
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
    <main className="min-h-screen bg-[#f4f1e9] text-[#252923]">
      <header className="border-b border-[#d8d2c6]">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-5 px-5 py-5 sm:px-8 lg:px-12">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-3"
            aria-label={COMPANY_NAME + " home"}
          >
            <WorkshopMark />
            <span>
              <span className="block text-[15px] font-semibold tracking-[-0.02em]">
                {COMPANY_NAME}
              </span>
              <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.2em] text-[#77796f]">
                Workshop operations
              </span>
            </span>
          </Link>

          <nav
            className="hidden items-center gap-8 text-[13px] font-medium text-[#5d6259] md:flex"
            aria-label="Main navigation"
          >
            <a href="#platform" className="transition-colors hover:text-[#a65336]">
              Platform
            </a>
            <a href="#workflow" className="transition-colors hover:text-[#a65336]">
              How it works
            </a>
            <a href="#customers" className="transition-colors hover:text-[#a65336]">
              Customer portal
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/login"
              className="px-2 py-2 text-[13px] font-semibold text-[#444a42] transition-colors hover:text-[#a65336] sm:px-3"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex min-h-10 items-center gap-2 bg-[#a65336] px-3.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#87452f] sm:px-4 sm:text-[13px]"
            >
              Create account <ArrowIcon />
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-[#d8d2c6]">
        <div className="mx-auto grid max-w-[1320px] gap-12 px-5 pb-16 pt-16 sm:px-8 sm:pb-20 sm:pt-20 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:gap-20 lg:px-12 lg:pb-24 lg:pt-24">
          <div className="max-w-[760px]">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#a65336] sm:text-[11px]">
              Workshop management
            </p>
            <h1 className="mt-6 font-serif text-[clamp(3.2rem,6.7vw,6.1rem)] leading-[0.98] tracking-[-0.06em] text-[#242821]">
              Run the workshop.
              <span className="mt-2 block text-[#a65336]">
                Keep every job moving.
              </span>
            </h1>
            <p className="mt-7 max-w-[640px] text-[15px] leading-7 text-[#60665d] sm:text-[17px] sm:leading-8">
              {COMPANY_NAME} connects the front desk and the service bay.
              Manage customer requests, appointments, inspections, estimates,
              repair orders, parts, invoices and payments around the same
              service record.
            </p>
            <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-7">
              <Link
                href="/register"
                className="inline-flex min-h-12 items-center gap-3 bg-[#a65336] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#87452f]"
              >
                Create a customer account <ArrowIcon />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 border-b border-[#a9a397] pb-1 text-[13px] font-semibold text-[#343a33] transition-colors hover:border-[#a65336] hover:text-[#a65336]"
              >
                Sign in to AutoFix
              </Link>
            </div>
            <p className="mt-7 max-w-[520px] text-[11px] leading-5 text-[#77796f]">
              One place for workshop teams to manage the job, and for customers
              to follow their own vehicles and service.
            </p>
          </div>

          <aside
            aria-label="Service workflow"
            className="border-l border-[#cfc8ba] pl-6 sm:pl-8 lg:ml-1 lg:pl-10"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#77796f]">
              From first request to collection
            </p>
            <h2 className="mt-4 max-w-sm font-serif text-[2rem] leading-tight tracking-[-0.04em] text-[#30362e] sm:text-[2.35rem]">
              The whole visit, not just the repair.
            </h2>
            <ol className="mt-8">
              {[
                "Customer request",
                "Appointment and check-in",
                "Inspection and estimate",
                "Repair and quality control",
                "Invoice and payment",
              ].map((step, index) => (
                <li
                  key={step}
                  className="grid grid-cols-[38px_1fr] items-center border-t border-[#d8d2c6] py-3.5 last:border-b"
                >
                  <span className="font-mono text-[10px] text-[#a65336]">
                    0{index + 1}
                  </span>
                  <span className="text-[13px] font-medium text-[#444a42] sm:text-sm">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </section>

      <section
        id="platform"
        className="scroll-mt-8 border-b border-[#d8d2c6] bg-[#ebe7dc]"
      >
        <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end lg:gap-16">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#a65336] sm:text-[11px]">
                The workshop, connected
              </p>
              <h2 className="mt-4 max-w-md font-serif text-4xl leading-[1.02] tracking-[-0.05em] sm:text-5xl">
                The details belong together.
              </h2>
            </div>
            <p className="max-w-[650px] text-[14px] leading-7 text-[#62675e] sm:text-[15px] sm:leading-8">
              A service visit touches more than one desk. AutoFix keeps the
              customer, vehicle, work, parts and money connected as the job
              moves through the garage.
            </p>
          </div>

          <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
            {capabilities.map((item) => (
              <article key={item.number} className="border-t border-[#bdb6a9] pt-5">
                <span className="font-mono text-[10px] text-[#a65336]">
                  {item.number}
                </span>
                <h3 className="mt-5 font-serif text-[1.55rem] leading-tight tracking-[-0.03em]">
                  {item.title}
                </h3>
                <p className="mt-3 text-[13px] leading-6 text-[#666b62]">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="scroll-mt-8 border-b border-[#d8d2c6]">
        <div className="mx-auto grid max-w-[1320px] gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20 lg:px-12 lg:py-24">
          <div className="max-w-md">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#a65336] sm:text-[11px]">
              How the work moves
            </p>
            <h2 className="mt-4 font-serif text-4xl leading-[1.02] tracking-[-0.05em] sm:text-5xl">
              A clear hand-off at every stage.
            </h2>
            <p className="mt-5 text-[14px] leading-7 text-[#62675e] sm:text-[15px] sm:leading-8">
              From the first request to the final payment, each part of the
              service visit has a place in the record. Staff can see what has
              happened and what needs attention next.
            </p>
            <Link
              href="/login"
              className="mt-7 inline-flex items-center gap-2 border-b border-[#a9a397] pb-1 text-[13px] font-semibold text-[#343a33] transition-colors hover:border-[#a65336] hover:text-[#a65336]"
            >
              Sign in to your workspace <ArrowIcon />
            </Link>
          </div>

          <ol className="border-t border-[#bdb6a9]">
            {serviceSteps.map((step) => (
              <li
                key={step.number}
                className="grid gap-2 border-b border-[#d8d2c6] py-5 sm:grid-cols-[54px_0.75fr_1.25fr] sm:gap-5 sm:py-6"
              >
                <span className="font-mono text-[11px] text-[#a65336]">
                  {step.number}
                </span>
                <h3 className="font-serif text-[1.35rem] leading-tight tracking-[-0.025em] text-[#30362e]">
                  {step.title}
                </h3>
                <p className="max-w-[440px] text-[13px] leading-6 text-[#666b62]">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="customers"
        className="scroll-mt-8 border-b border-[#d8d2c6] bg-[#ebe7dc]"
      >
        <div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:gap-20 lg:px-12 lg:py-24">
          <div className="max-w-[650px]">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#a65336] sm:text-[11px]">
              For your customers
            </p>
            <h2 className="mt-4 font-serif text-4xl leading-[1.02] tracking-[-0.05em] sm:text-5xl">
              Keep customers informed without bringing them into the workshop.
            </h2>
            <p className="mt-5 text-[14px] leading-7 text-[#62675e] sm:text-[15px] sm:leading-8">
              Each customer has access to their own account. They can follow
              service, review proposed work and see what is due, while
              workshop-only records stay in the staff workspace.
            </p>
            <Link
              href="/register"
              className="mt-7 inline-flex min-h-11 items-center gap-3 bg-[#a65336] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#87452f]"
            >
              Create a customer account <ArrowIcon />
            </Link>
          </div>

          <div>
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#77796f]">
              Customer account access
            </p>
            <ul className="border-t border-[#bdb6a9]">
              {customerTools.map((tool, index) => (
                <li
                  key={tool}
                  className="grid grid-cols-[36px_1fr] items-center gap-3 border-b border-[#d0c9bc] py-4"
                >
                  <span className="font-mono text-[10px] text-[#a65336]">
                    0{index + 1}
                  </span>
                  <span className="text-[13px] font-medium text-[#444a42] sm:text-sm">
                    {tool}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-b border-[#d8d2c6]">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-7 px-5 py-14 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12 lg:py-16">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#a65336]">
              AutoFix Garage
            </p>
            <h2 className="mt-3 font-serif text-3xl leading-tight tracking-[-0.04em] sm:text-4xl">
              Spend less time chasing the job. More time getting it done.
            </h2>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Link
              href="/login"
              className="border-b border-[#a9a397] pb-1 text-[13px] font-semibold text-[#343a33] transition-colors hover:border-[#a65336] hover:text-[#a65336]"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex min-h-11 items-center gap-3 bg-[#a65336] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#87452f]"
            >
              Create account <ArrowIcon />
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-[#262d27] text-[#e9e5da]">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-4 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <div className="flex items-center gap-3">
            <WorkshopMark />
            <span className="text-[13px] font-semibold">{COMPANY_NAME}</span>
            <span className="text-[11px] text-[#a8ada3]">
              Workshop operations
            </span>
          </div>
          <div className="flex gap-6 text-[12px] text-[#c2c5bb]">
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
