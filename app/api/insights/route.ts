import { NextRequest, NextResponse } from "next/server";
import { getInsights } from "@/lib/insights";
import type {
  AggregationLevel,
  InsightsQueryParams,
  KindFilter,
  MetricKey,
  SortDirection,
} from "@/lib/types";

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;

    const sortByParam = sp.get("sortBy");
    const sortDirParam = sp.get("sortDir");
    const validMetrics: MetricKey[] = [
      "spend",
      "impressions",
      "clicks",
      "ctr",
      "cpc",
      "cpm",
      "results",
      "cost_per_result",
    ];
    const sortBy =
      sortByParam && validMetrics.includes(sortByParam as MetricKey)
        ? (sortByParam as MetricKey)
        : null;
    const sortDir =
      sortDirParam === "asc" || sortDirParam === "desc"
        ? (sortDirParam as SortDirection)
        : null;

    const kindParam = sp.get("kind");
    const kind: KindFilter =
      kindParam === "branding" || kindParam === "conversao"
        ? kindParam
        : "todos";

    const params: InsightsQueryParams = {
      level: (sp.get("level") as AggregationLevel) || "ad",
      dateFrom: sp.get("from") || "2026-08-01",
      dateTo: sp.get("to") || "2026-08-11",
      campaigns: parseList(sp.get("campaigns")),
      adsets: parseList(sp.get("adsets")),
      cursos: parseList(sp.get("cursos")),
      pracas: parseList(sp.get("pracas")),
      kind,
      search: sp.get("q") || "",
      sortBy,
      sortDir: sortBy ? sortDir : null,
      page: Math.max(1, Number(sp.get("page") || 1)),
      pageSize: Math.min(100, Math.max(10, Number(sp.get("pageSize") || 25))),
    };

    const data = await getInsights(params);
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao carregar insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
