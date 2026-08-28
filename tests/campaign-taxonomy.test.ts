import { describe, expect, it } from "vitest";
import { classificarCampanha } from "@/lib/campaign-taxonomy";

describe("classificarCampanha", () => {
  describe("formato padrão", () => {
    it("extrai curso e praça", () => {
      const t = classificarCampanha("2026-2-medicina-canoas-advplus-10agosto-leadsite-ativar");
      expect(t.curso).toBe("Medicina");
      expect(t.praca).toBe("Canoas");
      expect(t.kind).toBe("conversao");
    });

    /** Nomes reais têm espaço depois do hífen: "biomed- carazinho". */
    it("tolera espaço em volta do hífen", () => {
      const t = classificarCampanha("2026-2-biomed- carazinho-advplus-21julho-leadsite-ativar");
      expect(t.curso).toBe("Biomedicina");
      expect(t.praca).toBe("Carazinho");
    });

    it.each([
      ["cachoeira-do-sul", "Cachoeira do Sul"],
      ["santa-maria", "Santa Maria"],
      ["sao-jeronimo", "São Jerônimo"],
    ])("reconhece a praça composta %s", (slug, esperado) => {
      expect(classificarCampanha(`2026-2-direito-${slug}-advplus-21julho-leadsite-ativar`).praca).toBe(esperado);
    });

    it.each([
      ["saojeronimo", "São Jerônimo"],
      ["santamaria", "Santa Maria"],
      ["portoalegre", "Porto Alegre"],
    ])("reconhece %s escrito sem hífen", (slug, esperado) => {
      expect(classificarCampanha(`2026-2-psico-${slug}-advplus-24abril-leadsite-ativar`).praca).toBe(esperado);
    });

    it.each([
      ["psico", "Psicologia"],
      ["psicologia", "Psicologia"],
      ["fisio", "Fisioterapia"],
      ["fisioterapia", "Fisioterapia"],
      ["odonto", "Odontologia"],
      ["odontologia", "Odontologia"],
      ["geral", "Geral"],
      ["gerais", "Geral"],
    ])("trata %s como o mesmo curso", (slug, esperado) => {
      expect(classificarCampanha(`2026-2-${slug}-canoas-advplus-21julho-leadsite-ativar`).curso).toBe(esperado);
    });

    it.each([
      ["engenharia-ambiental", "Engenharia Ambiental"],
      ["engenharia-quimica", "Engenharia Química"],
      ["engenhariamecanica", "Engenharia Mecânica"],
      ["terapiaocupacional", "Terapia Ocupacional"],
      ["cienciascontabeis", "Ciências Contábeis"],
    ])("reconhece o curso composto %s", (slug, esperado) => {
      expect(classificarCampanha(`2026-2-${slug}-manaus-advplus-16julho-leadsite-ativar`).curso).toBe(esperado);
    });
  });

  describe("recorte de público", () => {
    it.each([
      ["remanescentes", "Remanescentes"],
      ["transferencia", "Transferência"],
    ])("separa o recorte %s sem perder o curso", (slug, esperado) => {
      const t = classificarCampanha(`2026-2-medicina-${slug}-manaus-advplus-26maio-conversao-ativar`);
      expect(t.curso).toBe("Medicina");
      expect(t.recorte).toBe(esperado);
    });

    /** "transferencia-brasil" não tem curso — o recorte é o próprio assunto. */
    it("classifica a campanha que só tem recorte", () => {
      const t = classificarCampanha("2026-2-transferencia-brasil-advplus-31julho-leadsite-ativar");
      expect(t.praca).toBe("Brasil");
      expect(t.curso).not.toBe("Não classificado");
    });
  });

  describe("branding versus conversão", () => {
    it.each([
      "LINK_CLICKS",
      "OUTCOME_ENGAGEMENT",
      "OUTCOME_AWARENESS",
      "BRAND_AWARENESS",
      "REACH",
    ])("classifica o objetivo %s como branding", (objetivo) => {
      expect(classificarCampanha("2026-2-geral-canoas-advplus-10agosto-leadsite-ativar", objetivo).kind).toBe("branding");
    });

    it("classifica OUTCOME_LEADS como conversão", () => {
      expect(classificarCampanha("2026-2-geral-canoas-advplus-10agosto-leadsite-ativar", "OUTCOME_LEADS").kind).toBe("conversao");
    });

    it("reconhece branding pelo nome quando não há objetivo", () => {
      expect(classificarCampanha("2026/2 | Brasil | Rebranding | 17Abril").kind).toBe("branding");
    });

    it("formato institucional com pipe extrai a praça", () => {
      expect(classificarCampanha("2026/2 | RS | Rebranding | 14Abril").praca).toBe("Rio Grande do Sul");
      expect(classificarCampanha("2026/2 | Brasil | Rebranding | 17Abril").praca).toBe("Brasil");
    });
  });

  describe("entradas degeneradas", () => {
    it.each(["", "   ", "sem-estrutura-nenhuma"])("não quebra com %p", (nome) => {
      const t = classificarCampanha(nome);
      expect(t).toHaveProperty("curso");
      expect(t).toHaveProperty("praca");
      expect(t).toHaveProperty("kind");
    });

    it("aceita objetivo nulo", () => {
      expect(() => classificarCampanha("2026-2-medicina-canoas-advplus", null)).not.toThrow();
    });
  });

  /**
   * Regressão: o backfill de 30 dias trouxe seis campanhas que a taxonomia
   * não cobria, e elas sumiram dos filtros sem qualquer aviso. Esta lista
   * vem dos nomes reais do banco.
   */
  describe("nomes reais que já quebraram", () => {
    it.each([
      "2026-2-engenharia-quimica-manaus-advplus-16julho-leadsite-ativar",
      "2026-2-engenharia-ambiental-manaus-advplus-16julho-leadsite-ativar",
      "2026-2-odontologia- torres-advplus-21julho-leadsite-ativar",
      "2026-2-odontologia-cachoeira-do-sul-advplus-21julho-leadsite-ativar",
      "2026-2-gerais-itumbiara-advplus-16julho-leadsite-ativar",
      "2026-2-psico-santamaria-advplus-24abril-leadsite-ativar",
      "2026-1-edfisica-ulbrapop-advplus-09marco-semipresencial-leadsite-ativar",
      "2026/2 | Santarem | Branding Engajamento  | 17Abril",
      "2026/2 | Palmas | Direito | ADV + | 08Julho | LeadSite | ATIVAR",
    ])("classifica %s", (nome) => {
      const t = classificarCampanha(nome);
      expect(t.curso).not.toBe("Não classificado");
      expect(t.praca).not.toBe("Não classificado");
    });
  });
});

