import { describe, expect, it } from "vitest";
import { classificarCampanha } from "@/lib/campaign-taxonomy";
import { CURSOS_GENERICOS } from "@/lib/matriz";

/**
 * Os 119 nomes de campanha que a conta da Meta tem de verdade.
 *
 * O lado do Google já tinha essa cobertura (`campanhas-google.test.ts`, 29
 * nomes, 100% do gasto); o da Meta tinha 14 nomes soltos, 5,9% do gasto. As
 * oito campanhas mais caras que faltavam somavam mais de R$ 45 mil, e a
 * família `-video-{apresentador}-matriz-{praça}-{data}-` — R$ 28,4 mil, a
 * maior da conta — não tinha uma asserção sequer.
 *
 * O valor de teste está nas FORMAS de nome, não nos slugs: as formas é que
 * quebram quando alguém mexe no corte do miolo. Cada linha traz o gasto do
 * período de julho e agosto de 2026 em comentário, para que quem quebrar um
 * caso veja de quanto dinheiro está falando.
 *
 * Gerado a partir da base e conferido nome a nome. Campanha nova não precisa
 * entrar aqui — mas se entrar uma FORMA nova, vale acrescentar.
 */
const CAMPANHAS: [nome: string, objetivo: string | null, praca: string, curso: string, kind: string][] = [
  ["2026-2-medicina-video-vitao-matriz-canoas-13agosto-ATIVAR", "OUTCOME_LEADS", "Canoas", "Medicina", "conversao"], // R$ 13926.88
  ["2026-2-medicina-video-kevin-matriz-canoas-13agosto-ATIVAR", "OUTCOME_LEADS", "Canoas", "Medicina", "conversao"], // R$ 8105.56
  ["2026-2-pedagogia-ulbrapop-advplus-01junho-leadsite-ativar", "OUTCOME_LEADS", "Ulbra POP", "Pedagogia", "conversao"], // R$ 7142.50
  ["2026-2-medicina-cards-matriz-canoas-12agosto-ATIVAR", "OUTCOME_LEADS", "Canoas", "Medicina", "conversao"], // R$ 3831.84
  ["2026-2-odonto-brasil-advplus-29maio-leadsite-ativar", "OUTCOME_LEADS", "Brasil", "Odontologia", "conversao"], // R$ 3388.82
  ["2026-2-medvet-canoas-advplus-14abril-leadsite-ativar", "OUTCOME_LEADS", "Canoas", "Medicina Veterinária", "conversao"], // R$ 3225.67
  ["2026-2-ads-ulbrapop-advplus-01junho-leadsite-ativar", "OUTCOME_LEADS", "Ulbra POP", "Análise e Desenv. de Sistemas", "conversao"], // R$ 3123.73
  ["2026-2-medicina-brasil-advplus-29abril-conversao-ativar", "OUTCOME_LEADS", "Brasil", "Medicina", "conversao"], // R$ 2652.96
  ["2026-2-medicina-portoalegre-advplus-29abril-conversao-ativar", "OUTCOME_LEADS", "Porto Alegre", "Medicina", "conversao"], // R$ 2443.38
  ["2026-2-direito-palmas-advplus-30junho-leadsite-ativar", "OUTCOME_LEADS", "Palmas", "Direito", "conversao"], // R$ 2363.44
  ["2026-2-medicina-video-matheus-matriz-canoas-19agosto-ATIVAR", "OUTCOME_LEADS", "Canoas", "Medicina", "conversao"], // R$ 2329.72
  ["2026-2-biomed-canoas-advplus-21julho-leadsite-ativar", "OUTCOME_LEADS", "Canoas", "Biomedicina", "conversao"], // R$ 2260.04
  ["2026-2-terapiaocupacional-canoas-advplus-10agosto-leadsite-ativar", "OUTCOME_LEADS", "Canoas", "Terapia Ocupacional", "conversao"], // R$ 2237.03
  ["2026-2-medicina-remanescentes-saojeronimo-advplus-26maio-conversao-ativar", "OUTCOME_LEADS", "São Jerônimo", "Medicina", "conversao"], // R$ 2235.59
  ["2026-2-cienciascontabeis-ulbrapop-advplus-01junho-leadsite-ativar", "OUTCOME_LEADS", "Ulbra POP", "Ciências Contábeis", "conversao"], // R$ 2182.85
  ["2026-2-engenhariamecanica-ulbrapop-advplus-01junho-leadsite-ativar", "OUTCOME_LEADS", "Ulbra POP", "Engenharia Mecânica", "conversao"], // R$ 2168.72
  ["2026-2-medicina-brasil-advplus-29maio-leadsite-ativar", "OUTCOME_LEADS", "Brasil", "Medicina", "conversao"], // R$ 1950.25
  ["2026-2-psico-canoas-advplus-21julho-leadsite-ativar", "OUTCOME_LEADS", "Canoas", "Psicologia", "conversao"], // R$ 1826.29
  ["2026-2-estetica-canoas-advplus-21julho-leadsite-ativar", "OUTCOME_LEADS", "Canoas", "Estética", "conversao"], // R$ 1795.56
  ["2026-2-geral-brasil-advplus-16abril-videothiago-leadsite-ativar", "OUTCOME_LEADS", "Brasil", "Geral", "conversao"], // R$ 1753.93
  ["2026/2 | RS | Rebranding | 14Abril", "LINK_CLICKS", "Rio Grande do Sul", "Institucional", "branding"], // R$ 1733.23
  ["2026-2-direito-canoas-advplus-21julho-leadsite-ativar", "OUTCOME_LEADS", "Canoas", "Direito", "conversao"], // R$ 1701.75
  ["2026/2 | Brasil | Rebranding | 17Abril", "LINK_CLICKS", "Brasil", "Institucional", "branding"], // R$ 1693.76
  ["2026-2-biomed- carazinho-advplus-21julho-leadsite-ativar", "OUTCOME_LEADS", "Carazinho", "Biomedicina", "conversao"], // R$ 1659.57
  ["2026-2-medicina-remanescentes-gravatai-advplus-26maio-conversao-ativar", "OUTCOME_LEADS", "Gravataí", "Medicina", "conversao"], // R$ 1552.47
  ["2026-2-vestibular-manaus-advplus-19maio-leadsite-ativar", "OUTCOME_LEADS", "Manaus", "Vestibular", "conversao"], // R$ 1527.06
  ["2026-2-fisioterapia-canoas-advplus-21julho-leadsite-ativar", "OUTCOME_LEADS", "Canoas", "Fisioterapia", "conversao"], // R$ 1441.51
  ["2026-2-geral-santa-maria-advplus-14julho-leadsite-ativar", "OUTCOME_LEADS", "Santa Maria", "Geral", "conversao"], // R$ 1332.41
  ["2026-2-medvet-brasil-advplus-10julho-leadsite-ativar", "OUTCOME_LEADS", "Brasil", "Medicina Veterinária", "conversao"], // R$ 1328.90
  ["2026-2-direito-gravatai-advplus-14julho-leadsite-ativar", "OUTCOME_LEADS", "Gravataí", "Direito", "conversao"], // R$ 1307.92
  ["2026-2-medicina-remanescentes-manaus-advplus-26maio-conversao-ativar", "OUTCOME_LEADS", "Manaus", "Medicina", "conversao"], // R$ 1193.32
  ["2026-2-agronomia-palmas-advplus-08julho-leadsite-ativar", "OUTCOME_LEADS", "Palmas", "Agronomia", "conversao"], // R$ 1190.54
  ["2026-2-vestibular-brasil-advplus-19maio-leadsite-ativar", "OUTCOME_LEADS", "Brasil", "Vestibular", "conversao"], // R$ 1142.08
  ["2026-2-psico-canoas-advplus-14abril-leadsite-ativar", "OUTCOME_LEADS", "Canoas", "Psicologia", "conversao"], // R$ 1120.48
  ["2026-2-fisio-palmas-advplus-08julho-leadsite-ativar", "OUTCOME_LEADS", "Palmas", "Fisioterapia", "conversao"], // R$ 1038.69
  ["2026-2-medicina-remanescentes-palmas-advplus-26maio-conversao-ativar", "OUTCOME_LEADS", "Palmas", "Medicina", "conversao"], // R$ 1020.64
  ["2026-2-geral-gravatai-advplus-14julho-leadsite-ativar", "OUTCOME_LEADS", "Gravataí", "Geral", "conversao"], // R$ 1004.77
  ["2026-2-edfisica-ulbrapop-advplus-01junho-leadsite-ativar", "OUTCOME_LEADS", "Ulbra POP", "Educação Física", "conversao"], // R$ 973.69
  ["2026-2-medvet-canoas-advplus-10agosto-leadsite-ativar", "OUTCOME_LEADS", "Canoas", "Medicina Veterinária", "conversao"], // R$ 919.56
  ["2026-2-engenhariamecanica-ulbrapop2-advplus-01junho-leadsite-ativar", "OUTCOME_LEADS", "Ulbra POP", "Engenharia Mecânica", "conversao"], // R$ 919.09
  ["2026-2-vestibular-canoas-advplus-19maio-leadsite-ativar", "OUTCOME_LEADS", "Canoas", "Vestibular", "conversao"], // R$ 905.33
  ["2026-2-medicina-palmas-advplus-10agosto-leadsite-ativar", "OUTCOME_LEADS", "Palmas", "Medicina", "conversao"], // R$ 872.78
  ["2026-2-direito-torres-advplus-21julho-leadsite-ativar", "OUTCOME_LEADS", "Torres", "Direito", "conversao"], // R$ 867.33
  ["2026-2-estetica-brasil-advplus-10julho-leadsite-ativar", "OUTCOME_LEADS", "Brasil", "Estética", "conversao"], // R$ 818.85
  ["2026-2-psicologia- torres-advplus-21julho-leadsite-ativar", "OUTCOME_LEADS", "Torres", "Psicologia", "conversao"], // R$ 798.38
  ["2026-2-odonto-canoas-advplus-10agosto-leadsite-ativar", "OUTCOME_LEADS", "Canoas", "Odontologia", "conversao"], // R$ 744.86
  ["2026-2-direito-guaiba-advplus-24abril-leadsite-ativar", "OUTCOME_LEADS", "Guaíba", "Direito", "conversao"], // R$ 704.07
  ["2026-2-medicina-santarem-advplus-29abril-conversao-ativar", "OUTCOME_LEADS", "Santarém", "Medicina", "conversao"], // R$ 648.97
  ["2026-2-medicina-transferencia-manaus-advplus-10agosto-leadsite-ativar", "OUTCOME_LEADS", "Manaus", "Medicina", "conversao"], // R$ 643.58
  ["2026-2-medvet-itumbiara-advplus-16julho-leadsite-ativar", "OUTCOME_LEADS", "Itumbiara", "Medicina Veterinária", "conversao"], // R$ 632.13
  ["2026-2-medicina-palmas-advplus-29abril-conversao-ativar", "OUTCOME_LEADS", "Palmas", "Medicina", "conversao"], // R$ 626.10
  ["2026-2-direito-guaiba-advplus-13julho-leadsite-ativar", "OUTCOME_LEADS", "Guaíba", "Direito", "conversao"], // R$ 625.17
  ["2026-2-psicologia-cachoeira-do-sul-advplus-21julho-leadsite-ativar", "OUTCOME_LEADS", "Cachoeira do Sul", "Psicologia", "conversao"], // R$ 609.03
  ["2026-2-psico-manaus-advplus-20abril-leadsite-ativar", "OUTCOME_LEADS", "Manaus", "Psicologia", "conversao"], // R$ 607.01
  ["2026-2-direito-sao-jeronimo-advplus-14julho-leadsite-ativar", "OUTCOME_LEADS", "São Jerônimo", "Direito", "conversao"], // R$ 605.68
  ["2026-2-psico-guaiba-advplus-13julho-leadsite-ativar", "OUTCOME_LEADS", "Guaíba", "Psicologia", "conversao"], // R$ 592.01
  ["2026-2-geral-canoas-advplus-10agosto-leadsite-ativar", "OUTCOME_LEADS", "Canoas", "Geral", "conversao"], // R$ 587.02
  ["2026-2-geral-palmas-advplus-08julho-leadsite-ativar", "OUTCOME_LEADS", "Palmas", "Geral", "conversao"], // R$ 560.20
  ["2026-2-psico-brasil-advplus-10julho-leadsite-ativar", "OUTCOME_LEADS", "Brasil", "Psicologia", "conversao"], // R$ 555.05
  ["2026-2-enfermagem-canoas-advplus-21julho-leadsite-ativar", "OUTCOME_LEADS", "Canoas", "Enfermagem", "conversao"], // R$ 505.88
  ["2026-2-geral-sao-jeronimo-advplus-14julho-leadsite-ativar", "OUTCOME_LEADS", "São Jerônimo", "Geral", "conversao"], // R$ 474.81
  ["2026-2-psicologia-gravatai-advplus-14julho-leadsite-ativar", "OUTCOME_LEADS", "Gravataí", "Psicologia", "conversao"], // R$ 468.94
  ["2026-2-geral- carazinho-advplus-21julho-leadsite-ativar", "OUTCOME_LEADS", "Carazinho", "Geral", "conversao"], // R$ 461.18
  ["2026-2-terapiaocupacional-brasil-17agosto-ativar", "OUTCOME_LEADS", "Brasil", "Terapia Ocupacional", "conversao"], // R$ 454.74
  ["2026-2-fisio-canoas-advplus-14abril-leadsite-ativar", "OUTCOME_LEADS", "Canoas", "Fisioterapia", "conversao"], // R$ 444.32
  ["2026-2-enfermagem-cachoeira-do-sul-advplus-21julho-leadsite-ativar", "OUTCOME_LEADS", "Cachoeira do Sul", "Enfermagem", "conversao"], // R$ 430.04
  ["2026-2-biomed-palmas-advplus-08julho-leadsite-ativar", "OUTCOME_LEADS", "Palmas", "Biomedicina", "conversao"], // R$ 420.37
  ["2026-2-transferencia-brasil-advplus-31julho-leadsite-ativar", "OUTCOME_LEADS", "Brasil", "Transferência", "conversao"], // R$ 420.14
  ["2026-2-agronomia-brasil-advplus-10julho-leadsite-ativar", "OUTCOME_LEADS", "Brasil", "Agronomia", "conversao"], // R$ 412.31
  ["2026-2-direito-santa-maria-advplus-14julho-leadsite-ativar", "OUTCOME_LEADS", "Santa Maria", "Direito", "conversao"], // R$ 412.17
  ["2026-2-enfermagem-manaus-advplus-20abril-leadsite-ativar", "OUTCOME_LEADS", "Manaus", "Enfermagem", "conversao"], // R$ 387.79
  ["2026-2-direito-cachoeira-do-sul-advplus-21julho-leadsite-ativar", "OUTCOME_LEADS", "Cachoeira do Sul", "Direito", "conversao"], // R$ 360.73
  ["2026-2-estetica- torres-advplus-21julho-leadsite-ativar", "OUTCOME_LEADS", "Torres", "Estética", "conversao"], // R$ 358.50
  ["2026-2-estetica-palmas-advplus-29abril-leadsite-ativar", "OUTCOME_LEADS", "Palmas", "Estética", "conversao"], // R$ 321.39
  ["2026/2-enfermagem-video-brasil-advplus-17agosto-ATIVAR", "OUTCOME_LEADS", "Brasil", "Enfermagem", "conversao"], // R$ 314.00
  ["2026-2-geral-guaiba-advplus-13julho-leadsite-ativar", "OUTCOME_LEADS", "Guaíba", "Geral", "conversao"], // R$ 313.60
  ["2026-2-psicologia-sao-jeronimo-advplus-14julho-leadsite-ativar", "OUTCOME_LEADS", "São Jerônimo", "Psicologia", "conversao"], // R$ 302.61
  ["2026-2-psico-palmas-advplus-08julho-leadsite-ativar", "OUTCOME_LEADS", "Palmas", "Psicologia", "conversao"], // R$ 297.19
  ["2026-2-enfermagem-manaus-advplus-15julho-leadsite-ativar", "OUTCOME_LEADS", "Manaus", "Enfermagem", "conversao"], // R$ 287.18
  ["2026-2-enfermagem-torres-advplus-21julho-leadsite-ativar", "OUTCOME_LEADS", "Torres", "Enfermagem", "conversao"], // R$ 271.31
  ["2026-2-odonto-brasil-advplus-17agosto-ativar", "OUTCOME_LEADS", "Brasil", "Odontologia", "conversao"], // R$ 256.66
  ["2026-2-engenharia-ambiental-manaus-advplus-16julho-leadsite-ativar", "OUTCOME_LEADS", "Manaus", "Engenharia Ambiental", "conversao"], // R$ 248.54
  ["2026-2-medicina-cards-matriz-canoas-25agosto-ATIVAR", "OUTCOME_LEADS", "Canoas", "Medicina", "conversao"], // R$ 241.83
  ["2026-2-direito- carazinho-advplus-21julho-leadsite-ativar", "OUTCOME_LEADS", "Carazinho", "Direito", "conversao"], // R$ 240.88
  ["2026-2-agronomia-santarem-advplus-21julho-leadsite-ativar", "OUTCOME_LEADS", "Santarém", "Agronomia", "conversao"], // R$ 235.65
  ["2026-2-psico-itumbiara-advplus-29abril-leadsite-ativar", "OUTCOME_LEADS", "Itumbiara", "Psicologia", "conversao"], // R$ 229.32
  ["2026/2 | Santarem | Branding Engajamento  | 17Abril", "OUTCOME_ENGAGEMENT", "Santarém", "Institucional", "branding"], // R$ 229.24
  ["2026-2-direito-manaus-advplus-14julho-leadsite-ativar", "OUTCOME_LEADS", "Manaus", "Direito", "conversao"], // R$ 204.73
  ["2026-2-odonto-brasil-advplus-22abril-leadsite-ativar", "OUTCOME_LEADS", "Brasil", "Odontologia", "conversao"], // R$ 204.31
  ["2026-2-gerais-itumbiara-advplus-16julho-leadsite-ativar", "OUTCOME_LEADS", "Itumbiara", "Geral", "conversao"], // R$ 197.37
  ["2026-2-fisioterapia- torres-advplus-21julho-leadsite-ativar", "OUTCOME_LEADS", "Torres", "Fisioterapia", "conversao"], // R$ 193.45
  ["2026-2-direito-itumbiara-advplus-16julho-leadsite-ativar", "OUTCOME_LEADS", "Itumbiara", "Direito", "conversao"], // R$ 187.70
  ["2026-2-medvet-brasil-advplus-17agosto-ativar", "OUTCOME_LEADS", "Brasil", "Medicina Veterinária", "conversao"], // R$ 173.94
  ["2026-2-enfermagem-palmas-advplus-08julho-leadsite-ativar", "OUTCOME_LEADS", "Palmas", "Enfermagem", "conversao"], // R$ 163.55
  ["2026-2-odonto-palmas-advplus-08julho-leadsite-ativar", "OUTCOME_LEADS", "Palmas", "Odontologia", "conversao"], // R$ 160.40
  ["2026-2-medvet-palmas-advplus-08julho-leadsite-ativar", "OUTCOME_LEADS", "Palmas", "Medicina Veterinária", "conversao"], // R$ 143.62
  ["2026-2-geral-torres-advplus-16abril-carrossel-leadsite-ativar", "OUTCOME_LEADS", "Torres", "Geral", "conversao"], // R$ 138.49
  ["2026-2-engenharia-quimica-manaus-advplus-16julho-leadsite-ativar", "OUTCOME_LEADS", "Manaus", "Engenharia Química", "conversao"], // R$ 110.82
  ["2026-2-direito-santarem-advplus-21julho-leadsite-ativar", "OUTCOME_LEADS", "Santarém", "Direito", "conversao"], // R$ 104.63
  ["2026-2-geral-santarem-advplus-21julho-leadsite-ativar", "OUTCOME_LEADS", "Santarém", "Geral", "conversao"], // R$ 104.18
  ["2026-2-odontologia-cachoeira-do-sul-advplus-21julho-leadsite-ativar", "OUTCOME_LEADS", "Cachoeira do Sul", "Odontologia", "conversao"], // R$ 103.93
  ["2026-2-medicina-manaus-advplus-29abril-conversao-ativar", "OUTCOME_LEADS", "Manaus", "Medicina", "conversao"], // R$ 103.89
  ["2026-2-biomed-santarem-advplus-21julho-leadsite-ativar", "OUTCOME_LEADS", "Santarém", "Biomedicina", "conversao"], // R$ 103.71
  ["2026-1-edfisica-ulbrapop-advplus-09marco-semipresencial-leadsite-ativar", "OUTCOME_LEADS", "Ulbra POP", "Educação Física", "conversao"], // R$ 101.95
  ["2026-2-geral- torres-advplus-21julho-leadsite-ativar", "OUTCOME_LEADS", "Torres", "Geral", "conversao"], // R$ 76.22
  ["2026-2-geral-cachoeira-do-sul-advplus-21julho-leadsite-ativar", "OUTCOME_LEADS", "Cachoeira do Sul", "Geral", "conversao"], // R$ 71.86
  ["2026-2-odontologia- torres-advplus-21julho-leadsite-ativar", "OUTCOME_LEADS", "Torres", "Odontologia", "conversao"], // R$ 70.91
  ["2026-2-fisioterapia-santa-maria-advplus-14julho-leadsite-ativar", "OUTCOME_LEADS", "Santa Maria", "Fisioterapia", "conversao"], // R$ 70.64
  ["2026-2-psico-santamaria-advplus-24abril-leadsite-ativar", "OUTCOME_LEADS", "Santa Maria", "Psicologia", "conversao"], // R$ 56.84
  ["2026-2-psicologia-manaus-advplus-16julho-leadsite-ativar", "OUTCOME_LEADS", "Manaus", "Psicologia", "conversao"], // R$ 49.56
  ["2026-2-biomed-itumbiara-advplus-16julho-leadsite-ativar", "OUTCOME_LEADS", "Itumbiara", "Biomedicina", "conversao"], // R$ 47.30
  ["2026-2-psicologia-itumbiara-advplus-16julho-leadsite-ativar", "OUTCOME_LEADS", "Itumbiara", "Psicologia", "conversao"], // R$ 46.60
  ["2026-2-agronomia-itumbiara-advplus-16julho-leadsite-ativar", "OUTCOME_LEADS", "Itumbiara", "Agronomia", "conversao"], // R$ 46.17
  ["2026/2 | Palmas | Direito | ADV + | 08Julho | LeadSite | ATIVAR", "OUTCOME_LEADS", "Palmas", "Direito", "conversao"], // R$ 0.00
  ["2026/2 | Gravatai | Medicina | ADV+ | 29Abril | Conversão | ATIVAR", "OUTCOME_LEADS", "Gravataí", "Medicina", "conversao"], // R$ 0.00
  ["2026/2 | Itumbiara | MedVet | ADV+ | 29Abril | LeadSite | ATIVAR", "OUTCOME_LEADS", "Itumbiara", "Medicina Veterinária", "conversao"], // R$ 0.00
  ["2026/2 | Itumbiara | Agronomia | ADV+ | 29Abril | LeadSite | ATIVAR", "OUTCOME_LEADS", "Itumbiara", "Agronomia", "conversao"], // R$ 0.00
  ["2026-2-enfermagem-brasil-advplus-29maio-leadsite-ativar", "OUTCOME_LEADS", "Brasil", "Enfermagem", "conversao"], // R$ 0.00
  ["2026/2 | Medicina | Remanescentes | Santarem | ADV+ | 26Maio | Conversão | ATIVAR", "OUTCOME_LEADS", "Santarém", "Medicina", "conversao"], // R$ 0.00
];

