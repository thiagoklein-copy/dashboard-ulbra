"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMetric } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BreakdownItem } from "@/lib/types";

type Eixo = "curso" | "praca";
type Metrica = "spend" | "cost_per_result";

const VERDES = ["#059669", "#10b981", "#34d399", "#6ee7b7", "#a7f3d0"];

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
              : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function BreakdownChart({
  porCurso,
  porPraca,
  loading,
}: {
  porCurso: BreakdownItem[];
  porPraca: BreakdownItem[];
  loading?: boolean;
}) {
  const [eixo, setEixo] = useState<Eixo>("curso");
  const [metrica, setMetrica] = useState<Metrica>("spend");

  const dados = [...(eixo === "curso" ? porCurso : porPraca)]
    .filter((d) => (metrica === "spend" ? d.spend > 0 : d.cost_per_result > 0))
    .sort((a, b) =>
      metrica === "spend" ? b.spend - a.spend : a.cost_per_result - b.cost_per_result
    )
    .slice(0, 10);

  const maior = Math.max(...dados.map((d) => d[metrica]), 0);

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-[#171a20]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {metrica === "spend" ? "Investimento" : "Custo por resultado"} por{" "}
            {eixo === "curso" ? "curso" : "praça"}
          </h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {metrica === "spend"
              ? "Onde o orçamento está concentrado"
              : "Do mais eficiente para o mais caro"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pills
            value={eixo}
            onChange={setEixo}
            options={[
              { value: "curso", label: "Curso" },
              { value: "praca", label: "Praça" },
            ]}
          />
          <span className="h-4 w-px bg-gray-200 dark:bg-white/10" />
          <Pills
            value={metrica}
            onChange={setMetrica}
            options={[
              { value: "spend", label: "Gasto" },
              { value: "cost_per_result", label: "Custo/result." },
            ]}
          />
        </div>
      </div>

      {loading ? (
        <div className="h-[300px] animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />
      ) : dados.length === 0 ? (
        <div className="flex h-[300px] items-center justify-center text-sm text-gray-400 dark:text-gray-500">
          Sem dados no período selecionado
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={dados}
            layout="vertical"
            margin={{ left: 0, right: 56, top: 0, bottom: 0 }}
            barCategoryGap={6}
          >
            <XAxis type="number" hide domain={[0, maior * 1.05]} />
            <YAxis
              type="category"
              dataKey="nome"
              width={150}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#9ca3af" }}
            />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.03)" }}
              contentStyle={{
                borderRadius: 12,
                border: "none",
                boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                fontSize: 12,
                padding: "8px 12px",
              }}
              formatter={(v) => [formatMetric(Number(v ?? 0), "currency"), ""]}
              labelFormatter={(l) => {
                const nome = String(l ?? "");
                const item = dados.find((d) => d.nome === nome);
                return item
                  ? `${nome} — ${item.ads} anúncios · ${item.results} result.`
                  : nome;
              }}
            />
            <Bar
              dataKey={metrica}
              radius={[0, 8, 8, 0]}
              label={{
                position: "right",
                fontSize: 11,
                fill: "#6b7280",
                formatter: (v: unknown) => formatMetric(Number(v ?? 0), "currency"),
              }}
            >
              {dados.map((_, i) => (
                <Cell key={i} fill={VERDES[Math.min(i, VERDES.length - 1)]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
