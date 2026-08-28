import {
  aggregateRows,
  computeSummary,
  filterRows,
  sortAggregatedRows,
} from "@/lib/aggregations";
import { classificarCampanha } from "@/lib/campaign-taxonomy";
import {
  indexarMatriculas,
  type IndiceMatriculas,
  type MatriculaAgregada,
} from "@/lib/matriculas";
import { montarMatriz, redistribuirNacional } from "@/lib/matriz";
import { MOCK_INSIGHTS } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";
import { montarDesempenho } from "@/lib/video-retention";
import type {
  AdInsightRow,
  BreakdownItem,
  Funil,
  InsightsQueryParams,
  InsightsResponse,
  MatriculasResumo,
  SummaryTotals,
  VideoRetention,
} from "@/lib/types";

function agrupar(
  rows: AdInsightRow[],
  chave: (r: AdInsightRow) => string,
  indice: IndiceMatriculas
): BreakdownItem[] {
  const mapa = new Map<string, BreakdownItem>();
  // ad_ids distintos por grupo: somar linhas contaria o mesmo anúncio
  // uma vez por dia do período.
  const anuncios = new Map<string, Set<string>>();

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
      matriculas: 0,
      cac: 0,
      receita: 0,
    };
    atual.spend += r.spend;
    atual.results += r.results;
    atual.impressions += r.impressions;
    atual.cliquesLink += r.inline_link_clicks;
    mapa.set(nome, atual);

    if (!anuncios.has(nome)) anuncios.set(nome, new Set());
    anuncios.get(nome)!.add(r.ad_id);
  }

  // Curso que teve matrícula mas nenhuma campanha ainda assim entra.
  //
  // Administração fez 64 matrículas em julho/agosto sem um real de mídia. Se
  // o grupo só nascesse a partir de linha de anúncio, essas matrículas
  // sumiriam do gráfico enquanto continuariam no total do card — e a soma das
  // barras não bateria com o número lá em cima. Com gasto zero, essas linhas
  // caem fora dos gráficos de custo por si mesmas.
  for (const nome of indice.quantidade.keys()) {
    if (mapa.has(nome)) continue;
    mapa.set(nome, {
      nome,
      spend: 0,
      results: 0,
      cost_per_result: 0,
      ads: 0,
      impressions: 0,
      cliquesLink: 0,
      taxaAnuncio: 0,
      taxaPagina: 0,
      matriculas: 0,
      cac: 0,
      receita: 0,
    });
  }

  return Array.from(mapa.values())
    .map((i) => {
      const matriculas = indice.quantidade.get(i.nome) ?? 0;
      const investimento = indice.investimento.get(i.nome) ?? 0;
      return {
        ...i,
        ads: anuncios.get(i.nome)?.size ?? 0,
        spend: Math.round(i.spend * 100) / 100,
        cost_per_result: i.results ? Math.round((i.spend / i.results) * 1e4) / 1e4 : 0,
        // Mesmas quatro casas da matriz: são taxas de exibição, não somam.
        taxaAnuncio: i.impressions ? Math.round((i.cliquesLink / i.impressions) * 1e6) / 1e4 : 0,
        taxaPagina: i.cliquesLink ? Math.round((i.results / i.cliquesLink) * 1e6) / 1e4 : 0,
        matriculas,
        cac: matriculas ? Math.round((investimento / matriculas) * 1e4) / 1e4 : 0,
        receita: Math.round((indice.receita.get(i.nome) ?? 0) * 100) / 100,
      };
    })
    .sort((a, b) => b.spend - a.spend);
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
}

type RawInsightRow = AdInsightRow & {
  video_play_curve?: number[] | null;
  video_thruplay?: number | null;
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
    video_desempenho: montarDesempenho({
      plays: row.video_plays,
      tempoMedioSec: row.video_avg_watch_time_sec,
      thruplay: row.video_thruplay,
      curva: row.video_play_curve,
    }),
    ...taxonomia,
  };
}

/** Colunas de métrica — variam por dia, precisam vir de todas as linhas. */
const COLUNAS_METRICA = [
  "ad_id", "ad_name", "adset_id", "adset_name", "campaign_id", "campaign_name",
  "date_start", "date_stop", "spend", "impressions", "reach", "clicks",
  "inline_link_clicks", "ctr", "cpc", "cpm", "results", "cost_per_result",
  "objective", "result_indicator", "video_plays", "video_avg_watch_time_sec",
  "video_duration_sec", "video_p25", "video_p50", "video_p75", "video_p95",
  "video_p100", "video_play_curve", "video_thruplay",
].join(",");

