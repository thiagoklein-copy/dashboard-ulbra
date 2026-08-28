import { NextRequest, NextResponse } from "next/server";
import { isoValido, janelaPadrao } from "@/lib/format";
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

/**
 * Inteiro da querystring, preso entre limites.
 *
 * `Math.max(1, Number("abc"))` devolve **NaN**, não 1 — o mínimo não
 * protege de lixo. O NaN descia até `slice(NaN, NaN)`, que devolve lista
 * vazia: `?page=abc` mostrava "nenhum dado" com o banco cheio.
 */
function inteiro(
  valor: string | null,
  padrao: number,
  minimo: number,
  maximo: number
): number {
  const n = Number(valor);
  if (!valor || !Number.isFinite(n)) return padrao;
  return Math.min(maximo, Math.max(minimo, Math.trunc(n)));
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

    const padrao = janelaPadrao();
    const dateFrom = sp.get("from") || padrao.de;
    const dateTo = sp.get("to") || padrao.ate;

    if (!isoValido(dateFrom) || !isoValido(dateTo)) {
      return NextResponse.json(
        { error: "Datas inválidas — use o formato AAAA-MM-DD." },
        { status: 400 }
      );
    }
    // Intervalo invertido devolvia zero linhas em silêncio, que lê como
    // "não houve nada no período" em vez de "o período está ao contrário".
    if (dateFrom > dateTo) {
      return NextResponse.json(
        { error: "A data inicial é posterior à final." },
        { status: 400 }
      );
    }

    // O nível vem da URL e alimenta um switch sem caso padrão; um valor
    // inventado faria a agregação devolver chave indefinida para toda linha.
    const levelParam = sp.get("level");
    const niveis: AggregationLevel[] = ["campaign", "adset", "ad"];
    const level = niveis.includes(levelParam as AggregationLevel)
      ? (levelParam as AggregationLevel)
      : "ad";

    const params: InsightsQueryParams = {
      level,
      dateFrom,
      dateTo,
      campaigns: parseList(sp.get("campaigns")),
      adsets: parseList(sp.get("adsets")),
      cursos: parseList(sp.get("cursos")),
      pracas: parseList(sp.get("pracas")),
      kind,
      search: sp.get("q") || "",
      sortBy,
      sortDir: sortBy ? sortDir : null,
      page: inteiro(sp.get("page"), 1, 1, Number.MAX_SAFE_INTEGER),
      // Teto de 100 escondia os melhores criativos: com centenas de anúncios,
      // ordenar por custo por resultado jogava os relevantes para a página 13.
      pageSize: inteiro(sp.get("pageSize"), 25, 10, 1000),
    };

    const data = await getInsights(params);
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao carregar insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
