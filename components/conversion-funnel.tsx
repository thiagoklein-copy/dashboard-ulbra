"use client";

import { ArrowDown, Eye, MousePointerClick, Sparkles, Users } from "lucide-react";
import { formatMetric } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Funil } from "@/lib/types";

const ROTULOS: Record<string, string> = {
  "offsite_conversion.fb_pixel_lead": "Leads",
  profile_visit_view: "Visitas ao perfil",
  link_click: "Cliques",
  landing_page_view: "Visitas à página",
  post_engagement: "Engajamentos",
};

/**
 * As etapas caem de 5,1 milhões para 6 mil — proporção real deixaria a última
 * invisível. A largura é um afunilamento fixo, legível; o número real fica
 * em destaque para não induzir leitura de área.
 */
const LARGURAS = ["78%", "58%", "40%"];

/** Cada etapa tem sua própria cor, do topo do funil até a conversão. */
const CORES = {
  impressoes: { tinta: "rgba(56,189,248,0.22)", borda: "rgba(125,211,252,0.45)", brilho: "bg-sky-400/40" },
  cliques: { tinta: "rgba(167,139,250,0.24)", borda: "rgba(196,181,253,0.45)", brilho: "bg-violet-400/40" },
  resultado: { tinta: "rgba(52,211,153,0.24)", borda: "rgba(110,231,183,0.5)", brilho: "bg-emerald-400/45" },
} as const;

function Etapa({
  titulo,
  valor,
  legenda,
  icone: Icone,
  largura,
  cor,
}: {
  titulo: string;
  valor: string;
  legenda?: string;
  icone: typeof Eye;
  largura: string;
  cor: (typeof CORES)[keyof typeof CORES];
}) {
  return (
    <div
      className="relative mx-auto overflow-hidden rounded-2xl border px-4 py-3 shadow-[0_8px_28px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all duration-500"
      style={{ width: largura, background: cor.tinta, borderColor: cor.borda }}
    >
      {/* reflexo especular no topo — o que dá a leitura de vidro */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/75 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/18 to-transparent" />
      <div
        className={cn("pointer-events-none absolute -right-8 -top-10 size-24 rounded-full blur-2xl", cor.brilho)}
      />

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg border border-white/30 bg-white/20 backdrop-blur-md">
            <Icone className="size-3.5 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/75">
              {titulo}
            </p>
            {legenda && <p className="text-[10px] text-white/50">{legenda}</p>}
          </div>
        </div>
        <p className="text-xl font-medium tabular-nums tracking-tight text-white">
          {valor}
        </p>
      </div>
    </div>
  );
}

function Taxa({
  valor,
  titulo,
  descricao,
  loading,
}: {
  valor: number;
  titulo: string;
  descricao: string;
  loading?: boolean;
}) {
  return (
    <div className="relative flex items-center justify-center gap-2 py-1.5">
      <ArrowDown className="size-3 text-white/30" />
      <div className="flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 backdrop-blur-xl">
        <span className="text-[13px] font-medium tabular-nums text-white">
          {loading ? "—" : `${valor.toFixed(2).replace(".", ",")}%`}
        </span>
        <span className="h-3 w-px bg-white/25" />
        <span className="text-[10px] font-medium text-white/75">{titulo}</span>
        <span className="hidden text-[10px] text-white/45 lg:inline">
          {descricao}
        </span>
      </div>
    </div>
  );
}

export function ConversionFunnel({
  funil,
  loading,
}: {
  funil: Funil | null;
  loading?: boolean;
}) {
  const f = funil;
  const vazio = !f || loading;
  const rotuloFinal = f?.indicador ? (ROTULOS[f.indicador] ?? "Resultados") : "Resultados";
  const n = (v: number | undefined) => (vazio ? "—" : formatMetric(v ?? 0, "number"));

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#0d1526] p-5 shadow-sm">
      {/* massas de cor por trás — sem elas o desfoque não tem o que borrar */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-4 size-72 rounded-full bg-emerald-500/30 blur-3xl" />
        <div className="absolute right-0 top-24 size-64 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 size-72 rounded-full bg-sky-500/20 blur-3xl" />
      </div>

      <div className="relative">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-white">Funil de conversão</h3>
            <p className="mt-0.5 text-xs text-white/50">
              Onde o investimento entra e onde ele se perde
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-xl">
            <Sparkles className="size-3 text-white/60" />
            <span className="text-[11px] tabular-nums text-white/80">
              {vazio ? "—" : formatMetric(f.investimento, "currency")}
            </span>
          </div>
        </div>

        <div className="space-y-0">
          <Etapa
            titulo="Impressões"
            valor={n(f?.impressoes)}
            legenda={vazio ? undefined : `${n(f?.alcance)} pessoas alcançadas`}
            icone={Eye}
            largura={LARGURAS[0]}
            cor={CORES.impressoes}
          />

          <Taxa
            valor={f?.taxaAnuncio ?? 0}
            titulo="conversão do anúncio"
            descricao="— fez clicar"
            loading={vazio}
          />

          <Etapa
            titulo="Cliques no link"
            valor={n(f?.cliquesLink)}
            icone={MousePointerClick}
            largura={LARGURAS[1]}
            cor={CORES.cliques}
          />

          <Taxa
            valor={f?.taxaPagina ?? 0}
            titulo="conversão da página"
            descricao="— clicou e converteu"
            loading={vazio}
          />

          <Etapa
            titulo={rotuloFinal}
            valor={n(f?.resultados)}
            legenda={
              vazio || !f?.resultados
                ? undefined
                : `${formatMetric(f.investimento / f.resultados, "currency")} cada`
            }
            icone={Users}
            largura={LARGURAS[2]}
            cor={CORES.resultado}
          />
        </div>

      </div>
    </div>
  );
}
