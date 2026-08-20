import { describe, expect, it } from "vitest";
import {
  aggregateRows,
  computeSummary,
  filterRows,
  sortAggregatedRows,
} from "@/lib/aggregations";
import type { AggregatedRow } from "@/lib/types";
import { linha, semFiltro } from "./fabricas";

function agregado(over: Partial<AggregatedRow> = {}): AggregatedRow {
  return {
    id: "1", name: "a", campaign_name: "c", adset_name: null, ad_name: null,
    spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, cpm: 0,
    results: 0, cost_per_result: 0, headline: null, primary_text: null,
    description: null, call_to_action: null, image_url: null, video_id: null,
    video_storage_url: null, video_transcript: null, link_url: null,
    video_retention: null, video_desempenho: null,
    ad_count: 1, objective: null, result_indicator: null,
    curso: "Medicina", praca: "Canoas", kind: "conversao", recorte: null,
    ...over,
  };
}

describe("aggregateRows", () => {
  it("soma as métricas do grupo", () => {
    const [r] = aggregateRows(
      [
        linha({ spend: 10, impressions: 1000, clicks: 10, results: 2 }),
        linha({ spend: 30, impressions: 3000, clicks: 20, results: 3, date_start: "2026-08-12" }),
      ],
      "ad"
    );
    expect(r.spend).toBe(40);
    expect(r.impressions).toBe(4000);
    expect(r.results).toBe(5);
  });

  it("recalcula as derivadas a partir dos totais, não da média", () => {
    const [r] = aggregateRows(
      [
        linha({ spend: 10, impressions: 1000, clicks: 10, results: 2 }),
        linha({ spend: 30, impressions: 3000, clicks: 20, results: 3, date_start: "2026-08-12" }),
      ],
      "ad"
    );
    expect(r.ctr).toBeCloseTo(0.75, 5); // 30/4000
    expect(r.cpc).toBeCloseTo(40 / 30, 5);
    expect(r.cpm).toBeCloseTo(10, 5); // 40/4000*1000
    expect(r.cost_per_result).toBeCloseTo(8, 5); // 40/5
  });

  /**
   * Regressão: ad_count somava uma unidade por linha processada, então um
   * anúncio que rodou 28 dias virava "28 anúncios" na tela.
   */
  it("conta anúncios distintos, não linhas-dia", () => {
    const [r] = aggregateRows(
      [
        linha({ ad_id: "x", date_start: "2026-08-10" }),
        linha({ ad_id: "x", date_start: "2026-08-11" }),
        linha({ ad_id: "x", date_start: "2026-08-12" }),
      ],
      "campaign"
    );
    expect(r.ad_count).toBe(1);
  });

  it("conta cada anúncio uma vez na campanha", () => {
    const [r] = aggregateRows(
      [
        linha({ ad_id: "a", date_start: "2026-08-10" }),
        linha({ ad_id: "a", date_start: "2026-08-11" }),
        linha({ ad_id: "b", date_start: "2026-08-10" }),
      ],
      "campaign"
    );
    expect(r.ad_count).toBe(2);
  });

  it.each([
    ["campaign", "campaign_id"],
    ["adset", "adset_id"],
    ["ad", "ad_id"],
  ] as const)("agrupa o nível %s pela chave certa", (nivel, chave) => {
    const rows = aggregateRows(
      [linha({ [chave]: "p", spend: 1 }), linha({ [chave]: "q", spend: 2 })],
      nivel
    );
    expect(rows).toHaveLength(2);
  });

  it("não divide por zero quando não há impressões", () => {
    const [r] = aggregateRows([linha({ spend: 5 })], "ad");
    expect(r.ctr).toBe(0);
    expect(r.cpc).toBe(0);
    expect(r.cost_per_result).toBe(0);
    expect(Number.isFinite(r.cpm)).toBe(true);
  });
});

