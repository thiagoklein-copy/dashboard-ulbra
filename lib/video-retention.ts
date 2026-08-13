import type { RetentionDiagnosis, VideoRetention } from "@/lib/types";

/** Agrega retenção ponderando pelos plays (não faz média simples dos %). */
export function mergeVideoRetention(
  items: Array<VideoRetention | null | undefined>
): VideoRetention | null {
  const valid = items.filter((r): r is VideoRetention => Boolean(r && r.plays > 0));
  if (!valid.length) return null;

  const plays = valid.reduce((sum, r) => sum + r.plays, 0);
  if (!plays) return null;

  const weighted = (pick: (r: VideoRetention) => number) =>
    valid.reduce((sum, r) => sum + pick(r) * r.plays, 0) / plays;

  // Duração: moda simples via o maior peso de plays
  const duration_sec = valid.reduce((best, r) =>
    r.plays > best.plays ? r : best
  ).duration_sec;

  return {
    plays,
    avg_watch_time_sec: weighted((r) => r.avg_watch_time_sec),
    duration_sec,
    p25: weighted((r) => r.p25),
    p50: weighted((r) => r.p50),
    p75: weighted((r) => r.p75),
    p95: weighted((r) => r.p95),
    p100: weighted((r) => r.p100),
  };
}

export function diagnoseRetention(
  retention: VideoRetention
): RetentionDiagnosis {
  const dropHook = 100 - retention.p25;
  const dropMid = retention.p25 - retention.p75;
  const dropEnd = retention.p75 - retention.p100;

  if (dropHook >= dropMid && dropHook >= dropEnd && dropHook >= 28) {
    return {
      area: "hook",
      label: "Possível problema no hook",
      hint: "Queda forte nos primeiros 25%. Teste abertura mais direta nos 3–5s iniciais.",
      dropHook,
      dropMid,
      dropEnd,
    };
  }

  if (dropMid >= dropHook && dropMid >= dropEnd && dropMid >= 22) {
    return {
      area: "conteudo",
      label: "Possível problema no conteúdo",
      hint: "A audiência segura o início e cai no meio. Encurte, acelere o pacing ou reforce a promessa.",
      dropHook,
      dropMid,
      dropEnd,
    };
  }

  if (dropEnd >= dropHook && dropEnd >= dropMid && dropEnd >= 18) {
    return {
      area: "cta",
      label: "Possível problema no CTA / final",
      hint: "Chegam longe e saem no fechamento. Deixe o CTA mais claro e antecipado.",
      dropHook,
      dropMid,
      dropEnd,
    };
  }

  return {
    area: "saudavel",
    label: "Retenção relativamente estável",
    hint: "Sem queda dominante. Compare com criativos do mesmo objetivo para achar o melhor padrão.",
    dropHook,
    dropMid,
    dropEnd,
  };
}

export function retentionChartPoints(retention: VideoRetention) {
  return [
    { label: "0%", pct: 0, retained: 100 },
    { label: "25%", pct: 25, retained: round1(retention.p25) },
    { label: "50%", pct: 50, retained: round1(retention.p50) },
    { label: "75%", pct: 75, retained: round1(retention.p75) },
    { label: "95%", pct: 95, retained: round1(retention.p95) },
    { label: "100%", pct: 100, retained: round1(retention.p100) },
  ];
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function formatWatchTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}
