# Dashboard Meta Ads — ULBRA

Dashboard interno de performance de campanhas Meta Ads. **Somente leitura.**

Serve para cruzar métrica com criativo: ver quanto cada anúncio custou, quantos
leads trouxe, e ler a copy e a imagem que geraram aquele resultado — para
escrever campanhas novas com base em dado, não em relatório esporádico.

```
Meta Marketing API  →  n8n  →  Supabase  →  Next.js
```

---

## O que ele mostra

- **Conversão e branding separados.** Cada objetivo de campanha conta um
  resultado diferente — lead, visita de perfil, engajamento. Os totais nunca
  se somam, e cada bloco declara qual ação está contando.
- **Filtros cruzados de curso e praça**, extraídos do nome da campanha.
  Escolher uma praça reduz a lista de cursos, e vice-versa.
- **Funil de conversão** com as duas taxas separadas: do anúncio (impressões
  que viraram clique) e da página (cliques que viraram resultado).
- **Mapa de calor** por unidade, com painel ampliado do Rio Grande do Sul.
- **Modal de criativo** com imagem, copy, CTA e retenção de vídeo por quartis.

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
| `lib/insights.ts` | busca no Supabase, filtros cruzados, funil, totais |
| `lib/aggregations.ts` | agregação por campanha / conjunto / anúncio |
| `app/api/insights/route.ts` | endpoint que alimenta o dashboard |
| `app/api/img/route.ts` | proxy das imagens do Meta (recusam hotlink) |
| `components/` | interface |
| `meta-ads-para-supabase-v2.json` | workflow do n8n |
| `docs/` | histórico do projeto e notas de operação |

### Ao adicionar curso ou praça

Edite as listas `CURSOS` e `PRACAS` em `lib/campaign-taxonomy.ts`. Sem isso a
campanha cai em "Não classificado" e some dos filtros.

---

## Banco

Tabelas `ad_insights` e `ad_creatives`, unidas pela view `v_ads_performance` —
que é o que o dashboard lê.

Ao mexer na view, três regras que já custaram caro:

1. Leia a definição atual antes (`pg_get_viewdef`) e parta dela — a view já foi
   recriada por duas frentes, cada uma derrubando colunas da outra
2. Mantenha `with (security_invoker = true)`, senão ela não herda o RLS
3. Rode `notify pgrst, 'reload schema';` depois — o PostgREST cacheia o schema
   e não enxerga colunas novas até isso

Detalhes em [`docs/estado-do-projeto-dashboard-ulbra.md`](docs/estado-do-projeto-dashboard-ulbra.md).
