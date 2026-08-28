/**
 * Consulta rápida ao Supabase, para conferência de dados.
 *
 *   node scripts/consultar.mts <tabela> [--select cols] [--eq col=val]... [--gte col=val] [--lte col=val] [--soma col]... [--por col]... [--limite N] [--json]
 *
 * Pagina sozinho: o PostgREST corta em 1.000 linhas e uma conferência que
 * lê só a primeira página mente por omissão.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

readFileSync(".env.import", "utf8").split(/\r?\n/).forEach((l) => {
  const m = l.match(/^([^=]+)=(.*)$/);
  if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
});

const argv = process.argv.slice(2);

/**
 * Sinalizadores que consomem o argumento seguinte. Sem essa lista não dá
 * para dizer se `matriculas` é o nome da tabela ou o valor de um `--por`
 * anterior — e um `--json` antes do nome da tabela bagunçava a leitura.
 */
const COM_VALOR = new Set(["--select", "--eq", "--gte", "--lte", "--soma", "--por", "--limite"]);

const posicionais: string[] = [];
const valores = new Map<string, string[]>();
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith("--")) {
    posicionais.push(a);
  } else if (COM_VALOR.has(a)) {
    const v = argv[++i];
    if (v === undefined) {
      console.error(`Falta o valor de ${a}`);
      process.exit(1);
    }
    valores.set(a, [...(valores.get(a) ?? []), v]);
  }
}

const tabela = posicionais[0];
const varios = (flag: string) => valores.get(flag) ?? [];
const um = (flag: string) => varios(flag)[0] ?? null;
const json = argv.includes("--json");

if (!tabela) {
  console.error("Uso: node scripts/consultar.mts <tabela> [--eq col=val] [--soma col] [--por col]");
  process.exit(1);
}

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const select = um("--select") ?? "*";
let linhas: Record<string, unknown>[] = [];
for (let f = 0; ; f += 1000) {
  let q = s.from(tabela).select(select).range(f, f + 999);
  for (const e of varios("--eq")) { const [c, ...v] = e.split("="); q = q.eq(c, v.join("=")); }
  for (const e of varios("--gte")) { const [c, ...v] = e.split("="); q = q.gte(c, v.join("=")); }
  for (const e of varios("--lte")) { const [c, ...v] = e.split("="); q = q.lte(c, v.join("=")); }
  const { data, error } = await q;
  if (error) { console.error("Erro:", error.message); process.exit(1); }
  linhas = linhas.concat((data ?? []) as unknown as Record<string, unknown>[]);
  if ((data ?? []).length < 1000) break;
}

const somas = varios("--soma");
const grupos = varios("--por");
const num = (v: unknown) => Number(v ?? 0) || 0;

if (grupos.length || somas.length) {
  const mapa = new Map<string, { n: number; s: Record<string, number> }>();
  for (const l of linhas) {
    const k = grupos.map((g) => String(l[g] ?? "")).join(" | ") || "(tudo)";
    const g = mapa.get(k) ?? { n: 0, s: Object.fromEntries(somas.map((c) => [c, 0])) };
    g.n++;
    for (const c of somas) g.s[c] += num(l[c]);
    mapa.set(k, g);
  }
  type Grupo = { chave: string; linhas: number } & Record<string, string | number>;
  const saida: Grupo[] = [...mapa.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, g]) => ({ chave: k, linhas: g.n, ...g.s }));
  console.log(json ? JSON.stringify(saida, null, 2) : saida.map((r) =>
    `${r.chave.padEnd(46)} n=${String(r.linhas).padStart(6)}  ` +
    somas.map((c) => `${c}=${Number(r[c]).toFixed(2)}`).join("  ")).join("\n"));
  console.log(`\ntotal de linhas: ${linhas.length}`);
} else {
  // Com `--json` a saída é só o JSON: a linha de contagem no fim quebrava
  // qualquer coisa que tentasse ler o resultado por pipe. Sem a flag, ela
  // continua, porque aí a saída é para olho humano.
  const lim = Number(um("--limite") ?? (json ? Number.MAX_SAFE_INTEGER : 20));
  console.log(JSON.stringify(linhas.slice(0, lim), null, 2));
  if (json) process.exit(0);
  console.log(`\ntotal de linhas: ${linhas.length}`);
}
