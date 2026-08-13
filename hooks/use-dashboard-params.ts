"use client";

import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
  useQueryStates,
} from "nuqs";
import type {
  AggregationLevel,
  KindFilter,
  MetricKey,
  SortDirection,
} from "@/lib/types";

const levels = ["campaign", "adset", "ad"] as const satisfies AggregationLevel[];
const sortDirs = ["asc", "desc"] as const satisfies SortDirection[];
const kinds = ["todos", "conversao", "branding"] as const satisfies KindFilter[];
const metricKeys = [
  "spend",
  "impressions",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "results",
  "cost_per_result",
] as const satisfies MetricKey[];

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function useDashboardParams() {
  return useQueryStates(
    {
      level: parseAsStringEnum([...levels]).withDefault("ad"),
      from: parseAsString.withDefault(daysAgoISO(6)),
      to: parseAsString.withDefault(todayISO()),
      campaigns: parseAsArrayOf(parseAsString).withDefault([]),
      adsets: parseAsArrayOf(parseAsString).withDefault([]),
      cursos: parseAsArrayOf(parseAsString).withDefault([]),
      pracas: parseAsArrayOf(parseAsString).withDefault([]),
      kind: parseAsStringEnum([...kinds]).withDefault("todos"),
      q: parseAsString.withDefault(""),
      sortBy: parseAsStringEnum([...metricKeys]),
      sortDir: parseAsStringEnum([...sortDirs]),
      page: parseAsInteger.withDefault(1),
      pageSize: parseAsInteger.withDefault(25),
    },
    { history: "replace" }
  );
}

export type DashboardParams = Awaited<
  ReturnType<typeof useDashboardParams>
>[0];
