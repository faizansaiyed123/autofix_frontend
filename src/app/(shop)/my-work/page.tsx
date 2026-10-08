"use client";

import Link from "next/link";
import { useState } from "react";

import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Select } from "@/components/ui/Form";
import { PageHeader, StatTile, Toolbar } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { useReferences } from "@/components/layout/ReferenceProvider";
import { laborApi } from "@/lib/api/work";
import type { TechnicianDashboardOpenTask } from "@/lib/api/types";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { formatNumber } from "@/lib/format";

/**
 * One person's board.
 *
 * This screen is deliberately about a single technician rather than the shop:
 * the four numbers only mean anything as "how much is on my bench right now", and
 * a version that quietly added every technician's totals together would answer a
 * question nobody asked. The picker exists so a supervisor can stand behind
 * somebody's shoulder — it defaults to the signed-in user, not to the shop.
 *
 * "Open" is counted the way the backend counts it: a task that is neither
 * completed nor skipped, on an order that is still IN_PROGRESS or ON_HOLD.
 */
export default function MyWorkPage() {
  const { user } = useSession();
  const { staff } = useReferences();
  const [chosen, setChosen] = useState<string | null>(null);

  const meId = user?.id ?? "";
  // "Nobody chosen" means my own board; picking a name is the supervisor case.
  const technicianId = chosen ?? meId;

  const dashboard = useApiQuery(
    () => laborApi.dashboard(technicianId),
    [technicianId],
    { enabled: Boolean(technicianId) },
  );

  const columns: Column<TechnicianDashboardOpenTask>[] = [
    {
      key: "description",
      header: "Task",
      render: (task) => <span className="font-medium text-ink-900">{task.description}</span>,
    },
    {
      key: "ro",
      header: "Repair order",
      render: (task) => (
        <Link
          href={`/repair-orders/${task.repair_order_id}`}
          className="font-medium text-brand-700 hover:underline"
        >
          {task.ro_number}
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (task) => <StatusBadge status={task.status} />,
    },
  ];

  const board = dashboard.data;

  return (
    <>
      <PageHeader
        title="My work"
        subtitle={
          technicianId === meId
            ? "Your open jobs, your hours, your part requests"
            : `The board of the technician you picked`
        }
      />

      <Card padded={false} className="mb-4">
        <Toolbar>
          <label className="block">
            <span className="sr-only">Technician</span>
            <Select
              value={chosen ?? "me"}
              onChange={(event) =>
                setChosen(event.target.value === "me" ? null : event.target.value)
              }
              className="w-64"
            >
              <option value="me">
                Me{user ? ` — ${user.first_name} ${user.last_name}` : ""}
              </option>
              {staff
                .filter((person) => person.id !== meId)
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.first_name} {person.last_name}
                  </option>
                ))}
            </Select>
          </label>
          <p className="text-xs text-ink-500">
            This is one person&rsquo;s board, not the shop&rsquo;s. Open a repair order to work its
            tasks.
          </p>
        </Toolbar>
      </Card>

      {dashboard.loading && dashboard.initial ? (
        <Loading label="Reading the board…" />
      ) : dashboard.error ? (
        <ErrorState error={dashboard.error} onRetry={dashboard.refetch} />
      ) : !board ? (
        <ErrorState error={new Error("No dashboard data")} />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Open tasks"
              value={formatNumber(board.open_task_count)}
              hint="Neither completed nor skipped"
              tone={board.open_task_count > 0 ? "warning" : "neutral"}
            />
            <StatTile
              label="Orders in progress"
              value={formatNumber(board.in_progress_ro_count)}
              hint="IN_PROGRESS or ON_HOLD"
              tone={board.in_progress_ro_count > 0 ? "info" : "neutral"}
            />
            <StatTile
              label="Hours this week"
              value={formatNumber(board.hours_this_week, 2)}
              hint="Logged in the last seven days"
            />
            <StatTile
              label="Part requests"
              value={formatNumber(board.pending_part_request_count)}
              hint="Yours, still waiting on parts"
              tone={board.pending_part_request_count > 0 ? "warning" : "neutral"}
            />
          </div>

          {board.pending_part_request_count > 0 ? (
            <div className="mb-4">
              <Notice tone="info">
                {board.pending_part_request_count} part request
                {board.pending_part_request_count === 1 ? " is" : "s are"} still waiting on the parts
                desk. You raised them, but somebody else has to approve them.
              </Notice>
            </div>
          ) : null}

          <Card padded={false}>
            <DataTable
              rows={board.open_tasks}
              columns={columns}
              rowKey={(task) => task.task_id}
              empty={
                <EmptyState
                  title="Nothing open"
                  description="No task is assigned to this technician on a job that is still being worked on."
                />
              }
            />
          </Card>
        </>
      )}
    </>
  );
}