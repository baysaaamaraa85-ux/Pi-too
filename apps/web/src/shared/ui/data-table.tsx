import * as React from "react";
import { Button } from "./button";
import { cn } from "./utils";

export interface Column<Row> {
  key: string;
  header: string;
  cell: (row: Row) => React.ReactNode;
  className?: string;
}

// Компьютерт хүснэгт, утсанд (360 px) мөр бүр карт болж, хэвтээ гүйлгэлт гарахгүй (ФБШ-10).
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty = "Мэдээлэл олдсонгүй.",
}: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  onRowClick?: (row: Row) => void;
  empty?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-10 text-center text-sm text-muted">
        {empty}
      </p>
    );
  }
  const [first, ...rest] = columns;
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-border-warm bg-surface shadow-md md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-background-soft text-xs font-bold uppercase tracking-wider text-muted">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={cn("px-4 py-3", c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-warm">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(onRowClick && "cursor-pointer hover:bg-background-soft")}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-4 py-3 align-top", c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className="rounded-2xl border border-border-warm bg-surface p-4 shadow-md"
          >
            {first ? <div className="font-bold text-foreground-strong">{first.cell(row)}</div> : null}
            <dl className="mt-2 grid gap-1.5 text-sm">
              {rest.map((c) => (
                <div key={c.key} className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted">{c.header}</dt>
                  <dd className="min-w-0 text-right text-mid">{c.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

export function Pager({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted">
      <span>Нийт {total}</span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Өмнөх
        </Button>
        <span aria-live="polite">
          {page} / {pages}
        </span>
        <Button
          variant="secondary"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Дараах
        </Button>
      </div>
    </div>
  );
}