describe("campanhas reais da Meta", () => {
  it.each(CAMPANHAS)("%s", (nome, objetivo, praca, curso, kind) => {
    const c = classificarCampanha(nome, objetivo);
    expect({ praca: c.praca, curso: c.curso, kind: c.kind }).toEqual({ praca, curso, kind });
  });

  it("não deixa nenhuma campanha real sem praça nem sem curso", () => {
    const orfas = CAMPANHAS.filter(
      ([, , praca, curso]) => praca === "Não classificado" || curso === "Não classificado"
    );
    expect(orfas.map(([n]) => n)).toEqual([]);
  });
});

/**
 * A praça não pode depender de a data estar no nome.
 *
 * O corte do miolo reconhecia estratégia de lance e data, mas não destino
 * nem status. A família mais cara da Meta —
 * `2026-2-medicina-video-{apresentador}-matriz-{praça}-{data}-ATIVAR`,
 * R$ 28,4 mil — só acertava a praça porque o token `13agosto` estava lá.
 * Tirar a data derrubava R$ 14 mil para "Não classificado", e a linha sumia
 * da matriz sem nenhum aviso na tela.
 *
 * Nenhum destes nomes existe na conta hoje. É exatamente o ponto: eles são
 * a campanha de amanhã, criada por alguém que não sabe que o dashboard
 * depende da data no nome.
 */
