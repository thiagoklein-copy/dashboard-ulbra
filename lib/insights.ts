import {
  aggregateRows,
  computeSummary,
  filterRows,
  sortAggregatedRows,
} from "@/lib/aggregations";
import { classificarCampanha } from "@/lib/campaign-taxonomy";
import { MOCK_INSIGHTS } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";
import type {
  AdInsightRow,
  BreakdownItem,
  Funil,
  InsightsQueryParams,
  InsightsResponse,
  SummaryTotals,
  VideoRetention,
} from "@/lib/types";

function agrupar(
  rows: AdInsightRow[],
  chave: (r: AdInsightRow) => string
): BreakdownItem[] {
  const mapa = new Map<string, BreakdownItem>();
  for (const r of rows) {
    const nome = chave(r);
    const atual = mapa.get(nome) ?? {
      nome,
      spend: 0,
      results: 0,
      cost_per_result: 0,
      ads: 0,
      impressions: 0,
      cliquesLink: 0,
      taxaAnuncio: 0,
      taxaPagina: 0,
    };
    atual.spend += r.spend;
    atual.results += r.results;
    atual.impressions += r.impressions;
    atual.cliquesLink += r.inline_link_clicks;
    atual.ads += 1;
    mapa.set(nome, atual);
  }
  return Array.from(mapa.values())
    .map((i) => ({
      ...i,
      spend: Math.round(i.spend * 100) / 100,
      cost_per_result: i.results ? i.spend / i.results : 0,
      taxaAnuncio: i.impressions ? (i.cliquesLink / i.impressions) * 100 : 0,
      taxaPagina: i.cliquesLink ? (i.results / i.cliquesLink) * 100 : 0,
    }))
    .sort((a, b) => b.spend - a.spend);
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
}

type RawInsightRow = AdInsightRow & {
  video_plays?: number | null;
  video_avg_watch_time_sec?: number | null;
  video_duration_sec?: number | null;
  video_p25?: number | null;
  video_p50?: number | null;
  video_p75?: number | null;
  video_p95?: number | null;
  video_p100?: number | null;
};

function normalizeRetention(row: RawInsightRow): VideoRetention | null {
  if (row.video_retention) return row.video_retention;

  const plays = Number(row.video_plays ?? 0);
  if (!plays) return null;

  return {
    plays,
    avg_watch_time_sec: Number(row.video_avg_watch_time_sec ?? 0),
    duration_sec: Number(row.video_duration_sec ?? 0),
    p25: Number(row.video_p25 ?? 0),
    p50: Number(row.video_p50 ?? 0),
    p75: Number(row.video_p75 ?? 0),
    p95: Number(row.video_p95 ?? 0),
    p100: Number(row.video_p100 ?? 0),
  };
}

function normalizeRow(row: RawInsightRow): AdInsightRow {
  const raw = row as RawInsightRow & { video_url?: string | null };
  const taxonomia = classificarCampanha(row.campaign_name, row.objective);

  return {
    ...row,
    spend: Number(row.spend ?? 0),
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
    results: Number(row.results ?? 0),
    reach: Number(row.reach ?? 0),
    inline_link_clicks: Number(row.inline_link_clicks ?? 0),
    objective: row.objective ?? null,
    result_indicator: row.result_indicator ?? null,
    video_storage_url: row.video_storage_url ?? raw.video_url ?? null,
    video_transcript: row.video_transcript ?? null,
    video_retention: normalizeRetention(row),
    ...taxonomia,
  };
}

async function fetchFromSupabase(
  dateFrom: string,
  dateTo: string
): Promise<AdInsightRow[]> {
  const PAGE = 1000;
  const todas: RawInsightRow[] = [];

  // A view pode devolver mais que o teto padrão do PostgREST (1000).
  // Paginamos para não repetir aqui o mesmo bug de truncagem do n8n.
  for (let inicio = 0; ; inicio += PAGE) {
    const { data, error } = await supabase
      .from("v_ads_performance")
      .select("*")
      .gte("date_start", dateFrom)
      .lte("date_start", dateTo)
      .range(inicio, inicio + PAGE - 1);

    if (error) throw new Error(`Erro ao buscar insights: ${error.message}`);

    const lote = (data ?? []) as RawInsightRow[];
    todas.push(...lote);
    if (lote.length < PAGE) break;
  }

  return todas.map(normalizeRow);
}