describe("sortAggregatedRows", () => {
  const semResultado = agregado({ id: "zero", results: 0, cost_per_result: 0 });
  const barato = agregado({ id: "barato", results: 10, cost_per_result: 2 });
  const caro = agregado({ id: "caro", results: 5, cost_per_result: 50 });
  const lista = [semResultado, caro, barato];

  /**
   * Regressão: anúncio sem conversão recebia custo infinito para cair no fim
   * do ASC, mas o DESC era feito invertendo o array — jogando todos eles para
   * o topo. Pedir "do mais caro para o mais barato" trazia uma primeira
   * página inteira de anúncios com zero resultado.
   */
  it("mantém quem não tem resultado no fim, do mais caro para o mais barato", () => {
    const r = sortAggregatedRows(lista, "cost_per_result", "desc");
    expect(r.map((x) => x.id)).toEqual(["caro", "barato", "zero"]);
  });

  it("mantém quem não tem resultado no fim, do mais barato para o mais caro", () => {
    const r = sortAggregatedRows(lista, "cost_per_result", "asc");
    expect(r.map((x) => x.id)).toEqual(["barato", "caro", "zero"]);
  });

  it("ordena as demais métricas normalmente", () => {
    const r = sortAggregatedRows(
      [agregado({ id: "a", spend: 1 }), agregado({ id: "b", spend: 9 })],
      "spend",
      "desc"
    );
    expect(r.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("devolve a lista intacta sem critério de ordenação", () => {
    expect(sortAggregatedRows(lista, null, null)).toEqual(lista);
  });

  it("não altera o array recebido", () => {
    const original = [...lista];
    sortAggregatedRows(lista, "cost_per_result", "desc");
    expect(lista).toEqual(original);
  });
});

describe("filterRows", () => {
  const rows = [
    linha({ ad_id: "1", curso: "Medicina", praca: "Canoas", kind: "conversao", date_start: "2026-08-10" }),
    linha({ ad_id: "2", curso: "Direito", praca: "Palmas", kind: "conversao", date_start: "2026-08-11" }),
    linha({ ad_id: "3", curso: "Institucional", praca: "Brasil", kind: "branding", date_start: "2026-08-12" }),
  ];

  it("filtra por intervalo de datas, incluindo as bordas", () => {
    const r = filterRows(rows, { ...semFiltro, dateFrom: "2026-08-10", dateTo: "2026-08-11" });
    expect(r.map((x) => x.ad_id)).toEqual(["1", "2"]);
  });

  it("filtra por curso", () => {
    expect(filterRows(rows, { ...semFiltro, cursos: ["Direito"] })).toHaveLength(1);
  });

  it("filtra por praça", () => {
    expect(filterRows(rows, { ...semFiltro, pracas: ["Canoas"] })).toHaveLength(1);
  });

  it("filtra por tipo", () => {
    expect(filterRows(rows, { ...semFiltro, kind: "branding" })).toHaveLength(1);
    expect(filterRows(rows, { ...semFiltro, kind: "conversao" })).toHaveLength(2);
    expect(filterRows(rows, { ...semFiltro, kind: "todos" })).toHaveLength(3);
  });

  it("combina filtros com E, não com OU", () => {
    const r = filterRows(rows, { ...semFiltro, cursos: ["Medicina"], pracas: ["Palmas"] });
    expect(r).toHaveLength(0);
  });

  it("busca em nome, headline e texto, sem diferenciar maiúsculas", () => {
    const comTexto = [linha({ ad_name: "card1", headline: "Matricule-se JÁ" })];
    expect(filterRows(comTexto, { ...semFiltro, search: "matricule" })).toHaveLength(1);
    expect(filterRows(comTexto, { ...semFiltro, search: "inexistente" })).toHaveLength(0);
  });

  it("lista vazia devolve lista vazia", () => {
    expect(filterRows([], semFiltro)).toEqual([]);
  });
});

describe("computeSummary", () => {
  it("recalcula CTR e custo a partir dos totais", () => {
    const s = computeSummary([
      linha({ spend: 100, impressions: 10000, clicks: 100, results: 10 }),
      linha({ spend: 100, impressions: 10000, clicks: 200, results: 30 }),
    ]);
    expect(s.spend).toBe(200);
    expect(s.ctr).toBeCloseTo(1.5, 5);
    expect(s.cost_per_result).toBeCloseTo(5, 5);
  });

  it("zera com lista vazia em vez de dar NaN", () => {
    const s = computeSummary([]);
    expect(s.spend).toBe(0);
    expect(s.ctr).toBe(0);
    expect(s.cost_per_result).toBe(0);
  });
});