/** Teto de linhas por resposta do PostgREST. */
const PAGE = 1000;

/**
 * Busca todas as páginas de uma consulta de uma vez só.
 *
 * O PostgREST devolve no máximo mil linhas, e dois meses de anúncios dão
 * doze páginas. Em série era ida-e-volta empilhada: 7,4s só de latência.
 * A contagem diz de antemão quantas páginas existem, então elas saem juntas.
 *
 * Duas garantias:
 *
 * A ordenação é sempre pela chave única, então as fatias não se sobrepõem
 * nem deixam buraco — foi o que já mordeu esta consulta uma vez, quando ela
 * ordenava por `cost_per_result`, cheio de nulo e empate.
 *
 * Se alguém inserir linha entre a contagem e a busca, a última fatia volta
 * cheia e o laço de sobra continua em série até esgotar. Sem isso a carga
 * diária do n8n rodando no meio de uma consulta faria sumir o excedente.
 */
async function buscarTodasAsPaginas<T>(
  contar: () => Promise<number | null>,
  pagina: (inicio: number) => Promise<T[]>
): Promise<T[]> {
  const total = await contar().catch(() => null);

  // Sem contagem confiável, o laço sequencial continua correto.
  if (total === null) {
    const todas: T[] = [];
    for (let inicio = 0; ; inicio += PAGE) {
      const lote = await pagina(inicio);
      todas.push(...lote);
      if (lote.length < PAGE) break;
    }
    return todas;
  }

  const quantas = Math.ceil(total / PAGE);
  if (quantas === 0) return [];

  const lotes = await Promise.all(
    Array.from({ length: quantas }, (_, i) => pagina(i * PAGE))
  );
  const todas = lotes.flat();

  // Só vale procurar sobra se a última fatia veio cheia.
  if (lotes[lotes.length - 1]?.length === PAGE) {
    for (let inicio = quantas * PAGE; ; inicio += PAGE) {
      const lote = await pagina(inicio);
      todas.push(...lote);
      if (lote.length < PAGE) break;
    }
  }

  return todas;
}

/** Criativo é por anúncio, não por anúncio-por-dia. */
const COLUNAS_CRIATIVO =
  "ad_id,headline,primary_text,description,call_to_action,image_url,video_id,link_url,video_storage_url,video_transcript";

type LinhaCriativo = {
  ad_id: string;
  headline: string | null;
  primary_text: string | null;
  description: string | null;
  call_to_action: string | null;
  image_url: string | null;
  video_id: string | null;
  link_url: string | null;
  video_storage_url: string | null;
  video_transcript: string | null;
};

/**
 * Busca criativos uma vez por anúncio.
 *
 * Lê-los junto com as métricas trazia o mesmo texto repetido em cada linha-dia:
 * 1.052 criativos viravam 8.720 cópias, ~5 MB de payload redundante.
 */
/**
 * Cache dos criativos.
 *
 * Criativo é por anúncio e **não depende do intervalo de datas** — mas antes
 * ele era rebuscado inteiro em toda troca de período, porque só as linhas de
 * métrica eram cacheadas. Medido: 2,3s em 3 páginas, jogados fora a cada vez
 * que alguém empurrava a data inicial em um dia.
 */
let cacheCriativos: { em: number; mapa: Map<string, LinhaCriativo> } | null = null;

async function fetchCriativos(): Promise<Map<string, LinhaCriativo>> {
  if (cacheCriativos && Date.now() - cacheCriativos.em <= TTL_CACHE_MS) {
    return cacheCriativos.mapa;
  }

  const mapa = new Map<string, LinhaCriativo>();

  const paginas = await buscarTodasAsPaginas(
    async () => {
      const { count } = await supabase
        .from("ad_creatives")
        .select("ad_id", { count: "exact", head: true });
      return count ?? null;
    },
    async (inicio) => {
      const { data, error } = await supabase
        .from("ad_creatives")
        .select(COLUNAS_CRIATIVO)
        .order("ad_id", { ascending: true })
        .range(inicio, inicio + PAGE - 1);
      if (error) throw new Error(`Erro ao buscar criativos: ${error.message}`);
      return (data ?? []) as unknown as LinhaCriativo[];
    }
  );

  for (const c of paginas) mapa.set(c.ad_id, c);
  cacheCriativos = { em: Date.now(), mapa };
  return mapa;
}

