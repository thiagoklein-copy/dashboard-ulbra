import { describe, expect, it } from "vitest";
import { montarMatriz, redistribuirNacional, type LinhaConversao } from "@/lib/matriz";
import type { MatriculaAgregada } from "@/lib/matriculas";

const m = (
  praca: string,
  curso: string,
  quantidade: number,
  receita_semestral: number | null = null
): MatriculaAgregada => ({
  data: "2026-08-01",
  praca,
  curso,
  quantidade,
  receita_semestral,
});

const c = (
  praca: string,
  curso: string,
  spend: number,
  results: number
): LinhaConversao => ({ praca, curso, spend, results });

describe("montarMatriz", () => {
  describe("eixos", () => {
    const matriculas = [m("Canoas", "Direito", 4), m("Torres", "Direito", 2)];
    const gasto = [c("Canoas", "Direito", 200, 50), c("Torres", "Direito", 100, 20)];

    it("separa cada par no eixo praça × curso", () => {
      const r = montarMatriz(matriculas, gasto, "praca-curso");
      expect(r).toHaveLength(2);
      expect(r.map((i) => `${i.praca}/${i.curso}`).sort()).toEqual([
        "Canoas/Direito",
        "Torres/Direito",
      ]);
    });

    it("junta as praças no eixo curso e deixa a praça vazia", () => {
      const r = montarMatriz(matriculas, gasto, "curso");
      expect(r).toHaveLength(1);
      expect(r[0].curso).toBe("Direito");
      expect(r[0].praca).toBe("");
      expect(r[0].matriculas).toBe(6);
      expect(r[0].investimento).toBe(300);
    });

    it("junta os cursos no eixo praça e deixa o curso vazio", () => {
      const r = montarMatriz(matriculas, gasto, "praca");
      expect(r).toHaveLength(2);
      expect(r.every((i) => i.curso === "")).toBe(true);
    });
  });

  describe("indicadores", () => {
    it("calcula CPL, CAC, ROI e conversão", () => {
      const r = montarMatriz(
        [m("Canoas", "Direito", 5, 50000)],
        [c("Canoas", "Direito", 1000, 100)],
        "praca-curso"
      );
      expect(r[0].cpl).toBe(10); // 1000 / 100 leads
      expect(r[0].cac).toBe(200); // 1000 / 5 matrículas
      expect(r[0].roi).toBe(50); // 50000 / 1000
      expect(r[0].taxaConversao).toBe(5); // 5 de 100 leads
    });

    it("soma linhas repetidas do mesmo grupo", () => {
      const r = montarMatriz(
        [m("Canoas", "Direito", 2, 100), m("Canoas", "Direito", 3, 200)],
        [c("Canoas", "Direito", 60, 10), c("Canoas", "Direito", 40, 15)],
        "praca-curso"
      );
      expect(r[0].matriculas).toBe(5);
      expect(r[0].receita).toBe(300);
      expect(r[0].investimento).toBe(100);
      expect(r[0].leads).toBe(25);
    });
  });

  describe("recortes sem os dois lados", () => {
    /**
     * Administração fez 64 matrículas em julho e agosto sem um real de mídia.
     * Se a linha só nascesse de gasto, essa captação orgânica sumiria da
     * tabela enquanto continuaria contada no total do card.
     */
    it("inclui grupo com matrícula e nenhuma mídia", () => {
      const r = montarMatriz([m("Ulbra POP", "Administração", 64, 9000)], [], "praca-curso");
      expect(r).toHaveLength(1);
      expect(r[0].matriculas).toBe(64);
      expect(r[0].investimento).toBe(0);
    });

    /**
     * Zero em CAC e ROI aqui significa "não dá para calcular", não "custou
     * nada" — quem formata decide mostrar traço. O cálculo não pode devolver
     * Infinity nem NaN.
     */
    it("devolve zero em vez de dividir por zero", () => {
      const r = montarMatriz([m("Ulbra POP", "Administração", 64, 9000)], [], "praca-curso");
      expect(r[0].cac).toBe(0);
      expect(r[0].roi).toBe(0);
      expect(r[0].cpl).toBe(0);
      expect(r[0].taxaConversao).toBe(0);
      expect(Number.isFinite(r[0].cac)).toBe(true);
    });

    /**
     * O caso "Brasil": campanha nacional gasta e os leads dela viram
     * matrícula creditada à praça do campus. A linha fica com gasto e zero
     * matrícula, e é isso que a tela precisa poder destacar.
     */
    it("mantém grupo com mídia e nenhuma matrícula", () => {
      const r = montarMatriz([], [c("Brasil", "Medicina", 4160, 511)], "praca-curso");
      expect(r).toHaveLength(1);
      expect(r[0].investimento).toBe(4160);
      expect(r[0].matriculas).toBe(0);
      expect(r[0].cac).toBe(0);
      expect(r[0].taxaConversao).toBe(0);
    });

    it("ignora receita nula sem quebrar a soma", () => {
      const r = montarMatriz(
        [m("Canoas", "Direito", 2, null), m("Canoas", "Direito", 1, 500)],
        [c("Canoas", "Direito", 100, 10)],
        "praca-curso"
      );
      expect(r[0].matriculas).toBe(3);
      expect(r[0].receita).toBe(500);
    });
  });

  it("ordena pelo maior investimento", () => {
    const r = montarMatriz(
      [],
      [c("A", "x", 10, 1), c("B", "y", 300, 1), c("C", "z", 100, 1)],
      "praca-curso"
    );
    expect(r.map((i) => i.investimento)).toEqual([300, 100, 10]);
  });

  /** Sem gasto e sem matrícula não existe linha para desempatar por dinheiro. */
  it("desempata pelo número de matrículas quando não há investimento", () => {
    const r = montarMatriz(
      [m("A", "x", 1), m("B", "y", 9)],
      [],
      "praca-curso"
    );
    expect(r[0].matriculas).toBe(9);
  });

  it("devolve lista vazia sem entrada nenhuma", () => {
    expect(montarMatriz([], [], "praca-curso")).toEqual([]);
  });
});

