"use client";

import { Megaphone, Target, TrendingUp, Wallet } from "lucide-react";
import { formatMetric } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InsightsResponse, KindFilter, SummaryTotals } from "@/lib/types";

type Totais = SummaryTotals & { indicador: string | null };

const INDICADORES: Record<string, string> = {
  "offsite_conversion.fb_pixel_lead": "Leads no site",
  profile_visit_view: "Visitas ao perfil",
  link_click: "Cliques no link",
  landing_page_view: "Visitas à página",
  post_engagement: "Engajamento",
};

function rotularIndicador(i: string | null): string | null {
  if (!i) return null;
  return INDICADORES[i] ?? i.replace(/_/g, " ");
}

function Item({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-medium tabular-nums text-gray-900 dark:text-gray-100">
        {valor}
      </p>
    </div>
  );
}

function CardTipo({
  titulo,
  icone: Icone,
  cor,
  totais,
  loading,
  apagado,
}: {
  titulo: string;
  icone: typeof Target;
  cor: string;
  totais: Totais | null;
  loading?: boolean;
  apagado?: boolean;
}) {
  const vazio = !totais || loading;
  const f = (v: number, fmt: "currency" | "number" | "percent") =>
    vazio ? "—" : formatMetric(v, fmt);
  const indicador = rotularIndicador(totais?.indicador ?? null);

  return (
    <div
      className={cn(
        "rounded-2xl bg-white p-5 shadow-sm dark:bg-[#171a20] transition-opacity",
        apagado && "opacity-40"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl",
              cor
            )}
          >
            <Icone className="size-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{titulo}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {indicador ?? "Sem resultados no período"}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-medium tabular-nums text-gray-900 dark:text-gray-100">
            {f(totais?.spend ?? 0, "currency")}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
            investido
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-3 border-t border-gray-100 dark:border-white/10 pt-4">
        <Item label="Result." valor={f(totais?.results ?? 0, "number")} />
        <Item label="Custo/res." valor={f(totais?.cost_per_result ?? 0, "currency")} />
        <Item label="Cliques" valor={f(totais?.clicks ?? 0, "number")} />
        <Item label="CTR" valor={f(totais?.ctr ?? 0, "percent")} />
      </div>
    </div>
  );
}

const TITULO_TOTAL: Record<KindFilter, string> = {
  todos: "Investimento total",
  conversao: "Investimento em conversão",
  branding: "Investimento em branding",
};

export function SummaryCards({
  kindTotals,
  kind,
  loading,
}: {
  kindTotals: InsightsResponse["kindTotals"] | null;
  kind: KindFilter;
  loading?: boolean;
}) {
  const c = kindTotals?.conversao;
  const b = kindTotals?.branding;

  // O card de topo acompanha o seletor: ao filtrar por um tipo,
  // o total deixa de somar o outro.
  const inclui = (k: "conversao" | "branding") => kind === "todos" || kind === k;
  const total =
    (inclui("conversao") ? c?.spend ?? 0 : 0) +
    (inclui("branding") ? b?.spend ?? 0 : 0);
  const impressoes =
    (inclui("conversao") ? c?.impressions ?? 0 : 0) +
    (inclui("branding") ? b?.impressions ?? 0 : 0);

  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-white shadow-lg">
        <div className="absolute -right-8 -top-8 size-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 -right-2 size-24 rounded-full bg-white/5" />
        <div className="relative z-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm">
            <Wallet className="size-6 text-emerald-600" />
          </div>
          <p className="mt-5 text-xs font-medium uppercase tracking-wider text-white/80">
            {TITULO_TOTAL[kind]}
          </p>
          <p className="mt-1 text-4xl font-medium tabular-nums tracking-tight">
            {loading || !kindTotals ? "—" : formatMetric(total, "currency")}
          </p>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-white/85">
            <TrendingUp className="size-3.5" />
            {loading || !kindTotals
              ? "—"
              : `${formatMetric(impressoes, "number")} impressões`}
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <CardTipo
          titulo="Conversão"
          icone={Target}
          cor="bg-emerald-500"
          totais={c ?? null}
          loading={loading}
          apagado={!inclui("conversao")}
        />
        <CardTipo
          titulo="Branding"
          icone={Megaphone}
          cor="bg-violet-500"
          totais={b ?? null}
          loading={loading}
          apagado={!inclui("branding")}
        />
      </div>
    </div>
  );
}
