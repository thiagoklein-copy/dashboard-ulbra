# Dashboard Meta Ads ULBRA — Estado do projeto

> Documento de repasse. Descreve o que está pronto, o que foi corrigido, como rodar e o que falta.
> Situação verificada em **12/08/2026**.

---

## 1. Resumo em três linhas

O pipeline `Meta API → n8n → Supabase → dashboard Next.js` está **funcionando de ponta a ponta**. O dashboard roda local com dados reais, separa campanhas de conversão e de branding, e filtra por curso e praça. Faltam a transcrição de vídeos e o deploy.

---

## 2. O que está funcionando

| Camada | Estado |
|---|---|
| Coleta do Meta (insights + criativos) | ✅ com paginação |
| Gravação no Supabase | ✅ upsert sem duplicar |
| Dashboard local | ✅ dados reais |
| Filtros de curso, praça, campanha, conjunto | ✅ cruzados entre si |
| Separação branding × conversão | ✅ |
| Imagens dos criativos | ✅ via proxy |
| Histórico | ⏳ backfill de 30 dias em andamento |
| Transcrição de vídeo | ❌ bloqueada |
| Deploy | ❌ não iniciado |

Volume atual no banco: **~15 dias, 4.600+ linhas, 1.032 anúncios, 113 campanhas, R$ 30.622**. O backfill continua rodando e vai até 30 dias.

---

## 3. Bugs encontrados e corrigidos

Vale ler esta seção: vários eram **falhas silenciosas** — o sistema reportava sucesso e gravava dado errado ou incompleto.

### 3.1 Paginação (o mais grave)

O workflow buscava só a primeira página da API do Meta. Gravava **25 anúncios de 278** e não acusava erro nenhum.

Impacto: o dashboard mostrava **R$ 1.032 num dia em que a conta gastou R$ 3.842** — 27% do real.

Corrigido com paginação nativa do nó HTTP, seguindo `paging.next` até o fim.

### 3.2 Criativos vazios

Todos os campos de criativo gravavam nulo — sem headline, texto, imagem ou link. Duas falhas empilhadas:

1. O workflow pedia `creative{title,body,image_url}`, campos que **não existem** em anúncios Advantage+
2. O fallback (buscar o post original da Página) retornava `(#100) Missing permissions`

A solução foi trocar a origem para `creative{asset_feed_spec}`, que contém tudo e é acessível com o token atual. Sem pedir permissão nova.

**Importante:** `asset_feed_spec.optimization_type` vale `PLACEMENT`, não teste A/B. As 3 imagens por anúncio são recortes para feed/story/reels — existe **um** texto e **um** título por anúncio.

### 3.3 Universo errado na busca de criativos

O endpoint `/act_X/ads` devolve **todo anúncio já criado na conta — 14.570+**, não só os ativos. Buscar `asset_feed_spec` de todos estourava a API com HTTP 500.

Corrigido: o ramo de criativos agora recebe os `ad_id` vindos dos insights e busca em lotes de 50 via `filtering=[{"field":"id","operator":"IN",...}]`. De 30+ páginas para 6 requisições.

> O parâmetro `?ids=` foi **descontinuado na v26** da Graph API. Usar `filtering`.

### 3.4 `results` e `cost_per_result` nulos

Ninguém extraía esses valores. Descobriu-se que **a API já os entrega prontos**, calculados conforme o objetivo de cada campanha:

```json
"objective": "OUTCOME_LEADS",
"results": [{"indicator": "actions:offsite_conversion.fb_pixel_lead",
             "values": [{"value": "8"}]}]
```

Basta pedir `results`, `cost_per_result` e `objective`. Atenção: quando não há resultado, a chave `values` **não vem** — tratar como zero.

### 3.5 View desatualizada em relação ao código

A `v_ads_performance` não tinha `adset_id`, `adset_name` nem `campaign_id`. O código agrupa por esses campos; vindo `undefined`, **todas as linhas colapsavam em uma só** ao agregar por campanha ou conjunto.

Corrigido. Ver a seção 6, que é onde isso pode voltar a acontecer.

### 3.6 Botão dentro de botão

O `<Checkbox>` do Radix renderiza um `<button>`, e estava dentro de outro `<button>` no filtro multi-seleção. HTML inválido → erro de hidratação no console. Substituído por uma caixa visual.

---

## 4. Branding × conversão — por que isso existe

Esta é a decisão de produto mais importante do dashboard, e **não é preferência estética**.

Cada campanha do Meta conta um resultado diferente conforme seu objetivo:

