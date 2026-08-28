"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface MultiSelectFilterProps {
  label: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

export function MultiSelectFilter({
  label,
  options,
  value,
  onChange,
  placeholder = "Todos",
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  const summary =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? value[0]
        : `${value.length} selecionados`;

  function toggle(option: string) {
    if (value.includes(option)) {
      onChange(value.filter((v) => v !== option));
    } else {
      onChange([...value, option]);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="min-w-[180px] justify-between font-normal">
          <span className="truncate">
            <span className="text-muted-foreground">{label}: </span>
            {summary}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <Input
          placeholder="Buscar…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-2"
        />
        <div className="mb-2 flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onChange([])}
          >
            Limpar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onChange([...options])}
          >
            Todos
          </Button>
        </div>
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              Nenhuma opção
            </p>
          )}
          {filtered.map((option) => {
            const checked = value.includes(option);
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={checked}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                )}
                onClick={() => toggle(option)}
              >
                {/* Caixa apenas visual: o <Checkbox> do Radix renderiza um
                    <button>, e botão dentro de botão é HTML inválido. */}
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                    checked
                      ? "border-black bg-black text-white"
                      : "border-input bg-transparent"
                  )}
                >
                  {checked && <Check className="size-3" />}
                </span>
                <span className="flex-1 truncate">{option}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
