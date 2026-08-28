# Matrículas no dashboard

> Como a matrícula entra no funil, como atualizar o dado todo dia, e o que
> o número **não** quer dizer.

---

## 1. O que mudou

O funil ia até o lead. Agora vai até a matrícula:

```
impressões → cliques no link → leads → matrículas → receita
```

Com isso aparecem **CAC**, **receita líquida do semestre**, **ROI de mídia** e
a taxa de **conversão comercial** (lead → matrícula), tudo respondendo aos
filtros de período, curso e praça.

O gráfico de curso/praça ganhou duas métricas novas — *Matrículas* e *CAC* —
em âmbar, a mesma cor da etapa no funil. Cor diferente porque o número tem
origem diferente: matrícula não vem da Meta.

### A aba Praça × Curso

Tabela ordenável com **CPL, CAC, ROI, matrículas e taxa de conversão** em
cada recorte, nos três eixos: o par praça × curso, só praça, só curso. É a
planilha `ULBRA ADS x Matrículas` calculada do dado vivo.

Duas escolhas de leitura que valem entender:

**Traço não é zero.** CAC e ROI aparecem como “—” onde não houve
investimento. Administração fez 64 matrículas sem um real de mídia: o CAC
dela é indefinido, não R$ 0,00 — mostrar zero a colocaria como o curso mais
eficiente da rede.

**A linha total recalcula, não soma.** CPL do total é gasto total sobre leads
totais. A média das colunas derivadas de cada linha daria outro número, e o
errado.

### Campanha nacional é rateada

> **Matrícula nunca é “Brasil”.** A unidade `EAD` do sistema acadêmico é o
> **Ulbra POP** — é assim que `campaign-taxonomy.ts` trata os slugs `ead` e
> `online`, e é assim que a planilha de análise soma. Mandá-la para “Brasil”
> deixava a receita presa numa linha sem investimento, que o rateio nunca
> alcança porque ele só redistribui mídia. `ULTEC SCHOOL` vai para “Não
> classificado”: o curso é presencial e a unidade não diz onde fica.

Campanha sem recorte geográfico chega da Meta na praça **“Brasil”** — eram
R$ 14.712 e 1.790 leads em julho e agosto contra **uma** matrícula, porque o
aluno que ela traz se matricula num campus. O balde só acumulava custo,
enquanto toda praça de campus aparecia mais barata do que foi.

Agora cada linha nacional é dividida **em partes iguais** entre as praças que
oferecem aquele curso — mídia própria ou matrícula no período, porque as duas
coisas provam que o curso roda ali. Brasil/Medicina se reparte entre as sete
praças de Medicina, Brasil/Odontologia entre as quatro de Odontologia. Os
leads acompanham o gasto na mesma proporção, senão o CPL de quem recebe
ficaria distorcido.

O rateio **move** dinheiro entre linhas e não cria nem some com ele: o total
continua R$ 107.369,98 e 10.776 leads. `tests/matriz.test.ts` trava isso.

Três detalhes:

- **O rateio é hipótese, não medição.** Sem lead id não dá para saber quanto
  de Brasil/Medicina virou aluno em Canoas e quanto em Palmas. O peso é a
  matrícula do destino: é circular por construção — usa o resultado para
  explicar o custo que o gerou —, e é por isso que a tabela marca com `~`
  toda linha cujo investimento veio inteiro de rateio. Ponderar por verba
  própria seria pior: premiaria quem já gasta mais.
- **Curso genérico se espalha; curso real sem destino fica em Brasil.**
  “Geral”, “Vestibular”, “Transferência”, “Remanescentes” e “Institucional”
  não são curso que alguém curse: eles vão para todas as praças mantendo o
  rótulo, pesados pelo total de matrículas de cada praça. Só um curso de
  verdade que nenhuma praça ofereça fica parado em Brasil — no acumulado de
  julho e agosto isso deu R$ 0,00.
- **O rateio acontece antes do filtro de praça.** Filtrar Canoas não pode
  fazer Canoas virar o único destino de Medicina e receber os sete sétimos —
  o universo de destinos é sempre o mesmo, com filtro ou sem.

### Por que o card e a aba mostram números diferentes sob filtro de praça

Sem filtro, os dois batem ao centavo (R$ 191.317,35). Com uma praça
escolhida, divergem — e é de propósito:

| | Filtro "Canoas" |
|---|---|
| Card de investimento | R$ 51.727,23 |
| Aba Praça × Curso | R$ 60.038,58 |

Os R$ 8.311,35 de diferença são **campanha nacional rateada para Canoas**. A
aba redistribui o gasto "Brasil" para as praças; o card não, porque ele soma
o que as campanhas de fato gastaram naquele recorte. Um mede o que foi
gasto; o outro, o que foi atribuído. Os dois estão certos para a pergunta
que respondem, e por isso ambos ficam.