describe("redistribuirNacional", () => {
  const nac = (curso: string, spend: number, results: number) =>
    c("Brasil", curso, spend, results);

  it("divide o gasto nacional entre as praças do curso", () => {
    const r = redistribuirNacional(
      [nac("Medicina", 900, 90), c("Canoas", "Medicina", 100, 10), c("Palmas", "Medicina", 50, 5), c("Manaus", "Medicina", 20, 2)],
      []
    );
    const porPraca = montarMatriz([], r, "praca");
    const canoas = porPraca.find((i) => i.praca === "Canoas")!;
    expect(canoas.investimento).toBe(400); // 100 próprio + 900/3
    expect(canoas.leads).toBe(40); // 10 próprio + 90/3
    expect(porPraca.find((i) => i.praca === "Brasil")).toBeUndefined();
  });

  /** Leads acompanham o gasto: separá-los distorceria o CPL de quem recebe. */
  it("reparte leads na mesma proporção do gasto", () => {
    const r = redistribuirNacional(
      [nac("Direito", 200, 100), c("Canoas", "Direito", 0, 0), c("Torres", "Direito", 0, 0)],
      []
    );
    const linhas = montarMatriz([], r, "praca-curso");
    expect(linhas.every((i) => i.cpl === 2)).toBe(true);
  });

  /** Praça que só aparece na base de matrículas também é destino válido. */
  it("aceita como destino a praça que só tem matrícula", () => {
    const r = redistribuirNacional(
      [nac("Odontologia", 100, 10)],
      [m("Torres", "Odontologia", 5), m("Canoas", "Odontologia", 3)]
    );
    const porPraca = montarMatriz([], r, "praca");
    expect(porPraca.map((i) => i.praca).sort()).toEqual(["Canoas", "Torres"]);
    // 5 e 3 matrículas de 8: 62,5% e 37,5% do gasto.
    expect(porPraca.find((i) => i.praca === "Torres")!.investimento).toBe(62.5);
    expect(porPraca.find((i) => i.praca === "Canoas")!.investimento).toBe(37.5);
  });




  /**
   * Curso real que nenhuma praça oferece não tem para onde ir — sumir com o
   * gasto seria pior que deixá-lo visível numa linha nacional.
   *
   * O caso usa um curso NÃO genérico de propósito. Com "Transferência" o
   * teste passava por acidente: ele está em `CURSOS_GENERICOS`, e só ficava
   * em Brasil porque o fixture não tinha nenhuma outra linha para formar o
   * universo de praças. Bastava uma segunda linha para ele ser espalhado, e
   * o teste continuaria verde afirmando o contrário.
   */
  it("mantém em Brasil o curso real sem nenhuma praça de destino", () => {
    const r = redistribuirNacional(
      [nac("Odontologia", 420, 93), c("Canoas", "Direito", 100, 10)],
      [m("Canoas", "Direito", 5)]
    );
    const brasil = r.filter((l) => l.praca === "Brasil");
    expect(brasil).toHaveLength(1);
    expect(brasil[0].curso).toBe("Odontologia");
    expect(brasil[0].spend).toBe(420);
  });

  /**
   * Genérico é o oposto: ele SEMPRE se espalha, mantendo o rótulo.
   *
   * "Brasil/Transferência" vira "Canoas/Transferência" e
   * "Torres/Transferência" — não fica em Brasil. O peso é o total de
   * matrículas da praça, porque matrícula nenhuma se chama "Transferência".
   */
  it("espalha curso genérico por todas as praças, sem deixar resto em Brasil", () => {
    const r = redistribuirNacional(
      [nac("Transferência", 300, 90), c("Canoas", "Direito", 1, 1), c("Torres", "Direito", 1, 1)],
      [m("Canoas", "Direito", 3), m("Torres", "Direito", 1)]
    );
    expect(r.filter((l) => l.praca === "Brasil")).toHaveLength(0);
    const porPraca = Object.fromEntries(
      r.filter((l) => l.curso === "Transferência").map((l) => [l.praca, l.spend])
    );
    expect(porPraca).toEqual({ Canoas: 225, Torres: 75 });
  });

  /** O rateio move dinheiro entre linhas; não pode criar nem sumir com ele. */
  it("preserva o total de gasto e de leads", () => {
    const entrada = [
      nac("Medicina", 4160.06, 511),
      nac("Odontologia", 3677.06, 428),
      nac("Transferência", 420.14, 93),
      c("Canoas", "Medicina", 21193.98, 1289),
      c("Palmas", "Medicina", 3614.3, 255),
      c("Torres", "Odontologia", 70.91, 12),
    ];
    const r = redistribuirNacional(entrada, [m("Manaus", "Medicina", 32)]);
    const soma = (xs: typeof entrada) => ({
      spend: Math.round(xs.reduce((a, x) => a + x.spend, 0) * 100) / 100,
      results: Math.round(xs.reduce((a, x) => a + x.results, 0) * 100) / 100,
    });
    expect(soma(r)).toEqual(soma(entrada));
  });

  it("não mexe em praça que não é a nacional", () => {
    const entrada = [c("Canoas", "Direito", 100, 10)];
    expect(redistribuirNacional(entrada, [])).toEqual(entrada);
  });

  /** Praça não classificada não é destino: não se sabe onde fica. */
  it("ignora 'Não classificado' como destino", () => {
    const r = redistribuirNacional(
      [nac("Psicologia", 100, 10), c("Não classificado", "Psicologia", 5, 1), c("Torres", "Psicologia", 5, 1)],
      []
    );
    expect(r.find((l) => l.praca === "Torres" && l.spend === 100)).toBeDefined();
  });
});

