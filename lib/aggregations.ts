import type {
  AdInsightRow,
  AggregatedRow,
  AggregationLevel,
  KindFilter,
  MetricKey,
  SortDirection,
  SummaryTotals,
  VideoDesempenho,
  VideoRetention,
} from "@/lib/types";
import {
  mergeVideoDesempenho,
  mergeVideoRetention,
} from "@/lib/video-retention";

function safeDiv(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return numerator / denominator;
}

function recalculateDerived(totals: {
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
}): Pick<AggregatedRow, "ctr" | "cpc" | "cpm" | "cost_per_result"> {
  return {
    ctr: safeDiv(totals.clicks, totals.impressions) * 100,
    cpc: safeDiv(totals.spend, totals.clicks),
    cpm: safeDiv(totals.spend, totals.impressions) * 1000,
    cost_per_result: safeDiv(totals.spend, totals.results),
  };
}

function groupKey(row: AdInsightRow, level: AggregationLevel): string {
  switch (level) {
    case "campaign":
      return row.campaign_id;
    case "adset":
      return row.adset_id;
    case "ad":
      return row.ad_id;
  }
}

function displayName(row: AdInsightRow, level: AggregationLevel): string {
  switch (level) {
    case "campaign":
      return row.campaign_name;
    case "adset":
      return row.adset_name;
    case "ad":
      return row.ad_name;
  }
}

export function aggregateRows(
  rows: AdInsightRow[],
  level: AggregationLevel
): AggregatedRow[] {
  const map = new Map<
    string,
    {
      base: AggregatedRow;
      spend: number;
      impressions: number;
      clicks: number;
      results: number;
      latestDate: string;
      bestAdSpend: number;
      retentions: VideoRetention[];
      desempenhos: VideoDesempenho[];
      /** ad_ids distintos — sem isso "anúncios" viraria contagem de linhas-dia */
      adIds: Set<string>;
    }
  >();

  for (const row of rows) {
    const key = groupKey(row, level);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        spend: row.spend,
        impressions: row.impressions,
        clicks: row.clicks,
        results: row.results,
        latestDate: row.date_start,
        bestAdSpend: row.spend,
        retentions: row.video_retention ? [row.video_retention] : [],
        desempenhos: row.video_desempenho ? [row.video_desempenho] : [],
        adIds: new Set([row.ad_id]),
        base: {
          id: key,
          name: displayName(row, level),
          campaign_name: row.campaign_name,
          adset_name: level === "campaign" ? null : row.adset_name,
          ad_name: level === "ad" ? row.ad_name : null,
          spend: 0,
          impressions: 0,
          clicks: 0,
          ctr: 0,
          cpc: 0,
          cpm: 0,
          results: 0,
          cost_per_result: 0,
          headline: row.headline,
          primary_text: row.primary_text,
          description: row.description,
          call_to_action: row.call_to_action,
          image_url: row.image_url,
          video_id: row.video_id,
          video_storage_url: row.video_storage_url ?? null,
          video_transcript: row.video_transcript ?? null,
          link_url: row.link_url,
          video_retention: row.video_retention,
          video_desempenho: row.video_desempenho,
          ad_count: 1,
          objective: row.objective,
          result_indicator: row.result_indicator,
          curso: row.curso,
          praca: row.praca,
          kind: row.kind,
          recorte: row.recorte,
        },
      });
    } else {
      existing.spend += row.spend;
      existing.impressions += row.impressions;
      existing.clicks += row.clicks;
      existing.results += row.results;
      existing.adIds.add(row.ad_id);
      if (row.video_retention) existing.retentions.push(row.video_retention);
      if (row.video_desempenho) existing.desempenhos.push(row.video_desempenho);

      const shouldRefreshCreative =
        level === "ad"
          ? row.date_start >= existing.latestDate
          : row.spend > existing.bestAdSpend;

      if (shouldRefreshCreative) {
        if (level === "ad") existing.latestDate = row.date_start;
        else existing.bestAdSpend = row.spend;

        existing.base.headline = row.headline;
        existing.base.primary_text = row.primary_text;
        existing.base.description = row.description;
        existing.base.call_to_action = row.call_to_action;
        existing.base.image_url = row.image_url;
        existing.base.video_id = row.video_id;
        existing.base.video_storage_url = row.video_storage_url ?? null;
        existing.base.video_transcript = row.video_transcript ?? null;
        existing.base.link_url = row.link_url;
      }
    }
  }

  return Array.from(map.values()).map(
    ({
      base,
      spend,
      impressions,
      clicks,
      results,
      retentions,
      desempenhos,
      adIds,
    }) => {
      const derived = recalculateDerived({
        spend,
        impressions,
        clicks,
        results,
      });
      return {
        ...base,
        spend,
        impressions,
        clicks,
        results,
        ...derived,
        ad_count: adIds.size,
        video_retention: mergeVideoRetention(retentions),
        video_desempenho: mergeVideoDesempenho(desempenhos),
      };
    }
  );
}

