import type { ColumnKey, MetricKey, SortDirection } from "@/lib/types";

export type MetricFormat = "currency" | "percent" | "number" | "text";

export interface MetricConfig {
  key: ColumnKey;
  label: string;
  format: MetricFormat;
  sortable: boolean;
  defaultVisible: boolean;
  description?: string;
}

export const METRICS: MetricConfig[] = [
  {
    key: "name",
    label: "Nome",
    format: "text",
    sortable: false,
    defaultVisible: true,
  },
  {
    key: "spend",
    label: "Investimento",
    format: "currency",
    sortable: true,
    defaultVisible: true,
  },
  {
    key: "impressions",
    label: "Impressões",
    format: "number",
    sortable: true,
    defaultVisible: true,
  },
  {
    key: "clicks",
    label: "Cliques",
    format: "number",
    sortable: true,
    defaultVisible: true,
  },
  {
    key: "ctr",
    label: "CTR",
    format: "percent",
    sortable: true,
    defaultVisible: true,
  },
  {
    key: "cpc",
    label: "CPC",
    format: "currency",
    sortable: true,
    defaultVisible: true,
  },
  {
    key: "cpm",
    label: "CPM",
    format: "currency",
    sortable: true,
    defaultVisible: false,
  },
  {
    key: "results",
    label: "Resultados",
    format: "number",
    sortable: true,
    defaultVisible: true,
  },
  {
    key: "cost_per_result",
    label: "Custo/Resultado",
    format: "currency",
    sortable: true,
    defaultVisible: true,
  },
  {
    key: "headline",
    label: "Headline",
    format: "text",
    sortable: false,
    defaultVisible: false,
  },
  {
    key: "primary_text",
    label: "Texto principal",
    format: "text",
    sortable: false,
    defaultVisible: false,
  },
];

export const SORTABLE_METRICS = METRICS.filter(
  (m): m is MetricConfig & { key: MetricKey } => m.sortable
);

export const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = METRICS.filter(
  (m) => m.defaultVisible
).map((m) => m.key);

export const COLUMNS_STORAGE_KEY = "ulbra-meta-ads-columns";

export function getMetricLabel(key: ColumnKey): string {
  return METRICS.find((m) => m.key === key)?.label ?? key;
}

/** Custos: 1º clique ASC. Volume/performance: 1º clique DESC. */
const ASC_FIRST_METRICS = new Set<MetricKey>([
  "spend",
  "cpc",
  "cpm",
  "cost_per_result",
]);

export function defaultSortDir(key: MetricKey): SortDirection {
  return ASC_FIRST_METRICS.has(key) ? "asc" : "desc";
}

/** Ciclo Meta: ativa → inverte → limpa. */
export function cycleColumnSort(
  currentBy: MetricKey | null,
  currentDir: SortDirection | null,
  clicked: MetricKey
): { sortBy: MetricKey | null; sortDir: SortDirection | null } {
  if (currentBy !== clicked) {
    return { sortBy: clicked, sortDir: defaultSortDir(clicked) };
  }

  const preferred = defaultSortDir(clicked);
  const opposite: SortDirection = preferred === "asc" ? "desc" : "asc";

  if ((currentDir ?? preferred) === preferred) {
    return { sortBy: clicked, sortDir: opposite };
  }

  return { sortBy: null, sortDir: null };
}
