"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  diagnoseRetention,
  formatWatchTime,
  retentionChartPoints,
} from "@/lib/video-retention";
import type { VideoRetention } from "@/lib/types";
import { cn } from "@/lib/utils";

interface VideoRetentionChartProps {
  retention: VideoRetention;
  className?: string;
}

const AREA_STYLES: Record<
  string,
  { badge: string; box: string }
> = {
  hook: {
    badge: "bg-amber-100 text-amber-900 hover:bg-amber-100",
    box: "border-amber-200 bg-amber-50",
  },
  conteudo: {
    badge: "bg-orange-100 text-orange-900 hover:bg-orange-100",
    box: "border-orange-200 bg-orange-50",
  },
  cta: {
    badge: "bg-rose-100 text-rose-900 hover:bg-rose-100",
    box: "border-rose-200 bg-rose-50",
  },
  saudavel: {
    badge: "bg-emerald-100 text-emerald-900 hover:bg-emerald-100",
    box: "border-emerald-200 bg-emerald-50",
  },
};

export function VideoRetentionChart({
  retention,
  className,
}: VideoRetentionChartProps) {
  const points = retentionChartPoints(retention);
  const diagnosis = diagnoseRetention(retention);
  const style = AREA_STYLES[diagnosis.area];
  const avgPct =
    retention.duration_sec > 0
      ? Math.min(
          100,
          (retention.avg_watch_time_sec / retention.duration_sec) * 100
        )
      : 0;

  return (
    <div className={cn("space-y-3 rounded-xl border bg-background p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Retenção do vídeo</p>
          <p className="text-xs text-muted-foreground">
            % de pessoas que chegaram a cada ponto do vídeo
          </p>
        </div>
        <Badge className={cn("font-normal", style.badge)}>
          {diagnosis.label}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat
          label="Plays"
          value={new Intl.NumberFormat("pt-BR").format(retention.plays)}
        />
        <Stat
          label="Tempo médio"
          value={formatWatchTime(retention.avg_watch_time_sec)}
        />
        <Stat label="% médio assistido" value={`${avgPct.toFixed(0)}%`} />
      </div>

      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={points}
            margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
          >
            <defs>
              <linearGradient id="retentionFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.55 0.15 250)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="oklch(0.55 0.15 250)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.9 0 0)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "oklch(0.55 0 0)" }}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
              axisLine={false}
              width={40}
              tick={{ fontSize: 11, fill: "oklch(0.55 0 0)" }}
            />
            <Tooltip
              formatter={(value) => [
                `${typeof value === "number" ? value : "—"}%`,
                "Retidos",
              ]}
              labelFormatter={(label) => `Ponto ${label}`}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid oklch(0.9 0 0)",
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="retained"
              stroke="oklch(0.45 0.14 250)"
              strokeWidth={2}
              fill="url(#retentionFill)"
              dot={{ r: 3, strokeWidth: 1 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <DropStat label="Queda no hook" value={diagnosis.dropHook} active={diagnosis.area === "hook"} />
        <DropStat label="Queda no meio" value={diagnosis.dropMid} active={diagnosis.area === "conteudo"} />
        <DropStat label="Queda no final" value={diagnosis.dropEnd} active={diagnosis.area === "cta"} />
      </div>

      <div className={cn("rounded-lg border px-3 py-2 text-xs leading-relaxed", style.box)}>
        {diagnosis.hint}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2 py-2">
      <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function DropStat({
  label,
  value,
  active,
}: {
  label: string;
  value: number;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2 py-2",
        active ? "border-foreground/20 bg-muted/60" : "bg-muted/30"
      )}
    >
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums">−{value.toFixed(0)} pp</p>
    </div>
  );
}
