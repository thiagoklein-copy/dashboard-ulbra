import type { InsightsResponse, AggregatedRow, BreakdownItem } from "@/lib/types";

/**
 * Piso de volume para um anúncio entrar no ranking.
 *
 * Sem isso o ranking é dominado por anúncios de 1 ou 2 leads que tiveram
 * sorte: no período de agosto/2026, os cinco menores custos por resultado
 * tinham 2 leads em média a R$ 0,19, contra 65 leads a R$ 2,44 quando se
 * exige um mínimo. Recomendar os primeiros faz a equipe replicar ruído.
 */
const MIN_RESULTADOS = 8;

export interface LinhaRanking {
  nome: string;
  investimento: number;
  resultados: number;
  custoPorResultado: number;
  taxaAnuncio: number;
  taxaPagina: number;
  ads: number;
  /** Variação % do custo por resultado contra o período anterior */
  variacaoCusto: number | null;
}

export interface Comparativo {
  atual: number;
  anterior: number;
  variacao: number | null;
  /** true quando cair é bom (custo), false quando subir é bom (leads) */
  menorMelhor: boolean;
}

export interface RelatorioMidia {
  geradoEm: string;
  periodo: { de: string; ate: string; dias: number };
  periodoAnterior: { de: string; ate: string };
  filtros: string[];
  tipo: "todos" | "conversao" | "branding";
  indicador: string | null;
  /** Sem filtro de tipo, o resumo cobre só conversão — branding vem aqui. */
  brandingAparte: { investimento: number; resultados: number; indicador: string | null } | null;

  investimento: Comparativo;
  resultados: Comparativo;
  custoPorResultado: Comparativo;
  impressoes: Comparativo;

  funil: {
    impressoes: number;
    alcance: number;
    cliques: number;
    resultados: number;
    taxaAnuncio: Comparativo;
    taxaPagina: Comparativo;
  };

  porCurso: LinhaRanking[];
  porPraca: LinhaRanking[];
  vencedores: AggregatedRow[];
  perdedores: AggregatedRow[];
  copiesVencedoras: { texto: string; ads: number; resultados: number; custo: number }[];
  conclusoes: string[];
  metodologia: string[];
}

const ROTULOS_INDICADOR: Record<string, [plural: string, singular: string]> = {
  "offsite_conversion.fb_pixel_lead": ["leads no site", "lead"],
  profile_visit_view: ["visitas ao perfil", "visita ao perfil"],
  link_click: ["cliques no link", "clique no link"],
  landing_page_view: ["visitas à página", "visita à página"],
  post_engagement: ["engajamentos", "engajamento"],
};

function rotulos(indicador: string | null): [plural: string, singular: string] {
  return indicador ? (ROTULOS_INDICADOR[indicador] ?? ["resultados", "resultado"]) : ["resultados", "resultado"];
}

function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return ((atual - anterior) / anterior) * 100;
}

function comparar(atual: number, anterior: number, menorMelhor = false): Comparativo {
  return { atual, anterior, variacao: variacao(atual, anterior), menorMelhor };
}

function rankear(
  itens: BreakdownItem[],
  anteriores: BreakdownItem[]
): LinhaRanking[] {
  const mapaAnterior = new Map(anteriores.map((i) => [i.nome, i]));
  return itens
    .filter((i) => i.results > 0)
    .map((i) => {
      const ant = mapaAnterior.get(i.nome);
      const custoAnt = ant && ant.results ? ant.spend / ant.results : 0;
      return {
        nome: i.nome,
        investimento: i.spend,
        resultados: i.results,
        custoPorResultado: i.cost_per_result,
        taxaAnuncio: i.taxaAnuncio,
        taxaPagina: i.taxaPagina,
        ads: i.ads,
        variacaoCusto: custoAnt ? variacao(i.cost_per_result, custoAnt) : null,
      };
    })
    .sort((a, b) => a.custoPorResultado - b.custoPorResultado);
}

