"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { formatMetric } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InsightsResponse, MatrizItem } from "@/lib/types";

type Eixo = "pracaCurso" | "porPraca" | "porCurso";
type Coluna = Exclude<keyof MatrizItem, "id" | "praca" | "curso">;

const EIXOS: { value: Eixo; label: string }[] = [
  { value: "pracaCurso", label: "Praça × Curso" },
  { value: "porPraca", label: "Por praça" },
  { value: "porCurso", label: "Por curso" },
];

/**
 * `menorMelhor` inverte a primeira ordenação da coluna.
 *
 * Clicar em "Receita" quer dizer "quem rendeu mais"; clicar em "CAC" quer
 * dizer "quem custou menos". Abrir os dois em decrescente colocaria o pior
 * CAC no topo, que é o contrário do que a pergunta pede.
 */
const COLUNAS: {
  key: Coluna;
  label: string;
  titulo: string;
  menorMelhor: boolean;
}[] = [
  { key: "investimento", label: "Invest.", titulo: "Investimento em conversão", menorMelhor: false },
  { key: "leads", label: "Leads", titulo: "Leads gerados", menorMelhor: false },
  { key: "cpl", label: "CPL", titulo: "Custo por lead — investimento ÷ leads", menorMelhor: true },
  { key: "matriculas", label: "Matríc.", titulo: "Matrículas novas confirmadas", menorMelhor: false },
  { key: "cac", label: "CAC", titulo: "Custo por matrícula — investimento ÷ matrículas", menorMelhor: true },
  { key: "receita", label: "Receita", titulo: "Receita líquida do semestre", menorMelhor: false },
  { key: "roi", label: "ROI", titulo: "Receita ÷ investimento", menorMelhor: false },
  { key: "taxaConversao", label: "Conv.", titulo: "% de leads que viraram matrícula", menorMelhor: false },
];

/**
 * Zero e "não se aplica" são coisas diferentes, e a tabela não pode
 * confundi-las.
 *
 * Administração teve 64 matrículas e nenhuma campanha: o CAC dela não é
 * R$ 0,00 (grátis), é indefinido — não houve investimento para dividir.
 * Mostrar zero leria como o curso mais eficiente da rede. Já uma taxa de
 * conversão de 0% com leads existindo é informação de verdade, e aparece.
 */
/**
 * Quando praticamente todo o investimento da linha veio de rateio, o número
 * não mede mídia: nenhuma campanha citou aquele curso naquela praça, e a
 * fatia foi arbitrada a partir de uma campanha nacional, ponderada pelas
 * matrículas do destino. CAC e CPL da linha viram função da própria
 * contagem de matrículas. O til avisa que ali não há medição.
 */
const RATEADO = 0.995;

function celula(item: MatrizItem, key: Coluna): string {
  const til = (v: string) => (item.fracaoRateada >= RATEADO ? `~${v}` : v);
  switch (key) {
    case "investimento":
      return item.investimento === 0 ? "—" : til(formatMetric(item.investimento, "currency"));
    case "receita":
      return formatMetric(item.receita, "currency");
    case "leads":
      return til(formatMetric(item.leads, "number"));
    case "matriculas":
      return formatMetric(item.matriculas, "number");
    case "cpl":
      return item.leads ? til(formatMetric(item.cpl, "currency")) : "—";
    case "cac":
      return item.matriculas && item.investimento
        ? til(formatMetric(item.cac, "currency"))
        : "—";
    case "roi":
      return item.investimento ? til(`${item.roi.toFixed(1).replace(".", ",")}×`) : "—";
    case "taxaConversao":
      return item.leads ? til(formatMetric(item.taxaConversao, "percent")) : "—";
    default:
      return "—";
  }
}

function Pills<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-[11px] font-medium transition-colors",
            value === o.value
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function totalizar(itens: MatrizItem[]): MatrizItem {
  const rateado = itens.reduce((a, i) => a + i.investimento * i.fracaoRateada, 0);
  const s = itens.reduce(
    (a, i) => ({
      investimento: a.investimento + i.investimento,
      leads: a.leads + i.leads,
      matriculas: a.matriculas + i.matriculas,
      receita: a.receita + i.receita,
    }),
    { investimento: 0, leads: 0, matriculas: 0, receita: 0 }
  );
  // Média das colunas derivadas não é a soma delas: CPL do total é gasto
  // total sobre leads totais, não a média dos CPLs de cada linha.
  return {
    id: "__total__",
    praca: "",
    curso: "",
    ...s,
    fracaoRateada: s.investimento ? rateado / s.investimento : 0,
    cpl: s.leads ? s.investimento / s.leads : 0,
    cac: s.matriculas ? s.investimento / s.matriculas : 0,
    roi: s.investimento ? s.receita / s.investimento : 0,
    taxaConversao: s.leads ? (s.matriculas / s.leads) * 100 : 0,
  };
}

