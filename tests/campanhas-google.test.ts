import { describe, expect, it } from "vitest";
import { classificarCampanha } from "@/lib/campaign-taxonomy";

/**
 * Nomes reais de campanha das duas contas do Google, de julho de 2026 em
 * diante — o recorte que o dashboard vai ingerir.
 *
 * Existem três convenções convivendo, e nenhuma é a da Meta:
 *
 *   Meta     2026-2-{curso}-{praça}-advplus-...     praça no FIM
 *   Google   2026-2-{praça}-{curso}-pmax-...        praça no COMEÇO
 *   Google   2025/02 | ... | {praça} | {curso} | Pesquisa | ...
 *
 * Antes de tratar isso, 37 de 61 nomes caíam em "Não classificado" — R$ 41
 * mil de investimento que sumiriam da análise mesmo depois de gravados no
 * banco. Este arquivo é a rede de segurança: campanha nova com nome fora do
 * padrão quebra o teste em vez de sumir calada.
 *
 * VIDEO (channel 6) é o equivalente de branding no Google; o resto é
 * conversão. É assim que o ingestor traduz `channel_type` em `objective`.
 */
const BRANDING = "OUTCOME_AWARENESS";
const CONVERSAO = "OUTCOME_LEADS";

const CONTA_ULBRA: [nome: string, objetivo: string, curso: string, praca: string][] = [
  ["2026-2-brasil-vestibular-pmax-9agosto-ativar", CONVERSAO, "Vestibular", "Brasil"],
  ["2026-2-brasil-2graduacao-pmax-29janeiro-ativar", CONVERSAO, "Geral", "Brasil"],
  ["2025-2-brasil-transferencia-pmax-21marco-ativar", CONVERSAO, "Transferência", "Brasil"],
  ["2026-2- brasil-enem-pmax-29julho-ativar", CONVERSAO, "Geral", "Brasil"],
  ["2026-2-canoas-geral-pmax-28julho-ativar", CONVERSAO, "Geral", "Canoas"],
  ["2026-2-brasil-medicina-pmax-13julho-ativar", CONVERSAO, "Medicina", "Brasil"],
  ["2026-2-medicina-canoas-pesquisa-matriz-14agosto-ativar", CONVERSAO, "Medicina", "Canoas"],
  ["2025-2-gravatai-medicina-pmax-25julho-ativar", CONVERSAO, "Medicina", "Gravataí"],
  ["2025-2-portoalegre-medicina-pmax-22julho-ativar", CONVERSAO, "Medicina", "Porto Alegre"],
  ["2025-2-manaus-medicina-pmax-23marco-ativar", CONVERSAO, "Medicina", "Manaus"],
  ["2026-2-palmas-medicina-pmax-19maio-ativar", CONVERSAO, "Medicina", "Palmas"],
  ["2025/02 | Graduacao Presencial | Manaus | Cursos | Pesquisa | 01/abr ATIVAR", CONVERSAO, "Geral", "Manaus"],
  ["2025/02 | Graduacao Presencial | Palmas | Cursos | Pesquisa | 01/abr ATIVAR", CONVERSAO, "Geral", "Palmas"],
  ["2025/02 | Graduacao Presencial | Canoas | Cursos | Pesquisa | 28/mar ATIVAR", CONVERSAO, "Geral", "Canoas"],
  ["2025/02 | Graduacao Presencial | Medicina | Sao Jeronimo | PMAX | 25julho ATIVAR", CONVERSAO, "Medicina", "São Jerônimo"],
  ["2026/02 l Gravatai | Geral | PMAX | 17Abril ATIVAR", CONVERSAO, "Geral", "Gravataí"],
  ["2026/02 l Torres | Geral | PMAX | 17Abril ATIVAR", CONVERSAO, "Geral", "Torres"],
  ["2026/02 l Cursos | Geral | Geração de Demanda | 02Junho ATIVAR", CONVERSAO, "Geral", "Brasil"],
  ["2026-1-brasil-rebranding-reconhecimento-28maio", BRANDING, "Institucional", "Brasil"],
  ["2026-1-brasil-branding-professorguerra-reconhecimento-05fevereiro", BRANDING, "Institucional", "Brasil"],
  ["2026-2-docpalmas-ytb-31julho-branding", BRANDING, "Institucional", "Palmas"],
  ["2026-2-branding-palmas-10agosto", BRANDING, "Institucional", "Palmas"],
  ["2026-1-ytb-docpalmas-03agosto-branding", BRANDING, "Institucional", "Palmas"],
];

