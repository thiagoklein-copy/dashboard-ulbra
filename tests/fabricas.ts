import type { AdInsightRow } from "@/lib/types";

/**
 * Linha de insight com valores neutros. Cada teste sobrescreve só o que
 * interessa, para que a intenção fique legível na própria chamada.
 */
export function linha(over: Partial<AdInsightRow> = {}): AdInsightRow {
  return {
    ad_id: "ad-1",
    ad_name: "card1",
    adset_id: "adset-1",
    adset_name: "conjunto 1",
    campaign_id: "camp-1",
    campaign_name: "2026-2-medicina-canoas-advplus-10agosto-leadsite-ativar",
    date_start: "2026-08-11",
    date_stop: "2026-08-11",
    spend: 0,
    impressions: 0,
    reach: 0,
    inline_link_clicks: 0,
    clicks: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    results: 0,
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
    objective: "OUTCOME_LEADS",
    result_indicator: "actions:offsite_conversion.fb_pixel_lead",
    curso: "Medicina",
    praca: "Canoas",
    kind: "conversao",
    recorte: null,
    ...over,
  };
}

/** Filtro sem nenhuma restrição — base para os testes de filterRows. */
export const semFiltro = {
  dateFrom: "2000-01-01",
  dateTo: "2100-01-01",
  campaigns: [] as string[],
  adsets: [] as string[],
  cursos: [] as string[],
  pracas: [] as string[],
  kind: "todos" as const,
  search: "",
};
