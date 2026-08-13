"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

export type Tema = "light" | "dark";

/** Lido também pelo script inline no layout, que evita o flash de tema errado. */
export const CHAVE_TEMA = "ulbra-tema";

/**
 * O tema vive na classe do <html>, não no React — o script inline do layout já
 * o aplicou antes da primeira pintura. Tratamos isso como estado externo em vez
 * de espelhar em useState, que geraria renderização em cascata.
 */
let ouvintes: (() => void)[] = [];

function inscrever(callback: () => void) {
  ouvintes.push(callback);
  return () => {
    ouvintes = ouvintes.filter((o) => o !== callback);
  };
}

function ler(): Tema {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** No servidor não há DOM; o script inline corrige na hidratação. */
function lerNoServidor(): Tema {
  return "light";
}

export function ThemeToggle() {
  const tema = useSyncExternalStore(inscrever, ler, lerNoServidor);

  function alternar() {
    const proximo: Tema = tema === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", proximo === "dark");
    document.documentElement.style.colorScheme = proximo;
    try {
      localStorage.setItem(CHAVE_TEMA, proximo);
    } catch {
      // modo privativo ou storage bloqueado: o tema vale só nesta sessão
    }
    ouvintes.forEach((o) => o());
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={tema === "dark" ? "Usar tema claro" : "Usar tema escuro"}
      title={tema === "dark" ? "Tema claro" : "Tema escuro"}
      className="flex size-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:bg-gray-100 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10"
    >
      {tema === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
