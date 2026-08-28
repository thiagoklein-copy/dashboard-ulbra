-- Matrículas confirmadas — a etapa do funil depois do lead.
--
-- O grão é (dia, praça, curso). Não existe grão menor possível: a base de
-- matrículas não tem UTM, lead id nem contato, então não há como ligar uma
-- matrícula a um anúncio. Cruzar por esse trio é correlação, não atribuição.
--
-- **Nada de PII entra aqui.** A planilha de origem traz nome do aluno e
-- número de contrato; o importador lê e descarta. O que chega ao banco já
-- está agregado e não identifica ninguém.
--
-- Só linha de `Matrícula` é carregada. `Rematrícula` é retenção da base
-- instalada — 10.312 contra 1.503 em julho/agosto de 2026 — e somar as duas
-- dividiria o CAC por oito.

create table if not exists public.matriculas (
  data date not null,
  praca text not null,
  curso text not null,
  quantidade integer not null default 0 check (quantidade >= 0),
  -- Soma de `Vlr Liq Semestre`. Nulo quando a carga veio do arquivo diário,
  -- que traz só contagem — daí o dashboard mostrar quantas ficaram sem valor
  -- em vez de estimar uma receita que ninguém mediu.
  receita_semestral numeric(14, 2),
  atualizado_em timestamptz not null default now(),
  primary key (data, praca, curso)
);

create index if not exists matriculas_data_idx on public.matriculas (data);

alter table public.matriculas enable row level security;

-- O dashboard só lê, e lê com a anon key. Escrita fica com a service_role,
-- que ignora RLS e por isso não precisa (nem deve ter) policy própria.
drop policy if exists "matriculas_leitura" on public.matriculas;
create policy "matriculas_leitura"
  on public.matriculas
  for select
  to anon, authenticated
  using (true);

-- O PostgREST cacheia o schema: sem isto a API responde "column does not
-- exist" para uma tabela que já existe no Postgres.
notify pgrst, 'reload schema';
