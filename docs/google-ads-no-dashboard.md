# Google Ads no dashboard

> Do Google Ads Script até a tela, passando por n8n e Supabase.
> Escrito sobre os três scripts que já existem na conta: **D-1**, **D-2** e
> **Retro**.

---

## Carregando um export novo

```bash
node scripts/importar-google.mts <arquivo.xlsx> --conta <id> --conferir   # só lê
node scripts/importar-google.mts <arquivo.xlsx> --conta <id>              # grava
```

O importador acha a aba e as colunas **pelo cabeçalho**, não pela posição: os
dois exports que chegaram já vieram diferentes ("Base (linha por dia)" com
quatro colunas e "Base longa" com três). Ele precisa de `Campanha`, `Data` e
`Custo` em alguma aba; a de matriz (campanha × dia) é ignorada por não ter
coluna de data.

Duas armadilhas do arquivo do Google, ambas tratadas:

- **linha `Total` no fim** e **coluna `Total campanha` no fim** — somar a
  planilha inteira sem cuidado dá exatamente o dobro do gasto real;
- a carga **apaga as linhas anteriores daquela conta** antes de gravar. Sem
  isso, dias que o export novo não cobre sobrevivem como resíduo da carga
  antiga.

Confira sempre com `--conferir` primeiro e compare o "custo total" impresso
com o total que a própria planilha declara.

### O que a carga por planilha perde

Duas coisas, ambas conhecidas e nenhuma delas afetando número de tela:

- **Impressões, cliques, CTR, CPC e valor de conversão ficam zerados.** O
  export não os traz, e a carga apaga as linhas anteriores da conta. O que a
  API já tinha coletado desses campos se perdeu. Não muda nada na tela —
  `MOLDE_EXTERNO` em `lib/insights.ts` zera esses campos para mídia externa
  de qualquer jeito, e a consulta só lê `spend` e `conversions` —, mas é dado
  que não volta sem a API.
- **Campanha com conversão e gasto zero pode sumir.** O export do ULBRA veio
  filtrado por "Custo > R$ 0" (23 campanhas de 556), e a carga apaga a conta
  inteira antes de gravar. Uma campanha que tenha conversão atribuída num dia
  sem gasto não estaria no arquivo e desapareceria em silêncio. É o mesmo
  furo que o `README.md` de `scripts/google-ads/` documenta do lado do GAQL
  (`metrics.cost_micros > 0`). Só a API confirma se aconteceu.

Os dois desaparecem quando os scripts entrarem no ar: eles leem da API, não
de planilha.

---

## Estado atual

**As duas contas estão no banco, com custo medido dia a dia.** Não é mais
estimativa: as 1.682 linhas vieram do export diário do Google Ads, carregado
por `scripts/importar-google.mts`. Em 01/07 a 27/08 de 2026:

| Conta | Linhas | Investimento | Conversões |
|---|---|---|---|
| **ULBRA** (`8472594330`) | 1.334 | R$ 35.864,64 | 4.162,15 |
| **Ulbra Pop - EAD** (`4672123684`) | 348 | R$ 42.626,57 | 2.927,96 |
| **Total** | **1.682** | **R$ 78.491,21** | **7.090,11** |

O que continua pendente são os **scripts rodando sozinhos** — hoje a carga é
manual, por planilha. O resto deste documento é o caminho para automatizar.

> **Custo é medido; conversão diária é estimada.** O export traz custo por
> campanha por dia, mas não traz conversão. O total de conversões de cada
> campanha (esse sim, medido pela API) é redistribuído na proporção do gasto
> diário real. O total por campanha continua exato; a curva dentro do mês é
> aproximada. Dia sem gasto fica com zero conversão, que é o certo.

---

## Por que isso importava

Antes de entrar, o Google era **27,7% do investimento de conversão** e estava
inteiramente invisível. Todo custo na tela saía otimista por quase 40%:

| | Mostrava | Real |
|---|---|---|
| CAC | R$ 93,28 | **R$ 124,31** |
| ROI mídia | 66,6× | **51,8×** |

