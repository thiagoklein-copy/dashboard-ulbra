import { describe, expect, it } from "vitest";
import { classificarCampanha } from "@/lib/campaign-taxonomy";
import {
  agregarMatriculas,
  indexarMatriculas,
  mapearCurso,
  mapearPraca,
  separarPracaDoCurso,
  NAO_CLASSIFICADO,
} from "@/lib/matriculas";

describe("mapearPraca", () => {
  it.each([
    ["CAMPUS CANOAS", "Canoas"],
    ["ULBRA POP", "Ulbra POP"],
    ["CENTRO UNIV. PALMAS/TO", "Palmas"],
    ["CENTRO UNIV. SANTAREM/PA", "Santarém"],
    ["ILES ITUMBIARA/GO", "Itumbiara"],
    ["CAMPUS GRAVATAI II", "Gravataí"],
    ["CAMPUS SAO JERONIMO", "São Jerônimo"],
  ])("mapeia a unidade %s", (unidade, esperado) => {
    expect(mapearPraca(unidade)).toBe(esperado);
  });

  /**
   * `ULBRA MEDICINA - X` é o curso de Medicina de X, não uma praça própria.
   * Se não colapsasse, o gasto de Medicina/Palmas ficaria numa praça e as
   * matrículas dele em outra, e o CAC daria infinito dos dois lados.
   */
  it.each([
    ["ULBRA MEDICINA - POA", "Porto Alegre"],
    ["ULBRA MEDICINA - MANAUS", "Manaus"],
    ["ULBRA MEDICINA - PALMAS", "Palmas"],
    ["ULBRA MEDICINA - GRAVATAÍ", "Gravataí"],
    ["ULBRA MEDICINA - SAJ", "São Jerônimo"],
  ])("colapsa %s na praça correspondente", (unidade, esperado) => {
    expect(mapearPraca(unidade)).toBe(esperado);
  });

  /** O arquivo diário escreve só o apelido da praça. */
  it.each([
    ["CANOAS", "Canoas"],
    ["SANTA MARIA", "Santa Maria"],
    ["SANTARÉM", "Santarém"],
    ["GRAVATAÍ", "Gravataí"],
  ])("aceita o apelido %s do arquivo diário", (apelido, esperado) => {
    expect(mapearPraca(apelido)).toBe(esperado);
  });

  it("devolve não classificado para unidade desconhecida", () => {
    expect(mapearPraca("CAMPUS INVENTADO")).toBe(NAO_CLASSIFICADO);
    expect(mapearPraca(null)).toBe(NAO_CLASSIFICADO);
  });
});

