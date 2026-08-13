"use client";

import { useMemo, useState } from "react";
import { formatMetric } from "@/lib/format";
import type { BreakdownItem } from "@/lib/types";

/** Coordenadas das unidades da ULBRA. */
const UNIDADES: Record<string, [lon: number, lat: number]> = {
  Canoas: [-51.18, -29.92],
  "Porto Alegre": [-51.23, -30.03],
  Gravataí: [-50.99, -29.94],
  Guaíba: [-51.32, -30.11],
  "São Jerônimo": [-51.72, -29.96],
  "Santa Maria": [-53.81, -29.68],
  "Cachoeira do Sul": [-52.89, -30.04],
  Carazinho: [-52.79, -28.28],
  Torres: [-49.73, -29.34],
  Palmas: [-48.33, -10.18],
  Manaus: [-60.02, -3.12],
  Santarém: [-54.7, -2.44],
  Itumbiara: [-49.22, -18.42],
};

/** Nove das treze unidades ficam no RS — daí o mapa auxiliar. */
const NO_RS = new Set([
  "Canoas", "Porto Alegre", "Gravataí", "Guaíba", "São Jerônimo",
  "Santa Maria", "Cachoeira do Sul", "Carazinho", "Torres",
]);

const CONTORNO_BR: [number, number][] = [
  [-60.0, 5.2], [-59.9, 4.5], [-55.2, 2.5], [-51.6, 4.1], [-50.0, 0.0],
  [-44.3, -2.5], [-38.5, -3.7], [-35.2, -5.8], [-34.8, -7.1], [-37.0, -11.0],
  [-38.5, -13.0], [-39.0, -17.9], [-40.3, -20.3], [-43.2, -23.0], [-48.5, -25.5],
  [-48.6, -28.5], [-50.0, -32.0], [-52.3, -33.7], [-57.6, -30.2], [-56.0, -27.5],
  [-54.6, -25.6], [-57.9, -22.1], [-58.2, -19.8], [-60.0, -16.3], [-65.3, -11.0],
  [-69.6, -10.9], [-73.9, -7.5], [-70.0, -4.2], [-69.4, 1.1], [-67.0, 1.9],
  [-64.0, 4.1],
];

const CONTORNO_RS: [number, number][] = [
  [-53.1, -27.1], [-51.6, -27.2], [-49.7, -28.6], [-50.0, -30.4], [-50.7, -31.4],
  [-51.5, -32.2], [-52.2, -33.2], [-53.4, -33.7], [-53.5, -32.5], [-54.9, -31.4],
  [-56.0, -31.0], [-57.6, -30.2], [-56.8, -29.0], [-56.0, -28.0], [-55.2, -27.4],
  [-54.0, -27.0],
];

const ESCALA = ["#1e3a8a", "#0e7490", "#15803d", "#ca8a04", "#ea580c", "#dc2626"];

function corDoCalor(t: number): string {
  return ESCALA[Math.min(ESCALA.length - 1, Math.floor(t * (ESCALA.length - 1) + 0.0001))];
}

/** Projeção linear dentro de uma caixa. */
function projetor(
  lon: readonly [number, number],
  lat: readonly [number, number],
  w: number,
  h: number
) {
  return {
    x: (v: number) => ((v - lon[0]) / (lon[1] - lon[0])) * w,
    y: (v: number) => ((v - lat[0]) / (lat[1] - lat[0])) * h,
  };
}

function caminho(pts: [number, number][], p: ReturnType<typeof projetor>) {
  return (
    pts.map(([lo, la], i) => `${i ? "L" : "M"}${p.x(lo).toFixed(1)},${p.y(la).toFixed(1)}`).join(" ") + " Z"
  );
}

type Ponto = BreakdownItem & { coord: [number, number] };

/**
 * Empurra rótulos que colidem para cima ou para baixo, mantendo a linha-guia
 * até o ponto. Sem isso os nomes do RS ficam ilegíveis.
 */