E é isto que explica o Ulbra POP. As seis campanhas da conta EAD são todas de
captação ampla — `ulbrapop-geral`, `ulbrapop-geral2`, `ulbrapop-cursos`,
`online-geral` —, o que significa que **todo o investimento do EAD é genérico
de curso**. Some com o rateio que o dashboard já faz e ele cai exatamente
sobre os 34 cursos do Ulbra POP que hoje aparecem com matrícula e custo
irrisório: Administração, Biomedicina, Fisioterapia, Serviços Jurídicos.

> Cuidado para não confundir contas: existe uma terceira, **`UlbraPop`
> (`5601492927`), cancelada**. Não aceita script nem devolve histórico por
> API. A que interessa é a **Ulbra Pop - EAD**, `4672123684`, ativa.
>
> Ela só responde quando o `login_customer_id` é ela mesma.

---

## Passo 0 — Autorizar os scripts

**Faça isto antes de qualquer outra coisa.**

D-1 e D-2 estão "Ativado" com frequência diária, mas a última execução é de
**26 de junho**. Script sem autorização válida não dispara no agendamento e
continua exibindo "Ativado" — é a tarja amarela de *"Autorizar"* no topo da
tela de scripts.

Autorize os três. No dia seguinte, confira se a coluna de última execução
mudou. Sem isso, todo o resto deste documento não recebe dado nenhum.

---

## Passo 1 — Supabase: a tabela

O payload dos scripts já traz `platform: 'GOOGLE'` e `entity_level:
'campaign'` — quem escreveu pensou em **uma tabela para várias plataformas**.
A tabela abaixo segue esse desenho, campo a campo, para o n8n não precisar
renomear nada.

```sql
-- Mídia paga no grão de campanha por dia, de qualquer plataforma.
--
-- Separada de `ad_insights` de propósito: aquela é modelada por anúncio
-- (ad_id, adset_id, criativo) e o Google Ads Script entrega campanha.
-- Forçar as duas no mesmo formato encheria de nulo a metade que não se
-- aplica. Quem junta as fontes é o dashboard, em (dia, praça, curso) — o
-- único grão em que elas se comparam.

create table if not exists public.midia_insights (
  data date not null,
  platform text not null,
  account_id text not null,
  campaign_id text not null,
  campaign_name text not null,
  account_name text,
  channel_type text,
  entity_level text not null default 'campaign',
  spend numeric(14, 2) not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  ctr numeric(12, 6),
  cpc numeric(14, 2),
  cpa numeric(14, 2),
  conversions numeric(14, 2) not null default 0,
  conversion_value numeric(14, 2) not null default 0,
  -- Qual script gravou. FORA da chave de propósito: o D-2 precisa
  -- sobrescrever a linha que o D-1 gravou no dia anterior, com a conversão
  -- já madura. Se entrasse na chave, viraria linha duplicada e o gasto do
  -- dia dobraria.
  script_name text,
  atualizado_em timestamptz not null default now(),
  primary key (data, platform, account_id, campaign_id)
);

create index if not exists midia_insights_data_idx
  on public.midia_insights (data);

alter table public.midia_insights enable row level security;

drop policy if exists "midia_insights_leitura" on public.midia_insights;
create policy "midia_insights_leitura"
  on public.midia_insights
  for select
  to anon, authenticated
  using (true);

notify pgrst, 'reload schema';
```

---

## Passo 2 — Google Ads: um corpo só para os três scripts

Os três scripts hoje são cópias idênticas com uma diferença de data. Mantê-los
assim significa corrigir cada bug três vezes. O código abaixo é **o mesmo para
os três**: cole inteiro em cada um e mude só o bloco do topo.