describe("mapearCurso", () => {
  /**
   * Turno é recorte do mesmo curso. Foi assim que a planilha de análise
   * chegou nos 276 de Direito e nos 125 de Psicologia — separá-los partiria
   * cada curso em três linhas de CAC sem sentido.
   */
  it.each([
    ["DIREITO", "Direito"],
    ["DIREITO DIURNO", "Direito"],
    ["DIREITO NOTURNO", "Direito"],
    ["PSICOLOGIA", "Psicologia"],
    ["PSICOLOGIA - NOTURNO", "Psicologia"],
    ["ENFERMAGEM NOT", "Enfermagem"],
    ["ODONTOLOGIA INT/NOT", "Odontologia"],
    ["ENGENHARIA MECÂNICA COM ÊNFASE EM AUTOMOTIVA", "Engenharia Mecânica"],
  ])("colapsa o turno em %s", (bruto, esperado) => {
    expect(mapearCurso(bruto)).toBe(esperado);
  });

  /** "MEDICINA VETERINÁRIA" não pode cair na regra de "MEDICINA". */
  it("casa medicina veterinária antes de medicina", () => {
    expect(mapearCurso("MEDICINA VETERINÁRIA INT/NOT")).toBe("Medicina Veterinária");
    expect(mapearCurso("MEDICINA")).toBe("Medicina");
  });

  it.each([
    ["CURSO SUPERIOR DE TECNOLOGIA EM ANALISE E DESENVOLVIMENTO DE SISTEMAS", "Análise e Desenv. de Sistemas"],
    ["SUPERIOR DE TECNOLOGIA EM LOGISTICA (EAD)", "Logística"],
    ["CST EM MARKETING E MÍDIAS DIGITAIS", "Marketing e Mídias Digitais"],
    ["ADMINISTRAÇÃO (EAD)", "Administração"],
  ])("descarta prefixo de catálogo e modalidade em %s", (bruto, esperado) => {
    expect(mapearCurso(bruto)).toBe(esperado);
  });

  /** Ponto final sobrando e acento faltando aparecem na base real. */
  it.each([
    ["ODONTOLOGIA.", "Odontologia"],
    ["ENFERMAGEM.", "Enfermagem"],
    ["CIENCIAS CONTABEIS", "Ciências Contábeis"],
    ["CIÊNCIAS CONTÁBEIS", "Ciências Contábeis"],
    ["EDUCACAO FISICA - BACHARELADO", "Educação Física"],
    ["EDUCAÇÃO FÍSICA - LICENCIATURA", "Educação Física"],
  ])("tolera a sujeira de %s", (bruto, esperado) => {
    expect(mapearCurso(bruto)).toBe(esperado);
  });

  /** Abreviações do arquivo diário e dos nomes de campanha. */
  it.each([
    ["ADS", "Análise e Desenv. de Sistemas"],
    ["ENG MECANICA", "Engenharia Mecânica"],
    ["ENG CIVIL", "Engenharia Civil"],
    ["ED FISICA - BACHARELADO", "Educação Física"],
    ["MKT E MIDIAS DIGITAIS", "Marketing e Mídias Digitais"],
    ["BIOMED", "Biomedicina"],
    ["MEDVET", "Medicina Veterinária"],
  ])("entende a abreviação %s", (bruto, esperado) => {
    expect(mapearCurso(bruto)).toBe(esperado);
  });

  /**
   * Pós e MBA não têm campanha. Deixá-los virar curso encheria os filtros de
   * linhas com matrícula e zero investimento.
   */
  it.each([
    "MBA INTELIGÊNCIA DE NEGÓCIOS",
    "MBE EM ENGENHARIA DE PRODUÇÃO",
    "NEUROPSICOPEDAGOGIA EDUCACIONAL",
    "GESTÃO ESTRATÉGICA DE PESSOAS",
    "PSICOLOGIA ORGANIZACIONAL ESTRATÉGICA: GESTÃO DE TALENTOS",
    "DIREITO IMOBILIÁRIO, URBANÍSTICO E PLANEJAMENTO URBANO",
  ])("manda %s para não classificado", (bruto) => {
    expect(mapearCurso(bruto)).toBe(NAO_CLASSIFICADO);
  });

  /**
   * A planilha de análise conta Serviços Jurídicos separado de Direito — os
   * 276 de Direito não incluem os 22 dele. Fundir os dois quebraria a
   * conferência contra ela.
   */
  it("mantém serviços jurídicos separado de direito", () => {
    expect(mapearCurso("SUPERIOR DE TECNOLOGIA EM SERVIÇOS JURÍDICOS E NOTARIAIS")).toBe(
      "Serviços Jurídicos e Notariais"
    );
  });

  it("devolve não classificado para vazio", () => {
    expect(mapearCurso("")).toBe(NAO_CLASSIFICADO);
    expect(mapearCurso(null)).toBe(NAO_CLASSIFICADO);
  });
});

/**
 * O rótulo precisa ser idêntico ao de `campaign-taxonomy.ts`: os dois
 * alimentam o mesmo filtro de curso. Se descolarem, "Não classificado"
 * aparece duas vezes na lista e cada um filtra metade das linhas.
 */
describe("rótulo compartilhado com a taxonomia de campanha", () => {
  it("usa exatamente o mesmo texto", () => {
    expect(NAO_CLASSIFICADO).toBe(classificarCampanha(null).curso);
    expect(NAO_CLASSIFICADO).toBe(classificarCampanha(null).praca);
  });

  /** Curso vindo da campanha e vindo da matrícula têm que ser o mesmo. */
  it.each([
    ["2026-2-medicina-canoas-advplus-10agosto-leadsite-ativar", "MEDICINA"],
    ["2026-2-biomed-carazinho-advplus-21julho-leadsite-ativar", "BIOMEDICINA"],
    ["2026-2-ads-ulbrapop-advplus-21julho-leadsite-ativar", "CURSO SUPERIOR DE TECNOLOGIA EM ANALISE E DESENVOLVIMENTO DE SISTEMAS"],
    ["2026-2-terapiaocupacional-canoas-advplus-21julho-leadsite-ativar", "TERAPIA OCUPACIONAL"],
  ])("casa o curso de %s com o da matrícula", (campanha, matricula) => {
    expect(mapearCurso(matricula)).toBe(classificarCampanha(campanha).curso);
  });
});

describe("separarPracaDoCurso", () => {
  /**
   * No arquivo diário "MEDICINA POA" vem solta, fora do bloco da praça a que
   * pertence. Sem separar, essa matrícula entraria na praça do cabeçalho
   * anterior — que é outra.
   */
  it("extrai a praça grudada no rótulo", () => {
    expect(separarPracaDoCurso("MEDICINA POA")).toEqual({
      curso: "MEDICINA",
      praca: "Porto Alegre",
    });
  });

  it("prefere o sufixo composto ao simples", () => {
    expect(separarPracaDoCurso("DIREITO SANTA MARIA").praca).toBe("Santa Maria");
  });

  it("devolve praça nula quando não há sufixo de praça", () => {
    expect(separarPracaDoCurso("MEDICINA")).toEqual({ curso: "MEDICINA", praca: null });
  });
});

