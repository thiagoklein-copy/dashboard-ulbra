/**
 * Matrículas confirmadas — a etapa que faltava depois do lead.
 *
 * A base de matrículas não tem UTM, lead id, e-mail nem telefone: **não
 * existe atribuição por clique**. A única chave que cruza com a mídia é
 * (dia, praça, curso), e mesmo ela é correlação, não atribuição — uma
 * matrícula orgânica entra na conta igual a uma comprada. É o "CAC blended"
 * que a planilha de análise descreve: Manaus/Direito aparece com CAC de
 * R$ 2 porque 88 matrículas caíram sobre R$ 205 de mídia.
 *
 * Só entra linha de `Matrícula`. `Rematrícula` é retenção da base instalada
 * — 10.312 contra 1.503 no recorte de julho/agosto de 2026. Somar as duas
 * dividiria o CAC por oito e inventaria uma performance que não existe.
 *
 * Este arquivo é propositalmente autocontido: o importador roda fora do
 * Next (`node scripts/importar-matriculas.ts`) e não resolve o apelido
 * `@/`. `tests/matriculas.test.ts` garante que os rótulos não descolem dos
 * de `lib/campaign-taxonomy.ts`.
 */

/** Mesmo rótulo de `campaign-taxonomy.ts`. O teste falha se divergir. */
export const NAO_CLASSIFICADO = "Não classificado";

export interface MatriculaAgregada {
  /** ISO `yyyy-mm-dd` — dia da confirmação */
  data: string;
  praca: string;
  curso: string;
  quantidade: number;
  /**
   * Soma de `Vlr Liq Semestre` das matrículas do grupo. Nulo quando a
   * origem foi o arquivo diário, que traz só contagem.
   */
  receita_semestral: number | null;
}