describe("redistribuirNacional — curso genérico não é rateado", () => {
  /**
   * A regra que fechou o assunto depois de duas tentativas ruins.
   *
   * Em partes iguais, `CAC = (S/N)/mᵢ` — o inverso da contagem fingindo ser
   * eficiência. Proporcional a matrícula, `CAC = S/Σm` — o mesmo número
   * repetido em trinta linhas, correto e inútil. Não repartir deixa o gasto
   * genérico numa linha "Geral" da praça, e só quem tem campanha própria
   * mostra CAC — que aí é medido.
   */
  it("deixa o curso genérico como linha da própria praça", () => {
    const matriculas = [m("Ulbra POP", "Administração", 60), m("Ulbra POP", "Nutrição", 10)];
    const r = redistribuirNacional([c("Ulbra POP", "Geral", 1000, 500)], matriculas);
    const linhas = montarMatriz(matriculas, r, "praca-curso");

    const geral = linhas.find((i) => i.curso === "Geral")!;
    expect(geral.investimento).toBe(1000);
    expect(geral.leads).toBe(500);
    expect(geral.matriculas).toBe(0);

    // Os cursos não recebem centavo do genérico, então não exibem CAC falso.
    expect(linhas.find((i) => i.curso === "Administração")!.investimento).toBe(0);
    expect(linhas.find((i) => i.curso === "Nutrição")!.investimento).toBe(0);
  });

  it("preserva o CAC medido de quem tem campanha própria", () => {
    const matriculas = [m("Ulbra POP", "Contábeis", 50), m("Ulbra POP", "Nutrição", 10)];
    const r = redistribuirNacional(
      [c("Ulbra POP", "Geral", 1000, 500), c("Ulbra POP", "Contábeis", 3600, 200)],
      matriculas
    );
    const linhas = montarMatriz(matriculas, r, "praca-curso");
    expect(linhas.find((i) => i.curso === "Contábeis")!.cac).toBe(72); // 3600 / 50
  });

  /** O total da praça continua completo: o genérico entra na soma. */
  it("mantém o gasto genérico no total da praça", () => {
    const matriculas = [m("Ulbra POP", "Contábeis", 50)];
    const r = redistribuirNacional(
      [c("Ulbra POP", "Geral", 1000, 500), c("Ulbra POP", "Contábeis", 3600, 200)],
      matriculas
    );
    const praca = montarMatriz(matriculas, r, "praca");
    expect(praca[0].investimento).toBe(4600);
    expect(praca[0].cac).toBe(92); // 4600 / 50 — o CAC real da praça
  });

  it.each(["Geral", "Vestibular", "Institucional", "Transferência", "Remanescentes"])(
    "mantém %s onde está",
    (generico) => {
      const r = redistribuirNacional(
        [c("Torres", generico, 100, 10), c("Torres", "Direito", 50, 5)],
        [m("Torres", "Direito", 4)]
      );
      expect(r.find((l) => l.curso === generico)?.spend).toBe(100);
    }
  );

  /**
   * "geral-brasil" é genérica nos dois eixos: a praça se resolve pelo
   * rateio, o curso continua Geral em cada praça de destino.
   */
  it("espalha o genérico nacional pelas praças, mantendo o rótulo Geral", () => {
    const matriculas = [m("Canoas", "Direito", 30), m("Torres", "Direito", 10)];
    const r = redistribuirNacional([c("Brasil", "Geral", 400, 40)], matriculas);
    const linhas = montarMatriz(matriculas, r, "praca-curso").filter((i) => i.curso === "Geral");

    expect(linhas).toHaveLength(2);
    expect(linhas.find((i) => i.praca === "Canoas")!.investimento).toBe(300); // 30 de 40
    expect(linhas.find((i) => i.praca === "Torres")!.investimento).toBe(100); // 10 de 40
  });

  it("preserva o total com os dois eixos genéricos em jogo", () => {
    const entrada = [
      c("Brasil", "Geral", 1698.21, 241),
      c("Brasil", "Medicina", 4160.06, 511),
      c("Canoas", "Vestibular", 1893.62, 154),
      c("Canoas", "Medicina", 21193.98, 1289),
      c("Torres", "Direito", 772.63, 72),
    ];
    const r = redistribuirNacional(entrada, [
      m("Canoas", "Medicina", 20),
      m("Palmas", "Medicina", 10),
      m("Torres", "Direito", 8),
    ]);
    const cents = (xs: LinhaConversao[]) =>
      Math.round(xs.reduce((a, x) => a + x.spend, 0) * 100);
    expect(cents(r)).toBe(cents(entrada));
  });
});