export function computeSummary(rows: AdInsightRow[]): SummaryTotals {
  const totals = rows.reduce(
    (acc, row) => {
      acc.spend += row.spend;
      acc.impressions += row.impressions;
      acc.clicks += row.clicks;
      acc.results += row.results;
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0, results: 0 }
  );

  const derived = recalculateDerived(totals);
  return {
    spend: totals.spend,
    impressions: totals.impressions,
    clicks: totals.clicks,
    results: totals.results,
    ctr: derived.ctr,
    cost_per_result: derived.cost_per_result,
  };
}

export function sortAggregatedRows(
  rows: AggregatedRow[],
  sortBy: MetricKey | null,
  sortDir: SortDirection | null
): AggregatedRow[] {
  if (!sortBy || !sortDir) return rows;

  const ordenar = (lista: AggregatedRow[]) => {
    const s = [...lista].sort((a, b) => (a[sortBy] ?? 0) - (b[sortBy] ?? 0));
    return sortDir === "desc" ? s.reverse() : s;
  };

  // Anúncio sem resultado não tem custo por resultado — é ausência de dado,
  // não custo zero. Antes ele recebia custo infinito para cair no fim do ASC,
  // mas o DESC era feito invertendo o array, jogando todos eles para o topo:
  // ao pedir "do mais caro para o mais barato" a primeira página vinha cheia
  // de anúncios sem nenhuma conversão. Agora ficam sempre ao final.
  if (sortBy === "cost_per_result") {
    const comResultado = rows.filter((r) => r.results > 0);
    const semResultado = rows.filter((r) => r.results <= 0);
    return [...ordenar(comResultado), ...semResultado];
  }

  return ordenar(rows);
}

export function filterRows(
  rows: AdInsightRow[],
  opts: {
    dateFrom: string;
    dateTo: string;
    campaigns: string[];
    adsets: string[];
    cursos: string[];
    pracas: string[];
    kind: KindFilter;
    search: string;
  }
): AdInsightRow[] {
  const search = opts.search.trim().toLowerCase();

  return rows.filter((row) => {
    if (row.date_start < opts.dateFrom || row.date_start > opts.dateTo) {
      return false;
    }
    if (opts.kind !== "todos" && row.kind !== opts.kind) {
      return false;
    }
    if (opts.cursos.length && !opts.cursos.includes(row.curso)) {
      return false;
    }
    if (opts.pracas.length && !opts.pracas.includes(row.praca)) {
      return false;
    }
    if (opts.campaigns.length && !opts.campaigns.includes(row.campaign_name)) {
      return false;
    }
    if (opts.adsets.length && !opts.adsets.includes(row.adset_name)) {
      return false;
    }
    if (search) {
      const haystack = [
        row.ad_name,
        row.headline ?? "",
        row.primary_text ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}
