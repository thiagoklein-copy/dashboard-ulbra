/**
 * Importa o investimento diário do Google Ads para `midia_insights`.
 *
 *   node scripts/importar-google.mts <arquivo.xlsx> --conta <id> [--conferir]
 *
 * Substitui a estimativa por medição. As primeiras 1.682 linhas de Google no
 * banco foram o total do período dividido igualmente por 58 dias — exato no
 * total, errado no dia: campanha que começou em 11/08 aparecia gastando
 * desde 01/07, e o fim do período vinha 20% abaixo do real.
 *
 * O arquivo esperado é o export do Google Ads no formato longo: uma linha por
 * campanha por dia. A aba e as colunas são achadas pelo cabeçalho, não por
 * posição — os dois exports que chegaram já vieram diferentes ("Base (linha
 * por dia)" com 4 colunas e "Base longa" com 3), e vão continuar variando.
 *
 * ## Conversões
 *
 * O export traz custo, não conversão. Em vez de deixar a conversão achatada
 * enquanto o custo vira curva — o que daria CPL absurdo nos dias de pico —,
 * o total de conversões de cada campanha é redistribuído **na proporção do
 * gasto diário real**. Conversão acompanha investimento de perto, então essa
 * é a melhor forma disponível, e o total por campanha continua medido.
 *
 * O rateio é feito em **centésimos inteiros, com maior-resto**, e não em
 * fração livre. A coluna é `numeric(14, 2)`: o Postgres arredondava cada
 * linha por conta própria, e ±0,005 por linha somados em 58 dias faziam a
 * campanha deixar de fechar com o total medido — uma auditoria pegou
 * +0,029 conversão numa delas. Distribuindo unidades inteiras e dando o
 * centésimo que sobra às maiores frações, a soma bate por construção.
 *
 * Dia com custo zero passa a ter conversão zero, que é o comportamento certo
 * para campanha que não rodou — e o maior-resto preserva isso, porque um dia
 * sem gasto tem fração exatamente zero e nunca recebe unidade.
 */
import { readFileSync, existsSync } from "node:fs";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";

function texto(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return String(v.text);
    if ("result" in v) return String(v.result ?? "");
  }
  return String(v);
}

