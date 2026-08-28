-- Mídia paga no grão de campanha por dia, de qualquer plataforma.
--
-- Separada de `ad_insights` de propósito: aquela é modelada por anúncio
-- (ad_id, adset_id, criativo) e o Google Ads Script entrega campanha.
-- Forçar as duas no mesmo formato encheria de nulo a metade que não se
-- aplica. Quem junta as fontes é o dashboard, em (dia, praça, curso) — o
-- único grão em que elas se comparam.
--
-- O formato segue o payload que os scripts já enviam, campo a campo, para
-- o n8n não precisar renomear nada: `platform`, `entity_level`, `spend`,
-- `cpc`, `cpa`, `conversion_value`.

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
  -- Qual script gravou. FORA da chave de propósito: o D-2 roda dois dias
  -- depois e precisa SOBRESCREVER a linha que o D-1 gravou, agora com a
  -- conversão já madura. Se `script_name` entrasse na chave, D-1 e D-2
  -- virariam duas linhas e o gasto do dia apareceria dobrado.
  script_name text,
  atualizado_em timestamptz not null default now(),

  -- `account_id` na chave porque as duas contas do Google gravam aqui:
  -- ULBRA (847-259-4330) e Ulbra Pop - EAD (467-212-3684). Sem ele, uma
  -- campanha de mesmo id em contas diferentes se sobrescreveria.
  -- `platform` para o dia em que entrar outra fonte.
  primary key (data, platform, account_id, campaign_id)
);

create index if not exists midia_insights_data_idx
  on public.midia_insights (data);

alter table public.midia_insights enable row level security;

-- O dashboard só lê, e lê com a anon key. Escrita fica com a service_role,
-- que ignora RLS e por isso não precisa (nem deve ter) policy própria.
drop policy if exists "midia_insights_leitura" on public.midia_insights;
create policy "midia_insights_leitura"
  on public.midia_insights
  for select
  to anon, authenticated
  using (true);

-- O PostgREST cacheia o schema: sem isto a API responde "column does not
-- exist" para uma tabela que já existe no Postgres.
notify pgrst, 'reload schema';