/** Agrupa anúncios por texto de copy — é o campo que de fato varia. */
function agruparCopies(rows: AggregatedRow[]) {
  const mapa = new Map<string, { ads: number; resultados: number; gasto: number }>();
  for (const r of rows) {
    const texto = r.primary_text?.trim();
    if (!texto || r.results <= 0) continue;
    const atual = mapa.get(texto) ?? { ads: 0, resultados: 0, gasto: 0 };
    atual.ads += 1;
    atual.resultados += r.results;
    atual.gasto += r.spend;
    mapa.set(texto, atual);
  }
  return Array.from(mapa.entries())
    .filter(([, v]) => v.resultados >= MIN_RESULTADOS)
    .map(([texto, v]) => ({
      texto,
      ads: v.ads,
      resultados: v.resultados,
      custo: v.resultados ? v.gasto / v.resultados : 0,
    }))
    .sort((a, b) => a.custo - b.custo)
    .slice(0, 5);
}

function gerarConclusoes(r: {
  custo: Comparativo;
  resultados: Comparativo;
  porCurso: LinhaRanking[];
  porPraca: LinhaRanking[];
  taxaAnuncio: Comparativo;
  taxaPagina: Comparativo;
  indicador: string | null;
}): string[] {
  const out: string[] = [];
  const [unidade, singular] = rotulos(r.indicador);

  if (r.custo.variacao !== null) {
    const v = r.custo.variacao;
    out.push(
      v < -5
        ? `O custo por ${singular} caiu ${Math.abs(v).toFixed(1)}% contra o período anterior — a verba está rendendo mais.`
        : v > 5
          ? `O custo por ${singular} subiu ${v.toFixed(1)}%. Vale investigar se foi saturação de público, troca de criativo ou aumento de concorrência no leilão.`
          : `O custo por ${singular} ficou estável (${v.toFixed(1)}%) contra o período anterior.`
    );
  }

  const melhor = r.porCurso[0];
  const pior = r.porCurso[r.porCurso.length - 1];
  if (melhor && pior && melhor.nome !== pior.nome) {
    const fator = pior.custoPorResultado / melhor.custoPorResultado;
    out.push(
      `${melhor.nome} entrega a ${fator.toFixed(1)}x o custo-benefício de ${pior.nome} ` +
        `(R$ ${melhor.custoPorResultado.toFixed(2)} contra R$ ${pior.custoPorResultado.toFixed(2)} por ${singular}). ` +
        `Realocar verba entre os dois é a alavanca mais direta do período.`
    );
  }

  const caros = r.porCurso.filter((c) => c.variacaoCusto !== null && c.variacaoCusto > 25);
  if (caros.length) {
    out.push(
      `Piora relevante em ${caros.map((c) => `${c.nome} (+${c.variacaoCusto!.toFixed(0)}%)`).join(", ")}. ` +
        `Custo subindo mais de 25% costuma indicar fadiga de criativo.`
    );
  }

  if (r.taxaAnuncio.variacao !== null && r.taxaPagina.variacao !== null) {
    const a = r.taxaAnuncio.variacao;
    const p = r.taxaPagina.variacao;
    if (a < -10 && p > -5) {
      out.push(
        `A conversão do anúncio caiu ${Math.abs(a).toFixed(1)}% enquanto a da página se manteve. ` +
          `O problema está no criativo, não na oferta — priorize renovação de peça.`
      );
    } else if (p < -10 && a > -5) {
      out.push(
        `A conversão da página caiu ${Math.abs(p).toFixed(1)}% com o anúncio estável. ` +
          `O criativo segue atraindo, mas a landing está perdendo quem chega.`
      );
    }
  }

  const melhorPraca = r.porPraca[0];
  if (melhorPraca) {
    out.push(
      `Entre as praças, ${melhorPraca.nome} tem o menor custo (R$ ${melhorPraca.custoPorResultado.toFixed(2)}) ` +
        `com ${melhorPraca.resultados} ${unidade}.`
    );
  }

  return out;
}

