"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, KeyValue, KeyValueGrid } from "@/components/ui/Card";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Field, Input, Select } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader, Toolbar } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { useReferences } from "@/components/layout/ReferenceProvider";
import { auditApi } from "@/lib/api/insight";
import type { AuditLog, AuditLogSummary } from "@/lib/api/types";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { formatDateTime, formatNumber, formatRelative, titleCase } from "@/lib/format";

/**
 * Who did what to whose record.
 *
 * **The log is append-only.** There is no POST, no PUT and no DELETE in the audit
 * router and no role that holds one, so this screen offers no edit and no delete
 * control: an interface offering one would be offering something the server cannot
 * honour.
 *
 * Each entry stores the actor twice — the live id plus a copied email and role — so
 * an entry can still name somebody after the account is gone. The list omits the two
 * heavy state columns because a page of entries carrying two full row snapshots each
 * is a response nobody asked for; the detail shows them.
 *
 * The whole screen is `audit_logs:read`, which only the owner holds.
 */

/** The endpoint adds this key when a diff was too wide to list in full. */
const TRUNCATED = "_truncated";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The vocabularies answer inside a named wrapper (`{"actions": [...]}`) while the
 * shared client types them as a bare array, so both shapes are accepted rather than
 * trusting one and rendering a dropdown with nothing in it.
 */
function stringList(payload: unknown): string[] {
  if (Array.isArray(payload)) return payload.filter((value): value is string => typeof value === "string");
  if (payload && typeof payload === "object") {
    const values = Object.values(payload as Record<string, unknown>);
    if (values.length === 1 && Array.isArray(values[0])) {
      return values[0].filter((value): value is string => typeof value === "string");
    }
  }
  return [];
}

/** Anything can have been stored in a state snapshot, so nothing is assumed. */
function showValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value === "" ? "(empty)" : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/**
 * The shared client types the history endpoint as a loose record, so the shape is
 * narrowed once here rather than cast at every read.
 */
type EntityHistory = {
  entity_type: string;
  entity_id: string;
  entity_label: string | null;
  total: number;
  entries: AuditLogSummary[];
};