```js
// ════════════════════════════════════════════════════════════════════
//  ÚNICO BLOCO QUE MUDA ENTRE OS TRÊS SCRIPTS
// ════════════════════════════════════════════════════════════════════
var SCRIPT_LABEL = 'GOOGLE ADS ETL [D-1]';
var DIAS_ATRAS   = 1;              // D-1 -> 1   |   D-2 -> 2   |   Retro -> null
var RETRO_INICIO = '2026-07-01';   // usados SÓ quando DIAS_ATRAS = null
var RETRO_FIM    = '2026-08-24';
// ════════════════════════════════════════════════════════════════════

var WEBHOOK_URL = 'https://n8n.ulbrads.site/webhook/googleads';
var WEBHOOK_TOKEN = 'TROQUE_POR_UM_SEGREDO_LONGO';
var LOTE = 500;

/** Data no fuso da CONTA, não no do script — perto da virada eles divergem. */
function diaRelativo(dias) {
  var d = new Date();
  d.setDate(d.getDate() - dias);
  return Utilities.formatDate(d, AdsApp.currentAccount().getTimeZone(), 'yyyy-MM-dd');
}

function periodo() {
  if (DIAS_ATRAS === null) return { inicio: RETRO_INICIO, fim: RETRO_FIM };
  var d = diaRelativo(DIAS_ATRAS);
  return { inicio: d, fim: d };
}

function enviar(lote, inicio) {
  var res = UrlFetchApp.fetch(WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Token': WEBHOOK_TOKEN },
    payload: JSON.stringify(lote),
    muteHttpExceptions: true
  });
  var codigo = res.getResponseCode();
  if (codigo >= 300) {
    // Lançar de propósito: o painel do Google precisa marcar FALHA.
    // Com o erro só logado, o script aparecia "Concluído sem mudanças"
    // e ninguém percebia que nada chegava do outro lado.
    throw new Error('Webhook respondeu ' + codigo + ' — ' + res.getContentText().slice(0, 300));
  }
  Logger.log('✅ ' + lote.length + ' linhas enviadas (a partir de ' + inicio + ')');
}

function main() {
  var p = periodo();
  Logger.log('Extraindo de ' + p.inicio + ' até ' + p.fim);

  var query =
    'SELECT segments.date, customer.descriptive_name, customer.id, ' +
    'campaign.id, campaign.name, campaign.advertising_channel_type, ' +
    'metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr, ' +
    'metrics.average_cpc, metrics.conversions, metrics.cost_per_conversion, ' +
    'metrics.conversions_value ' +
    'FROM campaign ' +
    "WHERE segments.date BETWEEN '" + p.inicio + "' AND '" + p.fim + "'";

  var report = AdsApp.search(query);
  var payload = [];
  var enviadas = 0;

  while (report.hasNext()) {
    var row = report.next();
    var custo = row.metrics.costMicros / 1000000;
    var conv = Number(row.metrics.conversions || 0);

    // O filtro de gasto saiu do GAQL e veio para cá: assim a campanha que
    // teve conversão atribuída num dia sem gasto não some da base.
    if (custo === 0 && conv === 0) continue;

    payload.push({
      script_name: SCRIPT_LABEL,
      date: row.segments.date,
      account_id: String(row.customer.id),
      account_name: row.customer.descriptiveName,
      campaign_id: String(row.campaign.id),
      campaign_name: row.campaign.name,
      channel_type: row.campaign.advertisingChannelType,
      entity_level: 'campaign',
      spend: custo,
      impressions: Number(row.metrics.impressions || 0),
      clicks: Number(row.metrics.clicks || 0),
      ctr: Number(row.metrics.ctr || 0),
      cpc: row.metrics.averageCpc / 1000000,
      cpa: row.metrics.costPerConversion / 1000000,
      conversions: conv,
      conversion_value: Number(row.metrics.conversionsValue || 0),
      platform: 'GOOGLE'
    });

    // Lotes: o Retro cobre meses e um POST só estoura o webhook.
    if (payload.length >= LOTE) {
      enviar(payload, p.inicio);
      enviadas += payload.length;
      payload = [];
    }
  }

  if (payload.length > 0) {
    enviar(payload, p.inicio);
    enviadas += payload.length;
  }

  if (enviadas === 0) Logger.log('⚠️ Nada encontrado entre ' + p.inicio + ' e ' + p.fim);
  else Logger.log('Total: ' + enviadas + ' linhas.');
}
```

