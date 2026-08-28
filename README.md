# Dashboard de mídia — ULBRA

Dashboard interno de performance de campanhas, cruzando **mídia paga com
matrícula confirmada**. **Somente leitura.**

Serve para duas perguntas. A primeira é de criativo: quanto cada anúncio
custou, quantos leads trouxe, e qual copy e qual imagem geraram aquilo. A
segunda é de negócio: quanto custou cada matrícula, por praça e por curso, e
quanto ela devolveu.

```
Meta Marketing API  ─┐
                     ├─  n8n  →  Supabase  →  Next.js
Google Ads Scripts  ─┘

planilha do sistema acadêmico  →  scripts/importar-matriculas.mts  →  Supabase
```

A ligação entre mídia e matrícula é **(dia, praça, curso)** — o único trio que
as duas bases têm em comum. Não há UTM nem id de lead, então o que o dashboard
mostra é **correlação, não atribuição**: ele não diz de que anúncio saiu uma
matrícula, diz quanto se investiu onde ela aconteceu.

---

## O que ele mostra

- **Conversão e branding separados.** Cada objetivo de campanha conta um
  resultado diferente — lead, visita de perfil, engajamento. Os totais nunca
  se somam, e cada bloco declara qual ação está contando.
- **Filtros cruzados de curso e praça**, extraídos do nome da campanha.
  Escolher uma praça reduz a lista de cursos, e vice-versa.
- **Funil de conversão** com as duas taxas separadas: do anúncio (impressões
  que viraram clique) e da página (cliques que viraram resultado). Quando o
  resultado não vem depois de um clique — engajamento, visita de perfil — a
  taxa de página some, porque compararia duas coisas que não se seguem.
- **Aba Praça × Curso** com CPL, CAC, ROI, matrículas e taxa de conversão em
  três recortes. O gasto de campanha nacional é redistribuído para as praças
  na proporção das matrículas, e o que veio de rateio é marcado com `~`.
- **Modal de criativo** com imagem, copy, CTA e retenção de vídeo por quartis.

CAC e ROI usam **só o investimento de conversão** — branding fica fora do
denominador. E o CAC é *blended*: matrícula orgânica entra na conta, porque
não há como separá-la.

---

## Rodando local

```bash
npm install
npm run dev
```

Crie um `.env.local` na raiz:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
DASHBOARD_PASSWORD=<senha de acesso ao painel>
USE_MOCK_DATA=false
```

`USE_MOCK_DATA=true` ignora o Supabase e usa os dados de exemplo em
`lib/mock-data.ts` — útil para mexer na interface sem banco.

> A anon key é pública por natureza e protegida por RLS. A **service_role**
> nunca entra aqui: o dashboard só lê. Ela vive apenas no n8n.

---

## Estrutura

| Caminho | Papel |
|---|---|
| `lib/campaign-taxonomy.ts` | extrai curso, praça e tipo do nome da campanha |
| `lib/matriculas.ts` | unidade e curso do sistema acadêmico → rótulo canônico |
| `lib/matriz.ts` | matriz praça × curso e rateio do gasto nacional |
| `lib/insights.ts` | busca no Supabase, filtros cruzados, funil, totais |
| `lib/aggregations.ts` | agregação por campanha / conjunto / anúncio |
| `app/api/insights/route.ts` | endpoint que alimenta o dashboard |
| `app/api/img/route.ts` | proxy das imagens do Meta (recusam hotlink) |
| `components/` | interface |
| `scripts/importar-matriculas.mts` | carrega a planilha de matrículas |
| `scripts/importar-google.mts` | carrega o export diário do Google Ads |
| `scripts/consultar.mts` | consulta o banco na linha de comando, para conferência |
| `scripts/google-ads/` | os seis scripts que rodam dentro do Google Ads |
| `supabase/*.sql` | DDL e RLS das tabelas novas |
| `docs/` | histórico do projeto e notas de operação |

Os dois lados precisam usar **o mesmo rótulo, letra por letra**: um curso
escrito diferente em `campaign-taxonomy.ts` e em `matriculas.ts` vira duas
linhas separadas e o cruzamento falha em silêncio. `tests/campanhas-meta.test.ts`
e `tests/campanhas-google.test.ts` prendem os 148 nomes reais de campanha.

### Ao adicionar curso ou praça

Edite as listas `CURSOS` e `PRACAS` em `lib/campaign-taxonomy.ts`. Sem isso a
campanha cai em "Não classificado" e some dos filtros.

---

## Banco

| Objeto | Conteúdo |
|---|---|
| `ad_insights` + `ad_creatives` | Meta, unidas pela view `v_ads_performance` |
| `midia_insights` | mídia de fora da Meta — hoje as duas contas do Google Ads |
| `matriculas` | matrícula confirmada, agregada por (dia, praça, curso) |

A tabela `matriculas` guarda **só o agregado**. A planilha de origem tem nome
de aluno e número de contrato, e nada disso sobe: `.gitignore` barra `*.xlsx`,
`*.xls` e `*.csv`, e o importador só emite contagem e valor.

Nas três, o RLS deixa a chave anônima **apenas ler**. DDL em `supabase/`.

Ao mexer na view, três regras que já custaram caro:

1. Leia a definição atual antes (`pg_get_viewdef`) e parta dela — a view já foi
   recriada por duas frentes, cada uma derrubando colunas da outra
2. Mantenha `with (security_invoker = true)`, senão ela não herda o RLS
3. Rode `notify pgrst, 'reload schema';` depois — o PostgREST cacheia o schema
   e não enxerga colunas novas até isso

Detalhes em [`docs/estado-do-projeto-dashboard-ulbra.md`](docs/estado-do-projeto-dashboard-ulbra.md).

---

## Carregando dado novo

```bash
# matrículas (relatório detalhado ou arquivo diário; detecta o formato)
node scripts/importar-matriculas.mts "matriculas julho-agosto 2026.xlsx" --conferir

# investimento diário do Google Ads, uma conta por vez
node scripts/importar-google.mts <arquivo.xlsx> --conta <id> --conferir
```

`--conferir` lê, resume e **não grava** — rode sempre primeiro. Os dois
importadores precisam de `.env.import` com a `SUPABASE_SERVICE_ROLE_KEY`, que
não vai no `.env.local` nem no repositório.

Como cada dado chega e o que fazer quando não bate:
[`docs/matriculas-no-dashboard.md`](docs/matriculas-no-dashboard.md) e
[`docs/google-ads-no-dashboard.md`](docs/google-ads-no-dashboard.md).
