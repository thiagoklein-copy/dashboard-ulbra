"use client";

import { useEffect, useState } from "react";
import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  COLUMNS_STORAGE_KEY,
  DEFAULT_VISIBLE_COLUMNS,
  METRICS,
} from "@/lib/metrics-config";
import type { ColumnKey } from "@/lib/types";

interface ColumnPickerProps {
  value: ColumnKey[];
  onChange: (columns: ColumnKey[]) => void;
}

export function ColumnPicker({ value, onChange }: ColumnPickerProps) {
  function toggle(key: ColumnKey) {
    if (key === "name") return; // nome sempre visível
    if (value.includes(key)) {
      onChange(value.filter((k) => k !== key));
    } else {
      onChange([...value, key]);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Columns3 className="size-4" />
          Colunas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-72 space-y-1 overflow-y-auto p-1">
          {METRICS.map((metric) => {
            const checked = value.includes(metric.key);
            const locked = metric.key === "name";
            return (
              <button
                key={metric.key}
                type="button"
                disabled={locked}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-60"
                onClick={() => toggle(metric.key)}
              >
                <Checkbox checked={checked} disabled={locked} />
                <span>{metric.label}</span>
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function useVisibleColumns() {
  const [columns, setColumns] = useState<ColumnKey[]>(DEFAULT_VISIBLE_COLUMNS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLUMNS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ColumnKey[];
        if (Array.isArray(parsed) && parsed.length) {
          const withName = parsed.includes("name")
            ? parsed
            : (["name", ...parsed] as ColumnKey[]);
          setColumns(withName);
        }
      }
    } catch {
      // ignore
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(columns));
  }, [columns, ready]);

  return { columns, setColumns };
}
