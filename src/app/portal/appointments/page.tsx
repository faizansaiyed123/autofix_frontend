"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Field, FormError, Input, Select, Textarea, useForm } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { portalApi } from "@/lib/api/portal";
import type { PortalAppointment, PortalVehicle } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { formatDateTime, toApiDateTime } from "@/lib/format";

/**
 * The customer's diary.
 *
 * Booking goes through the shop's own service, so a slot that clashes with work
 * already in a bay is refused here exactly as it would be at the counter. The
 * customer picks the time they want; who takes the job is the shop's business,
 * so there is no technician or bay control anywhere on this page.
 */
export default function PortalAppointmentsPage() {
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [booking, setBooking] = useState(false);

  const appointments = useApiQuery(
    () => portalApi.appointments({ upcoming_only: upcomingOnly }),
    [upcomingOnly],
  );
  const vehicles = useApiQuery(() => portalApi.vehicles());

  const columns: Column<PortalAppointment>[] = [
    {
      key: "when",
      header: "When",
      render: (a) => (
        <div>
          <p className="font-medium text-ink-800">{formatDateTime(a.scheduled_start)}</p>
          {a.scheduled_end ? (
            <p className="text-xs text-ink-500">until {formatDateTime(a.scheduled_end)}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "service",
      header: "Work",
      render: (a) => (
        <div>
          <p className="text-ink-800">{a.service_type}</p>
          <p className="text-xs text-ink-500">{a.vehicle_label}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (a) => (
        <span
          title={a.status_view.detail}
          className="inline-flex items-center rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-700"
        >
          {a.status_view.label}
        </span>
      ),
    },
    {
      key: "detail",
      header: "",
      render: (a) =>
        a.status_view.detail ? (
          <span className="text-xs text-ink-500">{a.status_view.detail}</span>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle="What the shop has booked for you."
        actions={
          <div className="flex gap-2">
            <Select
              value={upcomingOnly ? "upcoming" : "all"}
              onChange={(event) => setUpcomingOnly(event.target.value === "upcoming")}
              className="w-36"
            >
              <option value="all">All</option>
              <option value="upcoming">Upcoming only</option>
            </Select>
            <Button variant="primary" onClick={() => setBooking(true)}>
              Ask for a slot
            </Button>
          </div>
        }
      />

      <Card padded={false}>
        {appointments.loading && appointments.initial ? (
          <Loading />
        ) : appointments.error ? (
          <div className="p-4">
            <ErrorState error={appointments.error} onRetry={appointments.refetch} />
          </div>
        ) : !appointments.data || appointments.data.length === 0 ? (
          <EmptyState
            title="Nothing booked yet"
            description="Ask for a slot and it goes straight into the shop's diary."
          />
        ) : (
          <DataTable
            rows={appointments.data}
            columns={columns}
            rowKey={(a) => a.id}
            empty={<EmptyState title="Nothing booked yet" />}
          />
        )}
      </Card>

      <BookModal
        open={booking}
        vehicles={vehicles.data ?? []}
        onClose={() => setBooking(false)}
        onBooked={() => {
          setBooking(false);
          appointments.refetch();
        }}
      />
    </>
  );
}

function BookModal({
  open,
  vehicles,
  onClose,
  onBooked,
}: {
  open: boolean;
  vehicles: PortalVehicle[];
  onClose: () => void;
  onBooked: () => void;
}) {
  const form = useForm({
    vehicle_id: "",
    service_type: "",
    scheduled_start: "",
    duration_minutes: "60",
    customer_concern: "",
  });
  const book = useApiMutation(() =>
    portalApi.bookAppointment({
      vehicle_id: form.values.vehicle_id,
      service_type: form.values.service_type || undefined,
      scheduled_start: toApiDateTime(new Date(form.values.scheduled_start)),
      duration_minutes: Number(form.values.duration_minutes) || 60,
      customer_concern: form.values.customer_concern || null,
    }),
  );

  async function submit() {
    const missing = form.missing(["vehicle_id", "scheduled_start"]);
    if (missing.length > 0) return;
    const booked = await book.run();
    if (booked) {
      form.reset();
      onBooked();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ask for a slot"
      description="The shop confirms it. If the time clashes with work already booked, it will be refused here rather than later."
      footer={
        <>
          <Button onClick={onClose} disabled={book.pending}>
            Cancel
          </Button>
          <Button variant="primary" pending={book.pending} onClick={() => void submit()}>
            Request this slot
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="space-y-3"
      >
        <FormError error={book.error} />
        <Field label="Which car" required>
          <Select
            value={form.values.vehicle_id}
            onChange={(event) => form.set("vehicle_id", event.target.value)}
          >
            <option value="">Choose a vehicle…</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}
                {vehicle.license_plate ? ` (${vehicle.license_plate})` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="What is it for" hint="Leave blank and the shop will ask you what it is.">
          <Input
            value={form.values.service_type}
            onChange={(event) => form.set("service_type", event.target.value)}
            placeholder="Brake noise, service, warning light…"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Preferred time" required>
            <Input
              type="datetime-local"
              value={form.values.scheduled_start}
              onChange={(event) => form.set("scheduled_start", event.target.value)}
            />
          </Field>
          <Field label="How long" hint="Roughly — the shop can change it.">
            <Select
              value={form.values.duration_minutes}
              onChange={(event) => form.set("duration_minutes", event.target.value)}
            >
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
              <option value="120">2 hours</option>
              <option value="180">Half a day</option>
            </Select>
          </Field>
        </div>
        <Field label="Anything we should know">
          <Textarea
            rows={3}
            value={form.values.customer_concern}
            onChange={(event) => form.set("customer_concern", event.target.value)}
          />
        </Field>
        <Notice tone="info">
          You choose the time; the shop chooses who does the work.
        </Notice>
      </form>
    </Modal>
  );
}