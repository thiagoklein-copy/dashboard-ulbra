"use client";

import { cn } from "@/lib/utils";
import type { KindFilter } from "@/lib/types";

const OPCOES: { value: KindFilter; label: string }[] = [
  { value: "todos", label: "Tudo" },
  { value: "conversao", label: "Conversão" },
  { value: "branding", label: "Branding" },
];

export function KindSelector({
  value,
  onChange,
}: {
  value: KindFilter;
  onChange: (v: KindFilter) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {OPCOES.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
            value === o.value
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "bg-white text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