function distribuirRotulos(
  itens: { nome: string; x: number; y: number }[],
  alturaLinha = 15
) {
  const ordenado = [...itens].sort((a, b) => a.y - b.y);
  let ultimo = -Infinity;
  for (const it of ordenado) {
    if (it.y - ultimo < alturaLinha) it.y = ultimo + alturaLinha;
    ultimo = it.y;
  }
  return new Map(ordenado.map((i) => [i.nome, i.y]));
}

function Mapa({
  pontos,
  contorno,
  lon,
  lat,
  w,
  h,
  maxLeads,
  ativo,
  setAtivo,
  rotularADireita,
}: {
  pontos: Ponto[];
  contorno: [number, number][];
  lon: readonly [number, number];
  lat: readonly [number, number];
  w: number;
  h: number;
  maxLeads: number;
  ativo: string | null;
  setAtivo: (v: string | null) => void;
  rotularADireita?: boolean;
}) {
  const p = projetor(lon, lat, w, h);
  const d = caminho(contorno, p);
  const id = rotularADireita ? "rs" : "br";

  const rotulos = distribuirRotulos(
    pontos.map((pt) => ({ nome: pt.nome, x: p.x(pt.coord[0]), y: p.y(pt.coord[1]) }))
  );

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" role="img">
      <defs>
        <pattern id={`grade-${id}`} width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.06)" />
        </pattern>
        <clipPath id={`recorte-${id}`}>
          <path d={d} />
        </clipPath>
        <filter id={`brilho-${id}`} x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width={w} height={h} fill={`url(#grade-${id})`} />
      <g clipPath={`url(#recorte-${id})`}>
        <rect width={w} height={h} fill="rgba(255,255,255,0.04)" />
      </g>
      <path d={d} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" strokeLinejoin="round" />

      {pontos.map((pt) => {
        const t = pt.results / maxLeads;
        const r = 4 + Math.sqrt(t) * (rotularADireita ? 20 : 16);
        const cor = corDoCalor(t);
        const on = ativo === pt.nome;
        const cx = p.x(pt.coord[0]);
        const cy = p.y(pt.coord[1]);
        const ly = rotulos.get(pt.nome) ?? cy;
        const lx = cx + r + 8;

        return (
          <g
            key={pt.nome}
            onMouseEnter={() => setAtivo(pt.nome)}
            onMouseLeave={() => setAtivo(null)}
            className="cursor-pointer"
          >
            <circle cx={cx} cy={cy} r={r} fill={cor} opacity={on ? 0.55 : 0.3} filter={`url(#brilho-${id})`} />
            <circle
              cx={cx}
              cy={cy}
              r={Math.max(2.5, r * 0.34)}
              fill={cor}
              stroke="rgba(255,255,255,0.92)"
              strokeWidth={on ? 1.6 : 0.8}
            />
            {Math.abs(ly - cy) > 2 && (
              <line x1={cx + r * 0.5} y1={cy} x2={lx - 3} y2={ly - 3} stroke="rgba(255,255,255,0.22)" strokeWidth="0.8" />
            )}
            <text
              x={lx}
              y={ly}
              fontSize="10.5"
              fill={on ? "#fff" : "rgba(255,255,255,0.6)"}
              className="pointer-events-none select-none"
            >
              {pt.nome}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function LeadsMap({
  porPraca,
  loading,
}: {
  porPraca: BreakdownItem[];
  loading?: boolean;
}) {
  const [ativo, setAtivo] = useState<string | null>(null);

  const { noBrasil, noRS, foraDoMapa, maxLeads, totalLeads } = useMemo(() => {
    const comCoord = porPraca
      .filter((p) => UNIDADES[p.nome] && p.results > 0)
      .map((p) => ({ ...p, coord: UNIDADES[p.nome] }) as Ponto);
    return {
      noBrasil: comCoord.filter((p) => !NO_RS.has(p.nome)),
      noRS: comCoord.filter((p) => NO_RS.has(p.nome)),
      foraDoMapa: porPraca.filter((p) => !UNIDADES[p.nome] && p.results > 0),
      maxLeads: Math.max(...comCoord.map((p) => p.results), 1),
      totalLeads: porPraca.reduce((s, p) => s + p.results, 0),
    };
  }, [porPraca]);

  const destacado = [...noBrasil, ...noRS].find((p) => p.nome === ativo);
  const semDados = noBrasil.length + noRS.length === 0;

  return (
    <div className="overflow-hidden rounded-2xl bg-[#0b0f1a] shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/5 p-5">
        <div>
          <h3 className="text-sm font-medium text-white">
            Concentração de leads por unidade
          </h3>
          <p className="mt-0.5 text-xs text-white/45">
            Quanto mais quente, maior o volume captado
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-white/40">menos</span>
          <div className="flex overflow-hidden rounded-full">
            {ESCALA.map((c) => (
              <span key={c} className="h-2 w-5" style={{ background: c }} />
            ))}
          </div>
          <span className="text-[10px] uppercase tracking-wider text-white/40">mais</span>
        </div>
      </div>

      {loading ? (
        <div className="h-[460px] animate-pulse bg-white/5" />
      ) : semDados ? (
        <div className="flex h-[460px] items-center justify-center text-sm text-white/40">
          Sem leads no período selecionado
        </div>
      ) : (
        <div className="relative grid grid-cols-1 gap-2 p-3 md:grid-cols-2">
          <div className="relative h-[440px] min-w-0">
            <span className="absolute left-2 top-1 z-10 text-[10px] uppercase tracking-wider text-white/35">
              Brasil
            </span>
            <Mapa
              pontos={noBrasil}
              contorno={CONTORNO_BR}
              lon={[-75, -33]}
              lat={[6.5, -35]}
              w={420}
              h={470}
              maxLeads={maxLeads}
              ativo={ativo}
              setAtivo={setAtivo}
            />
          </div>

          <div className="relative h-[440px] min-w-0 rounded-xl border border-white/10 bg-white/[0.02]">
            <span className="absolute left-2 top-1 z-10 text-[10px] uppercase tracking-wider text-white/35">
              Rio Grande do Sul · ampliado
            </span>
            <Mapa
              pontos={noRS}
              contorno={CONTORNO_RS}
              lon={[-58.5, -48.5]}
              lat={[-26.6, -34.2]}
              w={420}
              h={470}
              maxLeads={maxLeads}
              ativo={ativo}
              setAtivo={setAtivo}
              rotularADireita
            />
          </div>

          {destacado && (
            <div className="pointer-events-none absolute left-5 bottom-4 z-20 rounded-xl bg-black/80 px-3.5 py-2.5 backdrop-blur-sm">
              <p className="text-xs font-medium text-white">{destacado.nome}</p>
              <p className="mt-1 text-lg font-medium tabular-nums text-white">
                {formatMetric(destacado.results, "number")}{" "}
                <span className="text-xs font-normal text-white/50">leads</span>
              </p>
              <p className="text-[11px] text-white/50">
                {formatMetric(destacado.spend, "currency")} ·{" "}
                {formatMetric(destacado.cost_per_result, "currency")} por lead
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-5">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/40">Total de leads</p>
            <p className="text-base font-medium tabular-nums text-white">
              {formatMetric(totalLeads, "number")}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/40">Unidades</p>
            <p className="text-base font-medium tabular-nums text-white">
              {noBrasil.length + noRS.length}
            </p>
          </div>
        </div>
        {foraDoMapa.length > 0 && (
          <p className="max-w-[58%] text-right text-[11px] leading-relaxed text-white/35">
            {formatMetric(
              foraDoMapa.reduce((s, p) => s + p.results, 0),
              "number"
            )}{" "}
            leads de campanhas sem localização única ({foraDoMapa.map((p) => p.nome).join(", ")})
            ficam fora do mapa
          </p>
        )}
      </div>
    </div>
  );
}
