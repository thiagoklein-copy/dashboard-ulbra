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

  // Vindos dos nomes reais das contas do Google. "ulbra-pop" com espaço,
  // "online" e "ead" são a mesma marca de EAD; "docpalmas" e "doc-manaus"
  // são documentários gravados na praça, não praças novas.
  ["ulbra-pop", "Ulbra POP"],
  ["online", "Ulbra POP"],
  ["ead", "Ulbra POP"],
  ["docpalmas", "Palmas"],
  ["doc-palmas", "Palmas"],
  ["doc-manaus", "Manaus"],
  ["aviacao", "Aviação"],
];

/**
 * Rótulos de captação ampla que ocupam o lugar do curso.
 *
 * "cursos", "enem", "2graduacao", "desconto" não são curso — são a porta de
 * entrada. Viram "Geral", que o rateio da matriz já sabe espalhar entre os
 * cursos da praça. Ficar em "Não classificado" faria o gasto sumir; virar
 * curso próprio criaria uma linha que matrícula nenhuma preenche.
 *
 * A lista é fechada de propósito: rótulo desconhecido continua caindo em
 * "Não classificado", que é o sinal de que apareceu campanha nova com nome
 * fora do padrão.
 */
/**
 * Marcadores de campanha de rede, sem recorte geográfico.
 *
 * "Geração de demanda" é um tipo de campanha que a ULBRA roda no nível da
 * rede — não tem praça no nome porque não tem praça. Deixá-la em "Não
 * classificado" esconderia gasto real; mandá-la para "Brasil" faz o rateio
 * da matriz espalhá-la pelas praças, que é o comportamento certo.
 */
const NACIONAIS = ["geracao-de-demanda", "geracao-demanda"];

const GENERICOS = new Set([
  "geral", "geral2", "gerais", "cursos", "curso", "desconto", "shorts",
  "enem", "2graduacao", "segunda-graduacao", "vestibular-aberto",
  "relacoes-governamentais", "matriz", "institucional",
]);

/** Apelidos usados nos nomes → rótulo canônico do curso. */
const CURSOS: [slug: string, label: string][] = [
  // Veterinária antes de Medicina, senão "medicina-veterinaria" vira Medicina.
  ["medicina-veterinaria", "Medicina Veterinária"],
  ["medvet", "Medicina Veterinária"],
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
  ["ads", "Análise e Desenv. de Sistemas"],

  // Formas com hífen e cursos que apareciam só na base de matrículas. Sem
  // eles, campanha do Google escrita por extenso caía em "Não classificado".
  ["ciencias-contabeis", "Ciências Contábeis"],
  ["terapia-ocupacional", "Terapia Ocupacional"],
  ["engenharia-mecanica", "Engenharia Mecânica"],
  ["engenharia-civil", "Engenharia Civil"],
  ["engenharia-eletrica", "Engenharia Elétrica"],
  ["engenharia-de-producao", "Engenharia de Produção"],
  ["engenharia-de-software", "Engenharia de Software"],
  ["ciencia-da-computacao", "Ciência da Computação"],
  ["educacao-fisica", "Educação Física"],
  ["ed-fisica", "Educação Física"],
  ["arquitetura", "Arquitetura e Urbanismo"],
  ["fonoaudiologia", "Fonoaudiologia"],
  ["administracao", "Administração"],
  ["nutricao", "Nutrição"],
  ["farmacia", "Farmácia"],
  ["jornalismo", "Jornalismo"],
  ["teologia", "Teologia"],
  ["biomedicina", "Biomedicina"],
  ["gestao-do-agronegocio", "Gestão do Agronegócio"],
  ["gestao-de-agro", "Gestão do Agronegócio"],
  // "PP e PC" = Piloto Privado e Piloto Comercial, na conta de Aviação.
  ["pp-e-pc", "Piloto Comercial"],
  ["piloto", "Piloto Comercial"],
];

/** Recortes de público que aparecem grudados no curso. */
const RECORTES: [slug: string, label: string][] = [
  ["remanescentes", "Remanescentes"],
  ["transferencia", "Transferência"],
];

/**
 * Para onde vai o que não foi identificado.
 *
 * Campanha de branding sem praça é institucional de rede — "Brasil" é o
 * rótulo certo, não uma falha. Já campanha de conversão sem praça continua
 * em "Não classificado": ali o buraco é real e precisa aparecer, porque é
 * gasto de captação que ninguém consegue atribuir.
 */
function padraoPraca(kind: CampaignKind): string {
  return kind === "branding" ? "Brasil" : DESCONHECIDO;
}

function padraoCurso(kind: CampaignKind): string {
  return kind === "branding" ? "Institucional" : DESCONHECIDO;
}

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
    /*
      Três famílias de marcador, todas significando "daqui para a frente é
      tipo de campanha, formato, status ou data — não curso nem praça":

      - estratégia de lance: `advplus`/`abo`/`cbo` na Meta, `pmax`,
        `pesquisa`, `demanda`, `ytb`, `reconhecimento` no Google;
      - destino e status, sempre no fim do nome: `leadsite`, `conversao`,
        `carrossel`, `ativar`, `pausar`;
      - a data, no formato `13agosto`.

      A segunda família entrou depois de uma auditoria: sem ela, a praça de
      `2026-2-medicina-video-vitao-matriz-canoas-ativar` só era encontrada
      porque o nome trazia `13agosto` junto. Essa família é a maior fatia de
      gasto da Meta — R$ 28,4 mil, 23% da conta —, e uma campanha nova sem
      data no nome cairia inteira em "Não classificado", sumindo da matriz
      sem aviso nenhum.

      `video` e `cards` ficam de fora de propósito, mesmo sendo formato:
      nessa família eles vêm ANTES da praça (`-video-vitao-matriz-canoas-`,
      `-cards-matriz-canoas-`), e cortar ali destruiria justamente o que se
      quer preservar — foram R$ 4.073,67 em "Não classificado" ao tentar.
      Só entra na lista o marcador que comprovadamente fecha o nome.
    */
    /-(advplus|adv\+|abo|cbo|pmax|pesquisa|demanda|ytb|reconhecimento|carrossel|leadsite|conversao|ativar|pausar|\d{1,2}(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro))/
  );
  if (corte > 0) s = s.slice(0, corte);
  return s.replace(/^-|-$/g, "");
}

