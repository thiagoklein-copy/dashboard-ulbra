"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";

interface SearchFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchFilter({ value, onChange }: SearchFilterProps) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (local !== value) onChange(local);
    }, 300);
    return () => clearTimeout(t);
  }, [local, onChange, value]);

  return (
    <div className="relative min-w-[220px] flex-1 max-w-sm">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder="Buscar anúncio, headline, texto…"
        className="pl-8"
      />
    </div>
  );
}
