/**
 * Matriz praça × curso: onde a mídia encontra a matrícula.
 *
 * É a mesma leitura da planilha `ULBRA ADS x Matrículas`, calculada do dado
 * vivo em vez de à mão. Cada linha responde a cinco perguntas sobre um
 * recorte: quanto custa o lead, quanto custa a matrícula, quanto ela rende,
 * quantas saíram e que fração dos leads virou aluno.
 *
 * Duas regras que valem para a matriz inteira:
 *
 * O investimento é **só de conversão**. Branding não entra em CPL nem em
 * CAC — ele não é comprado para gerar lead, e diluí-lo no denominador
 * faria a captação parecer mais barata do que é.
 *
 * O par (praça, curso) é o menor grão possível. A base de matrículas não
 * tem UTM nem lead id, então não existe recorte por campanha, conjunto ou
 * anúncio: abaixo do par, o cruzamento deixaria de ter chave.
 */
import { NAO_CLASSIFICADO, type MatriculaAgregada } from "@/lib/matriculas";
import type { MatrizItem } from "@/lib/types";

export type EixoMatriz = "praca-curso" | "praca" | "curso";

/** O mínimo de uma linha de mídia para entrar na matriz. */
export interface LinhaConversao {
  praca: string;
  curso: string;
  spend: number;
  results: number;
  /**
   * A linha nasceu de um rateio, não de uma campanha daquele curso.
   *
   * Importa porque muda o que o número significa. Quando TODO o
   * investimento de uma linha veio de rateio, o CAC dela é
   * `investimento ÷ matrículas` com um numerador que ninguém mediu — não
   * mede eficiência de mídia, mede quantas matrículas o curso fez.
   *
   * O rateio pesa por matrícula, então a fatia NÃO é igual entre destinos:
   * no período de julho e agosto a divisão igual (que só acontece quando
   * nenhum destino tem matrícula) rendeu R$ 0,00, e todo o R$ 11.238,04
   * marcado como rateado veio da ponderação. Em recorte de um dia só a
   * divisão igual aparece — foram R$ 5.578,92 somados nos 58 dias, com pico
   * de 13,2% do gasto em 27/08, dia cujas matrículas ainda não entraram.
   */
  rateado?: boolean;
}

/** Praça das campanhas sem recorte geográfico. */
export const PRACA_NACIONAL = "Brasil";

/**
 * Rótulos de curso que não são curso.
 *
 * "geral-canoas" e "vestibular-manaus" são captação da praça inteira: quem
 * converte ali entra em qualquer curso do campus. Como a taxonomia precisa
 * devolver algum rótulo, esses viravam uma linha de curso própria — com
 * gasto e zero matrícula, porque matrícula nenhuma se chama "Geral".
 *
 * Eram R$ 10.669 em julho e agosto, 9,9% do investimento de conversão,
 * parados numa linha que ninguém pode analisar — e todo curso de verdade
 * daquela praça aparecendo mais barato do que foi.
 */
export const CURSOS_GENERICOS = new Set([
  "Geral",
  "Vestibular",
  "Institucional",
  "Transferência",
  "Remanescentes",
]);