/** Mesmo rotulo que lib/campaign-taxonomy usa para o que nao reconhece. */
const NAO_CLASSIFICADO = "Não classificado";

describe("entrada suja", () => {
  // Regressao: 37 linhas com campaign_name nulo derrubaram o dashboard
  // inteiro com "Cannot read properties of null (reading 'toLowerCase')".
  // Toda consulta cujo periodo incluisse aquele dia devolvia 500.
  it.each([null, undefined, ""])("nao estoura com %p", (entrada) => {
    const t = classificarCampanha(entrada as unknown as string);
    expect(t.curso).toBe(NAO_CLASSIFICADO);
    expect(t.praca).toBe(NAO_CLASSIFICADO);
    expect(t.kind).toBe("conversao");
    expect(t.recorte).toBeNull();
  });

  it("uma linha suja no meio nao contamina as demais", () => {
    const nomes = [
      "2026-2-medicina-canoas-advplus-10agosto-leadsite-ativar",
      null,
      "2026-2-odonto-torres-advplus-10agosto-leadsite-ativar",
    ];
    const r = nomes.map((n) => classificarCampanha(n as unknown as string));
    expect(r.map((x) => x.curso)).toEqual([
      "Medicina",
      NAO_CLASSIFICADO,
      "Odontologia",
    ]);
  });
});