/**
 * Cache das linhas cruas por intervalo de datas.
 *
 * Buscar 30 dias custa ~9s: são 8.700 linhas em 9 idas ao Supabase. Mas o
 * dado só muda uma vez por dia, quando o n8n roda às 6h — reconsultar a cada
 * clique de filtro é desperdício puro. Filtro e agregação continuam em
 * memória e são baratos.
 *
 * TTL curto o suficiente para uma reexecução manual do workflow aparecer sem
 * ninguém precisar reiniciar o servidor.
 */
const TTL_CACHE_MS = 5 * 60 * 1000;
const cacheLinhas = new Map<string, { em: number; linhas: AdInsightRow[] }>();

function lerCache(chave: string): AdInsightRow[] | null {
  const item = cacheLinhas.get(chave);
  if (!item) return null;
  if (Date.now() - item.em > TTL_CACHE_MS) {
    cacheLinhas.delete(chave);
    return null;
  }
  return item.linhas;
}

function gravarCache(chave: string, linhas: AdInsightRow[]) {
  // Poda entradas vencidas para o mapa não crescer sem limite conforme o
  // usuário navega por períodos diferentes.
  const agora = Date.now();
  for (const [k, v] of cacheLinhas) {
    if (agora - v.em > TTL_CACHE_MS) cacheLinhas.delete(k);
  }
  cacheLinhas.set(chave, { em: agora, linhas });
}

async function fetchFromSupabase(
  dateFrom: string,
  dateTo: string
): Promise<AdInsightRow[]> {
  const chave = `${dateFrom}..${dateTo}`;
  const emCache = lerCache(chave);
  if (emCache) return emCache;

  // A ordenação precisa ser determinística: a view ordena por
  // (date_start, cost_per_result), e cost_per_result tem muitos nulos e
  // empates. Sem desempate estável o Postgres pode devolver a mesma linha em
  // duas páginas — e omitir outra. Ordenamos pela chave única (ad_id,
  // date_start), que não empata.
  //
  // As páginas e os criativos saem em paralelo: são consultas independentes,
  // e esperar uma para começar a outra somava latência à toa.
  const [todas, criativos] = await Promise.all([
    buscarTodasAsPaginas(
      async () => {
        const { count } = await supabase
          .from("v_ads_performance")
          .select("ad_id", { count: "exact", head: true })
          .gte("date_start", dateFrom)
          .lte("date_start", dateTo);
        return count ?? null;
      },
      async (inicio) => {
        const { data, error } = await supabase
          .from("v_ads_performance")
          .select(COLUNAS_METRICA)
          .gte("date_start", dateFrom)
          .lte("date_start", dateTo)
          .order("date_start", { ascending: true })
          .order("ad_id", { ascending: true })
          .range(inicio, inicio + PAGE - 1);

        if (error) throw new Error(`Erro ao buscar insights: ${error.message}`);
        return (data ?? []) as unknown as RawInsightRow[];
      }
    ),
    fetchCriativos(),
  ]);

  const linhas = todas.map((linha) =>
    normalizeRow({ ...linha, ...(criativos.get(linha.ad_id) ?? {}) })
  );
  gravarCache(chave, linhas);
  return linhas;
}

/**
 * Matrículas do período, direto da tabela agregada.
 *
 * Volume pequeno — pouco mais de mil grupos em dois meses — mas cacheado
 * junto com o resto porque o dado só muda quando alguém roda o importador.
 */
const cacheMatriculas = new Map<
  string,
  { em: number; linhas: MatriculaAgregada[] }
>();

