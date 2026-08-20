import type { CampaignKind } from "@/lib/campaign-taxonomy";

export type AggregationLevel = "campaign" | "adset" | "ad";

/** Filtro de topo: branding e conversão não são somáveis na mesma métrica. */
export type KindFilter = "todos" | CampaignKind;

export type SortDirection = "asc" | "desc";

export type MetricKey =
  | "spend"
  | "impressions"
  | "clicks"
  | "ctr"
  | "cpc"
  | "cpm"
  | "results"
  | "cost_per_result";

export type ColumnKey = MetricKey | "headline" | "primary_text" | "name";

/** Painel de vídeo do Meta, replicado a partir da API. */
export interface VideoDesempenho {
  reproducoes: number;
  tempoMedioSec: number;
  /** 4o ponto da curva — e como o Meta calcula a "taxa de atencao inicial" */
  atencaoInicial: number;
  /** ThruPlay sobre reproducoes */
  retencao: number;
  /** 22 pontos, do inicio ao fim do video, em % de quem ainda assiste */
  curva: number[];
}

/** Quartis de retenção no estilo Meta Ads (0–100% de quem iniciou o vídeo). */
export interface VideoRetention {
  /** Quantidade de plays / video views no período */
  plays: number;
  /** Tempo médio assistido (segundos) */
  avg_watch_time_sec: number;
  /** Duração total do vídeo (segundos) */
  duration_sec: number;
  /** % que chegou a 25% do vídeo */
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  p100: number;
}

export type RetentionDiagnosisArea = "hook" | "conteudo" | "cta" | "saudavel";

export interface RetentionDiagnosis {
  area: RetentionDiagnosisArea;
  label: string;
  hint: string;
  dropHook: number;
  dropMid: number;
  dropEnd: number;
}

export interface AdInsightRow {
  ad_id: string;
  ad_name: string;
  adset_id: string;
  adset_name: string;
  campaign_id: string;
  campaign_name: string;
  date_start: string;
  date_stop: string;
  spend: number;
  impressions: number;
  /** Pessoas únicas alcançadas */
  reach: number;
  /** Cliques que levaram ao site — base da conversão de página */
  inline_link_clicks: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  results: number;
  cost_per_result: number;
  headline: string | null;
  primary_text: string | null;
  description: string | null;
  call_to_action: string | null;
  image_url: string | null;
  video_id: string | null;
  /** URL do vídeo no storage (reproduzível no player) */
  video_storage_url: string | null;
  /** Transcrição do áudio/vídeo (quando processada) */
  video_transcript: string | null;
  link_url: string | null;
  video_retention: VideoRetention | null;
  video_desempenho: VideoDesempenho | null;
  /** Objetivo da campanha no Meta (OUTCOME_LEADS, LINK_CLICKS…) */
  objective: string | null;
  /** Qual ação o Meta contou como resultado */
  result_indicator: string | null;
  /** Derivados do nome da campanha */
  curso: string;
  praca: string;
  kind: CampaignKind;
  recorte: string | null;
}

export interface AggregatedRow {
  id: string;
  name: string;
  campaign_name: string;
  adset_name: string | null;
  ad_name: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  results: number;
  cost_per_result: number;
  headline: string | null;
  primary_text: string | null;
  description: string | null;
  call_to_action: string | null;
  image_url: string | null;
  video_id: string | null;
  video_storage_url: string | null;
  video_transcript: string | null;
  link_url: string | null;
  video_retention: VideoRetention | null;
  video_desempenho: VideoDesempenho | null;
  ad_count: number;
  objective: string | null;
  result_indicator: string | null;
  curso: string;
  praca: string;
  kind: CampaignKind;
  recorte: string | null;
}

export interface SummaryTotals {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  results: number;
  cost_per_result: number;
}

export interface InsightsQueryParams {
  level: AggregationLevel;
  dateFrom: string;
  dateTo: string;
  campaigns: string[];
  adsets: string[];
  cursos: string[];
  pracas: string[];
  kind: KindFilter;
  search: string;
  sortBy: MetricKey | null;
  sortDir: SortDirection | null;
  page: number;
  pageSize: number;
}

export interface InsightsResponse {
  rows: AggregatedRow[];
  summary: SummaryTotals;
  total: number;
  page: number;
  pageSize: number;
  filterOptions: {
    campaigns: string[];
    adsets: string[];
    /** Já cruzados entre si: curso reflete a praça escolhida e vice-versa. */
    cursos: string[];
    pracas: string[];
  };
  /**
   * Totais por tipo. Branding conta cliques e conversão conta leads —
   * somar os dois num número só distorce o resultado, então vêm separados.
   */
  kindTotals: {
    conversao: SummaryTotals & { indicador: string | null };
    branding: SummaryTotals & { indicador: string | null };
  };
  breakdown: {
    porCurso: BreakdownItem[];
    porPraca: BreakdownItem[];
  };
  funil: Funil;
}

/** Funil: impressões → cliques no link → resultado. */
export interface Funil {
  impressoes: number;
  alcance: number;
  cliquesLink: number;
  resultados: number;
  /** % de impressões que viraram clique no link — conversão do anúncio */
  taxaAnuncio: number;
  /** % de cliques que viraram resultado — conversão da página */
  taxaPagina: number;
  investimento: number;
  indicador: string | null;
}

export interface BreakdownItem {
  nome: string;
  spend: number;
  results: number;
  cost_per_result: number;
  ads: number;
  impressions: number;
  cliquesLink: number;
  /** % de impressões que viraram clique — qualidade do criativo */
  taxaAnuncio: number;
  /** % de cliques que viraram resultado — qualidade da página/oferta */
  taxaPagina: number;
}