### O que mudou em relação ao que está rodando

| Mudança | Por quê |
|---|---|
| Erro de webhook **lança** em vez de só logar | O `try/catch` fazia o script terminar "verde" entregando nada. Agora falha aparece como falha no painel. |
| `X-Token` no cabeçalho | A URL do webhook é pública. Sem verificação, qualquer um grava na sua tabela. |
| Envio em lotes de 500 | O Retro cobre meses; um POST único estoura o limite do webhook. |
| Data pelo fuso da **conta** | `new Date()` usa o fuso do script. Divergindo, "ontem" vira anteontem perto da virada. |
| Filtro de gasto no JS, não no GAQL | `metrics.cost_micros > 0` derrubava campanha com conversão atribuída em dia sem gasto. |
| `String()` nos ids | `campaign_id` chega como número e a coluna é texto. |

---

## Passo 3 — n8n: o workflow

Quatro nós:

**1. Webhook** — `POST`, path `googleads`, *Respond: Using Respond to Webhook
node*.

**2. IF (autenticação)** — compara `{{ $json.headers['x-token'] }}` com o
segredo. Ramo falso → *Respond to Webhook* com status **401**. Sem esse nó a
URL é uma porta aberta de escrita.

**3. Code** — o payload chega como **array puro** (os scripts fazem
`JSON.stringify(payload)` de uma lista, sem envelope):

```js
const linhas = $input.first().json.body || [];

return linhas.map((l) => ({
  json: {
    data: l.date,
    platform: l.platform || 'GOOGLE',
    account_id: String(l.account_id),
    campaign_id: String(l.campaign_id),
    campaign_name: l.campaign_name,
    account_name: l.account_name ?? null,
    channel_type: l.channel_type ?? null,
    entity_level: l.entity_level || 'campaign',
    // Os scripts já dividem micros por 1e6. Não dividir de novo aqui.
    spend: Number(l.spend || 0),
    impressions: Number(l.impressions || 0),
    clicks: Number(l.clicks || 0),
    ctr: Number(l.ctr || 0),
    cpc: Number(l.cpc || 0),
    cpa: Number(l.cpa || 0),
    conversions: Number(l.conversions || 0),
    conversion_value: Number(l.conversion_value || 0),
    script_name: l.script_name ?? null,
  },
}));
```

**4. HTTP Request (gravar)** — **não** use o nó Supabase. O workflow da Meta
já grava por `httpRequest` direto no PostgREST, com variáveis de ambiente que
sua instância já tem. Seguir o mesmo padrão significa **zero credencial nova**:

- **Method:** `POST`
- **URL:**
  ```
  =https://{{$env.SUPABASE_PROJECT_REF}}.supabase.co/rest/v1/midia_insights?on_conflict=data,platform,account_id,campaign_id
  ```
- **Send Headers:** sim
  | Nome | Valor |
  |---|---|
  | `apikey` | `={{$env.SUPABASE_SERVICE_ROLE_KEY}}` |
  | `Authorization` | `=Bearer {{$env.SUPABASE_SERVICE_ROLE_KEY}}` |
  | `Content-Type` | `application/json` |
  | `Prefer` | `resolution=merge-duplicates` |
- **Send Body:** sim, JSON
- **Batching:** envie o array inteiro de uma vez (o `Prefer` acima é o que
  transforma o insert em upsert)

> `Prefer: resolution=merge-duplicates` é o que faz o D-2 sobrescrever o D-1
> em vez de estourar violação de chave primária. Sem esse header o PostgREST
> devolve 409 e o dia do D-2 se perde.

Teste com *Listen for test event* e uma execução manual do D-1. Confira no
Supabase antes de ativar.

---

## Passo 4 — Carga histórica

No **Retro**, com o corpo novo já colado:

```js
var DIAS_ATRAS   = null;
var RETRO_INICIO = '2026-07-01';
var RETRO_FIM    = '2026-08-24';
```

