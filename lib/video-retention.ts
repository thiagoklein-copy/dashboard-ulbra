import type {
  RetentionDiagnosis,
  VideoDesempenho,
  VideoRetention,
} from "@/lib/types";

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

/**
 * Junta o painel de vídeo de várias linhas-dia num só.
 *
 * A curva vem do Meta como 22 pontos em % de quem ainda assiste, sempre
 * começando em 100. Como é percentual, somar os dias não faz sentido: cada
 * ponto é ponderado pelas reproduções daquele dia, igual ao resto do arquivo.
 *
 * ThruPlay vem nulo quando não houve nenhum: o Meta omite a ação em vez de
 * mandar zero. `montarDesempenho` traduz isso para retenção zero — que é o
 * valor certo, porque "nenhum ThruPlay" é performance, não dado ausente — e
 * o dia entra na média ponderada como qualquer outro.
 *
 * (Este comentário já afirmou o contrário: que esses dias eram excluídos do
 * denominador. Nunca foram, e `tests/video-retention.test.ts` fixa o
 * comportamento real. Ficava convidando a "corrigir" código que está certo.)
 */
export function mergeVideoDesempenho(
  items: Array<VideoDesempenho | null | undefined>
): VideoDesempenho | null {
  const validos = items.filter(
    (d): d is VideoDesempenho => Boolean(d && d.reproducoes > 0)
  );
  if (!validos.length) return null;

  const reproducoes = validos.reduce((s, d) => s + d.reproducoes, 0);
  const ponderado = (pick: (d: VideoDesempenho) => number) =>
    validos.reduce((s, d) => s + pick(d) * d.reproducoes, 0) / reproducoes;

  const comCurva = validos.filter((d) => d.curva.length === PONTOS_CURVA);
  const pesoCurva = comCurva.reduce((s, d) => s + d.reproducoes, 0);
  const curva = pesoCurva
    ? Array.from({ length: PONTOS_CURVA }, (_, i) =>
        round1(
          comCurva.reduce((s, d) => s + d.curva[i] * d.reproducoes, 0) /
            pesoCurva
        )
      )
    : [];

  return {
    reproducoes,
    tempoMedioSec: ponderado((d) => d.tempoMedioSec),
    atencaoInicial: curva.length ? curva[INDICE_ATENCAO] : 0,
    retencao: ponderado((d) => d.retencao),
    curva,
  };
}

/** O Meta devolve a curva sempre com 22 pontos, do início ao fim do vídeo. */
export const PONTOS_CURVA = 22;

/**
 * A "taxa de atenção inicial" do painel do Meta é o 4º ponto da curva.
 *
 * Não é dedução: conferimos contra três vídeos de durações diferentes e o
 * número bateu exato nos três (18%, 16% e 20%).
 */
export const INDICE_ATENCAO = 3;

/** Constrói o painel a partir das colunas cruas de uma linha-dia. */
export function montarDesempenho(dados: {
  plays: number | null | undefined;
  tempoMedioSec: number | null | undefined;
  thruplay: number | null | undefined;
  curva: number[] | null | undefined;
}): VideoDesempenho | null {
  const reproducoes = Number(dados.plays ?? 0);
  if (!reproducoes) return null;

  const curva =
    Array.isArray(dados.curva) && dados.curva.length === PONTOS_CURVA
      ? dados.curva.map(Number)
      : [];

  return {
    reproducoes,
    tempoMedioSec: Number(dados.tempoMedioSec ?? 0),
    atencaoInicial: curva.length ? curva[INDICE_ATENCAO] : 0,
    // ThruPlay = assistiu 15s (ou o vídeo inteiro, se for mais curto).
    retencao:
      dados.thruplay == null ? 0 : (Number(dados.thruplay) / reproducoes) * 100,
    curva,
  };
}

/** Pontos do gráfico: o eixo é % da duração, não segundos. */
export function pontosCurva(d: VideoDesempenho) {
  return d.curva.map((retido, i) => ({
    pct: Math.round((i / (PONTOS_CURVA - 1)) * 100),
    retido,
  }));
}
