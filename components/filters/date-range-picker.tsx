"use client";

import { useMemo, useState } from "react";
import {
  endOfMonth,
  format,
  startOfMonth,
  subDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

function toISO(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function parseISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const PRESETS = [
  {
    label: "Hoje",
    get: () => {
      const t = new Date();
      return { from: toISO(t), to: toISO(t) };
    },
  },
  {
    label: "Ontem",
    get: () => {
      const y = subDays(new Date(), 1);
      return { from: toISO(y), to: toISO(y) };
    },
  },
  {
    label: "Últimos 7 dias",
    get: () => ({ from: toISO(subDays(new Date(), 6)), to: toISO(new Date()) }),
  },
  {
    label: "Últimos 30 dias",
    get: () => ({
      from: toISO(subDays(new Date(), 29)),
      to: toISO(new Date()),
    }),
  },
  {
    label: "Este mês",
    get: () => ({
      from: toISO(startOfMonth(new Date())),
      to: toISO(endOfMonth(new Date())),
    }),
  },
];

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const selected: DateRange = useMemo(
    () => ({ from: parseISO(from), to: parseISO(to) }),
    [from, to]
  );

  const label = useMemo(() => {
    const a = parseISO(from);
    const b = parseISO(to);
    if (from === to) return format(a, "dd MMM yyyy", { locale: ptBR });
    return `${format(a, "dd MMM", { locale: ptBR })} – ${format(b, "dd MMM yyyy", { locale: ptBR })}`;
  }, [from, to]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("justify-start gap-2 font-normal")}
        >
          <CalendarIcon className="size-4 opacity-60" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          <div className="flex flex-col gap-1 border-b p-3 sm:border-b-0 sm:border-r">
            {PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => {
                  const range = preset.get();
                  onChange(range.from, range.to);
                  setOpen(false);
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Calendar
            mode="range"
            defaultMonth={selected.from}
            selected={selected}
            numberOfMonths={2}
            locale={ptBR}
            onSelect={(range) => {
              if (range?.from && range?.to) {
                onChange(toISO(range.from), toISO(range.to));
              } else if (range?.from) {
                onChange(toISO(range.from), toISO(range.from));
              }
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