Execute manualmente uma vez. Depois volte `RETRO_INICIO`/`RETRO_FIM` para o
que quiser reprocessar, ou deixe o script parado — ele não tem agendamento.

Como a gravação é upsert, rodar de novo o mesmo período é inofensivo.

---

## Passo 5 — Dashboard

### 5.1 Nomenclatura — resolvido, você não precisa renomear nada

As três convenções que convivem hoje já são lidas pela taxonomia:

```
Meta     2026-2-{curso}-{praça}-advplus-...      praça no FIM
Google   2026-2-{praça}-{curso}-pmax-...         praça no COMEÇO
Google   2025/02 | ... | {praça} | {curso} | Pesquisa | ...
```

Testado contra os **29 nomes reais** das duas contas, de julho em diante:
todos classificam, nenhum cai em "Não classificado".
`tests/campanhas-google.test.ts` trava isso — campanha nova com nome fora do
padrão quebra o teste em vez de sumir calada.

O que foi ensinado:

| Caso | Exemplo |
|---|---|
| Praça no começo do nome | `ulbrapop-geral2-pesquisa` |
| Marcadores do Google no corte | `pmax`, `pesquisa`, `demanda`, `ytb`, `reconhecimento` |
| Rótulos de captação ampla → "Geral" | `cursos`, `geral2`, `enem`, `2graduacao`, `desconto` |
| Apelidos de praça | `online` e `ead` → Ulbra POP; `docpalmas` → Palmas |
| Campanha de rede sem geografia | `Geração de demanda` → praça Brasil |
| Cursos por extenso | `Educação Fisica`, `Nutrição`, `Gestão de Agro` |
| Branding sem praça | vira Brasil/Institucional, não "Não classificado" |

De quebra, um bug antigo da Meta apareceu: a busca de praça no formato com
barras usava `includes`, e **"cu*rs*os" casava com o slug `rs`** — toda
campanha com "Cursos" no nome ia para Rio Grande do Sul. Agora o casamento
respeita fronteira de hífen.

### 5.2 Ler a tabela e juntar

Em [`lib/insights.ts`](../lib/insights.ts), ao lado de `fetchMatriculas`, um
`fetchMidiaExterna(dateFrom, dateTo)` com o mesmo cache de 5 minutos. Cada
linha vira uma `LinhaConversao` — `{ praca, curso, spend, results:
conversions }` — classificada pela taxonomia e somada a
`conversaoTodasPracas` **antes** do rateio de genéricos.

Isso basta: rateio, matriz, CAC, CPL e ROI passam a somar as duas plataformas
sem mais nenhuma mudança. As campanhas nacionais do Google (`brasil-*-pmax`)
caem na praça "Brasil" e são rateadas pelas praças do curso, exatamente como
as da Meta.

### 5.3 O que **não** deve mudar

Funil, tabela de anúncios e painel de vídeo continuam só Meta — são modelados
por anúncio e criativo, que o Google Ads Script não entrega. Rotule o funil
como "Meta" para ninguém ler as impressões como total da rede.

---

## Conferência depois de subir

Rode 01/07 a 27/08 e compare:

| Métrica | Esperado |
|---|---|
| Investimento de conversão | R$ 191.317,35 |
| CAC | R$ 124,31 |
| ROI mídia | 51,8× |
| Contas gravando | 2 (`8472594330` e `4672123684`) |
| **Campanhas em "Não classificado"** | **0** |

O investimento tem que bater entre o card do topo e a aba Praça × Curso, no
mesmo filtro. Se divergir, o suspeito é o balde de branding: o Google tem
R$ 6.105,47 classificados como branding, que entram no total geral e **não**
entram no denominador do CAC.

Para conferir sem abrir a tela:

```bash
node scripts/consultar.mts midia_insights --por platform --por account_id --soma spend --soma conversions
```

O último é o que mais importa: campanha do Google não classificada é nome
fora do padrão — e o gasto dela está sumindo da análise em silêncio.
