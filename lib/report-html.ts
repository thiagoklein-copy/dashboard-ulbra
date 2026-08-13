import type { Comparativo, LinhaRanking, RelatorioMidia } from "@/lib/benchmark-report";
import type { AggregatedRow } from "@/lib/types";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const num = new Intl.NumberFormat("pt-BR");

const money = (n: number) => brl.format(n || 0);
const int = (n: number) => num.format(Math.round(n || 0));
const pct = (n: number | null | undefined, casas = 2) =>
  n === null || n === undefined || Number.isNaN(n) ? "—" : `${n.toFixed(casas).replace(".", ",")}%`;

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function dataBR(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Seta e cor conforme a métrica melhora ou piora. */
function delta(c: Comparativo): string {
  if (c.variacao === null) return `<span class="delta neutro">sem base anterior</span>`;
  const v = c.variacao;
  const bom = c.menorMelhor ? v < 0 : v > 0;
  const seta = v > 0 ? "▲" : v < 0 ? "▼" : "—";
  const classe = Math.abs(v) < 1 ? "neutro" : bom ? "bom" : "ruim";
  return `<span class="delta ${classe}">${seta} ${Math.abs(v).toFixed(1).replace(".", ",")}%</span>`;
}

function kpi(rotulo: string, valor: string, c: Comparativo, anterior: string) {
  return `
    <div class="kpi">
      <span class="kpi-rotulo">${rotulo}</span>
      <strong class="kpi-valor">${valor}</strong>
      <div class="kpi-rodape">${delta(c)}<span class="kpi-antes">antes ${anterior}</span></div>
    </div>`;
}

function linhasRanking(itens: LinhaRanking[], unidade: string) {
  if (!itens.length) return `<tr><td colspan="7" class="vazio">Sem dados no período</td></tr>`;
  return itens
    .map(
      (i) => `
      <tr>
        <td class="nome">${esc(i.nome)}</td>
        <td class="n">${money(i.investimento)}</td>
        <td class="n">${int(i.resultados)}</td>
        <td class="n destaque">${money(i.custoPorResultado)}</td>
        <td class="n">${pct(i.taxaAnuncio)}</td>
        <td class="n">${pct(i.taxaPagina, 1)}</td>
        <td class="n">${
          i.variacaoCusto === null
            ? "—"
            : `<span class="delta ${i.variacaoCusto < -1 ? "bom" : i.variacaoCusto > 1 ? "ruim" : "neutro"}">${
                i.variacaoCusto > 0 ? "▲" : "▼"
              } ${Math.abs(i.variacaoCusto).toFixed(0)}%</span>`
        }</td>
      </tr>`
    )
    .join("");
}

function cartaoAnuncio(r: AggregatedRow, posicao: number, variante: "bom" | "ruim") {
  const img = r.image_url
    ? `<img src="${esc(r.image_url)}" alt="" loading="lazy" />`
    : `<div class="sem-img">sem imagem</div>`;
  const texto = r.primary_text?.trim();
  return `
    <div class="anuncio ${variante}">
      <div class="anuncio-pos">${posicao}</div>
      <div class="anuncio-img">${img}</div>
      <div class="anuncio-info">
        <p class="anuncio-nome">${esc(r.name)}</p>
        <p class="anuncio-meta">${esc(r.campaign_name)}</p>
        ${texto ? `<p class="anuncio-copy">${esc(texto.slice(0, 220))}${texto.length > 220 ? "…" : ""}</p>` : ""}
        <div class="anuncio-nums">
          <span><b>${money(r.cost_per_result)}</b> por resultado</span>
          <span>${int(r.results)} resultados</span>
          <span>${money(r.spend)} investidos</span>
          <span>CTR ${pct(r.ctr)}</span>
        </div>
      </div>
    </div>`;
}

export function renderRelatorioHtml(r: RelatorioMidia): string {
  const unidade = r.indicador === "offsite_conversion.fb_pixel_lead" ? "leads" : "resultados";
  const escopo =
    r.tipo === "conversao"
      ? "Campanhas de conversão"
      : r.tipo === "branding"
        ? "Campanhas de branding"
        : "Todas as campanhas";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Relatório de mídia — ULBRA · ${dataBR(r.periodo.de)} a ${dataBR(r.periodo.ate)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: Roboto, system-ui, -apple-system, sans-serif;
    margin: 0; padding: 40px 32px; background: #f5f4f0; color: #18181b;
    line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .folha { max-width: 1080px; margin: 0 auto; }
  header { margin-bottom: 28px; }
  h1 { font-size: 1.55rem; font-weight: 600; margin: 0 0 4px; letter-spacing: -0.01em; }
  .sub { color: #6b7280; font-size: 0.86rem; }
  .escopo { display: inline-block; background: #111; color: #fff; font-size: 0.7rem;
            padding: 4px 11px; border-radius: 999px; margin-bottom: 10px; }
  .filtros { margin-top: 8px; font-size: 0.78rem; color: #6b7280; }
  .filtros b { color: #18181b; font-weight: 500; }

  h2 { font-size: 1.02rem; font-weight: 600; margin: 34px 0 12px;
       padding-bottom: 7px; border-bottom: 1px solid #e5e3dd; }
  h2 .n { color: #9ca3af; font-weight: 400; margin-right: 7px; }
  .legenda { color: #6b7280; font-size: 0.8rem; margin: -6px 0 14px; }

  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .kpi { background: #fff; border-radius: 14px; padding: 15px 16px; }
  .kpi-rotulo { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
  .kpi-valor { display: block; font-size: 1.5rem; font-weight: 500; margin: 5px 0 7px;
               font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .kpi-rodape { display: flex; align-items: center; gap: 8px; }
  .kpi-antes { font-size: 0.7rem; color: #9ca3af; }
  .delta { font-size: 0.75rem; font-weight: 500; }
  .delta.bom { color: #047857; } .delta.ruim { color: #b91c1c; } .delta.neutro { color: #9ca3af; }

  .funil { background: #fff; border-radius: 14px; padding: 18px 20px; display: grid;
           grid-template-columns: 1fr auto 1fr auto 1fr; align-items: center; gap: 14px; }
  .fase { text-align: center; }
  .fase b { display: block; font-size: 1.28rem; font-weight: 500; font-variant-numeric: tabular-nums; }
  .fase span { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; }
  .fase small { display: block; font-size: 0.7rem; color: #9ca3af; margin-top: 2px; }
  .passo { text-align: center; padding: 0 4px; }
  .passo b { display: block; font-size: 0.98rem; font-weight: 600; font-variant-numeric: tabular-nums; }
  .passo span { font-size: 0.66rem; color: #6b7280; display: block; line-height: 1.3; }

  table { width: 100%; border-collapse: collapse; background: #fff;
          border-radius: 14px; overflow: hidden; font-size: 0.84rem; }
  th { text-align: left; font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.05em;
       color: #6b7280; font-weight: 500; padding: 11px 12px; background: #faf9f7; }
  td { padding: 10px 12px; border-top: 1px solid #f0efec; }
  td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
  td.nome { font-weight: 500; }
  td.destaque { font-weight: 600; }
  .vazio { text-align: center; color: #9ca3af; padding: 22px; }

  .anuncio { display: grid; grid-template-columns: 26px 84px 1fr; gap: 13px;
             background: #fff; border-radius: 14px; padding: 14px; margin-bottom: 9px;
             border-left: 3px solid transparent; }
  .anuncio.bom { border-left-color: #059669; }
  .anuncio.ruim { border-left-color: #dc2626; }
  .anuncio-pos { font-size: 0.9rem; font-weight: 600; color: #9ca3af; }
  .anuncio-img img { width: 84px; height: 84px; object-fit: cover; border-radius: 9px; display: block; }
  .sem-img { width: 84px; height: 84px; border-radius: 9px; background: #f3f4f6;
             display: flex; align-items: center; justify-content: center;
             font-size: 0.62rem; color: #9ca3af; text-align: center; }
  .anuncio-nome { font-weight: 500; margin: 0 0 1px; font-size: 0.9rem; }
  .anuncio-meta { color: #9ca3af; font-size: 0.72rem; margin: 0 0 7px; }
  .anuncio-copy { font-size: 0.79rem; color: #4b5563; margin: 0 0 9px; line-height: 1.45; }
  .anuncio-nums { display: flex; flex-wrap: wrap; gap: 14px; font-size: 0.76rem; color: #6b7280; }
  .anuncio-nums b { color: #18181b; font-variant-numeric: tabular-nums; }

  .copy { background: #fff; border-radius: 14px; padding: 15px 17px; margin-bottom: 9px; }
  .copy-texto { font-size: 0.85rem; color: #27272a; margin: 0 0 9px; line-height: 1.55; }
  .copy-nums { font-size: 0.75rem; color: #6b7280; display: flex; gap: 16px; flex-wrap: wrap; }
  .copy-nums b { color: #18181b; }

  .conclusoes { background: #fff; border-radius: 14px; padding: 6px 20px 14px; }
  .conclusoes li { margin: 11px 0; font-size: 0.88rem; line-height: 1.55; }
  .metodologia { font-size: 0.76rem; color: #6b7280; line-height: 1.6; }
  .metodologia li { margin: 6px 0; }
  footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #e5e3dd;
           font-size: 0.72rem; color: #9ca3af; }

  @media print {
    body { background: #fff; padding: 0; }
    h2 { break-after: avoid; }
    .anuncio, .copy, .kpi, table { break-inside: avoid; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
<div class="folha">

<header>
  <div class="escopo">${esc(escopo)}</div>
  <h1>Relatório de mídia — ULBRA Meta Ads</h1>
  <p class="sub">
    ${dataBR(r.periodo.de)} a ${dataBR(r.periodo.ate)} · ${r.periodo.dias} dias ·
    comparado com ${dataBR(r.periodoAnterior.de)} a ${dataBR(r.periodoAnterior.ate)}
  </p>
  ${r.filtros.length ? `<p class="filtros">Filtros aplicados: <b>${r.filtros.map(esc).join("</b> · <b>")}</b></p>` : ""}
</header>

<h2><span class="n">1</span>Resumo do período</h2>
<div class="kpis">
  ${kpi("Investimento", money(r.investimento.atual), r.investimento, money(r.investimento.anterior))}
  ${kpi(unidade.charAt(0).toUpperCase() + unidade.slice(1), int(r.resultados.atual), r.resultados, int(r.resultados.anterior))}
  ${kpi("Custo por resultado", money(r.custoPorResultado.atual), r.custoPorResultado, money(r.custoPorResultado.anterior))}
  ${kpi("Impressões", int(r.impressoes.atual), r.impressoes, int(r.impressoes.anterior))}
</div>

<h2><span class="n">2</span>Funil de conversão</h2>
<p class="legenda">Separar as duas taxas mostra se a perda está no criativo ou na página de destino.</p>
<div class="funil">
  <div class="fase">
    <span>Impressões</span><b>${int(r.funil.impressoes)}</b>
    <small>${int(r.funil.alcance)} pessoas</small>
  </div>
  <div class="passo">
    <b>${pct(r.funil.taxaAnuncio.atual)}</b>
    <span>conversão<br />do anúncio</span>
    ${delta(r.funil.taxaAnuncio)}
  </div>
  <div class="fase"><span>Cliques no link</span><b>${int(r.funil.cliques)}</b></div>
  <div class="passo">
    <b>${pct(r.funil.taxaPagina.atual, 1)}</b>
    <span>conversão<br />da página</span>
    ${delta(r.funil.taxaPagina)}
  </div>
  <div class="fase"><span>${esc(unidade)}</span><b>${int(r.funil.resultados)}</b></div>
</div>

<h2><span class="n">3</span>Desempenho por curso</h2>
<p class="legenda">Ordenado do menor para o maior custo. A última coluna compara com o período anterior.</p>
<table>
  <thead><tr>
    <th>Curso</th><th class="n">Investimento</th><th class="n">${esc(unidade)}</th>
    <th class="n">Custo/result.</th><th class="n">Conv. anúncio</th>
    <th class="n">Conv. página</th><th class="n">vs. anterior</th>
  </tr></thead>
  <tbody>${linhasRanking(r.porCurso, unidade)}</tbody>
</table>

<h2><span class="n">4</span>Desempenho por praça</h2>
<table>
  <thead><tr>
    <th>Praça</th><th class="n">Investimento</th><th class="n">${esc(unidade)}</th>
    <th class="n">Custo/result.</th><th class="n">Conv. anúncio</th>
    <th class="n">Conv. página</th><th class="n">vs. anterior</th>
  </tr></thead>
  <tbody>${linhasRanking(r.porPraca, unidade)}</tbody>
</table>

<h2><span class="n">5</span>Anúncios mais eficientes</h2>
<p class="legenda">Só entram anúncios com volume suficiente para a comparação significar algo.</p>
${
  r.vencedores.length
    ? r.vencedores.map((a, i) => cartaoAnuncio(a, i + 1, "bom")).join("")
    : `<div class="copy"><p class="copy-texto">Nenhum anúncio atingiu o volume mínimo no período.</p></div>`
}

<h2><span class="n">6</span>Anúncios mais caros</h2>
<p class="legenda">Mesmo critério de volume — candidatos a pausa ou revisão de criativo.</p>
${
  r.perdedores.length
    ? r.perdedores.map((a, i) => cartaoAnuncio(a, i + 1, "ruim")).join("")
    : `<div class="copy"><p class="copy-texto">Sem dados suficientes.</p></div>`
}

<h2><span class="n">7</span>Copies que mais converteram</h2>
<p class="legenda">Mesmo texto usado em vários anúncios, somando os resultados de todos.</p>
${
  r.copiesVencedoras.length
    ? r.copiesVencedoras
        .map(
          (c) => `
  <div class="copy">
    <p class="copy-texto">${esc(c.texto.slice(0, 480))}${c.texto.length > 480 ? "…" : ""}</p>
    <div class="copy-nums">
      <span><b>${money(c.custo)}</b> por resultado</span>
      <span><b>${int(c.resultados)}</b> resultados</span>
      <span>usada em <b>${c.ads}</b> anúncios</span>
    </div>
  </div>`
        )
        .join("")
    : `<div class="copy"><p class="copy-texto">Nenhuma copy atingiu o volume mínimo.</p></div>`
}

<h2><span class="n">8</span>Leitura do período</h2>
<div class="conclusoes"><ul>
  ${r.conclusoes.map((c) => `<li>${esc(c)}</li>`).join("") || "<li>Sem base de comparação suficiente.</li>"}
</ul></div>

<h2><span class="n">9</span>Metodologia</h2>
<ul class="metodologia">
  ${r.metodologia.map((m) => `<li>${esc(m)}</li>`).join("")}
</ul>

<footer>
  Gerado em ${esc(new Date(r.geradoEm).toLocaleString("pt-BR"))} ·
  Dashboard Meta Ads ULBRA · dados da API de Marketing do Meta
  <span class="no-print"> · para PDF use Ctrl/Cmd+P → Salvar como PDF</span>
</footer>

</div>
</body>
</html>`;
}
