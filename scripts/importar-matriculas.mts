/**
 * Importa matrículas de uma planilha para o Supabase.
 *
 *   node scripts/importar-matriculas.ts <arquivo.xlsx> [...] [opções]
 *
 *   --conferir          lê, agrega e mostra o resultado sem gravar nada
 *   --sql [arquivo]     gera um .sql para colar no SQL Editor do Supabase,
 *                       em vez de gravar direto (dispensa a service_role)
 *   --de / --ate       recorta o período importado (AAAA-MM-DD)
 *   --substituir-dia    apaga cada dia presente no arquivo antes de gravar
 *   --ano <aaaa>        ano das datas do formato diário (padrão: ano atual)
 *
 * Dois formatos são aceitos:
 *
 *   **detalhado** — o relatório do sistema acadêmico, uma linha por
 *   contrato, com `Dia Confirmacao` e `Matricula/Rematricula` no cabeçalho.
 *   É o formato confiável e o único que traz `Vlr Liq Semestre`, logo o
 *   único que produz receita.
 *
 *   **diário** — o resumo manual, praça em negrito e cursos abaixo. Traz só
 *   contagem. Serve para o dia a dia, mas o script avisa linha a linha o
 *   que entendeu, porque o layout é ambíguo por natureza.
 *
 * Nada de PII sai da planilha: nome do aluno e número de contrato são lidos
 * e descartados. O que vai para o banco é (dia, praça, curso, quantidade,
 * receita) — agregado, sem identificar ninguém.
 *
 * Dois caminhos para levar o dado ao banco:
 *
 *   `--sql` (recomendado) gera um arquivo para colar no SQL Editor. Não pede
 *   credencial nenhuma, e a service_role nunca sai do Supabase. Como a carga
 *   já é manual de qualquer jeito — o sistema acadêmico não tem API —, o
 *   passo extra de colar sai mais barato que espalhar uma chave que ignora
 *   RLS.
 *
 *   Sem `--sql`, o script grava direto e aí sim precisa da service_role, lida
 *   de um `.env.import` à parte — nunca do `.env.local` do dashboard, que
 *   carrega a chave anônima que vai para o navegador.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import {
  agregarMatriculas,
  mapearCurso,
  mapearPraca,
  separarPracaDoCurso,
  NAO_CLASSIFICADO,
  type MatriculaAgregada,
} from "../lib/matriculas.ts";

type LinhaCrua = {
  data: string;
  praca: string;
  curso: string;
  quantidade: number;
  receita_semestral: number | null;
};

const CABECALHO_DETALHADO = "dia confirmacao";
const APENAS_NOVAS = "Matrícula";

function normalizarChave(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function textoDaCelula(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return String(v.text);
    if ("result" in v) return String(v.result ?? "");
    if (v instanceof Date) return v.toISOString();
  }
  return String(v);
}

function numeroDaCelula(v: ExcelJS.CellValue): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "result" in v) {
    const r = (v as { result?: unknown }).result;
    return typeof r === "number" ? r : null;
  }
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Data para ISO local — `toISOString()` recuaria um dia em fuso negativo. */
function paraISO(d: Date): string {
  const ano = d.getUTCFullYear();
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(d.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function dataDaCelula(v: ExcelJS.CellValue): string | null {
  if (v instanceof Date) return paraISO(v);
  const texto = textoDaCelula(v).trim();
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return null;
}

// ---------------------------------------------------------------- formatos

function lerDetalhado(ws: ExcelJS.Worksheet, avisos: string[]): LinhaCrua[] | null {
  let linhaCabecalho = 0;
  const col: Record<string, number> = {};

  for (let i = 1; i <= Math.min(ws.rowCount, 20); i++) {
    const valores = ws.getRow(i).values as ExcelJS.CellValue[];
    const chaves = valores.map(normalizarChave);
    if (chaves.includes(CABECALHO_DETALHADO)) {
      linhaCabecalho = i;
      chaves.forEach((c, idx) => {
        if (c) col[c] = idx;
      });
      break;
    }
  }
  if (!linhaCabecalho) return null;

  const cData = col[CABECALHO_DETALHADO];
  const cTipo = col["matricula/rematricula"];
  const cUnidade = col["unidade"];
  const cCurso = col["curso"];
  const cValor = col["vlr liq semestre"];
  const cSituacao = col["situacao"];

  if (!cTipo) {
    avisos.push(
      "coluna 'Matricula/Rematricula' não encontrada — sem ela não dá para separar matrícula de rematrícula, e o arquivo foi ignorado"
    );
    return null;
  }

  const linhas: LinhaCrua[] = [];
  let rematriculas = 0;
  let semData = 0;
  let naoConfirmadas = 0;

  for (let i = linhaCabecalho + 1; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const tipo = textoDaCelula(row.getCell(cTipo).value).trim();
    if (!tipo) continue;

    // Rematrícula é retenção da base, não captação. Fica fora.
    if (normalizarChave(tipo) !== normalizarChave(APENAS_NOVAS)) {
      rematriculas++;
      continue;
    }

    /*
      Só matrícula confirmada conta.

      Os exports vistos até aqui vinham 100% `Confirmado`, então isto não
      muda nenhum número hoje. Mas a coluna existe, e um relatório futuro
      que traga `Cancelado` ou `Trancado` entraria como matrícula boa —
      inflando o denominador do CAC com aluno que desistiu. A checagem é
      barata e a falha seria silenciosa.

      Se a coluna não vier no arquivo, nada é filtrado: melhor carregar
      tudo do que descartar em silêncio por uma coluna ausente.
    */
    if (cSituacao) {
      const situacao = normalizarChave(textoDaCelula(row.getCell(cSituacao).value));
      if (situacao && situacao !== "confirmado") {
        naoConfirmadas++;
        continue;
      }
    }

    const data = dataDaCelula(row.getCell(cData).value);
    if (!data) {
      semData++;
      continue;
    }

    linhas.push({
      data,
      praca: mapearPraca(textoDaCelula(row.getCell(cUnidade).value)),
      curso: mapearCurso(textoDaCelula(row.getCell(cCurso).value)),
      quantidade: 1,
      receita_semestral: cValor ? numeroDaCelula(row.getCell(cValor).value) : null,
    });
  }

  avisos.push(`${linhas.length} matrículas novas · ${rematriculas} rematrículas ignoradas`);
  if (semData) avisos.push(`${semData} linhas sem data de confirmação foram descartadas`);
  if (naoConfirmadas) {
    avisos.push(`${naoConfirmadas} matrículas descartadas por não estarem "Confirmado"`);
  }
  if (!cSituacao) {
    avisos.push("coluna 'Situacao' ausente — nenhuma matrícula foi filtrada por situação");
  }
  return linhas;
}

function lerDiario(
  ws: ExcelJS.Worksheet,
  ano: number,
  avisos: string[]
): LinhaCrua[] {
  const linhas: LinhaCrua[] = [];
  let dataAtual: string | null = null;
  let pracaAtual: string | null = null;

  for (let i = 1; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const a = textoDaCelula(row.getCell(1).value).trim();
    const b = numeroDaCelula(row.getCell(2).value);
    if (!a) continue;

    // "Dia 24/08" / "DIA 25/08/2026" — abre um novo dia.
    const dia = a.match(/^dia\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/i);
    if (dia) {
      const aa = dia[3] ? Number(dia[3]) : ano;
      dataAtual = `${aa}-${dia[2].padStart(2, "0")}-${dia[1].padStart(2, "0")}`;
      pracaAtual = null;
      continue;
    }

    // Linha sem número é cabeçalho de praça.
    if (b === null) {
      const praca = mapearPraca(a);
      if (praca !== NAO_CLASSIFICADO) {
        pracaAtual = praca;
      } else if (normalizarChave(a) !== "matriculas") {
        avisos.push(`linha ${i}: "${a}" não é praça conhecida nem tem número — ignorada`);
      }
      continue;
    }

    if (!dataAtual) {
      avisos.push(`linha ${i}: "${a}" apareceu antes de qualquer "Dia dd/mm" — ignorada`);
      continue;
    }

    // "MEDICINA POA" carrega a própria praça e não pertence ao bloco acima.
    const { curso, praca: pracaNoRotulo } = separarPracaDoCurso(a);
    const praca = pracaNoRotulo ?? pracaAtual;

    if (!praca) {
      avisos.push(`linha ${i}: "${a}" sem praça definida — ignorada`);
      continue;
    }
    if (pracaNoRotulo) {
      avisos.push(`linha ${i}: "${a}" lida como ${curso} / ${pracaNoRotulo}`);
    }

    const cursoMapeado = mapearCurso(curso);
    if (cursoMapeado === NAO_CLASSIFICADO) {
      avisos.push(`linha ${i}: curso "${a}" sem correspondência — foi para "${NAO_CLASSIFICADO}"`);
    }

    linhas.push({
      data: dataAtual,
      praca,
      curso: cursoMapeado,
      quantidade: b,
      receita_semestral: null,
    });
  }

  return linhas;
}

// ------------------------------------------------------------------ leitura

async function lerArquivo(
  caminho: string,
  ano: number
): Promise<{ linhas: LinhaCrua[]; formato: string; avisos: string[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(caminho);
  const avisos: string[] = [];

  for (const ws of wb.worksheets) {
    if (ws.rowCount < 2) continue;
    const detalhado = lerDetalhado(ws, avisos);
    if (detalhado) return { linhas: detalhado, formato: "detalhado", avisos };
  }

  const linhas = wb.worksheets.flatMap((ws) => lerDiario(ws, ano, avisos));
  return { linhas, formato: "diário", avisos };
}

// ---------------------------------------------------------------------- sql

/** `'` vira `''` — é o único escape que o Postgres pede numa string literal. */
function aspas(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

/**
 * Gera um .sql para colar no SQL Editor.
 *
 * Existe porque escrever direto exige a service_role, e ela ignora o RLS —
 * é a chave que não deveria circular. Como a carga já é manual de qualquer
 * jeito (o sistema acadêmico não tem API), colar SQL sai mais barato do que
 * espalhar credencial: o segredo nunca sai do Supabase.
 *
 * O schema vem de `supabase/matriculas.sql`, não de uma cópia aqui: duas
 * definições da mesma tabela descolam na primeira alteração. Como o DDL é
 * `create table if not exists`, rodar o arquivo de novo é inofensivo.
 */
function gerarSql(
  linhas: MatriculaAgregada[],
  destino: string,
  substituirDia: boolean
) {
  const partes: string[] = [];

  if (existsSync("supabase/matriculas.sql")) {
    partes.push(readFileSync("supabase/matriculas.sql", "utf8").trimEnd(), "");
  } else {
    partes.push(
      "-- ⚠ supabase/matriculas.sql não encontrado: rode-o antes deste arquivo.",
      ""
    );
  }

  const dias = Array.from(new Set(linhas.map((l) => l.data))).sort();
  partes.push(
    "-- ----------------------------------------------------------------",
    `-- Carga de ${linhas.reduce((s, l) => s + l.quantidade, 0)} matrículas`,
    `-- Período: ${dias[0]} a ${dias[dias.length - 1]} (${dias.length} dias)`,
    "--",
    "-- Upsert na chave (data, praça, curso): rodar de novo substitui, não",
    "-- soma. Nenhum dado pessoal aqui — só o agregado.",
    "-- ----------------------------------------------------------------",
    ""
  );

  if (substituirDia) {
    partes.push(
      `delete from public.matriculas where data in (${dias.map(aspas).join(", ")});`,
      ""
    );
  }

  // Lotes para nenhum comando ficar grande demais para o editor engolir.
  const LOTE = 500;
  for (let i = 0; i < linhas.length; i += LOTE) {
    const valores = linhas
      .slice(i, i + LOTE)
      .map(
        (l) =>
          `  (${aspas(l.data)}, ${aspas(l.praca)}, ${aspas(l.curso)}, ${l.quantidade}, ` +
          `${l.receita_semestral === null ? "null" : l.receita_semestral.toFixed(2)})`
      )
      .join(",\n");

    partes.push(
      "insert into public.matriculas (data, praca, curso, quantidade, receita_semestral) values",
      valores,
      "on conflict (data, praca, curso) do update set",
      "  quantidade = excluded.quantidade,",
      // `coalesce` e não substituição direta: o arquivo diário só traz
      // contagem, e sobrescrever com nulo apagaria a receita que o relatório
      // detalhado já tinha medido para aquele mesmo dia.
      "  receita_semestral = coalesce(excluded.receita_semestral, public.matriculas.receita_semestral),",
      "  atualizado_em = now();",
      ""
    );
  }

  writeFileSync(destino, partes.join("\n"), "utf8");
  console.log(`\n  SQL escrito em ${destino}`);
  console.log("  Cole o conteúdo no SQL Editor do Supabase e rode.");
  console.log("  Nada foi gravado por este script.\n");
}

// ------------------------------------------------------------------ escrita

function carregarEnv(): { url: string; chave: string } {
  for (const arquivo of [".env.import", ".env.local"]) {
    if (!existsSync(arquivo)) continue;
    for (const linha of readFileSync(arquivo, "utf8").split(/\r?\n/)) {
      const m = linha.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!url || !chave) {
    console.error(
      "\nFaltam credenciais de escrita. Crie um `.env.import` na raiz com:\n" +
        "  SUPABASE_URL=https://<ref>.supabase.co\n" +
        "  SUPABASE_SERVICE_ROLE_KEY=<chave secreta>\n\n" +
        "A service_role ignora o RLS — ela fica só aqui e no n8n, nunca no dashboard.\n" +
        "Para só conferir os números sem gravar, rode com --conferir.\n"
    );
    process.exit(1);
  }
  return { url, chave };
}

async function gravar(linhas: MatriculaAgregada[], substituirDia: boolean) {
  const { url, chave } = carregarEnv();
  const supabase = createClient(url, chave, { auth: { persistSession: false } });

  if (substituirDia) {
    const dias = Array.from(new Set(linhas.map((l) => l.data))).sort();
    const { error } = await supabase.from("matriculas").delete().in("data", dias);
    if (error) throw new Error(`Falha ao limpar os dias: ${error.message}`);
    console.log(`  ${dias.length} dia(s) apagado(s) antes da carga`);
  }

  const LOTE = 500;
  for (let i = 0; i < linhas.length; i += LOTE) {
    const lote = linhas.slice(i, i + LOTE).map((l) => ({ ...l, atualizado_em: new Date().toISOString() }));
    const { error } = await supabase
      .from("matriculas")
      .upsert(lote, { onConflict: "data,praca,curso" });
    if (error) throw new Error(`Falha ao gravar: ${error.message}`);
    console.log(`  gravadas ${Math.min(i + LOTE, linhas.length)}/${linhas.length}`);
  }
}

// -------------------------------------------------------------------- saída

function resumir(linhas: MatriculaAgregada[]) {
  const total = linhas.reduce((s, l) => s + l.quantidade, 0);
  const receita = linhas.reduce((s, l) => s + (l.receita_semestral ?? 0), 0);
  const dias = Array.from(new Set(linhas.map((l) => l.data))).sort();
  const semCurso = linhas
    .filter((l) => l.curso === NAO_CLASSIFICADO)
    .reduce((s, l) => s + l.quantidade, 0);
  const semPraca = linhas
    .filter((l) => l.praca === NAO_CLASSIFICADO)
    .reduce((s, l) => s + l.quantidade, 0);

  console.log(`\n  ${total} matrículas em ${linhas.length} grupos (dia × praça × curso)`);
  if (dias.length) console.log(`  período: ${dias[0]} a ${dias[dias.length - 1]} (${dias.length} dias)`);
  if (receita) console.log(`  receita semestral: R$ ${receita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  else console.log("  receita: não informada neste formato");
  if (semCurso) console.log(`  ${semCurso} em curso "${NAO_CLASSIFICADO}" (pós, MBA e cursos sem campanha)`);
  if (semPraca) console.log(`  ⚠ ${semPraca} em praça "${NAO_CLASSIFICADO}" — confira o mapa de unidades`);

  const porPraca = new Map<string, number>();
  for (const l of linhas) porPraca.set(l.praca, (porPraca.get(l.praca) ?? 0) + l.quantidade);
  console.log("\n  por praça:");
  for (const [p, q] of [...porPraca].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${p.padEnd(20)} ${q}`);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const conferir = argv.includes("--conferir");
  const substituirDia = argv.includes("--substituir-dia");
  const iAno = argv.indexOf("--ano");
  const ano = iAno >= 0 ? Number(argv[iAno + 1]) : new Date().getFullYear();

  // `--sql` aceita um destino opcional; sem ele, cai num nome padrão.
  const iDe = argv.indexOf("--de");
  const iAte = argv.indexOf("--ate");
  const de = iDe >= 0 ? argv[iDe + 1] : null;
  const ate = iAte >= 0 ? argv[iAte + 1] : null;

  const iSql = argv.indexOf("--sql");
  const alvoSql =
    iSql < 0
      ? null
      : argv[iSql + 1] && !argv[iSql + 1].startsWith("--")
        ? argv[iSql + 1]
        : "carga-matriculas.sql";

  const consumidos = new Set<string>();
  if (iAno >= 0 && argv[iAno + 1]) consumidos.add(argv[iAno + 1]);
  if (iSql >= 0 && alvoSql && argv[iSql + 1] === alvoSql) consumidos.add(alvoSql);
  if (iDe >= 0 && argv[iDe + 1]) consumidos.add(argv[iDe + 1]);
  if (iAte >= 0 && argv[iAte + 1]) consumidos.add(argv[iAte + 1]);
  const arquivos = argv.filter((a) => !a.startsWith("--") && !consumidos.has(a));

  if (!arquivos.length) {
    console.error(
      "Uso: node scripts/importar-matriculas.mts <arquivo.xlsx> [--conferir] [--sql [saida.sql]] [--substituir-dia] [--ano 2026]"
    );
    process.exit(1);
  }

  const todas: LinhaCrua[] = [];
  for (const arquivo of arquivos) {
    if (!existsSync(arquivo)) {
      console.error(`Arquivo não encontrado: ${arquivo}`);
      process.exit(1);
    }
    console.log(`\n▸ ${arquivo}`);
    const { linhas, formato, avisos } = await lerArquivo(arquivo, ano);
    console.log(`  formato ${formato}`);
    for (const a of avisos) console.log(`  · ${a}`);
    todas.push(...linhas);
  }

  // Recortar por dia evita o acidente mais provável deste importador: o
  // arquivo diário cobre dois dias, um deles já carregado COM receita pelo
  // relatório detalhado. Importar tudo sobrescreveria aquele dia com receita
  // nula, apagando valor medido.
  const noPeriodo = todas.filter(
    (l) => (!de || l.data >= de) && (!ate || l.data <= ate)
  );
  if (de || ate) {
    console.log(`
▸ recorte ${de ?? "início"} a ${ate ?? "fim"}: ${noPeriodo.length} de ${todas.length} linhas`);
  }

  /*
    Valor estranho na origem, dito antes de agregar.

    Depois da agregação essa informação some: um estorno de −0,10 dentro de
    um grupo de R$ 2.620,30 vira R$ 2.620,20 e ninguém repara. E o que o
    sistema acadêmico exporta como 0 não é "matrícula de graça" — é valor
    não informado, indistinguível de célula vazia depois da soma.

    O importador NÃO conserta nada aqui de propósito: se a planilha diz
    −7.056, é isso que vai para o banco, e o ROI negativo que aparece na
    tela é o dado falando. Decidir se um negativo é estorno a descartar ou
    lançamento a corrigir é assunto de quem emite o relatório, não do script
    que o carrega. O que o script deve é não deixar passar em silêncio.
  */
  const negativas = noPeriodo.filter(
    (l) => typeof l.receita_semestral === "number" && l.receita_semestral < 0
  );
  const zeradas = noPeriodo.filter((l) => l.receita_semestral === 0);
  if (negativas.length || zeradas.length) {
    console.log("\n  ⚠ valores de receita para conferir na origem:");
    if (negativas.length) {
      const soma = negativas.reduce((t, l) => t + (l.receita_semestral ?? 0), 0);
      console.log(
        `      ${negativas.length} linha(s) com valor NEGATIVO, somando R$ ${soma.toFixed(2)} — provável estorno`
      );
      for (const l of negativas.slice(0, 10)) {
        console.log(`        ${l.data}  ${l.praca} / ${l.curso}  R$ ${l.receita_semestral?.toFixed(2)}`);
      }
    }
    if (zeradas.length) {
      console.log(
        `      ${zeradas.length} linha(s) com valor ZERO — contam como "sem valor informado", não como receita nula`
      );
    }
    console.log("      Elas entram como estão. Nenhuma correção é aplicada automaticamente.");
  }

  const agregadas = agregarMatriculas(noPeriodo);
  resumir(agregadas);

  if (conferir) {
    console.log("\n  --conferir: nada foi gravado.\n");
    return;
  }

  if (alvoSql) {
    gerarSql(agregadas, alvoSql, substituirDia);
    return;
  }

  console.log("\n▸ gravando no Supabase");
  await gravar(agregadas, substituirDia);
  console.log("\n  pronto.\n");
}

main().catch((e) => {
  console.error("\n" + (e instanceof Error ? e.message : String(e)) + "\n");
  process.exit(1);
});