/**
 * Invariantes da matriz inteira, e não de uma função isolada.
 *
 * A conservação já era testada na saída de `redistribuirNacional`, mas
 * nunca na de `montarMatriz` — que é o que a tela consome —, e nunca para
 * matrícula nem receita. Os três eixos também nunca eram comparados entre
 * si: cada um passava sozinho enquanto podiam discordar.
 *
 * O cenário abaixo tem, de propósito, tudo que a base real tem de
 * incômodo: campanha nacional de curso real, campanha nacional genérica,
 * curso com matrícula e sem mídia, curso com mídia e sem matrícula, praça
 * que só aparece na mídia, valor quebrado que não fecha em centavo redondo
 * e uma receita negativa de estorno.
 */
describe("invariantes da matriz", () => {
  /** Campanha sem recorte geográfico: entra na praça nacional. */
  const nac = (curso: string, spend: number, results: number): LinhaConversao => ({
    praca: "Brasil",
    curso,
    spend,
    results,
  });

  const matriculas = [
    m("Canoas", "Direito", 12, 84000.5),
    m("Canoas", "Medicina", 3, 208500.75),
    m("Torres", "Direito", 5, 31000.25),
    m("Palmas", "Medicina", 2, 139000),
    // Curso com matrícula e nenhum real de mídia — Administração é o caso
    // real: 64 matrículas em julho e agosto sem campanha nenhuma.
    m("Canoas", "Administração", 7, 42000),
    // Estorno vindo do sistema acadêmico. O cálculo tem que repassar sem
    // travar, ainda que o ROI da linha saia negativo.
    m("Itumbiara", "Biomedicina", 1, -7056),
  ];

  const gasto = [
    c("Canoas", "Direito", 4211.37, 389),
    c("Torres", "Direito", 1044.91, 97),
    c("Canoas", "Medicina", 9873.02, 604),
    // Praça só na mídia, sem matrícula nenhuma.
    c("Gravataí", "Odontologia", 512.44, 41),
    nac("Medicina", 3160.06, 211),
    nac("Geral", 2280.19, 350),
  ];

  const rateado = redistribuirNacional(gasto, matriculas);
  const eixos = {
    pracaCurso: montarMatriz(matriculas, rateado, "praca-curso"),
    porPraca: montarMatriz(matriculas, rateado, "praca"),
    porCurso: montarMatriz(matriculas, rateado, "curso"),
  };

  const somar = (linhas: ReturnType<typeof montarMatriz>, campo: "investimento" | "leads" | "matriculas" | "receita") =>
    Math.round(linhas.reduce((a, l) => a + l[campo], 0) * 100) / 100;

  const bruto = {
    investimento: Math.round(gasto.reduce((a, l) => a + l.spend, 0) * 100) / 100,
    leads: Math.round(gasto.reduce((a, l) => a + l.results, 0) * 100) / 100,
    matriculas: matriculas.reduce((a, x) => a + x.quantidade, 0),
    receita: Math.round(matriculas.reduce((a, x) => a + (x.receita_semestral ?? 0), 0) * 100) / 100,
  };

  for (const [nome, linhas] of Object.entries(eixos)) {
    describe(nome, () => {
      it("conserva investimento, leads, matrículas e receita", () => {
        expect({
          investimento: somar(linhas, "investimento"),
          leads: somar(linhas, "leads"),
          matriculas: somar(linhas, "matriculas"),
          receita: somar(linhas, "receita"),
        }).toEqual(bruto);
      });

      it("não produz NaN, Infinity nem negativo onde não pode haver", () => {
        for (const l of linhas) {
          for (const campo of ["investimento", "leads", "matriculas", "cpl", "cac", "taxaConversao", "fracaoRateada"] as const) {
            expect(Number.isFinite(l[campo]), `${l.praca}/${l.curso} ${campo}`).toBe(true);
            expect(l[campo], `${l.praca}/${l.curso} ${campo}`).toBeGreaterThanOrEqual(0);
          }
          // Receita e ROI são os dois campos que PODEM ser negativos, e por
          // um motivo só: o sistema acadêmico exporta estorno como valor
          // negativo, e o cálculo repassa em vez de esconder. Itumbiara sai
          // com ROI −92,83 no fixture porque a base diz isso mesmo.
          expect(Number.isFinite(l.receita), `${l.praca}/${l.curso} receita`).toBe(true);
          expect(Number.isFinite(l.roi), `${l.praca}/${l.curso} roi`).toBe(true);
        }
      });

      it("mantém fracaoRateada entre 0 e 1", () => {
        for (const l of linhas) {
          expect(l.fracaoRateada).toBeGreaterThanOrEqual(0);
          expect(l.fracaoRateada).toBeLessThanOrEqual(1);
        }
      });

      it("deixa CAC, CPL e ROI zerados quando o denominador é zero", () => {
        for (const l of linhas) {
          if (!l.matriculas) expect(l.cac).toBe(0);
          if (!l.leads) expect(l.cpl).toBe(0);
          if (!l.investimento) expect(l.roi).toBe(0);
        }
      });

      /**
       * A tolerância é 1e-4 porque `montarMatriz` arredonda as razões a
       * quatro casas de propósito — elas só trafegam até a tela, e centenas
       * de linhas com dezessete dígitos cada engordavam a resposta à toa.
       * Os somáveis, esses, não são arredondados: quem confere conservação
       * compara centavo com centavo.
       */
      it("recalcula as derivadas a partir dos somáveis da própria linha", () => {
        for (const l of linhas) {
          const perto = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-4);
          perto(l.cpl, l.leads ? l.investimento / l.leads : 0);
          perto(l.cac, l.matriculas ? l.investimento / l.matriculas : 0);
          perto(l.roi, l.investimento ? l.receita / l.investimento : 0);
          perto(l.taxaConversao, l.leads ? (l.matriculas / l.leads) * 100 : 0);
        }
      });
    });
  }

  it("faz os três eixos somarem o mesmo", () => {
    const totais = (linhas: ReturnType<typeof montarMatriz>) =>
      (["investimento", "leads", "matriculas", "receita"] as const).map((k) => somar(linhas, k));
    expect(totais(eixos.porPraca)).toEqual(totais(eixos.pracaCurso));
    expect(totais(eixos.porCurso)).toEqual(totais(eixos.pracaCurso));
  });

  /**
   * O campo que comanda o marcador "~" na tela não tinha um único teste.
   *
   * Linha cujo investimento veio inteiro de campanha nacional tem que sair
   * com 1; linha de campanha própria, com 0; e linha que mistura as duas,
   * com a proporção exata entre elas.
   */
  describe("fracaoRateada", () => {
    const linhas = eixos.pracaCurso;
    const achar = (praca: string, curso: string) =>
      linhas.find((l) => l.praca === praca && l.curso === curso)!;

    it("marca 0 onde não houve rateio nenhum", () => {
      expect(achar("Torres", "Direito").fracaoRateada).toBe(0);
      expect(achar("Gravataí", "Odontologia").fracaoRateada).toBe(0);
    });

    it("marca 1 onde todo o investimento veio de rateio", () => {
      // "Geral" é genérico: nenhuma campanha própria existe com esse rótulo.
      const geral = linhas.filter((l) => l.curso === "Geral");
      expect(geral.length).toBeGreaterThan(0);
      for (const l of geral) expect(l.fracaoRateada).toBe(1);
    });

    it("marca a proporção exata quando a linha mistura medido e rateado", () => {
      // Canoas/Medicina tem campanha própria (9873,02) e recebe parte da
      // nacional de Medicina — a fração é o rateado sobre o total da linha.
      const l = achar("Canoas", "Medicina");
      expect(l.fracaoRateada).toBeGreaterThan(0);
      expect(l.fracaoRateada).toBeLessThan(1);
      const rateadoNaLinha = l.investimento - 9873.02;
      expect(Math.abs(l.fracaoRateada - rateadoNaLinha / l.investimento)).toBeLessThan(1e-4);
    });
  });

  /**
   * Destino com peso zero é descartado (`fatia === 0`), e o que sobra tem
   * que absorver o total. Com pesos mistos — um destino com matrícula e
   * outro sem — o teste antigo não passava por esse caminho.
   */
  it("descarta destino sem matrícula e dá o total ao que tem", () => {
    const r = redistribuirNacional(
      [nac("Medicina", 1000, 100), c("Canoas", "Medicina", 1, 1), c("Palmas", "Medicina", 1, 1)],
      [m("Canoas", "Medicina", 4)]
    );
    const nacionais = r.filter((l) => l.spend === 1000 || (l.spend > 1 && l.curso === "Medicina"));
    expect(nacionais.map((l) => l.praca)).toEqual(["Canoas"]);
    expect(nacionais[0].spend).toBe(1000);
  });
});