async function fetchMatriculas(
  dateFrom: string,
  dateTo: string
): Promise<MatriculaAgregada[] | null> {
  const chave = `${dateFrom}..${dateTo}`;
  const item = cacheMatriculas.get(chave);
  if (item && Date.now() - item.em <= TTL_CACHE_MS) return item.linhas;

  // Dois meses já passam de mil grupos, ou seja, mais de uma página. Em
  // série isso é uma ida de rede a mais por página, dentro do caminho
  // crítico da resposta.
  let erro = false;
  const todas = await buscarTodasAsPaginas(
    async () => {
      const { count } = await supabase
        .from("matriculas")
        .select("data", { count: "exact", head: true })
        .gte("data", dateFrom)
        .lte("data", dateTo);
      return count ?? null;
    },
    async (inicio) => {
      const { data, error } = await supabase
        .from("matriculas")
        .select("data,praca,curso,quantidade,receita_semestral")
        .gte("data", dateFrom)
        .lte("data", dateTo)
        .order("data", { ascending: true })
        .order("praca", { ascending: true })
        .order("curso", { ascending: true })
        .range(inicio, inicio + PAGE - 1);

      // A tabela pode ainda não existir — o dashboard de mídia continua de
      // pé sem ela, só sem a etapa de matrícula.
      if (error) erro = true;
      return (data ?? []) as unknown as MatriculaAgregada[];
    }
  );
  // Nulo, e não lista vazia: falha de rede aqui com `dadoAte` quente no
  // cache desenhava a etapa de matrícula com zero, CAC zero e ROI zero —
  // uma queda que não aconteceu. Quem chama distingue "não deu para ler"
  // de "não houve matrícula".
  if (erro) return null;

  for (const [k, v] of cacheMatriculas) {
    if (Date.now() - v.em > TTL_CACHE_MS) cacheMatriculas.delete(k);
  }
  cacheMatriculas.set(chave, { em: Date.now(), linhas: todas });
  return todas;
}

/**
 * Mídia de fora da Meta — hoje as duas contas do Google Ads.
 *
 * Vem no grão de campanha por dia, que é mais grosso que o da Meta (anúncio
 * por dia). Isso não atrapalha: quem consome esta função é a camada de
 * CPL/CAC/ROI, que agrega em (dia, praça, curso) de qualquer jeito. O funil,
 * a tabela de anúncios e o painel de vídeo continuam só Meta, porque
 * dependem de criativo e o Google Ads Script não entrega isso.
 *
 * O nome da campanha passa pela mesma `classificarCampanha` da Meta. As três
 * convenções que convivem — praça no fim, praça no começo, formato com
 * barras — estão cobertas por `tests/campanhas-google.test.ts`.
 */
type LinhaMidiaExterna = {
  data: string;
  campaign_name: string;
  channel_type: string | null;
  spend: number;
  conversions: number;
};

const cacheMidiaExterna = new Map<
  string,
  { em: number; linhas: AdInsightRow[] }
>();

/**
 * O Google não tem `objective` como a Meta. O tipo de canal faz o papel:
 * VIDEO é compra de alcance, o resto é aquisição. O nome ainda pode dizer
 * "branding" e `classificarCampanha` respeita isso por conta própria.
 */
function objetivoDoCanal(channelType: string | null): string {
  return channelType === "VIDEO" ? "OUTCOME_AWARENESS" : "OUTCOME_LEADS";
}

async function fetchMidiaExterna(
  dateFrom: string,
  dateTo: string
): Promise<AdInsightRow[]> {
  const chave = `${dateFrom}..${dateTo}`;
  const item = cacheMidiaExterna.get(chave);
  if (item && Date.now() - item.em <= TTL_CACHE_MS) return item.linhas;

  let erro = false;
  const todas = await buscarTodasAsPaginas(
    async () => {
      const { count } = await supabase
        .from("midia_insights")
        .select("data", { count: "exact", head: true })
        .gte("data", dateFrom)
        .lte("data", dateTo);
      return count ?? null;
    },
    async (inicio) => {
      const { data, error } = await supabase
        .from("midia_insights")
        .select("data,campaign_name,channel_type,spend,conversions")
        .gte("data", dateFrom)
        .lte("data", dateTo)
        .order("data", { ascending: true })
        .order("campaign_id", { ascending: true })
        .range(inicio, inicio + PAGE - 1);

      // A tabela pode ainda não existir — o dashboard segue de pé só com a
      // Meta, do mesmo jeito que segue sem matrículas.
      if (error) erro = true;
      return (data ?? []) as unknown as LinhaMidiaExterna[];
    }
  );
  if (erro) return [];

  // Vira `AdInsightRow` para atravessar o mesmo `filterRows` da Meta. Os
  // campos que só existem no grão de anúncio ficam zerados de propósito:
  // impressão e clique do Google não entram no funil, que é Meta.
  const linhas = todas.map((l) => {
    const taxonomia = classificarCampanha(
      l.campaign_name,
      objetivoDoCanal(l.channel_type)
    );
    return {
      ...MOLDE_EXTERNO,
      ad_id: `google:${l.campaign_name}:${l.data}`,
      ad_name: l.campaign_name,
      adset_name: l.campaign_name,
      campaign_name: l.campaign_name,
      date_start: l.data,
      date_stop: l.data,
      spend: Number(l.spend ?? 0),
      results: Number(l.conversions ?? 0),
      ...taxonomia,
    } as AdInsightRow;
  });

  for (const [k, v] of cacheMidiaExterna) {
    if (Date.now() - v.em > TTL_CACHE_MS) cacheMidiaExterna.delete(k);
  }
  cacheMidiaExterna.set(chave, { em: Date.now(), linhas });
  return linhas;
}

