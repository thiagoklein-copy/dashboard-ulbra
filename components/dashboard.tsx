"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, RotateCcw } from "lucide-react";
import { BreakdownChart } from "@/components/breakdown-chart";
import { ColumnPicker, useVisibleColumns } from "@/components/column-picker";
import { ConversionFunnel } from "@/components/conversion-funnel";
import { DataTable } from "@/components/data-table";
import { DateRangePicker } from "@/components/filters/date-range-picker";
import { LevelSelector } from "@/components/filters/level-selector";
import { MultiSelectFilter } from "@/components/filters/multi-select-filter";
import { SearchFilter } from "@/components/filters/search-filter";
import { GenerateReportButton } from "@/components/generate-report-button";
import { KindSelector } from "@/components/kind-selector";
import { LeadsMap } from "@/components/leads-map";
import { RateRings } from "@/components/rate-rings";
import { SummaryCards } from "@/components/summary-cards";
import { ThemeToggle } from "@/components/theme-toggle";
import { useDashboardParams } from "@/hooks/use-dashboard-params";
import { cycleColumnSort } from "@/lib/metrics-config";
import type { InsightsResponse, MetricKey } from "@/lib/types";

export function Dashboard() {
  const router = useRouter();
  const [params, setParams] = useDashboardParams();
  const { columns, setColumns } = useVisibleColumns();
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const qs = new URLSearchParams();
    qs.set("level", params.level);
    qs.set("from", params.from);
    qs.set("to", params.to);
    if (params.campaigns.length) qs.set("campaigns", params.campaigns.join(","));
    if (params.adsets.length) qs.set("adsets", params.adsets.join(","));
    if (params.cursos.length) qs.set("cursos", params.cursos.join(","));
    if (params.pracas.length) qs.set("pracas", params.pracas.join(","));
    if (params.kind !== "todos") qs.set("kind", params.kind);
    if (params.q) qs.set("q", params.q);
    if (params.sortBy) qs.set("sortBy", params.sortBy);
    if (params.sortDir) qs.set("sortDir", params.sortDir);
    qs.set("page", String(params.page));
    qs.set("pageSize", String(params.pageSize));

    try {
      const res = await fetch(`/api/insights?${qs.toString()}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "Falha ao carregar dados");
      }
      setData((await res.json()) as InsightsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  function handleSort(key: MetricKey) {
    const next = cycleColumnSort(params.sortBy, params.sortDir, key);
    void setParams({ ...next, page: 1 });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const temFiltro =
    params.cursos.length > 0 ||
    params.pracas.length > 0 ||
    params.campaigns.length > 0 ||
    params.adsets.length > 0 ||
    params.kind !== "todos" ||
    params.q !== "";

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f5f4f0] dark:bg-[#0e1014]">
      <div className="min-w-0 space-y-4 px-4 py-4 sm:px-5 lg:px-6">
        <header className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-black text-sm font-bold text-white">
              U
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight text-black dark:text-white">
                Meta Ads · ULBRA
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Performance de campanhas · somente leitura
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker
              from={params.from}
              to={params.to}
              onChange={(from, to) => setParams({ from, to, page: 1 })}
            />
            <ThemeToggle />
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 rounded-full bg-black px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-85 dark:bg-white dark:text-black"
            >
              <LogOut className="size-3.5" />
              Sair
            </button>
          </div>
        </header>

        <SummaryCards
          kindTotals={data?.kindTotals ?? null}
          kind={params.kind}
          loading={loading}
        />

        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[#171a20]">
          <div className="flex flex-wrap items-center gap-2">
            <KindSelector
              value={params.kind}
              onChange={(kind) => setParams({ kind, page: 1 })}
            />
            <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-white/10" />
            <MultiSelectFilter
              label="Curso"
              options={data?.filterOptions.cursos ?? []}
              value={params.cursos}
              onChange={(cursos) => setParams({ cursos, page: 1 })}
            />
            <MultiSelectFilter
              label="Praça"
              options={data?.filterOptions.pracas ?? []}
              value={params.pracas}
              onChange={(pracas) => setParams({ pracas, page: 1 })}
            />
            <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-white/10" />
            <MultiSelectFilter
              label="Campanha"
              options={data?.filterOptions.campaigns ?? []}
              value={params.campaigns}
              onChange={(campaigns) => setParams({ campaigns, page: 1 })}
            />
            <MultiSelectFilter
              label="Conjunto"
              options={data?.filterOptions.adsets ?? []}
              value={params.adsets}
              onChange={(adsets) => setParams({ adsets, page: 1 })}
            />
            <SearchFilter
              value={params.q}
              onChange={(q) => setParams({ q, page: 1 })}
            />
            {temFiltro && (
              <button
                type="button"
                onClick={() =>
                  setParams({
                    cursos: [],
                    pracas: [],
                    campaigns: [],
                    adsets: [],
                    kind: "todos",
                    q: "",
                    page: 1,
                  })
                }
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                <RotateCcw className="size-3.5" />
                Limpar
              </button>
            )}
          </div>
        </div>

        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <ConversionFunnel funil={data?.funil ?? null} loading={loading} />
          <RateRings funil={data?.funil ?? null} loading={loading} />
        </div>

        <LeadsMap porPraca={data?.breakdown.porPraca ?? []} loading={loading} />

        <BreakdownChart
          porCurso={data?.breakdown.porCurso ?? []}
          porPraca={data?.breakdown.porPraca ?? []}
          loading={loading}
        />

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-[#171a20]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <LevelSelector
              value={params.level}
              onChange={(level) => setParams({ level, page: 1 })}
            />
            <div className="flex flex-wrap items-center gap-2">
              <GenerateReportButton
                from={params.from}
                to={params.to}
                campaigns={params.campaigns}
                adsets={params.adsets}
                cursos={params.cursos}
                pracas={params.pracas}
                kind={params.kind}
                q={params.q}
              />
              <ColumnPicker value={columns} onChange={setColumns} />
            </div>
          </div>

          <DataTable
            rows={data?.rows ?? []}
            columns={columns}
            level={params.level}
            loading={loading}
            page={params.page}
            pageSize={params.pageSize}
            total={data?.total ?? 0}
            sortBy={params.sortBy}
            sortDir={params.sortDir}
            onSort={handleSort}
            onPageChange={(page) => setParams({ page })}
            onPageSizeChange={(pageSize) => setParams({ pageSize, page: 1 })}
          />
        </div>
      </div>
    </div>
  );
}
