import { describe, expect, it } from "vitest";
import {
  diagnoseRetention,
  formatWatchTime,
  mergeVideoDesempenho,
  mergeVideoRetention,
  montarDesempenho,
  retentionChartPoints,
} from "@/lib/video-retention";
import type { VideoRetention } from "@/lib/types";

function ret(over: Partial<VideoRetention> = {}): VideoRetention {
  return {
    plays: 100, avg_watch_time_sec: 10, duration_sec: 30,
    p25: 60, p50: 40, p75: 25, p95: 15, p100: 10,
    ...over,
  };
}

describe("mergeVideoRetention", () => {
  /** Média simples de percentuais ignora que um vídeo teve 10x mais plays. */
  it("pondera pelos plays em vez de tirar média simples", () => {
    const m = mergeVideoRetention([
      ret({ plays: 900, p25: 80 }),
      ret({ plays: 100, p25: 20 }),
    ]);
    expect(m?.p25).toBeCloseTo(74, 5); // (80*900 + 20*100) / 1000
  });

  it("soma os plays", () => {
    expect(mergeVideoRetention([ret({ plays: 30 }), ret({ plays: 70 })])?.plays).toBe(100);
  });

  it("descarta entradas sem play", () => {
    const m = mergeVideoRetention([ret({ plays: 0, p25: 99 }), ret({ plays: 50, p25: 10 })]);
    expect(m?.plays).toBe(50);
    expect(m?.p25).toBeCloseTo(10, 5);
  });

  it.each([[[]], [[null]], [[undefined]]])("devolve nulo para %p", (itens) => {
    expect(mergeVideoRetention(itens as (VideoRetention | null | undefined)[])).toBeNull();
  });

  it("usa a duração do vídeo com mais plays", () => {
    const m = mergeVideoRetention([
      ret({ plays: 10, duration_sec: 15 }),
      ret({ plays: 90, duration_sec: 60 }),
    ]);
    expect(m?.duration_sec).toBe(60);
  });
});

describe("diagnoseRetention", () => {
  it("aponta o gancho quando a queda inicial domina", () => {
    expect(diagnoseRetention(ret({ p25: 40, p50: 38, p75: 36, p100: 34 })).area).toBe("hook");
  });

  it("aponta o conteúdo quando a queda é no meio", () => {
    expect(diagnoseRetention(ret({ p25: 90, p50: 70, p75: 55, p100: 50 })).area).toBe("conteudo");
  });

  it("aponta o CTA quando a queda é no fim", () => {
    expect(diagnoseRetention(ret({ p25: 95, p50: 92, p75: 90, p100: 60 })).area).toBe("cta");
  });

  it("considera saudável quando não há queda dominante", () => {
    expect(diagnoseRetention(ret({ p25: 95, p50: 90, p75: 85, p100: 80 })).area).toBe("saudavel");
  });

  it("sempre devolve rótulo e dica", () => {
    const d = diagnoseRetention(ret());
    expect(d.label).toBeTruthy();
    expect(d.hint).toBeTruthy();
  });
});

describe("retentionChartPoints", () => {
  it("começa em 100% e cobre todos os quartis", () => {
    const p = retentionChartPoints(ret());
    expect(p[0]).toMatchObject({ pct: 0, retained: 100 });
    expect(p.map((x) => x.pct)).toEqual([0, 25, 50, 75, 95, 100]);
  });
});

describe("formatWatchTime", () => {
  it.each([
    [45, "45s"],
    [90, "1m 30s"],
    [3, "3s"],
    [125, "2m 05s"],
  ])("formata %i segundos como %s", (seg, esperado) => {
    expect(formatWatchTime(seg)).toBe(esperado);
  });
});

describe("montarDesempenho", () => {
  it("sem reprodução não há painel", () => {
    expect(
      montarDesempenho({ plays: 0, tempoMedioSec: 5, thruplay: 3, curva: [] })
    ).toBeNull();
  });

  it("atenção inicial é o 4º ponto da curva, como no painel do Meta", () => {
    const curva = Array.from({ length: 22 }, (_, i) => (i === 3 ? 18 : 1));
    const d = montarDesempenho({
      plays: 1000,
      tempoMedioSec: 4,
      thruplay: 50,
      curva,
    })!;
    expect(d.atencaoInicial).toBe(18);
    expect(d.retencao).toBeCloseTo(5, 6);
  });

  it("curva com tamanho inesperado é descartada em vez de deslocar o eixo", () => {
    const d = montarDesempenho({
      plays: 10,
      tempoMedioSec: 1,
      thruplay: 1,
      curva: [100, 50, 10],
    })!;
    expect(d.curva).toEqual([]);
    expect(d.atencaoInicial).toBe(0);
  });

  it("thruplay nulo vira retenção zero — o Meta omite a ação quando não houve", () => {
    const d = montarDesempenho({
      plays: 100,
      tempoMedioSec: 2,
      thruplay: null,
      curva: null,
    })!;
    expect(d.retencao).toBe(0);
  });
});

describe("mergeVideoDesempenho", () => {
  const curvaDe = (v: number) => Array.from({ length: 22 }, () => v);

  it("pondera a curva pelas reproduções, não tira média simples", () => {
    const junto = mergeVideoDesempenho([
      { reproducoes: 900, tempoMedioSec: 1, atencaoInicial: 10, retencao: 1, curva: curvaDe(10) },
      { reproducoes: 100, tempoMedioSec: 1, atencaoInicial: 50, retencao: 1, curva: curvaDe(50) },
    ])!;
    // média simples daria 30; o dia de 900 plays tem que pesar mais
    expect(junto.curva[0]).toBe(14);
    expect(junto.atencaoInicial).toBe(14);
    expect(junto.reproducoes).toBe(1000);
  });

  it("ignora dias sem curva sem estragar o peso dos que têm", () => {
    const junto = mergeVideoDesempenho([
      { reproducoes: 100, tempoMedioSec: 1, atencaoInicial: 20, retencao: 1, curva: curvaDe(20) },
      { reproducoes: 900, tempoMedioSec: 1, atencaoInicial: 0, retencao: 1, curva: [] },
    ])!;
    expect(junto.curva[0]).toBe(20);
    expect(junto.reproducoes).toBe(1000);
  });

  it("devolve nulo quando nenhum dia teve reprodução", () => {
    expect(mergeVideoDesempenho([null, undefined])).toBeNull();
  });
});
