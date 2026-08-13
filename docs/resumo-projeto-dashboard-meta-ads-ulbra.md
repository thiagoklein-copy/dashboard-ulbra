# Dashboard de Meta Ads — ULBRA
## Resumo executivo e histórico do projeto

---

## 1. Objetivo

Montar um dashboard próprio, conectado via API, **somente leitura**, para analisar o que funciona (CPL, CTR, custo por resultado) e cruzar isso com o texto/criativo de cada anúncio — usando isso para escrever copies e criar novas campanhas com base em dados reais, não em relatórios esporádicos de terceiros.

---

## 2. Arquitetura decidida

```
Meta Marketing API
      ↓
   n8n (rodando 24h na VPS Hostinger, mesma onde fica o Hermes Agent)
      ↓
   Supabase (Postgres + Storage + RLS)
      ↓
   Dashboard em Next.js (construído no Cursor)
```

- **n8n**: puxa insights (spend, CTR, CPC, CPM, resultados) e criativos (headline, texto, imagem, vídeo) da API do Meta, 1–2x por dia.
- **Supabase**: banco central. Guarda métricas (`ad_insights`), criativos (`ad_creatives`), vídeos dos ads (Storage), e uma view (`v_ads_performance`) que já junta tudo.
- **Dashboard (Cursor)**: interface para filtrar por campanha/adset/ad, escolher quais colunas ver, ordenar por qualquer métrica (mais barato → mais caro), e abrir um modal por anúncio com vídeo + transcrição + copy lado a lado.

**Custo da operação**: praticamente zero — tudo em tiers gratuitos (Supabase free, n8n self-hosted na VPS já existente, Vercel free) ou custo marginal (Whisper API para transcrição, centavos por vídeo).

---

## 3. O que já foi entregue (arquivos)

| Arquivo | Função |
|---|---|
| `supabase-schema.sql` | Cria as tabelas `ad_insights` e `ad_creatives`, a view `v_ads_performance`, o bucket de Storage para vídeos, RLS com políticas de leitura pública (via anon key) e escrita restrita (via service_role) |
| `meta-ads-para-supabase.json` | Workflow do n8n: puxa insights e criativos do Meta, baixa e transcreve vídeos dos ads via Whisper, salva tudo no Supabase via HTTP Request (upsert direto na API REST) |
| `prompt-cursor-dashboard-meta-ads.md` | Prompt para o Cursor construir o dashboard: filtros dinâmicos, seletor de colunas, ordenação por métrica escolhida, cards de resumo |
| `prompt-cursor-video-modal.md` | Adição ao dashboard: modal com player de vídeo + transcrição + copy ao clicar num ad |
| `docker-compose.yml` | Alternativa via Docker para rodar o n8n (não usada — optou-se por instalação via npm + systemd) |
| `n8n.service` | Arquivo de serviço systemd para o n8n rodar 24h, sobrevivendo a reinícios da VPS |
| `prompt-hermes-configurar-n8n.md` | Prompt para o Hermes Agent configurar o systemd sozinho |
| `prompt-hermes-liberar-env-vars.md` | Prompt para o Hermes liberar acesso a variáveis de ambiente dentro dos nodes do n8n |

---

## 4. Progresso e obstáculos resolvidos

- **Supabase**: projeto criado, schema rodado, RLS habilitado com leitura pública controlada. Um erro de sintaxe (`CREATE POLICY IF NOT EXISTS`, que o Postgres não suporta) foi identificado e corrigido antes de causar problema.
- **View "Unrestricted"**: a view `v_ads_performance` não herdava RLS por padrão (comportamento normal de views no Postgres) — corrigido com `security_invoker = true`.
- **n8n instalado** na VPS via `npm install -g n8n` e configurado como serviço systemd (ajuste feito com ajuda do Hermes Agent), para rodar 24h sem depender de terminal aberto.
- **Bloqueio de variáveis de ambiente**: o n8n (versão instalada) bloqueia `$env` dentro dos nodes por padrão (`access to env vars denied`) — resolvido adicionando `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` no serviço.
- **Node nativo do Supabase incompatível**: a versão do n8n instalada não tinha mais a operação "upsert" no node nativo do Supabase (só Create/Update/Delete/Get separados), causando erro `"upsert" not supported`. Solução: substituição dos 3 nós de gravação por **HTTP Request direto na API REST do Supabase**, usando o header `Prefer: resolution=merge-duplicates` — mais robusto e independente de versão do node.

---

## 5. Pendências

- **Token de acesso do Meta (`META_ACCESS_TOKEN`)**: bloqueio principal. Thiago não tem nenhum acesso ao Business Manager da ULBRA ainda. É necessário que um admin:
  1. Adicione Thiago como Analista (leitura) na conta de anúncios
  2. Crie um System User no Business Manager
  3. Gere um token de longa duração com permissão `ads_read`
- **OPENAI_API_KEY**: ainda não configurada (necessária para a transcrição de vídeos via Whisper).
- **Testes end-to-end do workflow**: os nós de Supabase foram corrigidos mas ainda não testados com dados reais do Meta (bloqueado pela pendência do token acima). Recomenda-se testar isoladamente com `mock data` no node antes de ativar o trigger diário.
- **Dashboard no Cursor**: em andamento, já conectado ao Supabase via `.env.local` (anon key), aguardando dados reais chegarem via n8n para validação completa.

---

## 6. Nota lateral — dashboard de um ex-funcionário

Foi identificado um dashboard antigo (`dashboard.ulbrads.site`), aparentemente muito completo, feito por um ex-funcionário da ULBRA, que parou de funcionar (não puxa mais dados). Ele tem um assistente de IA embutido ("Gaia") que responde perguntas sobre os dados de mídia via uma Supabase Edge Function.

**Conclusão**: não é viável "recuperar" esse projeto a partir do código do navegador (bundle JS minificado) — a lógica real (incluindo a chamada de IA) roda em uma Edge Function no servidor, invisível no frontend. A pergunta feita ao chat "Gaia" sobre qual modelo de IA ela usa não é confiável (resposta "Gaia Elite v3.5, do Google" não corresponde a nenhum modelo real do Google — é uma alucinação típica de chatbot sem acesso à própria configuração).

**Recomendação dada**: investigar quem administra o domínio, hospedagem e o projeto Supabase por trás desse dashboard antigo — provavelmente as credenciais/acesso ficaram vinculadas à conta pessoal do ex-funcionário e pararam de funcionar após a saída dele. Recuperar esse acesso institucional é mais rápido do que tentar reconstruir pelo código do frontend. Enquanto isso não é resolvido, o projeto atual (deste documento) segue como a via principal.

---

## 7. Próximos passos sugeridos

1. Resolver o acesso ao Meta (prioridade — é o único bloqueio que depende de terceiros)
2. Configurar `OPENAI_API_KEY` no n8n
3. Testar o workflow completo de ponta a ponta com uma campanha real
4. Finalizar o dashboard no Cursor com dados reais
5. Investigar em paralelo o acesso institucional ao dashboard antigo (`ulbrads.site`), como fonte de referência de design/funcionalidades adicionais