describe("praça sobrevive a nome sem data", () => {
  const SEM_DATA: [nome: string, praca: string, curso: string][] = [
    ["2026-2-medicina-canoas-leadsite-ativar", "Canoas", "Medicina"],
    ["2026-2-medicina-video-vitao-matriz-canoas-ativar", "Canoas", "Medicina"],
    ["2026-2-medicina-cards-matriz-canoas-ativar", "Canoas", "Medicina"],
    ["2026-2-geral-canoas-conversao-ativar", "Canoas", "Geral"],
    ["2026-2-direito-palmas-leadsite-pausar", "Palmas", "Direito"],
    ["2026-2-odontologia-torres-conversao-ativar", "Torres", "Odontologia"],
  ];

  it.each(SEM_DATA)("%s", (nome, praca, curso) => {
    const c = classificarCampanha(nome, null);
    expect({ praca: c.praca, curso: c.curso }).toEqual({ praca, curso });
  });

  it("continua achando a praça quando ela vem antes do corte", () => {
    const c = classificarCampanha("2026-2-ulbrapop-cursos-ativar", null);
    expect(c.praca).toBe("Ulbra POP");
  });
});

/**
 * Os rótulos genéricos existem em dois arquivos e precisam concordar.
 *
 * `campaign-taxonomy.ts` decide que "Vestibular" é um curso; `matriz.ts`
 * decide que ele é genérico e não deve ser redistribuído entre cursos
 * reais. Hoje a matriz vence, e é o comportamento certo — mas nada ligava
 * os dois. Removendo a linha de `CURSOS_GENERICOS`, R$ 9.218,87 virariam
 * uma linha de curso fantasma, com CAC contra matrícula que não existe.
 */
describe("rótulos genéricos concordam entre taxonomia e matriz", () => {
  it("todo rótulo genérico produzido pela taxonomia está em CURSOS_GENERICOS", () => {
    const produzidos = new Set(
      CAMPANHAS.map(([, , , curso]) => curso).filter((c) =>
        ["Geral", "Vestibular", "Institucional", "Transferência", "Remanescentes"].includes(c)
      )
    );
    const fora = [...produzidos].filter((c) => !CURSOS_GENERICOS.has(c));
    expect(fora).toEqual([]);
  });

  it("nenhum genérico é nome de curso que alguém possa cursar", () => {
    // Se um destes virar curso de verdade na planilha de matrícula, o
    // cruzamento passa a somar mídia genérica com matrícula real.
    expect([...CURSOS_GENERICOS].sort()).toEqual([
      "Geral",
      "Institucional",
      "Remanescentes",
      "Transferência",
      "Vestibular",
    ]);
  });
});
