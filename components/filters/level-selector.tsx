"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AggregationLevel } from "@/lib/types";

const OPTIONS: { value: AggregationLevel; label: string }[] = [
  { value: "campaign", label: "Campanhas" },
  { value: "adset", label: "Conjuntos" },
  { value: "ad", label: "Anúncios" },
];

interface LevelSelectorProps {
  value: AggregationLevel;
  onChange: (level: AggregationLevel) => void;
}

export function LevelSelector({ value, onChange }: LevelSelectorProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v as AggregationLevel)}
    >
      <TabsList>
        {OPTIONS.map((opt) => (
          <TabsTrigger key={opt.value} value={opt.value}>
            {opt.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
