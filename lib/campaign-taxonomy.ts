/**
 * Extrai curso, praça e tipo (branding/conversão) do nome da campanha.
 *
 * A nomenclatura da ULBRA codifica essas dimensões no próprio nome:
 *   2026-2-{curso}-{praça}-advplus-{data}-{tipo}-ativar
 *   2026/2 | {praça} | Rebranding | {data}          (institucional)
 *
 * Os nomes têm sujeira real (espaço depois de hífen, apelidos alternados
 * para o mesmo curso), então normalizamos antes de casar.
 */

export type CampaignKind = "conversao" | "branding";

export interface CampaignTaxonomy {
  curso: string;
  praca: string;
  kind: CampaignKind;
  /** Recorte dentro do curso: "remanescentes", "transferencia" etc. */
  recorte: string | null;
}

const DESCONHECIDO = "Não classificado";

/** Praças conhecidas. Ordem importa: as compostas precisam vir antes. */
const PRACAS: [slug: string, label: string][] = [
  ["cachoeira-do-sul", "Cachoeira do Sul"],
  ["sao-jeronimo", "São Jerônimo"],
  ["saojeronimo", "São Jerônimo"],
  ["santa-maria", "Santa Maria"],
  ["santamaria", "Santa Maria"],
  ["portoalegre", "Porto Alegre"],
  ["porto-alegre", "Porto Alegre"],
  ["ulbrapop2", "Ulbra POP"],
  ["ulbrapop", "Ulbra POP"],
  ["itumbiara", "Itumbiara"],
  ["carazinho", "Carazinho"],
  ["santarem", "Santarém"],
  ["gravatai", "Gravataí"],
  ["canoas", "Canoas"],
  ["palmas", "Palmas"],
  ["manaus", "Manaus"],
  ["guaiba", "Guaíba"],
  ["torres", "Torres"],
  ["brasil", "Brasil"],
  ["rs", "Rio Grande do Sul"],
];

/** Apelidos usados nos nomes → rótulo canônico do curso. */
const CURSOS: [slug: string, label: string][] = [
  ["engenharia-ambiental", "Engenharia Ambiental"],
  ["engenharia-quimica", "Engenharia Química"],
  ["engenhariamecanica", "Engenharia Mecânica"],
  ["cienciascontabeis", "Ciências Contábeis"],
  ["terapiaocupacional", "Terapia Ocupacional"],
  ["fisioterapia", "Fisioterapia"],
  ["fisio", "Fisioterapia"],
  ["psicologia", "Psicologia"],
  ["psico", "Psicologia"],
  ["enfermagem", "Enfermagem"],
  ["agronomia", "Agronomia"],
  ["pedagogia", "Pedagogia"],
  ["vestibular", "Vestibular"],
  ["edfisica", "Educação Física"],
  ["medicina", "Medicina"],
  ["medvet", "Medicina Veterinária"],
  ["estetica", "Estética"],
  ["direito", "Direito"],
  ["biomed", "Biomedicina"],
  ["odontologia", "Odontologia"],
  ["odonto", "Odontologia"],
  ["gerais", "Geral"],
  ["geral", "Geral"],
  ["ads", "Análise e Desenv. de Sistemas"],
];

/** Recortes de público que aparecem grudados no curso. */
const RECORTES: [slug: string, label: string][] = [
  ["remanescentes", "Remanescentes"],
  ["transferencia", "Transferência"],
];

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // "biomed- carazinho" e "psicologia - torres" viram "biomed-carazinho"
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/** Remove tudo que não identifica curso nem praça. */
function extrairMiolo(nome: string): string {
  let s = normalizar(nome);
  s = s.replace(/^\d{4}[-/]\d-/, "");
  const corte = s.search(
    /-(advplus|adv\+|abo|cbo|\d{1,2}(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro))/
  );
  if (corte > 0) s = s.slice(0, corte);
  return s.replace(/^-|-$/g, "");
}

export function classificarCampanha(
  campaignName: string,
  objective?: string | null
): CampaignTaxonomy {
  const bruto = normalizar(campaignName);

  // Branding sai do objetivo da campanha, não do nome — o nome é só reforço.
  const kind: CampaignKind =
    objective === "LINK_CLICKS" ||
    objective === "OUTCOME_AWARENESS" ||
    objective === "OUTCOME_ENGAGEMENT" ||
    objective === "BRAND_AWARENESS" ||
    objective === "REACH" ||
    /rebranding|branding|institucional/.test(bruto)
      ? "branding"
      : "conversao";

  // Formato institucional: "2026/2 | Brasil | Rebranding | 17Abril"
  if (campaignName.includes("|")) {
    const partes = campaignName.split("|").map((p) => normalizar(p));
    const praca =
      PRACAS.find(([slug]) => partes.some((p) => p === slug))?.[1] ??
      PRACAS.find(([slug]) => partes.some((p) => p.includes(slug)))?.[1] ??
      DESCONHECIDO;
    return { curso: "Institucional", praca, kind, recorte: null };
  }

  let miolo = extrairMiolo(campaignName);

  // Praça fica no fim do miolo; casamos a mais longa primeiro.
  let praca = DESCONHECIDO;
  for (const [slug, label] of PRACAS) {
    if (miolo === slug || miolo.endsWith(`-${slug}`)) {
      praca = label;
      miolo = miolo.slice(0, miolo.length - slug.length).replace(/-$/, "");
      break;
    }
  }

  let recorte: string | null = null;
  for (const [slug, label] of RECORTES) {
    if (miolo.includes(slug)) {
      recorte = label;
      miolo = miolo.replace(new RegExp(`-?${slug}`), "");
      break;
    }
  }

  let curso = DESCONHECIDO;
  for (const [slug, label] of CURSOS) {
    if (miolo === slug || miolo.startsWith(`${slug}-`) || miolo.endsWith(`-${slug}`)) {
      curso = label;
      break;
    }
  }

  // Campanhas como "transferencia-brasil" não citam curso: o recorte é o
  // próprio foco da campanha, então ele vira o rótulo.
  if (curso === DESCONHECIDO && recorte) {
    curso = recorte;
    recorte = null;
  }

  return { curso, praca, kind, recorte };
}

export function rotuloKind(kind: CampaignKind): string {
  return kind === "branding" ? "Branding" : "Conversão";
}