describe("agregarMatriculas", () => {
  /**
   * `CENTRO UNIV. MANAUS/AM` e `ULBRA MEDICINA - MANAUS` viram a mesma praça,
   * então chegam aqui como duas linhas do mesmo grupo.
   */
  it("soma linhas que caem na mesma chave", () => {
    const r = agregarMatriculas([
      { data: "2026-08-24", praca: "Manaus", curso: "Medicina", quantidade: 3, receita_semestral: 300 },
      { data: "2026-08-24", praca: "Manaus", curso: "Medicina", quantidade: 2, receita_semestral: 200 },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].quantidade).toBe(5);
    expect(r[0].receita_semestral).toBe(500);
  });

  it("conta uma matrícula por linha quando não vem quantidade", () => {
    const r = agregarMatriculas([
      { data: "2026-08-24", praca: "Canoas", curso: "Direito" },
      { data: "2026-08-24", praca: "Canoas", curso: "Direito" },
    ]);
    expect(r[0].quantidade).toBe(2);
  });

  /**
   * O arquivo diário só traz contagem. Receita nula tem que continuar nula —
   * virar zero faria o dashboard mostrar "R$ 0 de receita" como se fosse
   * medido, quando ninguém mediu.
   */
  it("preserva receita nula em vez de zerar", () => {
    const r = agregarMatriculas([
      { data: "2026-08-25", praca: "Canoas", curso: "Direito", quantidade: 1, receita_semestral: null },
    ]);
    expect(r[0].receita_semestral).toBeNull();
  });

  it("separa grupos por dia, praça e curso", () => {
    const r = agregarMatriculas([
      { data: "2026-08-24", praca: "Canoas", curso: "Direito" },
      { data: "2026-08-25", praca: "Canoas", curso: "Direito" },
      { data: "2026-08-24", praca: "Torres", curso: "Direito" },
      { data: "2026-08-24", praca: "Canoas", curso: "Medicina" },
    ]);
    expect(r).toHaveLength(4);
  });

  it("ordena por data, praça e curso", () => {
    const r = agregarMatriculas([
      { data: "2026-08-25", praca: "Canoas", curso: "Direito" },
      { data: "2026-08-24", praca: "Torres", curso: "Direito" },
      { data: "2026-08-24", praca: "Canoas", curso: "Medicina" },
    ]);
    expect(r.map((x) => `${x.data} ${x.praca} ${x.curso}`)).toEqual([
      "2026-08-24 Canoas Medicina",
      "2026-08-24 Torres Direito",
      "2026-08-25 Canoas Direito",
    ]);
  });
});

describe("indexarMatriculas", () => {
  const matriculas = [
    { data: "2026-08-24", praca: "Canoas", curso: "Direito", quantidade: 4, receita_semestral: 4000 },
    { data: "2026-08-24", praca: "Torres", curso: "Direito", quantidade: 1, receita_semestral: 900 },
    { data: "2026-08-24", praca: "Canoas", curso: "Medicina", quantidade: 2, receita_semestral: null },
  ];
  const gasto = [
    { praca: "Canoas", curso: "Direito", spend: 200 },
    { praca: "Torres", curso: "Direito", spend: 100 },
    { praca: "Canoas", curso: "Medicina", spend: 500 },
  ];

  it("soma por curso", () => {
    const i = indexarMatriculas(matriculas, gasto, "curso");
    expect(i.quantidade.get("Direito")).toBe(5);
    expect(i.receita.get("Direito")).toBe(4900);
    expect(i.investimento.get("Direito")).toBe(300);
  });

  it("soma por praça", () => {
    const i = indexarMatriculas(matriculas, gasto, "praca");
    expect(i.quantidade.get("Canoas")).toBe(6);
    expect(i.investimento.get("Canoas")).toBe(700);
  });

  /** Receita nula não pode virar zero somado — some da conta, e pronto. */
  it("ignora receita nula na soma", () => {
    const i = indexarMatriculas(matriculas, gasto, "curso");
    expect(i.receita.get("Medicina")).toBe(0);
    expect(i.quantidade.get("Medicina")).toBe(2);
  });

  it("deixa o grupo sem mídia fora do investimento", () => {
    const i = indexarMatriculas(
      [{ data: "2026-08-24", praca: "Canoas", curso: "Teologia", quantidade: 3, receita_semestral: null }],
      [],
      "curso"
    );
    expect(i.quantidade.get("Teologia")).toBe(3);
    expect(i.investimento.get("Teologia")).toBeUndefined();
  });
});
