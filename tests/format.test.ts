import { describe, expect, it } from "vitest";
import { formatMetric, formatDateBR, isoValido } from "@/lib/format";

describe("formatMetric", () => {
  describe("percentual", () => {
    /**
     * Regressão: o Intl com style "percent" já multiplica por 100, mas o
     * código só dividia quando o valor passava de 1. CTR de anúncio quase
     * sempre fica abaixo disso, então a maioria das linhas da tabela
     * aparecia cem vezes maior — 0,74% virava 74,26%.
     */
    it("trata o valor como pontos percentuais, não como fração", () => {
      expect(formatMetric(0.74, "percent")).toBe("0,74%");
      expect(formatMetric(0.37, "percent")).toBe("0,37%");
    });

    it("não muda de regra ao cruzar 1%", () => {
      expect(formatMetric(0.99, "percent")).toBe("0,99%");
      expect(formatMetric(1.01, "percent")).toBe("1,01%");
      expect(formatMetric(1.76, "percent")).toBe("1,76%");
    });

    it("aceita zero e valores altos", () => {
      expect(formatMetric(0, "percent")).toBe("0,00%");
      expect(formatMetric(100, "percent")).toBe("100,00%");
    });
  });

  describe("moeda", () => {
    it("formata em real brasileiro", () => {
      expect(formatMetric(1234.5, "currency")).toMatch(/1\.234,50/);
      expect(formatMetric(0, "currency")).toMatch(/0,00/);
    });
  });

  describe("número", () => {
    it("agrupa milhar e arredonda", () => {
      expect(formatMetric(1234567, "number")).toBe("1.234.567");
      expect(formatMetric(1234.6, "number")).toBe("1.235");
    });
  });

  describe("ausência de valor", () => {
    it.each([null, undefined, ""])("devolve travessão para %p", (v) => {
      expect(formatMetric(v, "currency")).toBe("—");
    });

    it("devolve travessão para valor não numérico", () => {
      expect(formatMetric("abc", "number")).toBe("—");
    });

    it("não confunde zero com ausência", () => {
      expect(formatMetric(0, "number")).toBe("0");
    });
  });

  it("aceita número em texto", () => {
    expect(formatMetric("0.74", "percent")).toBe("0,74%");
  });
});

describe("formatDateBR", () => {
  it("converte ISO para o formato brasileiro", () => {
    expect(formatDateBR("2026-08-11")).toBe("11/08/2026");
  });

  /** Data ISO interpretada como UTC voltava um dia em fuso negativo. */
  it("não desloca o dia por causa de fuso", () => {
    expect(formatDateBR("2026-01-01")).toBe("01/01/2026");
    expect(formatDateBR("2026-12-31")).toBe("31/12/2026");
  });
});

describe("isoValido", () => {
  it.each(["2026-08-24", "2026-01-01", "2026-12-31", "2024-02-29"])(
    "aceita %s",
    (v) => {
      expect(isoValido(v)).toBe(true);
    }
  );

  /**
   * Sem esta barreira o valor ia cru para o Postgres, que respondia
   * `invalid input syntax for type date` — erro interno do banco devolvido
   * ao cliente como 500, quando é erro de quem chamou.
   */
  it.each(["abc", "", "24/08/2026", "2026-8-24", "2026-08", "2026-08-24T00:00:00"])(
    "recusa %s",
    (v) => {
      expect(isoValido(v)).toBe(false);
    }
  );

  /**
   * `new Date("2026-02-31")` não lança: rola para 3 de março. A comparação
   * com o ISO de volta é o que pega a data que não existe.
   */
  it.each(["2026-02-31", "2026-13-01", "2026-00-10", "2025-02-29"])(
    "recusa a data impossível %s",
    (v) => {
      expect(isoValido(v)).toBe(false);
    }
  );
});
