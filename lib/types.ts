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
  matriculas: MatriculasResumo;
  /**
   * Investimento por plataforma.
   *
   * Os cards de Conversão e Branding leem só a Meta, porque as métricas de
   * anúncio que eles mostram — cliques, CTR, custo por resultado — só
   * existem lá. Mas o card de investimento total precisa somar tudo, senão
   * a mesma tela exibe dois valores para "investimento em conversão": o dos
   * cards e o da aba Praça × Curso, com dezenas de milhares de diferença.
   */
  investimento: {
    meta: number;
    /**
     * Google Ads e o que mais entrar por `midia_insights`, separado por
     * tipo. Num número só, o card somava o Google de branding sob o filtro
     * de conversão e divergia da aba Praça × Curso.
     */
    externo: {
      conversao: number;
      branding: number;
    };
  };
  /**
   * Os três eixos vêm juntos: são poucas centenas de linhas no total, e
   * calcular os três de uma vez deixa o seletor da aba trocar de recorte
   * sem uma nova ida ao servidor.
   */
  matriz: {
    pracaCurso: MatrizItem[];
    porPraca: MatrizItem[];
    porCurso: MatrizItem[];
  };
}

/** Funil: impressões → cliques no link → resultado → matrícula. */
export interface Funil {
  impressoes: number;
  alcance: number;
  cliquesLink: number;
  resultados: number;
  /** % de impressões que viraram clique no link — conversão do anúncio */
  taxaAnuncio: number;
  /** % de cliques que viraram resultado — conversão da página */
  taxaPagina: number;
  /**
   * O resultado desta etapa vem depois de um clique no link?
   *
   * Para campanha de lead, sim: o pixel dispara na página. Para engajamento
   * ou visita de perfil, **não** — a ação acontece dentro do próprio Meta,
   * sem passar pelo site. Aí `taxaPagina` compara duas grandezas que não se
   * seguem e estoura: 72.832 engajamentos sobre 15.066 cliques davam
   * "conversão da página: 483%" na tela.
   */
  resultadoAposClique: boolean;
  /** Resultados sobre impressões — a leitura que vale quando não há clique no meio. */
  taxaSobreImpressoes: number;
  investimento: number;
  indicador: string | null;
  /**
   * Matrículas confirmadas no mesmo período, curso e praça.
   *
   * Não vêm da Meta: são carregadas da planilha do sistema acadêmico e
   * cruzadas por (dia, praça, curso), o único trio que as duas bases têm em
   * comum. Nulo quando não há dado de matrícula para o recorte.
   */
  matriculas: number | null;
  /** % de resultados que viraram matrícula — conversão comercial */
  taxaMatricula: number;
}

/**
 * Bloco de matrículas do período.
 *
 * Segue **período, curso e praça**. Não segue campanha, conjunto, tipo nem
 * busca: sem atribuição por clique, não há como dizer que uma matrícula
 * saiu de um anúncio específico. O `investimento` é sempre o de conversão —
 * branding fica fora do denominador do CAC.
 */
export interface MatriculasResumo {
  total: number;
  /** Receita semestral efetivamente informada nas matrículas contadas. */
  receita: number;
  /** Quantas foram carregadas sem valor (o arquivo diário só traz contagem) */
  semReceita: number;
  /** Investimento em conversão no mesmo recorte de período, curso e praça. */
  investimento: number;
  /** investimento ÷ total. É blended: matrícula orgânica entra na conta. */
  cac: number;
  /** Receita gerada sobre o investimento em conversão. */
  roi: number;
  /** % de leads que viraram matrícula */
  taxaMatricula: number;
  /** Última data com matrícula carregada no banco — a fronteira do dado. */
  dadoAte: string | null;
  /**
   * O período pedido vai além de `dadoAte`. Sem isso, dia sem carga aparece
   * como dia de zero matrícula, que lê como queda de performance.
   */
  periodoIncompleto: boolean;
  /**
   * Há filtro de campanha, conjunto ou busca ativo — recortes que a
   * matrícula não acompanha, porque sem atribuição por clique não há como
   * dizer de que campanha ela saiu. O total continua sendo o do período
   * inteiro, e a tela precisa dizer isso.
   *
   * Tipo não entra: investimento de conversão e total de matrícula são os
   * mesmos em "Tudo" e em "Conversão".
   */
  filtroNaoAplicado: boolean;
}

/**
 * Uma linha da matriz praça × curso.
 *
 * `investimento` e `leads` são sempre de conversão — branding não entra em
 * CPL nem em CAC. No eixo de uma dimensão só, o campo da outra vem vazio.
 */
export interface MatrizItem {
  id: string;
  praca: string;
  curso: string;
  investimento: number;
  /**
   * Quanto do investimento veio de rateio, de 0 a 1.
   *
   * Em 1, nenhuma campanha citou aquele curso naquela praça: o valor foi
   * arbitrado a partir de campanha nacional, ponderado pelas matrículas do
   * destino. O CAC da linha vira `investimento ÷ matrículas` com um
   * numerador que ninguém mediu, e a tabela marca essas linhas para não
   * serem lidas como medição.
   */
  fracaoRateada: number;
  leads: number;
  /** investimento ÷ leads */
  cpl: number;
  matriculas: number;
  /** investimento ÷ matrículas — blended, inclui a matrícula orgânica */
  cac: number;
  receita: number;
  /** receita ÷ investimento */
  roi: number;
  /** % de leads que viraram matrícula */
  taxaConversao: number;
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
  /** Matrículas confirmadas no grupo, no mesmo período. */
  matriculas: number;
  /** Investimento em conversão ÷ matrículas. Zero quando não houve matrícula. */
  cac: number;
  /** Receita semestral das matrículas do grupo. */
  receita: number;
}
