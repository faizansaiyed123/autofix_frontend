"use client";

import type { ReactNode } from "react";

/**
 * The list every screen is made of.
 *
 * A generic table with a `render` per column rather than a data-grid library:
 * the shop's rows are all different shapes, and a column is just a function.
 * `key` is required rather than inferred from the row, because two lines of the
 * same estimate can otherwise swap places in React's reconciliation and carry
 * their buttons with them.
 */
export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Right-aligned with tabular figures — for money, counts and dates. */
  numeric?: boolean;
  className?: string;
  headerClassName?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  empty,
  dense = false,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  dense?: boolean;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  const cellPadding = dense ? "px-3 py-1.5" : "px-4 py-2.5";

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-200">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`${cellPadding} text-xs font-semibold tracking-wide text-ink-500 uppercase ${
                  column.numeric ? "text-right" : "text-left"
                } ${column.headerClassName ?? ""}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey(row, index)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-ink-100 last:border-0 ${
                onRowClick ? "cursor-pointer hover:bg-brand-50/60" : ""
              }`}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`${cellPadding} align-middle ${
                    column.numeric ? "tabular text-right" : "text-left"
                  } ${column.className ?? ""}`}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Page controls that say what they are, rather than two chevrons. */
export function Pagination({
  page,
  pages,
  total,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (pages <= 1) {
    return <p className="px-4 py-2 text-xs text-ink-500">{total} record(s)</p>;
  }
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-4 border-t border-ink-100 px-4 py-2.5"
    >
      <p className="text-xs text-ink-500">
        Page {page} of {pages} · {total} record(s)
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50 disabled:text-ink-300"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50 disabled:text-ink-300"
        >
          Next
        </button>
      </div>
    </nav>
  );
}