function numero(v: ExcelJS.CellValue): number {
  if (typeof v === "number") return v;
  const n = Number(String(v ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Data no fuso local — `toISOString` recuaria um dia em fuso negativo. */
function paraISO(v: ExcelJS.CellValue): string | null {
  if (v instanceof Date) {
    const a = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${a}-${m}-${d}`;
  }
  const t = texto(v).trim();
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return null;
}

const argv = process.argv.slice(2);
const conferir = argv.includes("--conferir");
const iConta = argv.indexOf("--conta");
const conta = iConta >= 0 ? argv[iConta + 1] : null;
const arquivo = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--conta");

if (!arquivo || !conta) {
  console.error("Uso: node scripts/importar-google.mts <arquivo.xlsx> --conta <id> [--conferir]");
  process.exit(1);
}
if (!existsSync(arquivo)) {
  console.error(`Arquivo não encontrado: ${arquivo}`);
  process.exit(1);
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(arquivo);

const chave = (v: ExcelJS.CellValue) =>
  texto(v).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Acha a aba no formato longo e as três colunas que interessam.
 *
 * Procurar pelo cabeçalho e não pela posição porque o export varia: um
 * arquivo veio com "Base (linha por dia)" e a coluna de custo na 4ª posição,
 * outro com "Base longa" e na 3ª. A aba de matriz (campanha × dia) é
 * descartada por não ter coluna de data.
 */
function acharAba(): { ws: ExcelJS.Worksheet; cab: number; cCamp: number; cData: number; cCusto: number } | null {
  for (const ws of wb.worksheets) {
    for (let i = 1; i <= Math.min(ws.rowCount, 10); i++) {
      // `Array.from` e não `.map`: ExcelJS devolve um array esparso (as
      // colunas são 1-indexadas), e `.map` preserva o buraco do índice 0.
      const cols = Array.from((ws.getRow(i).values as ExcelJS.CellValue[]) ?? [], chave);
      const cCamp = cols.findIndex((c) => c.startsWith("campanha"));
      const cData = cols.findIndex((c) => c === "data" || c === "dia");
      const cCusto = cols.findIndex((c) => c.startsWith("custo"));
      if (cCamp > 0 && cData > 0 && cCusto > 0) return { ws, cab: i, cCamp, cData, cCusto };
    }
  }
  return null;
}

const achou = acharAba();
if (!achou) {
  console.error(
    `Nenhuma aba com Campanha + Data + Custo. Abas: ${wb.worksheets.map((w) => w.name).join(", ")}`
  );
  process.exit(1);
}
const { ws, cab, cCamp, cData, cCusto } = achou;

type Linha = { campanha: string; data: string; custo: number };
const lidas: Linha[] = [];
for (let i = cab + 1; i <= ws.rowCount; i++) {
  const r = ws.getRow(i);
  const campanha = texto(r.getCell(cCamp).value).trim();
  const data = paraISO(r.getCell(cData).value);
  if (!campanha || !data) continue;
  lidas.push({ campanha, data, custo: numero(r.getCell(cCusto).value) });
}

const dias = [...new Set(lidas.map((l) => l.data))].sort();
const campanhas = [...new Set(lidas.map((l) => l.campanha))];
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

console.log(`\n▸ ${arquivo}`);
console.log(`  ${lidas.length} linhas · ${campanhas.length} campanhas · ${dias.length} dias`);
console.log(`  período: ${dias[0]} a ${dias[dias.length - 1]}`);
console.log(`  custo total: ${brl(lidas.reduce((a, l) => a + l.custo, 0))}`);

readFileSync(".env.import", "utf8").split(/\r?\n/).forEach((l) => {
  const m = l.match(/^([^=]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1].trim()] = m[2].trim();
});
const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

// O que já existe no banco: dá o campaign_id, o canal e o total de
// conversões que a API mediu — nada disso vem no export.
let atuais: Record<string, unknown>[] = [];
for (let f = 0; ; f += 1000) {
  const { data, error } = await s.from("midia_insights").select("*").eq("account_id", conta).range(f, f + 999);
  if (error) { console.error("Erro ao ler o banco:", error.message); process.exit(1); }
  atuais = atuais.concat(data ?? []);
  if ((data ?? []).length < 1000) break;
}

type Meta = { campaign_id: string; channel_type: string; account_name: string; conversoes: number };
const meta = new Map<string, Meta>();
for (const r of atuais) {
  const nome = r.campaign_name as string;
  const m = meta.get(nome) ?? {
    campaign_id: r.campaign_id as string,
    channel_type: (r.channel_type as string) ?? "",
    account_name: (r.account_name as string) ?? "",
    conversoes: 0,
  };
  m.conversoes += Number(r.conversions ?? 0);
  meta.set(nome, m);
}

const semMeta = campanhas.filter((c) => !meta.has(c));
if (semMeta.length) {
  console.log(`\n  ⚠ ${semMeta.length} campanha(s) do arquivo não estão no banco:`);
  for (const c of semMeta) console.log(`      ${c}`);
  console.log("    Elas entram sem conversão e com id sintético.");
}

const totalPorCampanha = new Map<string, number>();
for (const l of lidas) totalPorCampanha.set(l.campanha, (totalPorCampanha.get(l.campanha) ?? 0) + l.custo);

/*
  Rateio das conversões em centésimos inteiros, campanha por campanha.

  Cada linha recebe o piso da sua fatia; os centésimos que sobram vão para
  as maiores frações restantes. A soma das linhas é então exatamente
  `round(total * 100)`, que é o que a coluna de duas casas consegue guardar
  — sem isso, o arredondamento do banco em cada linha fazia a campanha
  perder o total medido.
*/
const linhasDaCampanha = new Map<string, number[]>();
lidas.forEach((l, i) => {
  const atual = linhasDaCampanha.get(l.campanha) ?? [];
  atual.push(i);
  linhasDaCampanha.set(l.campanha, atual);
});

const conversaoDaLinha = new Array<number>(lidas.length).fill(0);
for (const [campanha, indices] of linhasDaCampanha) {
  const totalCusto = totalPorCampanha.get(campanha) ?? 0;
  const unidades = Math.round((meta.get(campanha)?.conversoes ?? 0) * 100);
  if (!unidades || !totalCusto) continue;

  const exatas = indices.map((i) => (lidas[i].custo / totalCusto) * unidades);
  const piso = exatas.map((v) => Math.floor(v));
  let sobra = unidades - piso.reduce((a, b) => a + b, 0);

  // Maior fração primeiro; empate desempatado pelo maior gasto e, depois,
  // pela ordem do arquivo — para a carga ser reproduzível.
  const ordem = exatas
    .map((v, k) => ({ k, fracao: v - Math.floor(v) }))
    .sort(
      (a, b) =>
        b.fracao - a.fracao ||
        lidas[indices[b.k]].custo - lidas[indices[a.k]].custo ||
        a.k - b.k
    );
  for (let p = 0; p < ordem.length && sobra > 0; p++, sobra--) piso[ordem[p].k]++;

  indices.forEach((i, k) => {
    conversaoDaLinha[i] = piso[k] / 100;
  });
}

const agora = new Date().toISOString();
const saida = lidas.map((l, i) => {
  const m = meta.get(l.campanha);
  return {
    data: l.data,
    platform: "GOOGLE",
    account_id: conta,
    account_name: m?.account_name ?? null,
    campaign_id: m?.campaign_id ?? `X-${l.campanha.slice(0, 40)}`,
    campaign_name: l.campanha,
    channel_type: m?.channel_type ?? null,
    entity_level: "campaign",
    spend: Math.round(l.custo * 100) / 100,
    conversions: conversaoDaLinha[i],
    impressions: 0,
    clicks: 0,
    ctr: 0,
    cpc: 0,
    cpa: 0,
    conversion_value: 0,
    script_name: "MEDIDO — export diário do Google Ads",
    atualizado_em: agora,
  };
});

console.log(`\n  conversões redistribuídas: ${Math.round(saida.reduce((a, l) => a + l.conversions, 0))}`);

if (conferir) {
  console.log("\n  --conferir: nada foi gravado.\n");
  process.exit(0);
}

// As linhas estimadas da conta saem antes: elas cobrem dias que o export
// pode não ter, e sobreviveriam como resíduo se fossem só sobrescritas.
const { error: erroDel } = await s.from("midia_insights").delete().eq("platform", "GOOGLE").eq("account_id", conta);
if (erroDel) { console.error("Erro ao limpar:", erroDel.message); process.exit(1); }

for (let i = 0; i < saida.length; i += 500) {
  const { error } = await s
    .from("midia_insights")
    .upsert(saida.slice(i, i + 500), { onConflict: "data,platform,account_id,campaign_id" });
  if (error) { console.error("Erro ao gravar:", error.message); process.exit(1); }
}
console.log(`\n  ${saida.length} linhas gravadas.\n`);
