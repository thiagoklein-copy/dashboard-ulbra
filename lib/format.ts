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

/**
 * Data ISO que existe de verdade.
 *
 * Sem esta checagem o valor da querystring ia cru para o Postgres, que
 * respondia `invalid input syntax for type date: "abc"` — mensagem interna
 * do banco devolvida ao cliente com status 500, quando é erro de quem
 * chamou. A volta pelo ISO pega data impossível como 2026-02-31, que o
 * construtor de Date aceita calado e rola para março.
 */
const FORMATO_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isoValido(valor: string): boolean {
  if (!FORMATO_ISO.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

/**
 * Janela padrão das rotas quando `from`/`to` não vêm na URL: os últimos 7
 * dias, igual ao que o dashboard já pede por conta própria.
 *
 * Era um par de datas fixas de agosto de 2026. Funcionava enquanto agosto
 * de 2026 era "agora"; depois disso, quem chamasse a API sem parâmetros
 * receberia um período histórico com cara de período atual — e o relatório
 * imprimível saía com o recorte errado sem dizer nada.
 */
export function janelaPadrao(): { de: string; ate: string } {
  const hoje = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const antes = new Date(hoje);
  antes.setUTCDate(antes.getUTCDate() - 6);
  return { de: iso(antes), ate: iso(hoje) };
}

export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR").format(new Date(y, m - 1, d));
}
