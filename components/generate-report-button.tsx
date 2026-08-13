"use client";

import { FileBarChart } from "lucide-react";
import type { KindFilter } from "@/lib/types";

interface GenerateReportButtonProps {
  from: string;
  to: string;
  campaigns: string[];
  adsets: string[];
  cursos: string[];
  pracas: string[];
  kind: KindFilter;
  q: string;
}

export function GenerateReportButton({
  from,
  to,
  campaigns,
  adsets,
  cursos,
  pracas,
  kind,
  q,
}: GenerateReportButtonProps) {
  function generate() {
    const qs = new URLSearchParams();
    qs.set("from", from);
    qs.set("to", to);
    if (campaigns.length) qs.set("campaigns", campaigns.join(","));
    if (adsets.length) qs.set("adsets", adsets.join(","));
    if (cursos.length) qs.set("cursos", cursos.join(","));
    if (pracas.length) qs.set("pracas", pracas.join(","));
    if (kind !== "todos") qs.set("kind", kind);
    if (q) qs.set("q", q);

    window.open(`/api/report/benchmark?${qs}`, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      type="button"
      onClick={generate}
      className="flex items-center gap-2 rounded-full border border-gray-200 dark:border-white/10 px-4 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:hover:bg-white/10"
      title="Abre o relatório do período filtrado — use Ctrl+P para salvar em PDF"
    >
      <FileBarChart className="size-3.5" />
      Gerar relatório
    </button>
  );
}
