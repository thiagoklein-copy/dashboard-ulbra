"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { VideoDesempenho } from "@/lib/types";
import {
  formatWatchTime,
  INDICE_ATENCAO,
  pontosCurva,
  PONTOS_CURVA,
} from "@/lib/video-retention";
import { cn } from "@/lib/utils";

interface VideoDesempenhoPanelProps {
  desempenho: VideoDesempenho;
  className?: string;
}

const numero = new Intl.NumberFormat("pt-BR");

/** Posição do ponto de atenção inicial no eixo, em % da duração. */
const PCT_ATENCAO = Math.round((INDICE_ATENCAO / (PONTOS_CURVA - 1)) * 100);

/**
 * Replica o painel de vídeo do Meta: atenção inicial, retenção e a curva.
 *
 * A duração em segundos não vem pela API com o token atual (os vídeos são da
 * Página, não da conta de anúncio, e não aparecem em /advideos), então o eixo
 * é % da duração — que é como o próprio Meta desenha o gráfico.
 */
export function VideoDesempenhoPanel({
  desempenho,
  className,
}: VideoDesempenhoPanelProps) {
  const pontos = pontosCurva(desempenho);

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border bg-background p-4",
        className
      )}
    >
      <div>
        <p className="text-sm font-medium">Desempenho do vídeo</p>
        <p className="text-xs text-muted-foreground">
          Mesmos números do painel de criativo do Meta
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Atenção inicial"
          value={`${desempenho.atencaoInicial.toFixed(1)}%`}
          destaque
          dica="Quem passou dos primeiros segundos"
        />
        <Stat
          label="Retenção"
          value={`${desempenho.retencao.toFixed(2)}%`}
          destaque
          dica="ThruPlay sobre reproduções"
        />
        <Stat label="Reproduções" value={numero.format(desempenho.reproducoes)} />
        <Stat
          label="Tempo médio"
          value={formatWatchTime(desempenho.tempoMedioSec)}
        />
      </div>

      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={pontos}
            margin={{ top: 8, right: 8, left: -14, bottom: 0 }}
          >
            <defs>
              <linearGradient id="curvaVideo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#9ca3af" strokeOpacity={0.25} />
            <XAxis
              dataKey="pct"
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
              axisLine={false}
              interval={4}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
              axisLine={false}
              width={42}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
            />
            <ReferenceLine
              x={PCT_ATENCAO}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              label={{
                value: "atenção inicial",
                position: "insideTopRight",
                fontSize: 10,
                fill: "#f59e0b",
              }}
            />
            <Tooltip
              formatter={(value) => [
                `${typeof value === "number" ? value.toFixed(1) : "—"}%`,
                "Ainda assistindo",
              ]}
              labelFormatter={(pct) => `${pct}% do vídeo`}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #9ca3af55",
                background: "var(--popover)",
                color: "var(--popover-foreground)",
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="retido"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#curvaVideo)"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  dica,
  destaque,
}: {
  label: string;
  value: string;
  dica?: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg px-2 py-2",
        destaque ? "bg-primary/10" : "bg-muted/50"
      )}
      title={dica}
    >
      <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
