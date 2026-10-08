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
import type { PortalServiceRequest, PortalVehicle } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { formatDateTime } from "@/lib/format";

/**
 * Requests the customer has sent.
 *
 * The write lands in the shop's own queue through the shop's own create path, so
 * a request filed here is indistinguishable from one taken over the phone — same
 * statuses, same priority, same person looking at it in the morning.
 */
export default function PortalServiceRequestsPage() {
  const [creating, setCreating] = useState(false);
  const requests = useApiQuery(() => portalApi.serviceRequests());

  const columns: Column<PortalServiceRequest>[] = [
    {
      key: "title",
      header: "Request",
      render: (r) => (
        <div>
          <p className="font-medium text-ink-800">{r.title}</p>
          {r.description ? (
            <p className="max-w-prose text-xs text-ink-500">{r.description}</p>
          ) : null}
        </div>
      ),
    },
    { key: "priority", header: "Priority", render: (r) => r.priority },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <span
          title={r.status_view.detail}
          className="inline-flex items-center rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-700"
        >
          {r.status_view.label}
        </span>
      ),
    },
    { key: "sent", header: "Sent", numeric: true, render: (r) => (
      <span className="text-xs text-ink-500">{formatDateTime(r.created_at)}</span>
    ) },
  ];

  return (
    <>
      <PageHeader
        title="Requests"
        subtitle="Tell us what the car is doing and we will come back to you."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            Ask for work
          </Button>
        }
      />

      <Card padded={false}>
        {requests.loading && requests.initial ? (
          <Loading />
        ) : requests.error ? (
          <div className="p-4">
            <ErrorState error={requests.error} onRetry={requests.refetch} />
          </div>
        ) : !requests.data || requests.data.length === 0 ? (
          <EmptyState
            title="Nothing sent yet"
            description="Describe what the car is doing and it appears in the shop's queue straight away."
          />
        ) : (
          <DataTable
            rows={requests.data}
            columns={columns}
            rowKey={(r) => r.id}
            empty={<EmptyState title="Nothing sent yet" />}
          />
        )}
      </Card>

      <NewRequestModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          requests.refetch();
        }}
      />
    </>
  );
}

function NewRequestModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const vehicles = useApiQuery(() => portalApi.vehicles(), [], { enabled: open });
  const form = useForm({
    title: "",
    description: "",
    priority: "MEDIUM",
    vehicle_id: "",
  });
  const create = useApiMutation(() =>
    portalApi.createServiceRequest({
      title: form.values.title,
      description: form.values.description || null,
      priority: form.values.priority,
      vehicle_id: form.values.vehicle_id || null,
    }),
  );

  async function submit() {
    if (form.missing(["title"]).length > 0) return;
    const created = await create.run();
    if (created) {
      form.reset();
      onCreated();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ask for work"
      description="This goes into the shop's own queue, where a service advisor will pick it up."
      footer={
        <>
          <Button onClick={onClose} disabled={create.pending}>
            Cancel
          </Button>
          <Button variant="primary" pending={create.pending} onClick={() => void submit()}>
            Send
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
        <FormError error={create.error} />
        <Field label="What is it for" required hint="One line — 'Brake noise', 'Annual service'.">
          <Input
            value={form.values.title}
            onChange={(event) => form.set("title", event.target.value)}
          />
        </Field>
        <Field label="Anything more we should know">
          <Textarea
            rows={4}
            value={form.values.description}
            onChange={(event) => form.set("description", event.target.value)}
            placeholder="When it started, what it sounds like, anything you have already tried."
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="How urgent">
            <Select
              value={form.values.priority}
              onChange={(event) => form.set("priority", event.target.value)}
            >
              <option value="LOW">Whenever suits you</option>
              <option value="MEDIUM">Soon</option>
              <option value="HIGH">Soon — it is getting worse</option>
              <option value="URGENT">Urgent — please call me</option>
            </Select>
          </Field>
          <Field label="Which car" hint="Optional if it is not about a specific vehicle.">
            <Select
              value={form.values.vehicle_id}
              onChange={(event) => form.set("vehicle_id", event.target.value)}
            >
              <option value="">Not about one car</option>
              {(vehicles.data ?? []).map((vehicle: PortalVehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Notice tone="info">
          You will get a notification as the shop moves it along.
        </Notice>
      </form>
    </Modal>
  );
}