/** Campos de anúncio que a mídia externa não tem. Zerados, nunca inventados. */
const MOLDE_EXTERNO = {
  adset_id: "",
  campaign_id: "",
  impressions: 0,
  reach: 0,
  inline_link_clicks: 0,
  clicks: 0,
  ctr: 0,
  cpc: 0,
  cpm: 0,
  cost_per_result: 0,
  headline: null,
  primary_text: null,
  description: null,
  call_to_action: null,
  image_url: null,
  video_id: null,
  video_storage_url: null,
  video_transcript: null,
  link_url: null,
  video_retention: null,
  video_desempenho: null,
  objective: null,
  result_indicator: null,
} as const;

/**
 * Até quando existe matrícula carregada.
 *
 * A mídia vai até ontem; a matrícula, até o último arquivo que alguém
 * mandou. Sem essa fronteira o dashboard pinta "ainda não carregado" como
 * "zero matrículas", e o padrão de sete dias cai justamente na borda.
 */
let cacheDadoAte: { em: number; valor: string | null } | null = null;

async function fetchDadoAte(): Promise<string | null> {
  if (cacheDadoAte && Date.now() - cacheDadoAte.em <= TTL_CACHE_MS) {
    return cacheDadoAte.valor;
  }
  const { data, error } = await supabase
    .from("matriculas")
    .select("data")
    .order("data", { ascending: false })
    .limit(1);

  // Falha não entra no cache.
  //
  // Cacheando o erro junto com o sucesso, uma consulta que falhou congelava
  // `null` por cinco minutos — e `null` desliga o aviso de período
  // incompleto, que é justamente o alerta de "esse dado não existe ainda".
  // Aconteceu na carga inicial: a tabela passou a existir e o dashboard
  // seguiu jurando que não havia matrícula nenhuma. Falha tem que ser
  // retentada na próxima chamada, não memorizada.
  if (error) return null;

  const valor = (data?.[0]?.data as string | undefined) ?? null;
  cacheDadoAte = { em: Date.now(), valor };
  return valor;
}

/**
 * O indicador do Meta descreve uma ação que só acontece depois do clique?
 *
 * Conversão de pixel e visita à página passam pelo site, então descendem do
 * clique no link. Engajamento, visita de perfil e view de vídeo acontecem
 * dentro do Meta — quem engaja nunca saiu de lá. Dividir um pelo outro não
 * dá taxa de conversão, dá número sem referente.
 *
 * Sem indicador único (período misturando objetivos) a decisão cai no dado:
 * resultado acima do número de cliques não pode ter vindo de clique.
 */
function resultadoVemDoClique(
  indicador: string | null,
  resultados: number,
  cliques: number
): boolean {
  if (!indicador) return resultados <= cliques;

  if (/^(offsite_conversion|onsite_conversion)\./.test(indicador)) return true;

  return ["landing_page_view", "link_click", "lead", "complete_registration", "purchase"].includes(
    indicador
  );
}

