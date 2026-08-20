"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { CreativeModal } from "@/components/creative-modal";
import { CreativeThumbnail } from "@/components/creative-preview";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMetric } from "@/lib/format";
import { METRICS } from "@/lib/metrics-config";
import type {
  AggregatedRow,
  AggregationLevel,
  ColumnKey,
  MetricKey,
  SortDirection,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/** Com centenas de anúncios, 25 por página esconde os melhores criativos. */
const PAGE_SIZES = [25, 50, 100, 200, 400] as const;

interface DataTableProps {
  rows: AggregatedRow[];
  columns: ColumnKey[];
  level: AggregationLevel;
  loading?: boolean;
  page: number;
  pageSize: number;
  total: number;
  sortBy: MetricKey | null;
  sortDir: SortDirection | null;
  onSort: (key: MetricKey) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

function cellValue(row: AggregatedRow, key: ColumnKey): string {
  const config = METRICS.find((m) => m.key === key);
  if (!config) return "—";

  if (key === "name") return row.name;
  if (key === "headline") return row.headline ?? "—";
  if (key === "primary_text") return row.primary_text ?? "—";

  return formatMetric(row[key], config.format);
}

function hasCreative(row: AggregatedRow): boolean {
  return Boolean(
    row.headline ||
      row.primary_text ||
      row.description ||
      row.image_url ||
      row.video_id
  );
}

export function DataTable({
  rows,
  columns,
  level,
  loading,
  page,
  pageSize,
  total,
  sortBy,
  sortDir,
  onSort,
  onPageChange,
  onPageSizeChange,
}: DataTableProps) {
  const [selected, setSelected] = useState<AggregatedRow | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const visibleMetrics = METRICS.filter((m) => columns.includes(m.key));

  if (!loading && rows.length === 0) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed bg-muted/30 px-6 text-center">
        <div>
          <p className="font-medium">Nenhum dado nesse período</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajuste o intervalo de datas ou limpe os filtros.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      {/* min-w-0 + overflow-hidden: sem isso a tabela empurra o card em vez
          de rolar dentro dele, e o layout estoura ao dar zoom. */}
      <div className="min-w-0 overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[72px]">Criativo</TableHead>
              {visibleMetrics.map((col) => {
                const isActive = sortBy === col.key;
                const alignRight = col.format !== "text";

                if (!col.sortable) {
                  return (
                    <TableHead
                      key={col.key}
                      className={cn(
                        alignRight && "text-right",
                        col.key === "primary_text" && "min-w-[220px]",
                        col.key === "name" && "min-w-[200px]"
                      )}
                    >
                      {col.label}
                    </TableHead>
                  );
                }

                return (
                  <TableHead
                    key={col.key}
                    className={cn(
                      alignRight && "text-right",
                      col.key === "name" && "min-w-[200px]"
                    )}
                  >
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground",
                        alignRight && "flex-row-reverse",
                        isActive ? "text-foreground" : "text-muted-foreground"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSort(col.key as MetricKey);
                      }}
                      title={
                        isActive
                          ? sortDir === "asc"
                            ? "Clique para ordenar decrescente"
                            : "Clique para remover ordenação"
                          : "Clique para ordenar"
                      }
                    >
                      <span>{col.label}</span>
                      {isActive && sortDir === "asc" ? (
                        <ArrowUp className="size-3.5 shrink-0" />
                      ) : isActive && sortDir === "desc" ? (
                        <ArrowDown className="size-3.5 shrink-0" />
                      ) : (
                        <ChevronsUpDown className="size-3.5 shrink-0 opacity-40" />
                      )}
                    </button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  <TableCell colSpan={visibleMetrics.length + 1}>
                    <div className="h-12 animate-pulse rounded bg-muted" />
                  </TableCell>
                </TableRow>
              ))}
            {!loading &&
              rows.map((row) => {
                const canOpen = hasCreative(row);

                return (
                  <TableRow
                    key={row.id}
                    className={cn(canOpen && "cursor-pointer")}
                    onClick={() => canOpen && setSelected(row)}
                  >
                    <TableCell className="w-[72px] px-2">
                      <CreativeThumbnail
                        imageUrl={row.image_url}
                        videoId={row.video_id}
                        alt={row.name}
                      />
                    </TableCell>
                    {visibleMetrics.map((col) => (
                      <TableCell
                        key={col.key}
                        className={cn(
                          col.format !== "text" && "text-right tabular-nums",
                          (col.key === "primary_text" ||
                            col.key === "headline") &&
                            "max-w-[280px] truncate",
                          sortBy === col.key && "bg-muted/30"
                        )}
                      >
                        {col.key === "name" ? (
                          <div>
                            <div className="font-medium">{row.name}</div>
                            {level !== "campaign" && (
                              <div className="truncate text-xs text-muted-foreground">
                                {level === "ad"
                                  ? row.adset_name
                                  : row.campaign_name}
                              </div>
                            )}
                          </div>
                        ) : (
                          cellValue(row, col.key)
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-muted-foreground">
            {total === 0
              ? "0 resultados"
              : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total}`}
          </p>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Mostrar</span>
            {PAGE_SIZES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onPageSizeChange(n)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
                  pageSize === n
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
          >
            Anterior
          </Button>
          <span className="tabular-nums text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>

      <CreativeModal
        row={selected}
        level={level}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