export function MatrizPracaCurso({
  matriz,
  loading,
}: {
  matriz: InsightsResponse["matriz"] | null;
  loading?: boolean;
}) {
  const [eixo, setEixo] = useState<Eixo>("pracaCurso");
  const [ordem, setOrdem] = useState<Coluna>("investimento");
  const [desc, setDesc] = useState(true);

  // O `?? []` cria um array novo a cada render enquanto os dados não
  // chegaram, e isso invalidaria os três useMemo abaixo em toda passagem.
  const itens = useMemo(() => matriz?.[eixo] ?? [], [matriz, eixo]);

  const ordenados = useMemo(() => {
    const lista = [...itens];
    lista.sort((a, b) => (desc ? b[ordem] - a[ordem] : a[ordem] - b[ordem]));
    return lista;
  }, [itens, ordem, desc]);

  const total = useMemo(() => totalizar(itens), [itens]);


  function ordenarPor(key: Coluna) {
    if (key === ordem) {
      setDesc((d) => !d);
      return;
    }
    setOrdem(key);
    setDesc(!COLUNAS.find((c) => c.key === key)?.menorMelhor);
  }

  const mostraPraca = eixo !== "porCurso";
  const mostraCurso = eixo !== "porPraca";

  return (
    <div className="min-w-0">
      <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-[#171a20]">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Custo e retorno por recorte
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Do lead à matrícula: CPL, CAC, ROI e conversão em cada praça e curso
            </p>
            {/*
              Sem esta linha, ver o investimento do Ulbra POP espalhado por
              dezenas de cursos parece defeito. É o rateio: nenhuma campanha
              de lá cita curso, então o gasto nacional é distribuído pelas
              praças e cursos na proporção das matrículas de cada destino.
            */}
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
              <span className="font-medium">~</span> marca valor vindo de rateio —
              nenhuma campanha citou aquele curso, então o investimento foi
              distribuído na proporção das matrículas e o CAC reflete só a contagem.
            </p>
          </div>
          <Pills value={eixo} onChange={setEixo} options={EIXOS} />
        </div>


        {loading ? (
          <div className="h-[420px] animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />
        ) : ordenados.length === 0 ? (
          <div className="flex h-[420px] items-center justify-center text-sm text-gray-400 dark:text-gray-500">
            Sem dados no período selecionado
          </div>
        ) : (
          <div className="max-h-[600px] overflow-auto rounded-xl border border-gray-100 dark:border-white/10">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#1c2027]">
                <tr>
                  {mostraPraca && (
                    <th className="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Praça
                    </th>
                  )}
                  {mostraCurso && (
                    <th className="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Curso
                    </th>
                  )}
                  {COLUNAS.map((c) => (
                    <th
                      key={c.key}
                      title={c.titulo}
                      className="px-3 py-2.5 text-right text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                    >
                      <button
                        type="button"
                        onClick={() => ordenarPor(c.key)}
                        className="inline-flex items-center gap-1 transition-colors hover:text-gray-900 dark:hover:text-gray-100"
                      >
                        {c.label}
                        {ordem === c.key ? (
                          desc ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ArrowUp className="size-3" />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3 opacity-30" />
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordenados.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-gray-100 transition-colors hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/5"
                  >
                    {mostraPraca && (
                      <td className="whitespace-nowrap px-3 py-2 text-gray-900 dark:text-gray-100">
                        {item.praca}
                      </td>
                    )}
                    {mostraCurso && (
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                        {item.curso}
                      </td>
                    )}
                    {COLUNAS.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          "whitespace-nowrap px-3 py-2 text-right tabular-nums",
                          c.key === "matriculas"
                            ? "font-medium text-amber-600 dark:text-amber-400"
                            : "text-gray-600 dark:text-gray-300"
                        )}
                      >
                        {celula(item, c.key)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-gray-50 dark:bg-[#1c2027]">
                <tr className="border-t-2 border-gray-200 dark:border-white/10">
                  {mostraPraca && (
                    <td className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Total
                    </td>
                  )}
                  {mostraCurso && (
                    <td className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {mostraPraca ? "" : "Total"}
                    </td>
                  )}
                  {COLUNAS.map((c) => (
                    <td
                      key={c.key}
                      className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums text-gray-900 dark:text-gray-100"
                    >
                      {celula(total, c.key)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