function montarFunil(rows: AdInsightRow[], matriculas: number | null): Funil {
  const soma = (f: (r: AdInsightRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  const impressoes = soma((r) => r.impressions);
  const cliquesLink = soma((r) => r.inline_link_clicks);
  const resultados = soma((r) => r.results);

  const indicadores = uniqueSorted(
    rows.map((r) => (r.result_indicator ?? "").replace(/^actions:/, ""))
  );

  const indicador = indicadores.length === 1 ? indicadores[0] : null;

  return {
    impressoes,
    alcance: soma((r) => r.reach),
    cliquesLink,
    resultados,
    taxaAnuncio: impressoes ? (cliquesLink / impressoes) * 100 : 0,
    taxaPagina: cliquesLink ? (resultados / cliquesLink) * 100 : 0,
    resultadoAposClique: resultadoVemDoClique(indicador, resultados, cliquesLink),
    taxaSobreImpressoes: impressoes ? (resultados / impressoes) * 100 : 0,
    investimento: soma((r) => r.spend),
    indicador,
    matriculas,
    taxaMatricula:
      resultados && matriculas !== null ? (matriculas / resultados) * 100 : 0,
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
  /*
    Mock só quando pedido explicitamente.

    O padrão era o contrário — `!== "false"` —, então quem clonasse o repo e
    subisse sem definir a variável recebia `lib/mock-data.ts` com cara de
    dado real: números plausíveis, nenhum aviso na tela. Errar para o lado
    de "sem dados" é recuperável; errar para o lado de "dados inventados"
    não, porque ninguém percebe.
  */
  const useMock = process.env.USE_MOCK_DATA === "true";

  /*
    As quatro consultas saem juntas.

    São independentes entre si — mídia da Meta, matrículas, fronteira do dado
    e mídia externa não se referenciam. Em série custavam 3,3s empilhados
    (1,7 + 0,7 + 0,3 + 0,6); em paralelo, o tempo é o da mais lenta.
  */
  const [source, matriculasLidas, dadoAte, externa] = await Promise.all([
    useMock
      ? Promise.resolve(MOCK_INSIGHTS.map((r) => normalizeRow(r as RawInsightRow)))
      : fetchFromSupabase(params.dateFrom, params.dateTo),
    useMock
      ? Promise.resolve<MatriculaAgregada[] | null>([])
      : fetchMatriculas(params.dateFrom, params.dateTo),
    useMock ? Promise.resolve(null) : fetchDadoAte(),
    useMock ? Promise.resolve([]) : fetchMidiaExterna(params.dateFrom, params.dateTo),
  ]);

  const matriculasIndisponiveis = matriculasLidas === null;
  const matriculasPeriodo = matriculasLidas ?? [];

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
  const opcoesPara = (
    excluir: "cursos" | "pracas" | "campaigns" | "adsets",
    linhas: AdInsightRow[] = source
  ) =>
    filterRows(linhas, {
      ...periodo,
      kind: params.kind,
      search: params.search,
      cursos: excluir === "cursos" ? [] : params.cursos,
      pracas: excluir === "pracas" ? [] : params.pracas,
      campaigns: excluir === "campaigns" ? [] : params.campaigns,
      adsets: excluir === "adsets" || excluir === "campaigns" ? [] : params.adsets,
    });

  /*
    Curso e praça saem de TODAS as fontes, não só da Meta.

    O seletor listava 22 cursos enquanto o gráfico e a matriz mostravam 53:
    curso que só tem verba no Google, ou só matrícula, aparecia na tela sem
    poder ser filtrado. Administração é o caso extremo — 64 matrículas em
    julho e agosto, nenhum real de mídia. Opção que a tela mostra tem que
    ser opção que a tela deixa escolher.

    Campanha e conjunto continuam vindo só da Meta: são os únicos níveis que
    existem lá.
  */
  const universo = [...source, ...externa];

  // Matrícula não tem campanha, conjunto nem tipo — cruza só com a outra
  // dimensão dela mesma.
  const matriculasPara = (excluir: "cursos" | "pracas") =>
    matriculasPeriodo.filter(
      (m) =>
        (excluir === "cursos" || !params.cursos.length || params.cursos.includes(m.curso)) &&
        (excluir === "pracas" || !params.pracas.length || params.pracas.includes(m.praca))
    );

  const filterOptions = {
    cursos: uniqueSorted([
      ...opcoesPara("cursos", universo).map((r) => r.curso),
      ...matriculasPara("cursos").map((m) => m.curso),
    ]),
    pracas: uniqueSorted([
      ...opcoesPara("pracas", universo).map((r) => r.praca),
      ...matriculasPara("pracas").map((m) => m.praca),
    ]),
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

  // ---- matrículas -------------------------------------------------------
  //
  // Seguem período, curso e praça — e só. Campanha, conjunto, tipo e busca
  // ficam de fora porque não existe atribuição por clique: nada na base de
  // matrículas aponta para um anúncio. O investimento que serve de
  // denominador do CAC é sempre o de conversão, no mesmo recorte.

  const matriculasFiltradas = matriculasPeriodo.filter(
    (m) =>
      (!params.cursos.length || params.cursos.includes(m.curso)) &&
      (!params.pracas.length || params.pracas.includes(m.praca))
  );

  // A praça só é filtrada DEPOIS de redistribuir o gasto nacional.
  //
  // Se o filtro viesse antes, escolher Canoas deixaria Canoas como única
  // praça conhecida de Medicina — e ela receberia 100% do que a campanha
  // nacional gastou, em vez de um sétimo. O universo de destinos precisa ser
  // o mesmo esteja o filtro ligado ou não.
  // A mídia externa entra AQUI, antes do rateio: campanha nacional do Google
  // cai na praça "Brasil" e é distribuída pelas praças do curso exatamente
  // como as da Meta. Depois do rateio, ficaria num balde morto.

  const conversaoTodasPracas = filterRows([...source, ...externa], {
    ...periodo,
    ...vazio,
    cursos: params.cursos,
    kind: "conversao",
  });
  const matriculasTodasPracas = matriculasPeriodo.filter(
    (m) => !params.cursos.length || params.cursos.includes(m.curso)
  );

  const atribuido = redistribuirNacional(conversaoTodasPracas, matriculasTodasPracas);
  const linhasConversao = params.pracas.length
    ? atribuido.filter((l) => params.pracas.includes(l.praca))
    : atribuido;

  const indicePorCurso = indexarMatriculas(matriculasFiltradas, linhasConversao, "curso");
  const indicePorPraca = indexarMatriculas(matriculasFiltradas, linhasConversao, "praca");

  const temMatriculas =
    !matriculasIndisponiveis && (matriculasPeriodo.length > 0 || dadoAte !== null);

  /*
    Há filtro ativo que a matrícula não consegue acompanhar?

    Campanha, conjunto e busca recortam o lado da mídia sem recortar o da
    matrícula — sem atribuição por clique, não há como dizer de que campanha
    saiu uma matrícula. Qualquer razão entre os dois lados fica sem
    referente enquanto um deles estiver assim.

    Tipo NÃO entra: o investimento de conversão e o total de matrículas são
    os mesmos com o seletor em "Tudo" ou em "Conversão", então avisar ali
    seria alarme falso no filtro mais usado da tela.
  */
  const matriculaNaoSegue =
    params.campaigns.length > 0 ||
    params.adsets.length > 0 ||
    params.search.trim() !== "";
  const totalMatriculas = matriculasFiltradas.reduce((s, m) => s + m.quantidade, 0);
  const receitaMatriculas = matriculasFiltradas.reduce(
    (s, m) => s + (m.receita_semestral ?? 0),
    0
  );
  // Zero conta como "sem valor informado" tanto quanto nulo.
  //
  // O sistema acadêmico exporta 0 em vez de vazio em parte das linhas — há
  // 4 Medicina/Canoas em 24/08 zeradas no mesmo grupo em que as outras
  // valem ~R$ 69 mil cada. Contando só o nulo, o card dizia "36 sem valor"
  // quando o número honesto é 56, e o ROI parecia mais firme do que é.
  const semReceita = matriculasFiltradas.reduce(
    (s, m) => s + (!m.receita_semestral || m.receita_semestral <= 0 ? m.quantidade : 0),
    0
  );
  const investimentoConversao = linhasConversao.reduce((s, r) => s + r.spend, 0);
  const leadsConversao = linhasConversao.reduce((s, r) => s + r.results, 0);

  const resumoMatriculas: MatriculasResumo = {
    total: totalMatriculas,
    receita: Math.round(receitaMatriculas * 100) / 100,
    semReceita,
    investimento: Math.round(investimentoConversao * 100) / 100,
    cac: totalMatriculas ? investimentoConversao / totalMatriculas : 0,
    roi: investimentoConversao ? receitaMatriculas / investimentoConversao : 0,
    taxaMatricula: leadsConversao ? (totalMatriculas / leadsConversao) * 100 : 0,
    dadoAte,
    periodoIncompleto: dadoAte !== null && params.dateTo > dadoAte,
    filtroNaoAplicado: matriculaNaoSegue,
  };

  /*
    Métricas de eficiência olham só conversão.

    Sob o padrão da tela (`kind=todos`), `filtered` traz lead de conversão e
    engajamento de branding no mesmo campo `results`. Dividir gasto por essa
    soma não mede nada: o curso "Institucional" liderava o gráfico de custo
    por resultado com R$ 0,05, que eram 73.284 engajamentos tratados como
    lead, e Santarém aparecia a R$ 0,03 contra R$ 11,29 reais — 376× errado.
    O funil já fazia esse corte; o breakdown e o relatório não faziam.

    Com o seletor num tipo específico, `filtered` já é homogêneo.
  */
  const paraEficiencia =
    params.kind === "todos" ? filtered.filter((r) => r.kind === "conversao") : filtered;

  // Mesmo recorte dos cards — período, curso, praça e busca —, sem o filtro
  // de tipo, que os cards aplicam por conta própria sobre os dois baldes.
  const externoNoRecorte = filterRows(externa, {
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

  // Página além do fim devolvia lista vazia com `total` cheio, e a tabela
  // mostrava "Nenhum dado nesse período" com dado existindo. Prende na
  // última página real e devolve o número corrigido, senão a paginação
  // continua apontando para o vazio.
  const ultimaPagina = Math.max(1, Math.ceil(total / params.pageSize));
  const page = Math.min(Math.max(1, params.page), ultimaPagina);
  const start = (page - 1) * params.pageSize;
  const rows = sorted.slice(start, start + params.pageSize);

  void noPeriodo;

  return {
    rows,
    summary,
    total,
    page,
    pageSize: params.pageSize,
    filterOptions,
    kindTotals: {
      conversao: totaisPorTipo(semKind.filter((r) => r.kind === "conversao")),
      branding: totaisPorTipo(semKind.filter((r) => r.kind === "branding")),
    },
    breakdown: {
      porCurso: agrupar(paraEficiencia, (r) => r.curso, indicePorCurso),
      porPraca: agrupar(paraEficiencia, (r) => r.praca, indicePorPraca),
    },
    funil: montarFunil(
      paraEficiencia,
      // Nulo, e não zero: sem dado carregado a etapa some do funil em vez de
      // aparecer como "nenhuma matrícula".
      //
      // Em branding a etapa também some. Ali o funil termina em visita de
      // perfil ou engajamento, e "matrículas ÷ visitas ao perfil" seria uma
      // taxa entre duas coisas que não se seguem.
      //
      // E some também quando há filtro que a matrícula não acompanha: o
      // numerador seria o total do período inteiro contra o resultado de uma
      // campanha só. Filtrar uma campanha de 8 resultados punha as 1.539
      // matrículas contra ela e a tela dizia "conversão comercial: 19.237%".
      temMatriculas && params.kind !== "branding" && !matriculaNaoSegue
        ? totalMatriculas
        : null
    ),
    matriculas: resumoMatriculas,
    investimento: {
      meta: semKind.reduce((s, r) => s + r.spend, 0),
      // Separado por tipo, e não num número só: o card acompanha o seletor,
      // e somar o Google inteiro sob "Conversão" mostrava R$ 197.422,82
      // contra os R$ 191.317,35 da aba Praça × Curso. A diferença eram
      // exatamente os R$ 6.105,47 de Google classificado como branding.
      externo: {
        conversao: externoNoRecorte
          .filter((r) => r.kind === "conversao")
          .reduce((s, r) => s + r.spend, 0),
        branding: externoNoRecorte
          .filter((r) => r.kind === "branding")
          .reduce((s, r) => s + r.spend, 0),
      },
    },
    matriz: {
      pracaCurso: montarMatriz(matriculasFiltradas, linhasConversao, "praca-curso"),
      porPraca: montarMatriz(matriculasFiltradas, linhasConversao, "praca"),
      porCurso: montarMatriz(matriculasFiltradas, linhasConversao, "curso"),
    },
  };
}