O rodapé de ressalvas que ficava no card da tela inicial mora aqui, ao lado
dos números que ele qualifica — é em CAC e ROI que a leitura errada vira
decisão de verba.

---

## 2. A limitação que define tudo

**Não existe atribuição por clique.** A base de matrículas não tem UTM, lead
id, e-mail nem telefone. Nada nela aponta para um anúncio.

A única chave que as duas bases têm em comum é **(dia, praça, curso)**. É por
ela que o cruzamento acontece — e ela é correlação, não atribuição. Uma
matrícula orgânica de Direito em Canoas no dia 20 entra na conta do
investimento em Direito/Canoas do dia 20 exatamente como entraria uma
comprada.

Três consequências que estão escritas na própria tela:

| Consequência | Onde aparece |
|---|---|
| Filtro de campanha, conjunto, tipo e busca não afeta matrícula | nota na aba Praça × Curso |
| O CAC é *blended* — orgânico misturado com pago | nota na aba Praça × Curso |
| Dia sem carga não é dia sem matrícula | selo âmbar no card, quando o período passa da fronteira |

A terceira é a mais traiçoeira. A mídia vai até ontem; a matrícula, até o
último arquivo que alguém mandou. O dashboard abre nos últimos 7 dias, então
a borda cai bem no meio do padrão. Sem o aviso, três dias sem carga leriam
como queda de performance.

> A planilha `ULBRA ADS x Matrículas` resolve o CAC blended com um **CAC
> marginal** (CPL da praça × 1,20 ÷ conversão, teto de 12%). Esse modelo
> **não** foi trazido para o dashboard — ver a seção 6.

---

## 3. Só matrícula nova

Da base de julho/agosto de 2026: **1.503 matrículas** contra **10.312
rematrículas**.

Rematrícula é retenção da base instalada, não captação. O importador
descarta e informa quantas descartou. Somar as duas dividiria o CAC por oito
e inventaria uma performance que não existe.

---

## 4. O CAC não usa branding

O denominador do CAC é **só o investimento em conversão**, sempre — mesmo
com o seletor de tipo em "todos" ou em "branding". No recorte de 14/07 a
24/08 o branding foi 3,2% do gasto (R$ 3.549 de R$ 110.919), então o número
muda pouco; o significado muda bastante.

Pela mesma razão o bloco de matrículas ignora os seletores de campanha,
conjunto, tipo e busca: o `spend` responderia ao filtro, a matrícula não, e o
CAC viraria uma divisão entre duas coisas que não se referem ao mesmo
recorte.

---

## 5. Rotina

Há dois caminhos. O primeiro não pede credencial nenhuma e é o recomendado.

### Caminho A — gerar SQL e colar (recomendado)

```bash
npm run importar-matriculas -- "matriculas julho-agosto 2026.xlsx" --sql
```

Isso escreve `carga-matriculas.sql` na raiz. O arquivo já vem com o
`create table if not exists` no topo (lido de
[`supabase/matriculas.sql`](../supabase/matriculas.sql), não copiado), então
**basta abrir o SQL Editor do projeto `ulbra-meta-ads`, colar o conteúdo e
rodar** — a primeira vez cria a tabela, as seguintes só atualizam.

Por que este caminho: gravar direto exige a service_role, que ignora o RLS. A
carga já é manual de qualquer jeito, porque o sistema acadêmico não tem API.
Trocar "colar um arquivo" por "espalhar uma chave que ignora RLS" é um mau
negócio.

### Caminho B — gravar direto

Se preferir automatizar, crie um `.env.import` na raiz (já ignorado pelo git):

```
SUPABASE_URL=https://drpihmazlupxtspyqtxp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<chave secreta>
```

A service_role fica **só aí e no n8n** — nunca no `.env.local` do dashboard,
que carrega a anon key que vai para o navegador. Depois:

```bash
npm run importar-matriculas -- "matriculas julho-agosto 2026.xlsx"
```

### Todo dia, nos dois caminhos

```bash
# 1. confira o que o script entendeu, sem tocar em nada
npm run importar-matriculas -- "matriculas 26-08.xlsx" --conferir

# 2. se os números fizerem sentido, gere o SQL (ou grave direto)
npm run importar-matriculas -- "matriculas 26-08.xlsx" --sql
```

O `--conferir` vale o hábito: é ali que aparece se alguma praça ou curso novo
caiu em "Não classificado".

A gravação é *upsert* na chave (dia, praça, curso), então **reimportar o mesmo
arquivo é seguro** — substitui, não soma. Para apagar um dia antes de
recarregá-lo (uma correção que removeu linhas, por exemplo):

```bash
npm run importar-matriculas -- "arquivo.xlsx" --sql --substituir-dia
```

> O dashboard cacheia por 5 minutos. Depois de carregar, ou espera, ou
> reinicia o `next dev`.

### Dois formatos aceitos