export default function AuditPage() {
  const { can } = useSession();
  const { staff } = useReferences();
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLogSummary | null>(null);

  const permitted = can("audit_logs:read");
  const filtering = Boolean(actor || action || entityType || entityId || from || to);
  // A mistyped id would come back as a 422 rather than as an empty list, so the
  // query waits for something that could be an id at all.
  const idUsable = entityId === "" || UUID.test(entityId);

  const actions = useApiQuery(() => auditApi.actions(), [], { enabled: permitted });
  const entityTypes = useApiQuery(() => auditApi.entityTypes(), [], { enabled: permitted });

  const query = useApiQuery(
    () =>
      auditApi.list({
        page,
        size: 50,
        actor_id: actor || undefined,
        action: action || undefined,
        entity_type: entityType || undefined,
        entity_id: entityId || undefined,
        date_from: from || undefined,
        date_to: to || undefined,
      }),
    [page, actor, action, entityType, entityId, from, to],
    { enabled: permitted && idUsable },
  );

  const columns: Column<AuditLogSummary>[] = [
    {
      key: "when",
      header: "When",
      numeric: true,
      render: (entry) => (
        <div className="whitespace-nowrap">
          <span className="text-sm text-ink-800">{formatDateTime(entry.created_at)}</span>
          <span className="block text-xs text-ink-500">{formatRelative(entry.created_at)}</span>
        </div>
      ),
    },
    {
      key: "actor",
      header: "Actor",
      render: (entry) => (
        <div className="min-w-0">
          <span className="font-medium text-ink-900">{entry.actor_label}</span>
          {entry.actor_email ? (
            <span className="block truncate text-xs text-ink-500">{entry.actor_email}</span>
          ) : null}
          {entry.actor_role ? (
            <span className="block text-xs text-ink-500">{titleCase(entry.actor_role)}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      render: (entry) => <Badge tone="info">{entry.action}</Badge>,
    },
    {
      key: "entity",
      header: "Entity",
      render: (entry) => (
        <div className="min-w-0">
          <span className="text-sm text-ink-800">{titleCase(entry.entity_type)}</span>
          {entry.entity_label ? (
            <span className="block truncate text-xs text-ink-500">{entry.entity_label}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "summary",
      header: "Summary",
      render: (entry) => (
        <span className="text-sm text-ink-600">{entry.summary ?? "No summary recorded"}</span>
      ),
    },
  ];

  if (!permitted) {
    return (
      <>
        <PageHeader title="Audit log" subtitle="What each person did, and when" />
        <Notice tone="danger">
          The audit log is owner-only. An entry records what one person did to another
          person&apos;s record, and there is no shop where the front desk is entitled to read
          it.
        </Notice>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle={
          query.data ? `${formatNumber(query.data.meta.total)} entry(ies)` : "Who did what, and when"
        }
      />

      <p className="mb-4 text-sm text-ink-600">
        Append-only: entries are written by the server as work happens, and{" "}
        <span className="font-medium text-ink-800">
          no role in this system can edit or delete one
        </span>
        . There is no endpoint for it, so none is offered here.
      </p>

      <Card padded={false}>
        <Toolbar>
          <Field label="Actor" className="w-48">
            <Select
              value={actor}
              onChange={(event) => {
                setActor(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Anyone</option>
              {staff.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.first_name} {person.last_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Action" className="w-44">
            <Select
              value={action}
              onChange={(event) => {
                setAction(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Every action</option>
              {stringList(actions.data).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Entity" className="w-44">
            <Select
              value={entityType}
              onChange={(event) => {
                setEntityType(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Every record type</option>
              {stringList(entityTypes.data).map((value) => (
                <option key={value} value={value}>
                  {titleCase(value)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Record id"
            className="w-48"
            hint={idUsable ? "Optional — one record" : "That is not a record id"}
          >
            <Input
              value={entityId}
              onChange={(event) => {
                setEntityId(event.target.value);
                setPage(1);
              }}
              placeholder="Any record"
            />
          </Field>
          <Field label="From" className="w-40">
            <Input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => {
                const value = event.target.value;
                setFrom(value);
                if (value && to && value > to) setTo(value);
              }}
            />
          </Field>
          <Field label="To" className="w-40">
            <Input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => {
                const value = event.target.value;
                setTo(value);
                if (value && from && value < from) setFrom(value);
              }}
            />
          </Field>
          {filtering ? (
            <Button
              onClick={() => {
                setActor("");
                setAction("");
                setEntityType("");
                setEntityId("");
                setFrom("");
                setTo("");
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </Toolbar>

        {!idUsable ? (
          <div className="px-4 pt-3">
            <Notice tone="info">
              A record id is a UUID, so nothing is asked for until this is one or empty.
            </Notice>
          </div>
        ) : null}

        {query.loading && query.initial ? (
          <Loading label="Reading the log…" />
        ) : query.error ? (
          <div className="p-4">
            <ErrorState error={query.error} onRetry={query.refetch} />
          </div>
        ) : !query.data || query.data.data.length === 0 ? (
          <EmptyState
            title="Nothing matches those filters"
            description="The log only carries entries for record types this build knows how to snapshot."
          />
        ) : (
          <>
            <DataTable
              rows={query.data.data}
              columns={columns}
              rowKey={(entry) => entry.id}
              onRowClick={setSelected}
            />
            <Pagination
              page={query.data.meta.page}
              pages={query.data.meta.pages}
              total={query.data.meta.total}
              onPage={setPage}
            />
          </>
        )}
      </Card>

      {selected ? <EntryModal entryId={selected.id} onClose={() => setSelected(null)} /> : null}
    </>
  );
}

/**
 * One entry in full.
 *
 * The diff is what a reader usually wants, but it is not the whole record: a wide
 * change is truncated in `changes` while both full snapshots are kept, so the states
 * are shown underneath rather than left as an unexplained gap.
 */
function EntryModal({ entryId, onClose }: { entryId: string; onClose: () => void }) {
  const [showingHistory, setShowingHistory] = useState(false);
  const query = useApiQuery(() => auditApi.get(entryId), [entryId]);

  const entry: AuditLog | null = query.data;
  const changes = entry?.changes ?? null;
  const fields = changes ? Object.entries(changes) : [];
  const truncated = changes ? TRUNCATED in changes : false;

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={entry ? `${entry.action} · ${titleCase(entry.entity_type)}` : "Audit entry"}
        description={entry?.summary ?? "The full record of one action."}
        width="max-w-3xl"
        footer={
          <>
            {entry && entry.entity_id ? (
              <Button className="mr-auto" onClick={() => setShowingHistory(true)}>
                Everything about this record
              </Button>
            ) : null}
            <Button onClick={onClose}>Close</Button>
          </>
        }
      >
        {query.loading && query.initial ? (
          <Loading />
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={query.refetch} />
        ) : !entry ? (
          <ErrorState error={new Error("That entry could not be read")} />
        ) : (
          <div className="space-y-5">
            <KeyValueGrid>
              <KeyValue label="When">{formatDateTime(entry.created_at)}</KeyValue>
              <KeyValue label="Actor">
                {entry.actor_label}
                {entry.actor_email ? (
                  <span className="block text-xs text-ink-500">{entry.actor_email}</span>
                ) : null}
                {entry.actor_role ? (
                  <span className="block text-xs text-ink-500">{titleCase(entry.actor_role)}</span>
                ) : null}
              </KeyValue>
              <KeyValue label="Action">
                <Badge tone="info">{entry.action}</Badge>
              </KeyValue>
              <KeyValue label="Record">
                {titleCase(entry.entity_type)}
                {entry.entity_label ? (
                  <span className="block text-xs text-ink-500">{entry.entity_label}</span>
                ) : null}
                {entry.entity_id ? (
                  <span className="block font-mono text-xs text-ink-500">{entry.entity_id}</span>
                ) : null}
              </KeyValue>
              <KeyValue label="From address">{entry.ip_address ?? "—"}</KeyValue>
              <KeyValue label="Client">{entry.user_agent ?? "—"}</KeyValue>
            </KeyValueGrid>

            <section>
              <CardHeader title="What changed" subtitle="Every changed field: old value, then new" />
              {fields.length === 0 ? (
                <p className="text-sm text-ink-500">
                  Nothing was recorded as a field-level change — the record was created or
                  removed, or this build does not snapshot this kind of record.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {fields.map(([field, change]) =>
                    field === TRUNCATED ? null : (
                      <li
                        key={field}
                        className="flex flex-wrap items-baseline gap-x-2 rounded-lg bg-ink-50 px-3 py-2 text-sm"
                      >
                        <span className="font-mono text-xs text-ink-700">{field}</span>
                        <span className="text-ink-500">{showValue(change?.from)}</span>
                        <span aria-hidden className="text-ink-400">
                          &rarr;
                        </span>
                        <span className="font-medium text-ink-900">{showValue(change?.to)}</span>
                      </li>
                    ),
                  )}
                </ul>
              )}
              <p className="mt-2 text-xs text-ink-500">
                <span className="font-mono">updated_at</span> is deliberately excluded from
                every diff: it moves on every write, so including it would put a meaningless
                change in every entry.
                {truncated
                  ? " This change was wider than a list is worth, so the diff above was cut short — both full states below are still stored."
                  : ""}
              </p>
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <StatePanel title="Before" state={entry.before_state} />
              <StatePanel title="After" state={entry.after_state} />
            </div>
          </div>
        )}
      </Modal>

      {showingHistory && entry && entry.entity_id ? (
        <HistoryModal
          entityType={entry.entity_type}
          entityId={entry.entity_id}
          onClose={() => setShowingHistory(false)}
        />
      ) : null}
    </>
  );
}

function StatePanel({
  title,
  state,
}: {
  title: string;
  state: Record<string, unknown> | null;
}) {
  const fields = state ? Object.entries(state).sort(([a], [b]) => a.localeCompare(b)) : [];
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold tracking-wide text-ink-500 uppercase">{title}</h3>
      {fields.length === 0 ? (
        <p className="text-sm text-ink-500">
          Nothing stored — this build does not know how to read this kind of record, so there
          was no snapshot to take.
        </p>
      ) : (
        <dl className="space-y-1">
          {fields.map(([field, value]) => (
            <div
              key={field}
              className="flex flex-wrap items-baseline gap-x-2 rounded px-2 py-1 text-sm odd:bg-ink-50"
            >
              <dt className="font-mono text-xs text-ink-600">{field}</dt>
              <dd className="break-all text-ink-900">{showValue(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

/** Everything that has ever happened to one record, newest first. */
function HistoryModal({
  entityType,
  entityId,
  onClose,
}: {
  entityType: string;
  entityId: string;
  onClose: () => void;
}) {
  const query = useApiQuery(
    () => auditApi.entityHistory(entityType, entityId),
    [entityType, entityId],
  );
  const history = query.data ? (query.data as EntityHistory) : null;

  return (
    <Modal
      open
      onClose={onClose}
      title={`History of this ${titleCase(entityType)}`}
      description={history?.entity_label ?? "Everything that has happened to one record."}
      width="max-w-3xl"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {query.loading && query.initial ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : !history || history.entries.length === 0 ? (
        <EmptyState
          title="Nothing recorded"
          description="No audit entry has been written against this record yet."
        />
      ) : (
        <>
          <p className="mb-3 text-xs text-ink-500">
            {formatNumber(history.total)} entry(ies), newest first — the same log narrowed to
            one record.
          </p>
          <ul className="space-y-2">
            {history.entries.map((item) => (
              <li key={item.id} className="rounded-lg bg-ink-50 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-ink-900">{item.actor_label}</span>
                  <span className="text-xs text-ink-500">{formatDateTime(item.created_at)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge tone="info">{item.action}</Badge>
                  <span className="text-ink-600">{item.summary ?? "No summary recorded"}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}