function normalizar(texto: string | null | undefined): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[.–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Unidade do sistema acadêmico → praça do dashboard.
 *
 * As unidades `ULBRA MEDICINA - X` são o curso de Medicina de X, não uma
 * praça separada: colapsam na praça correspondente para que o gasto de
 * mídia de Medicina/Palmas encontre as matrículas de Medicina/Palmas.
 */
const UNIDADE_PRACA: Record<string, string> = {
  "CAMPUS CANOAS": "Canoas",
  "ULBRA POP": "Ulbra POP",
  "CENTRO UNIV PALMAS/TO": "Palmas",
  "CENTRO UNIV MANAUS/AM": "Manaus",
  "CENTRO UNIV SANTAREM/PA": "Santarém",
  "CAMPUS TORRES": "Torres",
  "ILES ITUMBIARA/GO": "Itumbiara",
  "CAMPUS SANTA MARIA": "Santa Maria",
  "CAMPUS GRAVATAI II": "Gravataí",
  "CAMPUS GUAIBA": "Guaíba",
  "CAMPUS CACHOEIRA DO SUL": "Cachoeira do Sul",
  "CAMPUS CARAZINHO": "Carazinho",
  "CAMPUS SAO JERONIMO": "São Jerônimo",
  "ULBRA MEDICINA MANAUS": "Manaus",
  "ULBRA MEDICINA PALMAS": "Palmas",
  "ULBRA MEDICINA POA": "Porto Alegre",
  "ULBRA MEDICINA GRAVATAI": "Gravataí",
  "ULBRA MEDICINA SANTAREM": "Santarém",
  "ULBRA MEDICINA SAJ": "São Jerônimo",
  /*
    EAD é o Ulbra POP, e não uma praça nacional.

    `campaign-taxonomy.ts` manda os slugs `ead` e `online` para "Ulbra POP",
    e a planilha de análise soma as duas coisas no mesmo balde. Mandar a
    matrícula para "Brasil" fazia os dois lados do cruzamento discordarem:
    a receita ficava presa numa linha sem investimento, que o rateio nunca
    alcança porque ele só redistribui mídia.
  */
  EAD: "Ulbra POP",

  /*
    Ultec School não tem praça conhecida.

    O curso é presencial, mas a unidade não diz onde. Mandá-lo para "Brasil"
    inventava uma praça nacional para uma matrícula física; "Não
    classificado" é o que se sabe de verdade, e aparece na tela como tal em
    vez de contaminar o CAC de um lugar.
  */
  "ULTEC SCHOOL": NAO_CLASSIFICADO,
};

/** Praça usada no arquivo diário, que abrevia os nomes. */
const APELIDO_PRACA: Record<string, string> = {
  CANOAS: "Canoas",
  "ULBRA POP": "Ulbra POP",
  POP: "Ulbra POP",
  PALMAS: "Palmas",
  MANAUS: "Manaus",
  SANTAREM: "Santarém",
  TORRES: "Torres",
  ITUMBIARA: "Itumbiara",
  "SANTA MARIA": "Santa Maria",
  GRAVATAI: "Gravataí",
  GUAIBA: "Guaíba",
  "CACHOEIRA DO SUL": "Cachoeira do Sul",
  CARAZINHO: "Carazinho",
  "SAO JERONIMO": "São Jerônimo",
  SAJ: "São Jerônimo",
  POA: "Porto Alegre",
  "PORTO ALEGRE": "Porto Alegre",
};

export function mapearPraca(unidade: string | null | undefined): string {
  const n = normalizar(unidade).replace(/\s*-\s*/g, " ").replace(/\s+/g, " ");
  return UNIDADE_PRACA[n] ?? APELIDO_PRACA[n] ?? NAO_CLASSIFICADO;
}

/**
 * Curso do sistema acadêmico → rótulo canônico.
 *
 * A ordem importa: "MEDICINA VETERINÁRIA" precisa casar antes de "MEDICINA".
 * Turno (`DIURNO`, `NOT`, `INT/NOT`) e ênfase são recortes do mesmo curso e
 * colapsam — foi assim que a planilha de análise chegou nos 276 de Direito
 * e nos 125 de Psicologia.
 *
 * Os rótulos que também existem em `campaign-taxonomy.ts` precisam bater
 * **letra por letra**, senão o curso vindo da campanha e o vindo da
 * matrícula viram duas linhas separadas no filtro.
 */
const CURSOS: [padrao: RegExp, label: string][] = [
  // Pós, MBA e extensão: não têm campanha e não entram na conta de captação.
  [/^(MBA|MBE) /, NAO_CLASSIFICADO],
  [/NEUROPSICOPEDAGOGIA|ALFABETIZACAO E LETRAMENTO/, NAO_CLASSIFICADO],
  [/EDUCACAO ESPECIAL|TECNOLOGIAS DIGITAIS APLICADAS/, NAO_CLASSIFICADO],
  [/^GESTAO (ESTRATEGICA|E DOCENCIA|E ESTRATEGIAS|PEDAGOGICA|DE PROCESSOS)/, NAO_CLASSIFICADO],
  [/^LIDERANCA ESTRATEGICA|^FINANCAS CORPORATIVAS/, NAO_CLASSIFICADO],
  [/^LOGISTICA E SUPPLY CHAIN/, NAO_CLASSIFICADO],
  [/^DIREITO (IMOBILIARIO|DO |PENAL|TRIBUTARIO)|^DIREITOS HUMANOS/, NAO_CLASSIFICADO],
  [/^PSICOLOGIA (DA SAUDE|ORGANIZACIONAL)/, NAO_CLASSIFICADO],
  [/^CIENCIAS DO EXERCICIO/, NAO_CLASSIFICADO],

  // Abreviações do arquivo diário e dos nomes de campanha. Ficam antes das
  // regras longas porque `^ADS$` precisa casar o rótulo inteiro — "ADS" solto
  // dentro de outra palavra não é o curso.
  [/^ADS$/, "Análise e Desenv. de Sistemas"],
  [/^MED ?VET/, "Medicina Veterinária"],
  [/^BIOMED$/, "Biomedicina"],
  [/^FISIO$/, "Fisioterapia"],
  [/^PSICO$/, "Psicologia"],
  [/^ODONTO$/, "Odontologia"],
  [/^ED ?FISICA/, "Educação Física"],
  [/^ENG ?MECANICA/, "Engenharia Mecânica"],
  [/^ENG ?CIVIL/, "Engenharia Civil"],
  [/^ENG ?QUIMICA/, "Engenharia Química"],
  [/^ENG ?AMBIENTAL/, "Engenharia Ambiental"],
  [/^ENG ?ELETRICA/, "Engenharia Elétrica"],
  [/^ENG ?(DE )?PRODUCAO/, "Engenharia de Produção"],
  [/^ENG ?(DE )?SOFTWARE/, "Engenharia de Software"],
  [/^MKT E MIDIAS DIGITAIS/, "Marketing e Mídias Digitais"],

  // Graduação.
  [/MEDICINA VETERINARIA/, "Medicina Veterinária"],
  [/^MEDICINA/, "Medicina"],
  [/^ODONTOLOGIA/, "Odontologia"],
  [/^DIREITO/, "Direito"],
  [/SERVICOS JURIDICOS/, "Serviços Jurídicos e Notariais"],
  [/^PSICOLOGIA/, "Psicologia"],
  [/^BIOMEDICINA/, "Biomedicina"],
  [/^FISIOTERAPIA/, "Fisioterapia"],
  [/^FONOAUDIOLOGIA/, "Fonoaudiologia"],
  [/^ENFERMAGEM/, "Enfermagem"],
  [/^NUTRICAO/, "Nutrição"],
  [/^FARMACIA/, "Farmácia"],
  [/^TERAPIA OCUPACIONAL/, "Terapia Ocupacional"],
  [/^AGRONOMIA/, "Agronomia"],
  [/^PEDAGOGIA/, "Pedagogia"],
  [/^JORNALISMO/, "Jornalismo"],
  [/^ARQUITETURA/, "Arquitetura e Urbanismo"],
  [/EDUCACAO FISICA/, "Educação Física"],
  [/ESTETICA E COSMETICA|^ESTETICA/, "Estética"],
  [/ANALISE E DESENVOLVIMENTO DE SISTEMAS/, "Análise e Desenv. de Sistemas"],
  [/^ENGENHARIA AMBIENTAL/, "Engenharia Ambiental"],
  [/^ENGENHARIA QUIMICA/, "Engenharia Química"],
  [/^ENGENHARIA MECANICA/, "Engenharia Mecânica"],
  [/^ENGENHARIA CIVIL/, "Engenharia Civil"],
  [/^ENGENHARIA ELETRICA/, "Engenharia Elétrica"],
  [/^ENGENHARIA DE PRODUCAO/, "Engenharia de Produção"],
  [/^ENGENHARIA DE SOFTWARE/, "Engenharia de Software"],
  [/^CIENCIA DA COMPUTACAO/, "Ciência da Computação"],
  [/^SISTEMAS DE INFORMACAO/, "Sistemas de Informação"],
  [/^CIENCIAS CONTABEIS/, "Ciências Contábeis"],
  [/^ADMINISTRACAO/, "Administração"],
  [/^TEOLOGIA/, "Teologia"],
  [/PILOTAGEM PROFISSIONAL|^PILOTO/, "Piloto Comercial"],
  [/MARKETING E MIDIAS DIGITAIS/, "Marketing e Mídias Digitais"],
  [/MIDIAS SOCIAIS DIGITAIS/, "Mídias Sociais Digitais"],
  [/INTELIGENCIA ARTIFICIAL/, "Inteligência Artificial"],
  [/SEGURANCA DA INFORMACAO/, "Segurança da Informação"],
  [/GESTAO DE RECURSOS HUMANOS|^RECURSOS HUMANOS/, "Gestão de Recursos Humanos"],
  [/GESTAO FINANCEIRA/, "Gestão Financeira"],
  [/GESTAO PUBLICA/, "Gestão Pública"],
  [/GESTAO COMERCIAL/, "Gestão Comercial"],
  [/GESTAO DA PRODUCAO INDUSTRIAL/, "Gestão da Produção Industrial"],
  [/GESTAO DA TECNOLOGIA DE INFORMACAO/, "Gestão da Tecnologia da Informação"],
  [/GESTAO DO AGRONEGOCIO/, "Gestão do Agronegócio"],
  [/PROCESSOS GERENCIAIS/, "Processos Gerenciais"],
  [/COMERCIO EXTERIOR/, "Comércio Exterior"],
  [/DESIGN DIGITAL/, "Design Digital"],
  [/^LOGISTICA/, "Logística"],
];

export function mapearCurso(curso: string | null | undefined): string {
  // "(EAD)", "CURSO SUPERIOR DE TECNOLOGIA EM", "CST EM" e afins são
  // modalidade e prefixo de catálogo, não identidade do curso.
  const n = normalizar(curso)
    .replace(/\s*\(EAD\)\s*/g, " ")
    .replace(/^CURSO SUPERIOR DE TECNOLOGIA EM /, "")
    .replace(/^SUPERIOR DE TECNOLOGIA EM /, "")
    .replace(/^CST EM /, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!n) return NAO_CLASSIFICADO;
  for (const [padrao, label] of CURSOS) {
    if (padrao.test(n)) return label;
  }
  return NAO_CLASSIFICADO;
}

/**
 * Separa a praça que vem grudada no curso no arquivo diário.
 *
 * Lá o layout é praça-cabeçalho seguida dos cursos, mas linhas como
 * "MEDICINA POA" aparecem soltas, fora do bloco da praça a que pertencem —
 * é o curso de Medicina de Porto Alegre listado à parte. Sem tratar isso, a
 * matrícula vai para a praça do cabeçalho anterior, que é outra.
 */
export function separarPracaDoCurso(rotulo: string | null | undefined): {
  curso: string;
  praca: string | null;
} {
  const n = normalizar(rotulo);
  const palavras = n.split(" ");

  // Testa os sufixos mais longos primeiro: "SANTA MARIA" antes de "MARIA".
  for (let corte = Math.max(1, palavras.length - 3); corte < palavras.length; corte++) {
    const sufixo = palavras.slice(corte).join(" ");
    const praca = APELIDO_PRACA[sufixo];
    if (praca) {
      return { curso: palavras.slice(0, corte).join(" "), praca };
    }
  }
  return { curso: n, praca: null };
}

/**
 * Matrículas e investimento somados por curso ou por praça.
 *
 * O CAC precisa de um investimento próprio, e não do `spend` já agregado do
 * grupo: aquele responde aos filtros de campanha, conjunto e tipo, que a
 * matrícula não acompanha. Aqui entra só gasto de **conversão** no mesmo
 * período, curso e praça — branding fica fora do denominador.
 */
export interface IndiceMatriculas {
  quantidade: Map<string, number>;
  receita: Map<string, number>;
  investimento: Map<string, number>;
}

/** O mínimo que uma linha de mídia precisa ter para entrar no índice. */
export interface LinhaGasto {
  curso: string;
  praca: string;
  spend: number;
}

export function indexarMatriculas(
  matriculas: MatriculaAgregada[],
  gastoConversao: LinhaGasto[],
  por: "curso" | "praca"
): IndiceMatriculas {
  const quantidade = new Map<string, number>();
  const receita = new Map<string, number>();
  const investimento = new Map<string, number>();

  for (const m of matriculas) {
    const k = m[por];
    quantidade.set(k, (quantidade.get(k) ?? 0) + m.quantidade);
    receita.set(k, (receita.get(k) ?? 0) + (m.receita_semestral ?? 0));
  }
  for (const r of gastoConversao) {
    const k = r[por];
    investimento.set(k, (investimento.get(k) ?? 0) + r.spend);
  }

  return { quantidade, receita, investimento };
}

/**
 * Junta linhas soltas na chave (data, praça, curso).
 *
 * Duas unidades podem cair na mesma praça — `CENTRO UNIV. MANAUS/AM` e
 * `ULBRA MEDICINA - MANAUS` são ambas Manaus — então a soma acontece aqui,
 * não no banco.
 */
export function agregarMatriculas(
  linhas: Array<{
    data: string;
    praca: string;
    curso: string;
    quantidade?: number;
    receita_semestral?: number | null;
  }>
): MatriculaAgregada[] {
  const mapa = new Map<string, MatriculaAgregada>();

  for (const l of linhas) {
    const chave = `${l.data}|${l.praca}|${l.curso}`;
    const atual = mapa.get(chave) ?? {
      data: l.data,
      praca: l.praca,
      curso: l.curso,
      quantidade: 0,
      receita_semestral: null,
    };
    atual.quantidade += l.quantidade ?? 1;
    if (l.receita_semestral !== null && l.receita_semestral !== undefined) {
      atual.receita_semestral = (atual.receita_semestral ?? 0) + l.receita_semestral;
    }
    mapa.set(chave, atual);
  }

  return Array.from(mapa.values()).sort(
    (a, b) =>
      a.data.localeCompare(b.data) ||
      a.praca.localeCompare(b.praca, "pt-BR") ||
      a.curso.localeCompare(b.curso, "pt-BR")
  );
}