**Detalhado** — o relatório do sistema acadêmico, uma linha por contrato, com
`Dia Confirmacao` e `Matricula/Rematricula` no cabeçalho. **É o formato a
usar.** É o único que traz `Vlr Liq Semestre`, logo o único que produz
receita e ROI.

**Diário** — o resumo manual (praça, cursos abaixo). Traz só contagem, sem
receita. Funciona, mas o layout é ambíguo por natureza: uma linha como
`MEDICINA POA` aparece fora do bloco da praça a que pertence. O script trata
o caso e **avisa linha a linha o que entendeu** — leia a saída.

> **Nenhum arquivo entra no repositório.** A base traz nome do aluno e número
> de contrato; `*.xlsx`, `*.xls` e `*.csv` estão no `.gitignore`. O
> importador lê a PII e descarta: para o banco vai só
> (dia, praça, curso, quantidade, receita).

---

## 6. Quando um curso ou praça novo aparece

Mesma regra da taxonomia de campanha, agora em dois lugares:

- praça nova → `UNIDADE_PRACA` em [`lib/matriculas.ts`](../lib/matriculas.ts)
- curso novo → a lista `CURSOS` no mesmo arquivo

Sem isso a linha cai em "Não classificado" e some dos filtros. O `--conferir`
mostra quantas caíram lá.

**Os rótulos precisam bater letra por letra com os de
[`lib/campaign-taxonomy.ts`](../lib/campaign-taxonomy.ts).** É o que faz o
curso vindo da campanha e o curso vindo da matrícula serem a mesma linha no
filtro. `tests/matriculas.test.ts` trava isso: se descolarem, o teste falha.

Cursos de pós, MBA e extensão vão de propósito para "Não classificado" — não
têm campanha, e virariam linhas de matrícula com investimento zero.

---

## 7. Conferência

O mapeamento foi validado contra a planilha `ULBRA ADS x Matrículas — Julho e
Agosto 2026`, que foi montada à mão a partir da mesma base:

| Conferência | Resultado |
|---|---|
| Unidade → praça | 1.503 de 1.503 |
| Total por curso (aba `Ticket por Curso`) | 20 de 20 idênticos |
| Par praça × curso (aba `Praça x Curso completo`) | 79 de 80 idênticos |
| Receita semestral total | R$ 9.907.166,77 |

A única divergência é Ulbra POP / ADS: 49 na planilha, 48 recalculado. O
total do curso bate exato (63), então é um ajuste manual de praça na
planilha, não erro do mapa.

---

## 8. O que ficou de fora

| Item | Por quê |
|---|---|
| CAC marginal da aba `Premissas` | é um modelo de projeção com premissas próprias (fator 1,20, teto de 12%), que envelhecem. Entrar como número fixo na tela o faria parecer medido |
| Matriz de ação (ESCALAR / MANTER / REDUZIR / CORTAR) | depende do CAC marginal acima |
| Matrícula no relatório de benchmark | o relatório compara dois períodos, e a fronteira do dado de matrícula é diferente em cada um. Fazer direito exige tratar isso; feito de qualquer jeito, mostraria queda onde só falta carga |
| Receita estimada nos dias vindos do arquivo diário | preferiu-se mostrar "N sem valor informado" a estimar um número que pareceria medido |
| Pós e MBA fora do denominador | as 67 matrículas de pós-graduação viram curso "Não classificado" mas **continuam contando** em `quantidade` — 4,4% do total geral e 10,2% do Ulbra POP. Elas entram no CAC sem ter tido campanha de captação, e os R$ 212.147,47 de receita delas entram no ROI da praça contra investimento de mídia de graduação. É por isso que o ROI do Ulbra POP parece melhor do que a graduação sozinha explicaria. Tirá-las mudaria o total de matrículas que você já valida contra a planilha, então ficam — mas saiba que estão lá |
| Contagem exata de "sem valor informado" | a tabela guarda o **agregado** por (dia, praça, curso), então uma matrícula zerada dentro de um grupo que tem outras com valor desaparece na soma. O card diz **48**; o número exato é **58** (36 do arquivo diário, que não traz valor, mais 22 zeradas ou negativas no relatório detalhado). As 10 de diferença estão em grupos mistos. Fechar isso exige uma coluna `sem_receita` na tabela e uma recarga — não vale a migração por 0,65% das matrículas, mas está registrado |
| Correção automática de valor negativo | o relatório traz estorno como valor negativo (duas linhas, R$ −7.056,10 em julho/agosto). O importador **avisa e carrega como está**: decidir se é estorno a descartar ou lançamento a corrigir é de quem emite o relatório, não do script. O efeito na tela é um ROI negativo naquela praça, que é o dado falando |
| Margem por curso | não existe no dado. A planilha de origem é de **receita**, não de margem — sem custo direto por curso, o ranking de Medicina, Odontologia e Veterinária pode virar quando a margem entrar |
