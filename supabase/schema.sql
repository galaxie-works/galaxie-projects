-- ============================================================================
-- Galaxie Projects — schema do banco (Supabase / Postgres)
-- ============================================================================
-- Como usar: Supabase Dashboard -> SQL Editor -> cole este arquivo inteiro ->
-- Run. Pode rodar de novo com segurança (usa IF NOT EXISTS / DROP POLICY IF
-- EXISTS), então serve também para reaplicar depois de alguma alteração.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- EMPRESAS — uma linha por usuário (dono da conta). Criada no onboarding.
-- ----------------------------------------------------------------------------
create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  cnpj text,
  descricao text,
  modo_operacao text, -- como o usuário conduz as obras (texto livre)
  created_at timestamptz not null default now(),
  unique (owner_id)
);

-- Serviços que a empresa realiza (ids de src/lib/servicos.ts), escolhidos no
-- onboarding e editáveis em /empresa. Coluna adicionada depois da versão
-- inicial, por isso o ALTER separado: pode rodar de novo sem problema.
alter table public.empresas
  add column if not exists servicos text[] not null default '{}';

-- ----------------------------------------------------------------------------
-- EQUIPE — pessoas que trabalham com o dono da empresa
-- ----------------------------------------------------------------------------
create table if not exists public.equipe (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null,
  funcao text, -- o que a pessoa faz / responsabilidade
  telefone text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- CLIENTES — pessoa física ou jurídica
-- ----------------------------------------------------------------------------
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  tipo text not null check (tipo in ('PF', 'PJ')),
  nome text not null, -- nome (PF) ou nome fantasia (PJ)
  cpf text,
  cnpj text,
  razao_social text,
  email text,
  telefone text,
  endereco text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- PROJETOS — cada cliente pode ter 1 ou mais projetos (obras)
-- ----------------------------------------------------------------------------
create table if not exists public.projetos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  nome text not null,
  status text not null default 'planejamento'
    check (status in ('planejamento', 'em_execucao', 'pausado', 'completo')),
  percentual_conclusao int not null default 0
    check (percentual_conclusao between 0 and 100),
  data_inicio date,
  data_prazo date,
  orcamento_total numeric(14, 2) default 0,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- ETAPAS — tarefas/fases de um projeto, cada uma com um responsável
-- ----------------------------------------------------------------------------
create table if not exists public.etapas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos (id) on delete cascade,
  nome text not null,
  responsavel_id uuid references public.equipe (id) on delete set null,
  status text not null default 'pendente'
    check (status in ('pendente', 'em_andamento', 'concluida')),
  data_prazo date,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- COMPRAS — materiais/gastos de um projeto, cada uma com um responsável
-- ----------------------------------------------------------------------------
create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos (id) on delete cascade,
  descricao text not null,
  valor numeric(14, 2) not null default 0,
  responsavel_id uuid references public.equipe (id) on delete set null,
  data date default current_date,
  created_at timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
-- PREÇOS DOS SERVIÇOS — tabela de preços da empresa: para cada serviço que
-- ela faz (ids de src/lib/servicos.ts), a unidade de cobrança e o valor.
-- Unidades: m2 (metro quadrado), ml (metro linear), un (unidade/peça),
-- m3 (metro cúbico), vb (verba / preço fechado), dia (diária).
-- ----------------------------------------------------------------------------
create table if not exists public.precos_servicos (
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  servico_id text not null,
  unidade text not null default 'm2'
    check (unidade in ('m2', 'ml', 'un', 'm3', 'vb', 'dia')),
  preco numeric(14, 2) not null default 0 check (preco >= 0),
  updated_at timestamptz not null default now(),
  primary key (empresa_id, servico_id)
);

-- ----------------------------------------------------------------------------
-- ÁREAS DO PROJETO — partes da obra medidas separadamente
-- (ex.: Garagem, Área da piscina, Escada do deck).
-- ----------------------------------------------------------------------------
create table if not exists public.projeto_areas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos (id) on delete cascade,
  nome text not null,
  observacao text,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- ITENS DO ORÇAMENTO — um serviço medido numa área. O preço unitário é
-- copiado da tabela de preços no momento do orçamento, para que mudar o
-- preço depois não altere orçamentos já feitos. `memoria_calculo` guarda a
-- conta digitada ou ditada (ex.: "5,2 x 3,4 + 2 x 1,5").
-- ----------------------------------------------------------------------------
create table if not exists public.projeto_itens (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.projeto_areas (id) on delete cascade,
  projeto_id uuid not null references public.projetos (id) on delete cascade,
  servico_id text,
  descricao text,
  unidade text not null default 'm2'
    check (unidade in ('m2', 'ml', 'un', 'm3', 'vb', 'dia')),
  quantidade numeric(14, 3) not null default 0 check (quantidade >= 0),
  memoria_calculo text,
  preco_unitario numeric(14, 2) not null default 0 check (preco_unitario >= 0),
  total numeric(16, 2) generated always as (round(quantidade * preco_unitario, 2)) stored,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  check (servico_id is not null or descricao is not null)
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- Cada usuário só vê/edita os dados da própria empresa (owner_id = auth.uid())
-- ============================================================================

alter table public.empresas enable row level security;
alter table public.equipe enable row level security;
alter table public.clientes enable row level security;
alter table public.projetos enable row level security;
alter table public.etapas enable row level security;
alter table public.compras enable row level security;
alter table public.precos_servicos enable row level security;
alter table public.projeto_areas enable row level security;
alter table public.projeto_itens enable row level security;

-- Projetos novos do Supabase não dão mais acesso automático às tabelas do
-- schema public para a API. Sem este GRANT, toda leitura e escrita do app
-- falha com "permission denied for table ...". Quem logou só enxerga as
-- próprias linhas por causa das políticas de RLS abaixo; visitante (anon)
-- continua sem acesso.
grant select, insert, update, delete on
  public.empresas, public.equipe, public.clientes,
  public.projetos, public.etapas, public.compras,
  public.precos_servicos, public.projeto_areas, public.projeto_itens
to authenticated;

drop policy if exists "empresas_select_own" on public.empresas;
drop policy if exists "empresas_insert_own" on public.empresas;
drop policy if exists "empresas_update_own" on public.empresas;
drop policy if exists "empresas_delete_own" on public.empresas;

create policy "empresas_select_own" on public.empresas
  for select using (owner_id = auth.uid());
create policy "empresas_insert_own" on public.empresas
  for insert with check (owner_id = auth.uid());
create policy "empresas_update_own" on public.empresas
  for update using (owner_id = auth.uid());
create policy "empresas_delete_own" on public.empresas
  for delete using (owner_id = auth.uid());

-- Tabelas filhas: a posse é verificada via join com empresas.owner_id
drop policy if exists "equipe_all_own" on public.equipe;
create policy "equipe_all_own" on public.equipe
  for all using (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
  ) with check (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
  );

drop policy if exists "clientes_all_own" on public.clientes;
create policy "clientes_all_own" on public.clientes
  for all using (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
  ) with check (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
  );

drop policy if exists "projetos_all_own" on public.projetos;
create policy "projetos_all_own" on public.projetos
  for all using (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
  ) with check (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
  );

drop policy if exists "etapas_all_own" on public.etapas;
create policy "etapas_all_own" on public.etapas
  for all using (
    projeto_id in (
      select p.id from public.projetos p
      join public.empresas e on e.id = p.empresa_id
      where e.owner_id = auth.uid()
    )
  ) with check (
    projeto_id in (
      select p.id from public.projetos p
      join public.empresas e on e.id = p.empresa_id
      where e.owner_id = auth.uid()
    )
  );

drop policy if exists "compras_all_own" on public.compras;
create policy "compras_all_own" on public.compras
  for all using (
    projeto_id in (
      select p.id from public.projetos p
      join public.empresas e on e.id = p.empresa_id
      where e.owner_id = auth.uid()
    )
  ) with check (
    projeto_id in (
      select p.id from public.projetos p
      join public.empresas e on e.id = p.empresa_id
      where e.owner_id = auth.uid()
    )
  );

drop policy if exists "precos_servicos_all_own" on public.precos_servicos;
create policy "precos_servicos_all_own" on public.precos_servicos
  for all using (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
  ) with check (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
  );

drop policy if exists "projeto_areas_all_own" on public.projeto_areas;
create policy "projeto_areas_all_own" on public.projeto_areas
  for all using (
    projeto_id in (
      select p.id from public.projetos p
      join public.empresas e on e.id = p.empresa_id
      where e.owner_id = auth.uid()
    )
  ) with check (
    projeto_id in (
      select p.id from public.projetos p
      join public.empresas e on e.id = p.empresa_id
      where e.owner_id = auth.uid()
    )
  );

drop policy if exists "projeto_itens_all_own" on public.projeto_itens;
create policy "projeto_itens_all_own" on public.projeto_itens
  for all using (
    projeto_id in (
      select p.id from public.projetos p
      join public.empresas e on e.id = p.empresa_id
      where e.owner_id = auth.uid()
    )
  ) with check (
    projeto_id in (
      select p.id from public.projetos p
      join public.empresas e on e.id = p.empresa_id
      where e.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- salvar_orcamento: grava de uma vez as áreas e itens de um projeto
-- (substitui os anteriores) e atualiza projetos.orcamento_total com a soma.
-- Uma chamada só, em transação: serve para a tela e, depois, para o
-- assistente por voz/IA montar o orçamento a partir de uma fala.
--
-- p_areas: [{ "nome": "Garagem", "observacao": null, "itens": [
--   { "servico_id": "ceramica-porcelanato", "descricao": null, "unidade": "m2",
--     "quantidade": 71.11, "memoria_calculo": null, "preco_unitario": 140 } ] }]
--
-- Roda com as permissões de quem chama (security invoker), então o RLS
-- acima continua valendo.
-- ============================================================================
create or replace function public.salvar_orcamento(p_projeto_id uuid, p_areas jsonb)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_area jsonb;
  v_area_ordem bigint;
  v_area_id uuid;
  v_total numeric;
begin
  if not exists (select 1 from public.projetos where id = p_projeto_id) then
    raise exception 'Projeto não encontrado';
  end if;

  delete from public.projeto_areas where projeto_id = p_projeto_id;

  for v_area, v_area_ordem in
    select value, ordinality from jsonb_array_elements(coalesce(p_areas, '[]'::jsonb)) with ordinality
  loop
    insert into public.projeto_areas (projeto_id, nome, observacao, ordem)
    values (
      p_projeto_id,
      coalesce(nullif(trim(v_area ->> 'nome'), ''), 'Área ' || v_area_ordem),
      nullif(trim(v_area ->> 'observacao'), ''),
      v_area_ordem
    )
    returning id into v_area_id;

    insert into public.projeto_itens
      (area_id, projeto_id, servico_id, descricao, unidade, quantidade, memoria_calculo, preco_unitario, ordem)
    select
      v_area_id,
      p_projeto_id,
      nullif(item ->> 'servico_id', ''),
      nullif(trim(item ->> 'descricao'), ''),
      coalesce(nullif(item ->> 'unidade', ''), 'm2'),
      coalesce((item ->> 'quantidade')::numeric, 0),
      nullif(trim(item ->> 'memoria_calculo'), ''),
      coalesce((item ->> 'preco_unitario')::numeric, 0),
      ordem
    from jsonb_array_elements(coalesce(v_area -> 'itens', '[]'::jsonb)) with ordinality as t(item, ordem);
  end loop;

  select coalesce(sum(total), 0) into v_total
  from public.projeto_itens where projeto_id = p_projeto_id;

  -- Sem itens, o orçamento continua sendo o valor digitado à mão.
  if exists (select 1 from public.projeto_itens where projeto_id = p_projeto_id) then
    update public.projetos set orcamento_total = v_total where id = p_projeto_id;
  end if;

  return v_total;
end;
$$;

revoke all on function public.salvar_orcamento(uuid, jsonb) from public, anon;
grant execute on function public.salvar_orcamento(uuid, jsonb) to authenticated;

-- ============================================================================
-- Índices úteis
-- ============================================================================
create index if not exists idx_equipe_empresa on public.equipe (empresa_id);
create index if not exists idx_clientes_empresa on public.clientes (empresa_id);
create index if not exists idx_projetos_empresa on public.projetos (empresa_id);
create index if not exists idx_projetos_cliente on public.projetos (cliente_id);
create index if not exists idx_etapas_projeto on public.etapas (projeto_id);
create index if not exists idx_compras_projeto on public.compras (projeto_id);
create index if not exists idx_projeto_areas_projeto on public.projeto_areas (projeto_id);
create index if not exists idx_projeto_itens_area on public.projeto_itens (area_id);
create index if not exists idx_projeto_itens_projeto on public.projeto_itens (projeto_id);
