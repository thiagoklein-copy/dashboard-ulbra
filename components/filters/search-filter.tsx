"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";

interface SearchFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchFilter({ value, onChange }: SearchFilterProps) {
  const [local, setLocal] = useState(value);

  /*
    A prop volta para o campo durante a renderização, não num efeito.

    O efeito antigo só rodava DEPOIS da pintura, então limpar o filtro pelo
    botão "Limpar" desenhava um quadro com o texto antigo antes de apagar.
    Ajustar durante a render é o caminho que o React recomenda para estado
    derivado de prop — ele descarta a saída e re-renderiza antes de pintar.
  */
  const [propAnterior, setPropAnterior] = useState(value);
  if (value !== propAnterior) {
    setPropAnterior(value);
    setLocal(value);
  }

  /*
    `onChange` num ref porque a identidade dela muda a cada render do
    dashboard — vinha como arrow inline. Nas dependências do efeito, isso
    reiniciava o timer de 300ms a cada re-render do pai: digitar enquanto uma
    consulta estava no ar podia adiar a busca indefinidamente.
  */
  const aoMudar = useRef(onChange);
  useEffect(() => {
    aoMudar.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (local === value) return;
    const t = setTimeout(() => aoMudar.current(local), 300);
    return () => clearTimeout(t);
  }, [local, value]);

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