/**
 * O tipo da linha promete `campaign_name: string`, mas o banco pode devolver
 * nulo — uma coleta parcial grava a chave (ad_id, date_start) antes de ter o
 * nome. Aconteceu: 37 linhas sem nome derrubaram o dashboard inteiro com
 * "Cannot read properties of null" em toda consulta que incluísse aquele dia.
 * Uma linha suja tem que virar "Desconhecido", não um 500.
 */
export function classificarCampanha(
  campaignName: string | null | undefined,
  objective?: string | null
): CampaignTaxonomy {
  if (!campaignName) {
    return { curso: DESCONHECIDO, praca: DESCONHECIDO, kind: "conversao", recorte: null };
  }
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

  // Formato com barras verticais. Ele serve a dois usos diferentes:
  //
  //   "2026/2 | Brasil | Rebranding | 17Abril"                    institucional
  //   "2026/2 | Gravatai | Medicina | ADV+ | 29Abril | Conversão" curso e praça
  //
  // O segundo caso era classificado como "Institucional" porque este ramo
  // cravava esse rótulo sem olhar o resto do nome. Cinco campanhas de
  // Medicina, MedVet, Agronomia e Direito sumiam dos seus cursos — e o gasto
  // delas ia para uma linha institucional que ninguém analisa. O curso agora
  // é procurado entre as partes; "Institucional" só sobra quando não há
  // nenhum, que é o caso do rebranding de verdade.
  if (campaignName.includes("|")) {
    // `normalizar` troca espaço por hífen, e o espaço em volta da barra vira
    // hífen nas pontas: " Medicina " sai como "-medicina-". Sem aparar isso,
    // nenhuma comparação exata casa — era por isso que a praça só era
    // encontrada pelo `includes`, que é frouxo, e o curso, por nada.
    const partes = campaignName
      .split("|")
      .map((p) => normalizar(p).replace(/^-+|-+$/g, ""))
      .filter(Boolean);

    const contem = (slug: string) =>
      partes.some((p) => p === slug || p.startsWith(`${slug}-`) || p.endsWith(`-${slug}`));

    // A busca frouxa por `includes` foi embora: "cu**rs**os" casava com o
    // slug "rs" e mandava toda campanha da Ultec para Rio Grande do Sul.
    // `contem` respeita fronteira de hífen.
    const nacional = NACIONAIS.some((m) => contem(m));

    const praca =
      PRACAS.find(([slug]) => contem(slug))?.[1] ??
      (nacional ? "Brasil" : padraoPraca(kind));

    // `contem` e não igualdade: "geracao-de-demanda-–-vestibular-aberto" vem
    // como uma parte só quando o separador é travessão em vez de barra.
    const generico =
      nacional || partes.some((p) => [...GENERICOS].some((g) => p === g || p.endsWith(`-${g}`)));

    const curso =
      CURSOS.find(([slug]) => contem(slug))?.[1] ??
      (generico ? "Geral" : padraoCurso(kind));

    const recorte = RECORTES.find(([slug]) => contem(slug))?.[1] ?? null;

    return { curso, praca, kind, recorte };
  }

  let miolo = extrairMiolo(campaignName);

  // A praça pode estar nas duas pontas, e casamos a mais longa primeiro.
  //
  // Na Meta ela vem no fim ("geral-canoas"); no Google, no começo
  // ("canoas-geral", "ulbrapop-geral2"). Só olhando o fim, os R$ 41 mil das
  // duas contas do Google caíam inteiros em "Não classificado".
  let praca = DESCONHECIDO;
  for (const [slug, label] of PRACAS) {
    if (miolo === slug) {
      praca = label;
      miolo = "";
      break;
    }
    if (miolo.endsWith(`-${slug}`)) {
      praca = label;
      miolo = miolo.slice(0, miolo.length - slug.length - 1);
      break;
    }
    if (miolo.startsWith(`${slug}-`)) {
      praca = label;
      miolo = miolo.slice(slug.length + 1);
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

  const nacional = NACIONAIS.some((m) => bruto.includes(m));

  // "canoas-geral", "ulbrapop-cursos", "brasil-enem": captação ampla.
  if (curso === DESCONHECIDO && (nacional || miolo.split("-").some((p) => GENERICOS.has(p)))) {
    curso = "Geral";
  }
  if (curso === DESCONHECIDO) curso = padraoCurso(kind);
  if (praca === DESCONHECIDO) praca = nacional ? "Brasil" : padraoPraca(kind);

  return { curso, praca, kind, recorte };
}

export function rotuloKind(kind: CampaignKind): string {
  return kind === "branding" ? "Branding" : "Conversão";
}
