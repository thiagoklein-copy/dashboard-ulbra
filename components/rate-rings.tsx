"use client";

import { MousePointerClick, Target } from "lucide-react";
import { formatMetric } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Funil } from "@/lib/types";

function Anel({
  valor,
  maximo,
  titulo,
  legenda,
  cor,
  icone: Icone,
  loading,
}: {
  valor: number;
  maximo: number;
  titulo: string;
  legenda: string;
  cor: string;
  icone: typeof Target;
  loading?: boolean;
}) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(1, maximo ? valor / maximo : 0));

  return (
    <div className="flex items-center gap-3.5">
      <div className="relative size-[86px] shrink-0">
        <svg viewBox="0 0 86 86" className="size-full -rotate-90">
          <circle cx="43" cy="43" r={R} fill="none" stroke="#e9e7e2" strokeWidth="7" />
          <circle
            cx="43"
            cy="43"
            r={R}
            fill="none"
            stroke={cor}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={loading ? C : C * (1 - pct)}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Icone className="size-5" style={{ color: cor }} />
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-medium tabular-nums leading-none text-gray-900 dark:text-gray-100">
          {loading ? "—" : `${valor.toFixed(2).replace(".", ",")}%`}
        </p>
        <p className="mt-1.5 text-xs font-medium text-gray-900 dark:text-gray-100">{titulo}</p>
        <p className="text-[11px] leading-snug text-gray-500 dark:text-gray-400">{legenda}</p>
      </div>
    </div>
  );
}

/** Barra segmentada: onde as impressões param em cada etapa. */
function BarraEtapas({ funil, loading }: { funil: Funil | null; loading?: boolean }) {
  const f = funil;
  const imp = f?.impressoes ?? 0;
  const cliques = f?.cliquesLink ?? 0;
  const leads = f?.resultados ?? 0;
  const aposClique = f?.resultadoAposClique ?? true;

  /*
    A barra só pode encaixar etapas quando uma contém a outra. Em conversão
    isso vale: quem converteu clicou, quem clicou viu. Em branding não —
    engajamento acontece dentro do Meta e chega a ser 5x os cliques, o que
    fazia `cliques - leads` virar negativo e a fatia do meio sumir zerada
    pelo clamp, sem ninguém perceber.

    Então em branding a barra mostra só o que de fato aninha (viu → clicou),
    e o resultado aparece na legenda como grandeza paralela.
  */
  const bruto = aposClique
    ? [imp - cliques, cliques - leads, leads].map((v) => Math.max(0, v))
    : [Math.max(0, imp - cliques), cliques];

  // Cliques e leads somam frações minúsculas do total; usamos raiz para
  // que as fatias finais fiquem visíveis sem inventar proporção.
  const peso = bruto.map((v) => Math.sqrt(v));
  const soma = peso.reduce((a, b) => a + b, 0) || 1;
  const fatias = peso.map((p) => (p / soma) * 100);

  const ITENS = aposClique
    ? [
        { rotulo: "Não clicou", valor: bruto[0], cor: "#d6d3cd" },
        { rotulo: "Clicou, não converteu", valor: bruto[1], cor: "#f59e0b" },
        { rotulo: "Converteu", valor: bruto[2], cor: "#059669" },
      ]
    : [
        { rotulo: "Não clicou", valor: bruto[0], cor: "#d6d3cd" },
        { rotulo: "Clicou no link", valor: bruto[1], cor: "#f59e0b" },
      ];

  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
        {!loading &&
          fatias.map((w, i) => (
            <span key={i} style={{ width: `${w}%`, background: ITENS[i].cor }} />
          ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {ITENS.map((it) => (
          <div key={it.rotulo} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: it.cor }} />
            <span className="text-[11px] text-gray-500 dark:text-gray-400">{it.rotulo}</span>
            <span className="text-[11px] font-medium tabular-nums text-gray-900 dark:text-gray-100">
              {loading ? "—" : formatMetric(it.valor, "number")}
            </span>
          </div>
        ))}
        {!aposClique && (
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full ring-1 ring-emerald-600" />
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              Resultado (fora da barra — não vem do clique)
            </span>
            <span className="text-[11px] font-medium tabular-nums text-gray-900 dark:text-gray-100">
              {loading ? "—" : formatMetric(leads, "number")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function RateRings({
  funil,
  loading,
}: {
  funil: Funil | null;
  loading?: boolean;
}) {
  const f = funil;
  const aposClique = f?.resultadoAposClique ?? true;

  return (
    <div className={cn("rounded-2xl bg-white p-5 shadow-sm dark:bg-[#171a20]")}>
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Taxas de conversão</h3>
        {/* Derivadas de impressão e clique, que só a Meta entrega. */}
        <span className="rounded-full bg-gray-100 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-gray-500 dark:bg-white/10 dark:text-gray-400">
          Meta
        </span>
      </div>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        Quanto sobra a cada etapa do funil
      </p>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Anel
          valor={f?.taxaAnuncio ?? 0}
          maximo={3}
          titulo="Do anúncio"
          legenda="impressões que viraram clique"
          cor="#7c3aed"
          icone={MousePointerClick}
          loading={loading}
        />
        {/*
          Em branding o resultado não passa pelo site, então "cliques que
          viraram resultado" não descreve nada — e o anel vivia cravado no
          máximo, porque a razão passava de 100%.
        */}
        <Anel
          valor={aposClique ? (f?.taxaPagina ?? 0) : (f?.taxaSobreImpressoes ?? 0)}
          maximo={aposClique ? 50 : 20}
          titulo={aposClique ? "Da página" : "Da ação"}
          legenda={
            aposClique
              ? "cliques que viraram resultado"
              : "impressões que viraram resultado"
          }
          cor="#059669"
          icone={Target}
          loading={loading}
        />
      </div>

      <div className="mt-6 border-t border-gray-100 dark:border-white/10 pt-5">
        <BarraEtapas funil={f} loading={loading} />
      </div>
    </div>
  );
}