/**
 * Devolve o gasto nacional às praças que oferecem o curso.
 *
 * Campanha sem recorte geográfico entra como praça "Brasil", mas o aluno que
 * ela traz é matriculado num campus. O resultado era um balde que só
 * acumulava custo: R$ 14.712 e 1.790 leads contra uma matrícula, enquanto
 * toda praça de campus aparecia mais barata do que foi de fato.
 *
 * **Só a praça é rateada. O curso genérico fica onde está.**
 *
 * Brasil/Medicina se reparte entre as sete praças de Medicina, na proporção
 * das matrículas de cada uma. Já Ulbra POP/Geral continua sendo uma linha
 * "Geral" do Ulbra POP — não vira fatia nos 34 cursos.
 *
 * Leads acompanham o gasto na mesma proporção. Separá-los distorceria o CPL
 * de quem recebe: mais custo, mesmos leads.
 *
 * ## Por que o curso genérico não é rateado
 *
 * Foram duas tentativas antes desta, e as duas produziam número que enganava.
 *
 * Em partes iguais, os 34 cursos do Ulbra POP recebiam `S/34` cada, e
 * `CAC = (S/34)/mᵢ` — o inverso da contagem, parecendo eficiência. Um curso
 * com 2 matrículas aparecia 6x mais caro que um com 12 só por ser menor.
 *
 * Proporcional a matrícula corrigia isso, mas fazia `CAC = S/Σm` — o mesmo
 * valor repetido em 30 linhas. Correto e inútil: coluna que não varia não
 * ajuda a decidir, e ainda ocupa a atenção de quem lê.
 *
 * O que sobra é não repartir. Campanha genérica vira uma linha "Geral" da
 * praça, com o gasto e os leads dela, e sem matrícula — porque matrícula
 * nenhuma se chama Geral. Assim:
 *
 *   - curso com campanha própria mostra **CAC medido**, que é comparável
 *   - o gasto genérico fica visível e somando no total da praça
 *   - nenhuma linha exibe custo que ninguém mediu
 *
 * A praça continua sendo rateada porque ali o rateio tem base: campanha
 * nacional de Medicina serviu as sete praças que oferecem Medicina, e o peso
 * por matrícula diz quanto cada uma colheu.
 *
 * Curso que só existe como campanha nacional não tem para onde ir e fica em
 * Brasil. Não é o caso dos genéricos: "Transferência", "Geral" e
 * "Vestibular" estão em `CURSOS_GENERICOS` e são espalhados por todas as
 * praças mantendo o rótulo, então sobra R$ 0,00 em Brasil no período
 * completo. Sobra em Brasil apenas curso REAL sem nenhuma outra praça —
 * R$ 353,48 somados em 17 dias isolados, nada no acumulado.
 */
export function redistribuirNacional(
  conversao: LinhaConversao[],
  matriculas: MatriculaAgregada[]
): LinhaConversao[] {
  // O universo do que existe de verdade, montado das duas bases: praça com
  // mídia própria ou com matrícula prova que o curso roda ali.
  const pracasPorCurso = new Map<string, Set<string>>();
  const cursosPorPraca = new Map<string, Set<string>>();

  const registrar = (praca: string, curso: string) => {
    if (praca === PRACA_NACIONAL || praca === NAO_CLASSIFICADO) return;
    if (CURSOS_GENERICOS.has(curso) || curso === NAO_CLASSIFICADO) return;

    let pracas = pracasPorCurso.get(curso);
    if (!pracas) pracasPorCurso.set(curso, (pracas = new Set()));
    pracas.add(praca);

    let cursos = cursosPorPraca.get(praca);
    if (!cursos) cursosPorPraca.set(praca, (cursos = new Set()));
    cursos.add(curso);
  };

  for (const l of conversao) registrar(l.praca, l.curso);
  for (const m of matriculas) registrar(m.praca, m.curso);

  // Peso de cada destino: quantas matrículas ele produziu no período.
  const peso = new Map<string, number>();
  const pesoPraca = new Map<string, number>();
  for (const m of matriculas) {
    const k = `${m.praca}||${m.curso}`;
    peso.set(k, (peso.get(k) ?? 0) + m.quantidade);
    pesoPraca.set(m.praca, (pesoPraca.get(m.praca) ?? 0) + m.quantidade);
  }

  /** Para onde uma linha deve ir. Vazio significa "fica onde está". */
  const destinosDe = (l: LinhaConversao): [string, string][] => {
    // Curso genérico em praça real fica onde está: vira a linha "Geral"
    // daquela praça, com gasto e leads e sem matrícula.
    if (l.praca !== PRACA_NACIONAL) return [];

    // "geral-brasil" é genérica nos dois eixos: espalha pelas praças
    // mantendo o rótulo genérico no curso.
    if (CURSOS_GENERICOS.has(l.curso)) {
      return [...cursosPorPraca.keys()].map((p) => [p, l.curso]);
    }

    return [...(pracasPorCurso.get(l.curso) ?? [])].map((p) => [p, l.curso]);
  };

  const saida: LinhaConversao[] = [];

  for (const l of conversao) {
    const destinos = destinosDe(l);

    if (!destinos.length) {
      saida.push(l);
      continue;
    }

    // Sem arredondar aqui: o total precisa fechar com o investimento bruto,
    // e três casas perdidas por destino viram diferença visível na soma.
    // Curso real pesa pelo par; curso genérico, pelo total da praça — não
    // existe matrícula "Geral" para pesar.
    const pesos = destinos.map(([p, c]) =>
      CURSOS_GENERICOS.has(c) ? (pesoPraca.get(p) ?? 0) : (peso.get(`${p}||${c}`) ?? 0)
    );
    const somaPesos = pesos.reduce((a, b) => a + b, 0);

    for (let i = 0; i < destinos.length; i++) {
      const [praca, curso] = destinos[i];
      // Sem matrícula em destino nenhum não há o que pesar — parte igual.
      const fatia = somaPesos ? pesos[i] / somaPesos : 1 / destinos.length;
      if (fatia === 0) continue;
      saida.push({
        praca,
        curso,
        spend: l.spend * fatia,
        results: l.results * fatia,
        rateado: true,
      });
    }
  }

  return saida;
}

