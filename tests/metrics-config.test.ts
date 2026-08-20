import { describe, expect, it } from "vitest";
import {
  cycleColumnSort,
  defaultSortDir,
  DEFAULT_VISIBLE_COLUMNS,
  getMetricLabel,
  METRICS,
  SORTABLE_METRICS,
} from "@/lib/metrics-config";

describe("defaultSortDir", () => {
  it.each(["spend", "cpc", "cpm", "cost_per_result"] as const)(
    "abre %s do menor para o maior — em custo, menos é melhor",
    (k) => expect(defaultSortDir(k)).toBe("asc")
  );

  it.each(["impressions", "clicks", "ctr", "results"] as const)(
    "abre %s do maior para o menor — em volume, mais é melhor",
    (k) => expect(defaultSortDir(k)).toBe("desc")
  );
});

describe("cycleColumnSort", () => {
  it("primeiro clique usa a direção natural da métrica", () => {
    expect(cycleColumnSort(null, null, "spend")).toEqual({ sortBy: "spend", sortDir: "asc" });
    expect(cycleColumnSort(null, null, "results")).toEqual({ sortBy: "results", sortDir: "desc" });
  });

  it("segundo clique inverte", () => {
    expect(cycleColumnSort("spend", "asc", "spend")).toEqual({ sortBy: "spend", sortDir: "desc" });
  });

  it("terceiro clique limpa a ordenação", () => {
    expect(cycleColumnSort("spend", "desc", "spend")).toEqual({ sortBy: null, sortDir: null });
  });

  it("trocar de coluna recomeça o ciclo", () => {
    expect(cycleColumnSort("spend", "desc", "results")).toEqual({ sortBy: "results", sortDir: "desc" });
  });

  it("três cliques voltam ao início", () => {
    let e = cycleColumnSort(null, null, "ctr");
    e = cycleColumnSort(e.sortBy, e.sortDir, "ctr");
    e = cycleColumnSort(e.sortBy, e.sortDir, "ctr");
    expect(e).toEqual({ sortBy: null, sortDir: null });
  });
});

describe("configuração das métricas", () => {
  it("não repete chave", () => {
    const chaves = METRICS.map((m) => m.key);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it("toda métrica tem rótulo", () => {
    for (const m of METRICS) expect(m.label.trim()).not.toBe("");
  });

  it("nome está sempre visível — sem ele a tabela perde a identificação", () => {
    expect(DEFAULT_VISIBLE_COLUMNS).toContain("name");
  });

  it("colunas de texto não são ordenáveis", () => {
    for (const m of SORTABLE_METRICS) expect(m.format).not.toBe("text");
  });

  it("devolve a própria chave quando não conhece o rótulo", () => {
    expect(getMetricLabel("inexistente" as never)).toBe("inexistente");
  });
});