export function construirRelatorio(opts: {
  atual: InsightsResponse;
  anterior: InsightsResponse;
  dateFrom: string;
  dateTo: string;
  anteriorDe: string;
  anteriorAte: string;
  tipo: "todos" | "conversao" | "branding";
  filtros: string[];
}): RelatorioMidia {
  const { atual, anterior } = opts;

  /**
   * Sem filtro de tipo, `summary` soma leads com engajamento e visita de
   * perfil — no período de agosto/2026 isso dava 76.456 "resultados" a
   * R$ 0,71, um número sem significado. Quando o relatório sai sem filtro,
   * o resumo passa a usar só o bloco de conversão, e o de branding aparece
   * à parte na seção própria.
   */
  const usarSoConversao = opts.tipo === "todos";
  const a = usarSoConversao ? atual.kindTotals.conversao : atual.summary;
  const b = usarSoConversao ? anterior.kindTotals.conversao : anterior.summary;

  const dias =
    Math.round(
      (new Date(opts.dateTo).getTime() - new Date(opts.dateFrom).getTime()) / 86400000
    ) + 1;

  const porCurso = rankear(atual.breakdown.porCurso, anterior.breakdown.porCurso);
  const porPraca = rankear(atual.breakdown.porPraca, anterior.breakdown.porPraca);

  const elegiveis = atual.rows.filter((r) => r.results >= MIN_RESULTADOS);
  const vencedores = [...elegiveis]
    .sort((x, y) => x.cost_per_result - y.cost_per_result)
    .slice(0, 8);
  const perdedores = [...elegiveis]
    .sort((x, y) => y.cost_per_result - x.cost_per_result)
    .slice(0, 5);

  const custo = comparar(a.cost_per_result, b.cost_per_result, true);
  const taxaAnuncio = comparar(atual.funil.taxaAnuncio, anterior.funil.taxaAnuncio);
  const taxaPagina = comparar(atual.funil.taxaPagina, anterior.funil.taxaPagina);

  return {
    geradoEm: new Date().toISOString(),
    periodo: { de: opts.dateFrom, ate: opts.dateTo, dias },
    periodoAnterior: { de: opts.anteriorDe, ate: opts.anteriorAte },
    filtros: opts.filtros,
    tipo: opts.tipo,
    indicador: usarSoConversao
      ? atual.kindTotals.conversao.indicador
      : atual.funil.indicador,
    brandingAparte:
      usarSoConversao && atual.kindTotals.branding.spend > 0
        ? {
            investimento: atual.kindTotals.branding.spend,
            resultados: atual.kindTotals.branding.results,
            indicador: atual.kindTotals.branding.indicador,
          }
        : null,

    investimento: comparar(a.spend, b.spend),
    resultados: comparar(a.results, b.results),
    custoPorResultado: custo,
    impressoes: comparar(a.impressions, b.impressions),

    funil: {
      impressoes: atual.funil.impressoes,
      alcance: atual.funil.alcance,
      cliques: atual.funil.cliquesLink,
      resultados: atual.funil.resultados,
      taxaAnuncio,
      taxaPagina,
    },

    porCurso,
    porPraca,
    vencedores,
    perdedores,
    copiesVencedoras: agruparCopies(atual.rows),
    conclusoes: gerarConclusoes({
      custo,
      resultados: comparar(a.results, b.results),
      porCurso,
      porPraca,
      taxaAnuncio,
      taxaPagina,
      indicador: atual.funil.indicador,
    }),
    metodologia: [
      `Vencedores e perdedores exigem no mínimo ${MIN_RESULTADOS} resultados no período — sem esse piso o ranking é dominado por anúncios de 1 ou 2 conversões que tiveram sorte.`,
      `Período anterior: ${opts.anteriorDe} a ${opts.anteriorAte}, mesma duração (${dias} dias), imediatamente antes.`,
      "A conversão da página usa a atribuição do Meta, não a analytics do site. Serve para comparar campanhas entre si; não é a taxa real da landing page.",
      "Campanhas de branding e de conversão contam resultados diferentes (lead, visita de perfil, engajamento) e nunca são somadas.",
    ],
  };
}