function chaveDe(
  item: { praca: string; curso: string },
  eixo: EixoMatriz
): string {
  if (eixo === "praca") return item.praca;
  if (eixo === "curso") return item.curso;
  return `${item.praca}||${item.curso}`;
}

function safeDiv(a: number, b: number): number {
  return b ? a / b : 0;
}

export function montarMatriz(
  matriculas: MatriculaAgregada[],
  conversao: LinhaConversao[],
  eixo: EixoMatriz
): MatrizItem[] {
  const mapa = new Map<
    string,
    {
      praca: string;
      curso: string;
      investimento: number;
      /** Parte do investimento que veio de rateio, não de campanha própria. */
      rateado: number;
      leads: number;
      matriculas: number;
      receita: number;
    }
  >();

  const obter = (item: { praca: string; curso: string }) => {
    const chave = chaveDe(item, eixo);
    const atual = mapa.get(chave) ?? {
      // No eixo de uma dimensão só, a outra fica vazia e a tabela não
      // desenha a coluna — melhor que repetir um "todos" em cada linha.
      praca: eixo === "curso" ? "" : item.praca,
      curso: eixo === "praca" ? "" : item.curso,
      investimento: 0,
      rateado: 0,
      leads: 0,
      matriculas: 0,
      receita: 0,
    };
    mapa.set(chave, atual);
    return atual;
  };

  for (const l of conversao) {
    const g = obter(l);
    g.investimento += l.spend;
    if (l.rateado) g.rateado += l.spend;
    g.leads += l.results;
  }

  // Grupos que tiveram matrícula e nenhuma mídia entram do mesmo jeito.
  // Administração fez 64 matrículas em julho e agosto sem um real investido
  // — é captação orgânica, e some da tela se a linha só nascer de anúncio.
  for (const m of matriculas) {
    const g = obter(m);
    g.matriculas += m.quantidade;
    g.receita += m.receita_semestral ?? 0;
  }

  /*
    `investimento` e `receita` vão sem arredondar; as razões vão com quatro
    casas.

    Os dois primeiros somam: o rateio deixa quase toda linha com fração, e
    arredondar 147 delas separadamente fazia a soma cair 19 centavos abaixo
    do investimento do card — dois números que precisam ser o mesmo.

    Já CPL, CAC, ROI e conversão nunca são somados, só exibidos com duas
    casas. Mandar `10.892345678901234` pela rede em vez de `10.8923` custava
    uns 15 KB por resposta, em 186 linhas × 4 campos, sem mudar um pixel.
  */
  const r4 = (v: number) => Math.round(v * 1e4) / 1e4;

  return Array.from(mapa.entries())
    .map(([id, g]) => ({
      id,
      praca: g.praca,
      curso: g.curso,
      investimento: g.investimento,
      fracaoRateada: r4(safeDiv(g.rateado, g.investimento)),
      leads: g.leads,
      cpl: r4(safeDiv(g.investimento, g.leads)),
      matriculas: g.matriculas,
      cac: r4(safeDiv(g.investimento, g.matriculas)),
      receita: g.receita,
      roi: r4(safeDiv(g.receita, g.investimento)),
      taxaConversao: r4(safeDiv(g.matriculas, g.leads) * 100),
    }))
    .sort((a, b) => b.investimento - a.investimento || b.matriculas - a.matriculas);
}
