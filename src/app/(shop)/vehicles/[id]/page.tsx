"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, KeyValue, KeyValueGrid } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Field, FormError, Input, Select, Textarea, useForm } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { useReferences } from "@/components/layout/ReferenceProvider";
import { vehiclesApi } from "@/lib/api/shop";
import type { MileageRecord, Vehicle, VehicleStatus } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";

const VEHICLE_STATUSES: VehicleStatus[] = ["ACTIVE", "IN_SHOP", "ARCHIVED"];

/** Where a mileage figure came from — the backend records this verbatim. */
const MILEAGE_SOURCES = ["MANUAL", "CHECK_IN", "INSPECTION", "REPAIR_ORDER"];

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useSession();
  const { customerLabel } = useReferences();
  const [recording, setRecording] = useState(false);

  const vehicle = useApiQuery(() => vehiclesApi.get(id), [id]);
  const mileage = useApiQuery(() => vehiclesApi.mileage(id), [id]);

  const setStatus = useApiMutation((status: VehicleStatus) => vehiclesApi.setStatus(id, status));

  if (vehicle.loading && vehicle.initial) return <Loading label="Opening the vehicle…" />;
  if (vehicle.error) return <ErrorState error={vehicle.error} onRetry={vehicle.refetch} />;

  const record = vehicle.data;
  if (!record) return <ErrorState error={new Error("Vehicle not found")} />;

  const label = [record.year, record.make, record.model].filter(Boolean).join(" ");

  return (
    <>
      <PageHeader
        breadcrumb={<Link href="/vehicles" className="hover:underline">Vehicles</Link>}
        title={label}
        subtitle={record.license_plate ? `Plate ${record.license_plate}` : "No plate on file"}
        actions={
          <>
            <StatusBadge status={record.status} />
            {can("vehicles:write") ? (
              <>
                <StatusControl
                  vehicle={record}
                  pending={setStatus.pending}
                  onApply={(next) =>
                    setStatus.run(next).then((saved) => {
                      if (saved) vehicle.refetch();
                    })
                  }
                />
                <Button variant="primary" onClick={() => setRecording(true)}>
                  Record mileage
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {setStatus.error ? (
        <div className="mb-4">
          <Notice tone="danger">{setStatus.error.messageForUser}</Notice>
        </div>
      ) : null}

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Vehicle" subtitle="What is known about this car" />
          <KeyValueGrid>
            <KeyValue label="VIN">{record.vin ?? "—"}</KeyValue>
            <KeyValue label="Plate">{record.license_plate ?? "—"}</KeyValue>
            <KeyValue label="Year">{record.year ?? "—"}</KeyValue>
            <KeyValue label="Make">{record.make}</KeyValue>
            <KeyValue label="Model">{record.model}</KeyValue>
            <KeyValue label="Trim">{record.trim ?? "—"}</KeyValue>
            <KeyValue label="Engine">{record.engine ?? "—"}</KeyValue>
            <KeyValue label="Transmission">{record.transmission ?? "—"}</KeyValue>
            <KeyValue label="Fuel">{record.fuel_type ?? "—"}</KeyValue>
            <KeyValue label="Colour">{record.color ?? "—"}</KeyValue>
            <KeyValue label="Mileage">{formatNumber(record.mileage)}</KeyValue>
            <KeyValue label="Purchase date">{formatDate(record.purchase_date)}</KeyValue>
            <KeyValue label="Owner">
              <Link
                href={`/customers/${record.customer_id}`}
                className="text-brand-700 hover:underline"
              >
                {customerLabel(record.customer_id)}
              </Link>
            </KeyValue>
          </KeyValueGrid>
          <div className="mt-4 border-t border-ink-100 pt-3">
            <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Notes</p>
            <p className="mt-0.5 text-sm whitespace-pre-line text-ink-700">
              {record.notes ?? "Nothing recorded."}
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Where it is" subtitle="Whether the shop is holding it" />
          <KeyValueGrid className="grid-cols-1">
            <KeyValue label="Status">
              <StatusBadge status={record.status} />
            </KeyValue>
            <KeyValue label="Current mileage">{formatNumber(record.mileage)}</KeyValue>
            <KeyValue label="Readings">
              {mileage.data ? mileage.data.length : "—"} recorded
            </KeyValue>
          </KeyValueGrid>
          <div className="mt-3">
            <Notice tone="info">
              Archiving keeps the history and stops the car appearing in pickers. It does not delete
              anything.
            </Notice>
          </div>
        </Card>
      </div>

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title="Mileage history"
            subtitle="Newest last — this is the record of how the car has been used"
            actions={
              can("vehicles:write") ? (
                <Button size="sm" onClick={() => setRecording(true)}>
                  Record mileage
                </Button>
              ) : null
            }
          />
        </div>
        {mileage.loading ? (
          <Loading />
        ) : mileage.error ? (
          <div className="p-4">
            <ErrorState error={mileage.error} onRetry={mileage.refetch} />
          </div>
        ) : !mileage.data || mileage.data.length === 0 ? (
          <EmptyState
            title="No readings yet"
            description="Record the odometer on arrival so later work can be compared against it."
          />
        ) : (
          <DataTable
            rows={[...mileage.data].reverse()}
            columns={mileageColumns}
            rowKey={(r) => r.id}
          />
        )}
      </Card>

      <RecordMileageModal
        open={recording}
        id={id}
        current={record.mileage}
        onClose={() => setRecording(false)}
        onSaved={() => {
          setRecording(false);
          vehicle.refetch();
          mileage.refetch();
        }}
      />
    </>
  );
}

const mileageColumns: Column<MileageRecord>[] = [
  {
    key: "mileage",
    header: "Reading",
    numeric: true,
    render: (r) => `${formatNumber(r.mileage)} mi`,
  },
  {
    key: "source",
    header: "Source",
    render: (r) => <span className="text-xs text-ink-600">{r.source}</span>,
  },
  {
    key: "notes",
    header: "Notes",
    render: (r) => <span className="text-sm text-ink-700">{r.notes ?? "—"}</span>,
  },
  {
    key: "when",
    header: "Recorded",
    numeric: true,
    render: (r) => <span className="text-xs text-ink-500">{formatDateTime(r.created_at)}</span>,
  },
];

function StatusControl({
  vehicle,
  pending,
  onApply,
}: {
  vehicle: Vehicle;
  pending: boolean;
  onApply: (status: VehicleStatus) => void;
}) {
  const options = VEHICLE_STATUSES.filter((status) => status !== vehicle.status);
  const [next, setNext] = useState<VehicleStatus>(options[0] ?? vehicle.status);

  if (options.length === 0) return null;

  return (
    <div className="flex items-end gap-2">
      <label className="block">
        <span className="sr-only">Set status</span>
        <Select value={next} onChange={(event) => setNext(event.target.value as VehicleStatus)}>
          {options.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
      </label>
      <Button pending={pending} onClick={() => onApply(next)}>
        Set status
      </Button>
    </div>
  );
}

function RecordMileageModal({
  open,
  id,
  current,
  onClose,
  onSaved,
}: {
  open: boolean;
  id: string;
  current: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const form = useForm({
    mileage: current ? String(current) : "",
    source: "MANUAL",
    notes: "",
  });
  const add = useApiMutation((body: { mileage: number; source: string; notes: string | null }) =>
    vehiclesApi.addMileage(id, body),
  );

  async function submit() {
    const reading = Number(form.values.mileage);
    if (!Number.isFinite(reading) || reading <= 0) return;
    const saved = await add.run({
      mileage: reading,
      source: form.values.source,
      notes: form.values.notes || null,
    });
    if (saved) {
      form.reset();
      onSaved();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record mileage"
      description="The reading becomes the vehicle's current odometer."
      footer={
        <>
          <Button onClick={onClose} disabled={add.pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            pending={add.pending}
            onClick={() => void submit()}
            disabled={!(Number(form.values.mileage) > 0)}
          >
            Record
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
        <FormError error={add.error} />
        <Field
          label="Odometer"
          required
          hint={current ? `Currently ${formatNumber(current)} mi` : "No reading on file yet"}
          error={
            form.values.mileage !== "" && !(Number(form.values.mileage) > 0)
              ? "Must be greater than zero"
              : null
          }
        >
          <Input
            type="number"
            min={1}
            value={form.values.mileage}
            onChange={(e) => form.set("mileage", e.target.value)}
          />
        </Field>
        <Field label="Source">
          <Select value={form.values.source} onChange={(e) => form.set("source", e.target.value)}>
            {MILEAGE_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes">
          <Textarea
            rows={2}
            value={form.values.notes}
            onChange={(e) => form.set("notes", e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}