/** Conta Ulbra Pop - EAD: toda campanha é captação ampla, sem curso. */
const CONTA_EAD: [nome: string, objetivo: string, curso: string, praca: string][] = [
  ["2025-2-ulbrapop-geral2-pmax-10abril-ativar", CONVERSAO, "Geral", "Ulbra POP"],
  ["2025-2-ulbrapop-geral2-pesquisa-10abril-ativar", CONVERSAO, "Geral", "Ulbra POP"],
  ["2025-2-ulbrapop-geral-pesquisa-10abril-ativar", CONVERSAO, "Geral", "Ulbra POP"],
  ["2025-2-ulbrapop-geral-pmax-10abril-ativar", CONVERSAO, "Geral", "Ulbra POP"],
  ["2026-2-ulbrapop-cursos-pesquisa-02junho-ativar", CONVERSAO, "Geral", "Ulbra POP"],
  ["2026-2-online-geral-11agosto", CONVERSAO, "Geral", "Ulbra POP"],
];

describe("campanhas reais do Google", () => {
  it.each([...CONTA_ULBRA, ...CONTA_EAD])(
    "classifica %s",
    (nome, objetivo, curso, praca) => {
      const t = classificarCampanha(nome, objetivo);
      expect({ curso: t.curso, praca: t.praca }).toEqual({ curso, praca });
    }
  );

  /**
   * O que mais importa: nenhuma pode cair em "Não classificado". Ali o gasto
   * fica fora do rateio e some da matriz — o mesmo buraco de R$ 41 mil que
   * motivou este arquivo.
   */
  it("não deixa nenhuma campanha sem classificação", () => {
    const orfas = [...CONTA_ULBRA, ...CONTA_EAD]
      .map(([nome, objetivo]) => ({ nome, ...classificarCampanha(nome, objetivo) }))
      .filter((t) => t.curso === "Não classificado" || t.praca === "Não classificado");
    expect(orfas).toEqual([]);
  });
});

/**
 * A praça pode estar nas duas pontas do nome. Só olhar o fim era o que
 * derrubava a conta inteira do EAD.
 */
describe("praça em qualquer ponta", () => {
  it.each([
    ["2026-2-geral-canoas-advplus-14julho-leadsite-ativar", "Canoas"],
    ["2026-2-canoas-geral-pmax-28julho-ativar", "Canoas"],
    ["2025-2-ulbrapop-geral-pmax-10abril-ativar", "Ulbra POP"],
    ["2026-2-medicina-manaus-advplus-10agosto-leadsite-ativar", "Manaus"],
    ["2025-2-manaus-medicina-pmax-23marco-ativar", "Manaus"],
  ])("acha a praça em %s", (nome, esperado) => {
    expect(classificarCampanha(nome, "OUTCOME_LEADS").praca).toBe(esperado);
  });
});

/**
 * "cu**rs**os" casava com o slug "rs" na busca frouxa por `includes`, e toda
 * campanha com a palavra "Cursos" no nome ia parar em Rio Grande do Sul.
 */
describe("casamento de praça respeita fronteira", () => {
  it("não confunde 'Cursos' com a praça 'rs'", () => {
    const t = classificarCampanha(
      "2025/02 | Graduacao Presencial | Manaus | Cursos | Pesquisa | 01/abr ATIVAR",
      "OUTCOME_LEADS"
    );
    expect(t.praca).toBe("Manaus");
  });
});
