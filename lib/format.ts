import type { MetricFormat } from "@/lib/metrics-config";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numberFormatter = new Intl.NumberFormat("pt-BR");

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMetric(
  value: number | string | null | undefined,
  format: MetricFormat
): string {
  if (value === null || value === undefined || value === "") return "—";

  if (format === "text") return String(value);

  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return "—";

  switch (format) {
    case "currency":
      return currencyFormatter.format(num);
    case "percent":
      // Valores chegam sempre em pontos percentuais (0–100), tanto da API do
      // Meta quanto de recalculateDerived. O Intl com style:"percent" espera
      // fração, então dividimos sempre — a heurística antiga (`num > 1`)
      // exibia todo CTR abaixo de 1% cem vezes maior.
      return percentFormatter.format(num / 100);
    case "number":
      return numberFormatter.format(Math.round(num));
    default:
      return String(value);
  }
}

export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR").format(new Date(y, m - 1, d));
}