function montarFunil(rows: AdInsightRow[]): Funil {
  const soma = (f: (r: AdInsightRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  const impressoes = soma((r) => r.impressions);
  const cliquesLink = soma((r) => r.inline_link_clicks);
  const resultados = soma((r) => r.results);

  const indicadores = uniqueSorted(
    rows.map((r) => (r.result_indicator ?? "").replace(/^actions:/, ""))
  );

  return {
    impressoes,
    alcance: soma((r) => r.reach),
    cliquesLink,
    resultados,
    taxaAnuncio: impressoes ? (cliquesLink / impressoes) * 100 : 0,
    taxaPagina: cliquesLink ? (resultados / cliquesLink) * 100 : 0,
    investimento: soma((r) => r.spend),
    indicador: indicadores.length === 1 ? indicadores[0] : null,
  };
}

function totaisPorTipo(rows: AdInsightRow[]): SummaryTotals & {
  indicador: string | null;
} {
  const indicadores = uniqueSorted(
    rows.map((r) => r.result_indicator ?? "").map((i) => i.replace(/^actions:/, ""))
  );
  return {
    ...computeSummary(rows),
    indicador: indicadores.length === 1 ? indicadores[0] : null,
  };
}

export async function getInsights(
  params: InsightsQueryParams
): Promise<InsightsResponse> {
  const useMock = process.env.USE_MOCK_DATA !== "false";

  const source = useMock
    ? MOCK_INSIGHTS.map((r) => normalizeRow(r as RawInsightRow))
    : await fetchFromSupabase(params.dateFrom, params.dateTo);

  const periodo = { dateFrom: params.dateFrom, dateTo: params.dateTo };
  const vazio = {
    campaigns: [],
    adsets: [],
    cursos: [],
    pracas: [],
    kind: "todos" as const,
    search: "",
  };

  const noPeriodo = filterRows(source, { ...periodo, ...vazio });

  // Cada seletor lista o que sobra depois dos OUTROS filtros — assim
  // escolher "Palmas" reduz os cursos, e escolher "Direito" reduz as praças.
  const opcoesPara = (excluir: "cursos" | "pracas" | "campaigns" | "adsets") =>
    filterRows(source, {
      ...periodo,
      kind: params.kind,
      search: params.search,
      cursos: excluir === "cursos" ? [] : params.cursos,
      pracas: excluir === "pracas" ? [] : params.pracas,
      campaigns: excluir === "campaigns" ? [] : params.campaigns,
      adsets: excluir === "adsets" || excluir === "campaigns" ? [] : params.adsets,
    });

  const filterOptions = {
    cursos: uniqueSorted(opcoesPara("cursos").map((r) => r.curso)),
    pracas: uniqueSorted(opcoesPara("pracas").map((r) => r.praca)),
    campaigns: uniqueSorted(opcoesPara("campaigns").map((r) => r.campaign_name)),
    adsets: uniqueSorted(opcoesPara("adsets").map((r) => r.adset_name)),
  };

  const filtered = filterRows(source, {
    ...periodo,
    campaigns: params.campaigns,
    adsets: params.adsets,
    cursos: params.cursos,
    pracas: params.pracas,
    kind: params.kind,
    search: params.search,
  });

  // Totais do topo ignoram o seletor de tipo: os dois blocos ficam sempre
  // visíveis e separados, porque as métricas não são comparáveis.
  const semKind = filterRows(source, {
    ...periodo,
    campaigns: params.campaigns,
    adsets: params.adsets,
    cursos: params.cursos,
    pracas: params.pracas,
    kind: "todos",
    search: params.search,
  });

  const summary = computeSummary(filtered);
  const aggregated = aggregateRows(filtered, params.level);
  const sorted = sortAggregatedRows(aggregated, params.sortBy, params.sortDir);

  const total = sorted.length;
  const start = (params.page - 1) * params.pageSize;
  const rows = sorted.slice(start, start + params.pageSize);

  void noPeriodo;

  return {
    rows,
    summary,
    total,
    page: params.page,
    pageSize: params.pageSize,
    filterOptions,
    kindTotals: {
      conversao: totaisPorTipo(semKind.filter((r) => r.kind === "conversao")),
      branding: totaisPorTipo(semKind.filter((r) => r.kind === "branding")),
    },
    breakdown: {
      porCurso: agrupar(filtered, (r) => r.curso),
      porPraca: agrupar(filtered, (r) => r.praca),
    },
    funil: montarFunil(filtered),
  };
}
