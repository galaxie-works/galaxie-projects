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

-- ============================================================================
-- Índices úteis
-- ============================================================================
create index if not exists idx_equipe_empresa on public.equipe (empresa_id);
create index if not exists idx_clientes_empresa on public.clientes (empresa_id);
create index if not exists idx_projetos_empresa on public.projetos (empresa_id);
create index if not exists idx_projetos_cliente on public.projetos (cliente_id);
create index if not exists idx_etapas_projeto on public.etapas (projeto_id);
create index if not exists idx_compras_projeto on public.compras (projeto_id);
