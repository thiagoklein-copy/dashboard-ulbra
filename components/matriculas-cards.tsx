"use client";

import { AlertTriangle, GraduationCap } from "lucide-react";
import { formatDateBR, formatMetric } from "@/lib/format";
import type { MatriculasResumo } from "@/lib/types";

function Item({
  label,
  valor,
  nota,
}: {
  label: string;
  valor: string;
  nota?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-medium tabular-nums text-gray-900 dark:text-gray-100">
        {valor}
      </p>
      {nota && (
        <p className="mt-0.5 text-[10px] leading-tight text-gray-400 dark:text-gray-500">
          {nota}
        </p>
      )}
    </div>
  );
}

/**
 * Bloco de matrículas — o resumo da tela inicial.
 *
 * Vive separado dos cards de mídia de propósito: matrícula não vem da Meta e
 * segue outro recorte de filtro.
 *
 * As ressalvas de método (CAC blended, escopo dos filtros) moraram aqui e
 * foram para a aba Praça × Curso: empilhadas sob quatro números, viravam
 * ruído que se lê uma vez e nunca mais. Lá elas ficam ao lado da tabela que
 * de fato orienta decisão de verba.
 */
export function MatriculasCards({
  matriculas,
  loading,
}: {
  matriculas: MatriculasResumo | null;
  loading?: boolean;
}) {
  // Sem tabela carregada não há o que mostrar — o dashboard de mídia segue
  // inteiro sem este bloco.
  if (!loading && (!matriculas || (!matriculas.total && !matriculas.dadoAte))) {
    return null;
  }

  const vazio = !matriculas || loading;
  const m = matriculas;
  const f = (v: number, fmt: "currency" | "number" | "percent") =>
    vazio ? "—" : formatMetric(v, fmt);

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-[#171a20]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500">
            <GraduationCap className="size-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Matrículas confirmadas
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Só matrícula nova — rematrícula é retenção da base, não captação
            </p>
            {/*
              As ressalvas de método foram para a aba Praça × Curso, onde
              estão os números que elas qualificam. Este selo fica porque não
              é nota de rodapé: é o estado do dado. Sem ele, um período que
              passa da última carga mostra queda que não existe.
            */}
            {m?.periodoIncompleto && m.dadoAte && !loading && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                <AlertTriangle className="size-3" />
                dado até {formatDateBR(m.dadoAte)}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-medium tabular-nums text-gray-900 dark:text-gray-100">
            {f(m?.total ?? 0, "number")}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
            no período
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-4 dark:border-white/10">
        <Item
          label="CAC"
          valor={m?.total ? f(m.cac, "currency") : "—"}
          nota="sobre gasto de conversão"
        />
        <Item
          label="Lead → matríc."
          valor={f(m?.taxaMatricula ?? 0, "percent")}
          nota="lead de todas as mídias"
        />
        <Item
          label="Receita"
          valor={f(m?.receita ?? 0, "currency")}
          nota={
            m?.semReceita
              ? `${formatMetric(m.semReceita, "number")} sem valor informado`
              : "líquida do semestre"
          }
        />
        <Item
          label="ROI mídia"
          valor={m?.roi ? `${m.roi.toFixed(1).replace(".", ",")}×` : "—"}
        />
      </div>

      {/*
        Sem atribuição por clique, a matrícula não segue campanha, conjunto
        nem busca: o número aqui continua sendo o do período inteiro
        enquanto o resto da tela mostra um recorte. Sem este aviso, filtrar
        uma campanha de 8 resultados fazia a taxa lead → matrícula ler
        19.237%.
      */}
      {m?.filtroNaoAplicado && (
        <p className="mt-4 rounded-lg bg-amber-100/70 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
          Filtro de campanha, conjunto ou busca ativo. A matrícula não é
          atribuída a campanha, então estes números seguem o período inteiro
          — só curso e praça os recortam.
        </p>
      )}
    </div>
  );
}
