import { NextRequest, NextResponse } from "next/server";
import { construirRelatorio } from "@/lib/benchmark-report";
import { getInsights } from "@/lib/insights";
import { renderRelatorioHtml } from "@/lib/report-html";
import type { KindFilter } from "@/lib/types";

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value.split(",").map((v) => v.trim()).filter(Boolean);
}

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Relatório de mídia em HTML imprimível.
 * GET /api/report/benchmark?from=&to=&cursos=&pracas=&kind=&campaigns=&adsets=&q=
 *
 * Busca dois períodos: o selecionado e o imediatamente anterior de mesma
 * duração, para que todo número tenha base de comparação.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const dateFrom = sp.get("from") || "2026-08-01";
    const dateTo = sp.get("to") || "2026-08-11";

    const dias =
      Math.round(
        (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000
      ) + 1;
    const anteriorAte = somarDias(dateFrom, -1);
    const anteriorDe = somarDias(anteriorAte, -(dias - 1));

    const kindParam = sp.get("kind");
    const kind: KindFilter =
      kindParam === "branding" || kindParam === "conversao" ? kindParam : "todos";

    const cursos = parseList(sp.get("cursos"));
    const pracas = parseList(sp.get("pracas"));
    const campaigns = parseList(sp.get("campaigns"));
    const adsets = parseList(sp.get("adsets"));
    const search = sp.get("q") || "";

    const base = {
      level: "ad" as const,
      campaigns,
      adsets,
      cursos,
      pracas,
      kind,
      search,
      sortBy: "cost_per_result" as const,
      sortDir: "asc" as const,
      page: 1,
      // Alto o bastante para o relatório ver todos os anúncios do período,
      // não só a primeira página como fazia antes.
      pageSize: 100,
    };

    const [atual, anterior] = await Promise.all([
      getInsights({ ...base, dateFrom, dateTo, pageSize: 500 }),
      getInsights({ ...base, dateFrom: anteriorDe, dateTo: anteriorAte, pageSize: 500 }),
    ]);

    const filtros: string[] = [];
    if (kind !== "todos") filtros.push(kind === "conversao" ? "Conversão" : "Branding");
    if (cursos.length) filtros.push(`Curso: ${cursos.join(", ")}`);
    if (pracas.length) filtros.push(`Praça: ${pracas.join(", ")}`);
    if (campaigns.length) filtros.push(`${campaigns.length} campanha(s)`);
    if (adsets.length) filtros.push(`${adsets.length} conjunto(s)`);
    if (search) filtros.push(`Busca: "${search}"`);

    const relatorio = construirRelatorio({
      atual,
      anterior,
      dateFrom,
      dateTo,
      anteriorDe,
      anteriorAte,
      tipo: kind,
      filtros,
    });

    if (sp.get("format") === "json") {
      return NextResponse.json(relatorio);
    }

    return new NextResponse(renderRelatorioHtml(relatorio), {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="relatorio-ulbra-${dateFrom}_${dateTo}.html"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao gerar relatório";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