| Objetivo | O que `results` significa | Grandeza típica |
|---|---|---|
| `OUTCOME_LEADS` | leads no site (pixel) | centenas |
| `LINK_CLICKS` | visitas ao perfil | centenas |
| `OUTCOME_ENGAGEMENT` | engajamento | **dezenas de milhares** |

Num único dia de julho: **465 leads e 21.281 engajamentos**. Somados, o custo por resultado despencaria e daria a impressão de performance excelente — puramente por troca de objetivo, sem melhora real nenhuma.

Por isso o dashboard:

- Guarda `objective` e `result_indicator` em cada linha
- Exibe **dois blocos separados** de totais, que nunca se somam
- Mostra na tela qual ação está sendo contada em cada bloco
- Ao filtrar por um tipo, o card de investimento total passa a considerar só aquele tipo

---

## 5. Curso e praça

Extraídos do nome da campanha, que segue o padrão:

```
2026-2-{curso}-{praça}-advplus-{data}-{tipo}-ativar
2026/2 | {praça} | Rebranding | {data}          ← institucional
```

A lógica está em [`lib/campaign-taxonomy.ts`](dashboard-ulbra-master/lib/campaign-taxonomy.ts) e cobre **64 de 64 campanhas**, tratando a sujeira real dos nomes:

- espaço depois do hífen (`biomed- carazinho`)
- apelidos alternados (`psico`/`psicologia`, `fisio`/`fisioterapia`)
- praças compostas (`cachoeira-do-sul`, `santa-maria`, `sao-jeronimo`)
- recortes de público (`remanescentes`, `transferencia`)

**Ao adicionar curso ou praça nova, editar as listas `CURSOS` e `PRACAS` desse arquivo.** Sem isso a campanha cai em "Não classificado" e some dos filtros.

Os seletores são **cruzados**: escolher Palmas reduz a lista de cursos aos que rodam lá; escolher Direito reduz as praças àquelas onde ele roda.

---

## 6. Banco de dados — cuidado importante

Projeto Supabase: **`ulbra-meta-ads`** (`drpihmazlupxtspyqtxp`)

### Estrutura

- `ad_insights` — métricas diárias por anúncio. Único em `(ad_id, date_start)`
- `ad_creatives` — copy e mídia por anúncio. Único em `(ad_id)`
- `v_ads_performance` — view que junta as duas. **É o que o dashboard lê**

### ⚠️ A view é ponto de colisão

Durante este trabalho a view foi **recriada por duas frentes diferentes**, e cada uma derrubou colunas da outra sem que ninguém percebesse na hora. O sintoma é traiçoeiro: o dashboard continua carregando, só que um campo vem vazio.

Ao mexer na view, três regras:

1. **Nunca recriar do zero sem antes rodar `pg_get_viewdef('public.v_ads_performance'::regclass, true)`** e partir do que já existe
2. **Sempre incluir `with (security_invoker = true)`** — sem isso a view não herda o RLS e aparece como "Unrestricted"
3. **Rodar `notify pgrst, 'reload schema';` depois** — o PostgREST cacheia o schema e não enxerga colunas novas até isso

A regra 3 já causou confusão: a coluna existia no Postgres, mas a API respondia `column does not exist`.

### Colunas que o dashboard depende

`objective` e `result_indicator` em `ad_insights` são **obrigatórias** — sem elas a separação branding/conversão para de funcionar.

---

## 7. Como rodar local

```bash
cd dashboard-ulbra-master
npm install
npm run dev
```

Acessa em `http://localhost:3000`. A senha está na variável `DASHBOARD_PASSWORD`.

O `.env.local` precisa de quatro variáveis (peça os valores a quem tem acesso):

```
NEXT_PUBLIC_SUPABASE_URL=https://drpihmazlupxtspyqtxp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key — pública, vai no bundle>
DASHBOARD_PASSWORD=<senha de acesso ao painel>
USE_MOCK_DATA=false
```

> `USE_MOCK_DATA=true` volta para o mock e ignora o Supabase. Útil para desenvolver a interface sem banco.

### n8n local

```powershell
$env:N8N_BLOCK_ENV_ACCESS_IN_NODE = "false"
$env:META_ACCESS_TOKEN = "<token>"
$env:META_AD_ACCOUNT_ID = "1299590423402028"     # sem o prefixo act_
$env:SUPABASE_PROJECT_REF = "drpihmazlupxtspyqtxp"
$env:SUPABASE_SERVICE_ROLE_KEY = "<chave secreta>"
n8n start
```

Três armadilhas já pagas:

- **`META_AD_ACCOUNT_ID` vai sem `act_`** — o workflow concatena o prefixo
- **`SUPABASE_PROJECT_REF` é só o ref**, sem `https://` nem `.supabase.co`
- Sem `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`, todos os nós falham com `access to env vars denied`

O SQLite do n8n **satura** ao gravar execuções de 278 itens (chega a derrubar a interface com `Database is not ready!`). Subir com:

```
EXECUTIONS_DATA_SAVE_ON_SUCCESS=none
EXECUTIONS_DATA_SAVE_ON_ERROR=all
DB_SQLITE_POOL_SIZE=10
```

Em produção, migrar o n8n para Postgres.

---

## 8. Arquivos principais

| Arquivo | Papel |
|---|---|
| `lib/campaign-taxonomy.ts` | extrai curso, praça e tipo do nome — **novo** |
| `lib/insights.ts` | busca, filtros cruzados, totais por tipo |
| `lib/aggregations.ts` | agregação por campanha/conjunto/anúncio |
| `components/dashboard.tsx` | layout e orquestração |
| `components/summary-cards.tsx` | blocos de conversão e branding — **novo** |
| `components/breakdown-chart.tsx` | gráfico por curso/praça — **novo** |
| `components/kind-selector.tsx` | seletor de tipo — **novo** |
| `app/api/img/route.ts` | proxy de imagem — **novo** |
| `meta-ads-para-supabase-v2.json` | workflow corrigido do n8n |

O workflow antigo (`meta-ads-para-supabase=certo.json`) foi mantido para comparação. **Não use** — é o que tem os bugs da seção 3.

### Sobre o proxy de imagem

As URLs de imagem da Meta funcionam servidor-a-servidor mas o navegador recebe recusa (proteção contra hotlink). O `/api/img` busca no servidor e repassa, com cache de 24h e allowlist restrita a `facebook.com` e `fbcdn.net` — sem isso viraria um proxy aberto.

---

## 9. Pendências

| # | Item | Depende de |
|---|---|---|
| 1 | Terminar o backfill de 30 dias | em andamento |
| 2 | Ativar o trigger diário do n8n | validação do backfill |
| 3 | Migrar n8n para Postgres | decisão de infra |
| 4 | Transcrição de vídeo | ver abaixo |
| 5 | Deploy | decisão de plataforma |

### Sobre a transcrição (item 4)

Há **19 anúncios com vídeo**. A tela do modal com player e transcrição lado a lado **já está construída** em `components/creative-preview.tsx` — só falta o dado.

Dois bloqueios independentes:

- Os arquivos de vídeo pertencem à **Página**, não à conta de anúncios. O token atual não os alcança, e eles não estão na biblioteca `/act_X/advideos` (verificado: 0 de 19 em ~1.600 vídeos varridos)
- A `OPENAI_API_KEY` para o Whisper nunca foi configurada

A ordem importa: sem resolver o acesso ao vídeo, a chave da OpenAI não serve para nada.

### Sobre o deploy (item 5)

Nada foi decidido. Para um Next.js puro a Vercel é o caminho mais direto e gratuito. O Railway (US$ 5/mês) faz sentido se a ideia for hospedar o dashboard **e** o n8n no mesmo lugar, aposentando a VPS.

Ao subir, atenção: variáveis `NEXT_PUBLIC_*` são **embutidas no build**, não lidas em runtime. Precisam estar configuradas **antes** do primeiro build, senão o app sobe sem conectar no Supabase e sem erro visível.

---

## 10. Notas de segurança

- A **anon key** é pública por natureza (vai no bundle do navegador) e é protegida por RLS. Pode circular.
- A **service_role / `sb_secret_`** ignora o RLS completamente. Vai **só no n8n**, nunca no dashboard nem no serviço de deploy — o dashboard só lê, e para ler a anon key basta.
- O **token do Meta** vai **só no n8n**. O dashboard não faz nenhuma chamada à API do Meta (verificado por busca no código).
- Nenhuma dessas credenciais deve ser colada em chat, ticket ou documento compartilhado. Elas vão do painel de origem direto para o destino final.

---

## 11. Números de referência para validar

Se mexer no pipeline, estes valores servem de conferência para **11/08/2026**:

| Métrica | Valor esperado |
|---|---|
| Anúncios com entrega | 278 |
| Conjuntos | 101 |
| Campanhas | 67 |
| Gasto total | R$ 3.842 |
| Leads (conversão) | 436 |
| Visitas de perfil (branding) | 209 |

Se o gasto vier bem abaixo disso, o primeiro suspeito é **paginação** — foi o que causou o bug original.
