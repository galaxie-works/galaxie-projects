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
  v_tinha_itens boolean;
begin
  if not exists (select 1 from public.projetos where id = p_projeto_id) then
    raise exception 'Projeto não encontrado';
  end if;

  v_tinha_itens := exists (select 1 from public.projeto_itens where projeto_id = p_projeto_id);
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

  -- Projeto que nunca teve itens mantém o valor digitado à mão; se tinha
  -- e todos foram removidos, o total calculado vai a zero.
  if v_tinha_itens or exists (select 1 from public.projeto_itens where projeto_id = p_projeto_id) then
    update public.projetos set orcamento_total = v_total where id = p_projeto_id;
  end if;

  return v_total;
end;
$$;

revoke all on function public.salvar_orcamento(uuid, jsonb) from public, anon;
grant execute on function public.salvar_orcamento(uuid, jsonb) to authenticated;

-- ============================================================================
-- CRM — Cliente 360 (fase 1)
-- Fase do cliente (automática + ajuste manual), temperatura, origem,
-- responsável, follow-up e atividades (linha do tempo do cliente).
-- A fase automática é calculada no app a partir das obras (src/lib/crm.ts);
-- fase_manual guarda só o ajuste feito à mão.
-- Pode rodar de novo com segurança.
-- ============================================================================

alter table public.clientes
  add column if not exists fase_manual text
    check (fase_manual in ('lead', 'prospect', 'proposta', 'cliente', 'pos_venda', 'inativo')),
  add column if not exists temperatura text
    check (temperatura in ('frio', 'morno', 'quente')),
  add column if not exists origem text,
  add column if not exists responsavel_id uuid references public.equipe (id) on delete set null,
  add column if not exists tags text[] not null default '{}',
  add column if not exists proximo_followup_em date,
  add column if not exists observacoes text;

-- ATIVIDADES — notas, ligações, mensagens e visitas ligadas ao cliente.
-- Na fase 2 ganham tarefa com prazo e vínculo com negócio.
create table if not exists public.atividades (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  projeto_id uuid references public.projetos (id) on delete set null,
  tipo text not null default 'nota'
    check (tipo in ('nota', 'ligacao', 'whatsapp', 'visita', 'reuniao', 'email', 'audio')),
  texto text not null,
  responsavel_id uuid references public.equipe (id) on delete set null,
  ocorreu_em timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.atividades enable row level security;
grant select, insert, update, delete on public.atividades to authenticated;

drop policy if exists "atividades_all_own" on public.atividades;
create policy "atividades_all_own" on public.atividades
  for all using (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
  ) with check (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
    and cliente_id in (
      select c.id from public.clientes c
      join public.empresas e on e.id = c.empresa_id
      where e.owner_id = auth.uid()
    )
  );

create index if not exists idx_atividades_cliente on public.atividades (cliente_id, ocorreu_em desc);

-- ============================================================================
-- FUNIL DE NEGÓCIOS (fase 2 do CRM)
-- ============================================================================
-- NEGÓCIOS — cada oportunidade de venda de um cliente. O orçamento fica no
-- próprio negócio (projeto_areas/projeto_itens com negocio_id) até ser
-- ganho; ganhar cria a obra e passa as áreas e itens para ela.
create table if not exists public.negocios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  titulo text not null,
  fase text not null default 'novo'
    check (fase in ('novo', 'visita_agendada', 'medicao', 'orcamento_enviado',
                    'negociacao', 'contrato_assinado', 'ganho', 'perdido')),
  valor_estimado numeric(14, 2),
  orcamento_total numeric(14, 2) not null default 0,
  valor_fechado numeric(14, 2),
  probabilidade int check (probabilidade between 0 and 100),
  previsao_fechamento date,
  motivo_perda text,
  responsavel_id uuid references public.equipe (id) on delete set null,
  projeto_id uuid references public.projetos (id) on delete set null,
  ordem int not null default 0,
  fase_alterada_em timestamptz not null default now(),
  fechado_em timestamptz,
  created_at timestamptz not null default now(),
  check (fase <> 'perdido' or motivo_perda is not null)
);

alter table public.negocios enable row level security;
grant select, insert, update, delete on public.negocios to authenticated;

drop policy if exists "negocios_all_own" on public.negocios;
create policy "negocios_all_own" on public.negocios
  for all using (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
  ) with check (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
    and cliente_id in (
      select c.id from public.clientes c
      join public.empresas e on e.id = c.empresa_id
      where e.owner_id = auth.uid()
    )
    and (projeto_id is null or projeto_id in (
      select p.id from public.projetos p
      join public.empresas e on e.id = p.empresa_id
      where e.owner_id = auth.uid()
    ))
  );

create index if not exists idx_negocios_empresa on public.negocios (empresa_id, fase, ordem);
create index if not exists idx_negocios_cliente on public.negocios (cliente_id);

-- Orçamento do negócio: áreas e itens passam a poder pertencer a um negócio
-- (sem obra ainda) ou a uma obra.
alter table public.projeto_areas alter column projeto_id drop not null;
alter table public.projeto_areas
  add column if not exists negocio_id uuid references public.negocios (id) on delete cascade;
alter table public.projeto_areas drop constraint if exists projeto_areas_dono_check;
alter table public.projeto_areas add constraint projeto_areas_dono_check
  check (projeto_id is not null or negocio_id is not null);

alter table public.projeto_itens alter column projeto_id drop not null;
alter table public.projeto_itens
  add column if not exists negocio_id uuid references public.negocios (id) on delete cascade;
alter table public.projeto_itens drop constraint if exists projeto_itens_dono_check;
alter table public.projeto_itens add constraint projeto_itens_dono_check
  check (projeto_id is not null or negocio_id is not null);

create index if not exists idx_projeto_areas_negocio on public.projeto_areas (negocio_id);
create index if not exists idx_projeto_itens_negocio on public.projeto_itens (negocio_id);

drop policy if exists "projeto_areas_all_own" on public.projeto_areas;
create policy "projeto_areas_all_own" on public.projeto_areas
  for all using (
    projeto_id in (
      select p.id from public.projetos p
      join public.empresas e on e.id = p.empresa_id
      where e.owner_id = auth.uid()
    )
    or negocio_id in (
      select n.id from public.negocios n
      join public.empresas e on e.id = n.empresa_id
      where e.owner_id = auth.uid()
    )
  ) with check (
    (projeto_id is null or projeto_id in (
      select p.id from public.projetos p
      join public.empresas e on e.id = p.empresa_id
      where e.owner_id = auth.uid()
    ))
    and (negocio_id is null or negocio_id in (
      select n.id from public.negocios n
      join public.empresas e on e.id = n.empresa_id
      where e.owner_id = auth.uid()
    ))
  );

drop policy if exists "projeto_itens_all_own" on public.projeto_itens;
create policy "projeto_itens_all_own" on public.projeto_itens
  for all using (
    projeto_id in (
      select p.id from public.projetos p
      join public.empresas e on e.id = p.empresa_id
      where e.owner_id = auth.uid()
    )
    or negocio_id in (
      select n.id from public.negocios n
      join public.empresas e on e.id = n.empresa_id
      where e.owner_id = auth.uid()
    )
  ) with check (
    (projeto_id is null or projeto_id in (
      select p.id from public.projetos p
      join public.empresas e on e.id = p.empresa_id
      where e.owner_id = auth.uid()
    ))
    and (negocio_id is null or negocio_id in (
      select n.id from public.negocios n
      join public.empresas e on e.id = n.empresa_id
      where e.owner_id = auth.uid()
    ))
  );

-- salvar_orcamento_negocio: igual a salvar_orcamento, mas grava no negócio
-- e atualiza negocios.orcamento_total. Mesmo formato de p_areas.
create or replace function public.salvar_orcamento_negocio(p_negocio_id uuid, p_areas jsonb)
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
  if not exists (select 1 from public.negocios where id = p_negocio_id) then
    raise exception 'Negócio não encontrado';
  end if;

  delete from public.projeto_areas where negocio_id = p_negocio_id and projeto_id is null;

  for v_area, v_area_ordem in
    select value, ordinality from jsonb_array_elements(coalesce(p_areas, '[]'::jsonb)) with ordinality
  loop
    insert into public.projeto_areas (negocio_id, nome, observacao, ordem)
    values (
      p_negocio_id,
      coalesce(nullif(trim(v_area ->> 'nome'), ''), 'Área ' || v_area_ordem),
      nullif(trim(v_area ->> 'observacao'), ''),
      v_area_ordem
    )
    returning id into v_area_id;

    insert into public.projeto_itens
      (area_id, negocio_id, servico_id, descricao, unidade, quantidade, memoria_calculo, preco_unitario, ordem)
    select
      v_area_id,
      p_negocio_id,
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
  from public.projeto_itens where negocio_id = p_negocio_id and projeto_id is null;

  update public.negocios set orcamento_total = v_total where id = p_negocio_id;
  return v_total;
end;
$$;

revoke all on function public.salvar_orcamento_negocio(uuid, jsonb) from public, anon;
grant execute on function public.salvar_orcamento_negocio(uuid, jsonb) to authenticated;

-- ganhar_negocio: cria a obra (em planejamento) com o orçamento do negócio,
-- passa as áreas e itens para ela e marca o negócio como ganho. Tudo numa
-- transação. Se o negócio já tem obra, só marca ganho. Devolve o id da obra.
create or replace function public.ganhar_negocio(p_negocio_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_neg public.negocios;
  v_projeto uuid;
  v_valor numeric;
begin
  select * into v_neg from public.negocios where id = p_negocio_id for update;
  if not found then
    raise exception 'Negócio não encontrado';
  end if;

  v_valor := coalesce(v_neg.valor_fechado, nullif(v_neg.orcamento_total, 0), v_neg.valor_estimado, 0);
  v_projeto := v_neg.projeto_id;

  if v_projeto is null then
    insert into public.projetos (empresa_id, cliente_id, nome, status, orcamento_total)
    values (v_neg.empresa_id, v_neg.cliente_id, v_neg.titulo, 'planejamento', v_valor)
    returning id into v_projeto;

    update public.projeto_areas set projeto_id = v_projeto, negocio_id = null
    where negocio_id = p_negocio_id and projeto_id is null;
    update public.projeto_itens set projeto_id = v_projeto, negocio_id = null
    where negocio_id = p_negocio_id and projeto_id is null;
  end if;

  update public.negocios
  set fase = 'ganho', projeto_id = v_projeto, valor_fechado = nullif(v_valor, 0), motivo_perda = null
  where id = p_negocio_id;

  return v_projeto;
end;
$$;

revoke all on function public.ganhar_negocio(uuid) from public, anon;
grant execute on function public.ganhar_negocio(uuid) to authenticated;

-- Atividades ganham vínculo com negócio e os tipos tarefa e sistema.
-- (Lista completa de tipos, igual em todas as frentes do CRM.)
alter table public.atividades
  add column if not exists negocio_id uuid references public.negocios (id) on delete set null;
alter table public.atividades drop constraint if exists atividades_tipo_check;
alter table public.atividades add constraint atividades_tipo_check
  check (tipo in ('nota', 'ligacao', 'whatsapp', 'visita', 'reuniao', 'email', 'audio', 'tarefa', 'sistema'));

-- Toda criação e mudança de fase de negócio entra na linha do tempo do cliente.
create or replace function public.negocio_fase_rotulo(p_fase text)
returns text language sql immutable as $$
  select case p_fase
    when 'novo' then 'Novo'
    when 'visita_agendada' then 'Visita agendada'
    when 'medicao' then 'Medição'
    when 'orcamento_enviado' then 'Orçamento enviado'
    when 'negociacao' then 'Negociação'
    when 'contrato_assinado' then 'Contrato assinado'
    when 'ganho' then 'Ganho'
    when 'perdido' then 'Perdido'
    else p_fase end
$$;

create or replace function public.negocios_registrar_fase()
returns trigger language plpgsql security invoker as $$
begin
  if tg_op = 'INSERT' then
    insert into public.atividades (empresa_id, cliente_id, negocio_id, projeto_id, tipo, texto)
    values (new.empresa_id, new.cliente_id, new.id, new.projeto_id, 'sistema',
            'Negócio aberto: ' || new.titulo || ' (' || public.negocio_fase_rotulo(new.fase) || ')');
  elsif new.fase is distinct from old.fase then
    insert into public.atividades (empresa_id, cliente_id, negocio_id, projeto_id, tipo, texto)
    values (new.empresa_id, new.cliente_id, new.id, new.projeto_id, 'sistema',
            new.titulo || ': ' || public.negocio_fase_rotulo(old.fase) || ' → '
              || public.negocio_fase_rotulo(new.fase)
              || case when new.fase = 'perdido' then ' (' || new.motivo_perda || ')' else '' end);
  end if;
  return new;
end;
$$;

create or replace function public.negocios_antes_salvar()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.fase is distinct from old.fase then
    new.fase_alterada_em := now();
  end if;
  if new.fase in ('ganho', 'perdido') and (tg_op = 'INSERT' or old.fase not in ('ganho', 'perdido')) then
    new.fechado_em := now();
  elsif new.fase not in ('ganho', 'perdido') then
    new.fechado_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists negocios_antes_salvar on public.negocios;
create trigger negocios_antes_salvar before insert or update on public.negocios
  for each row execute function public.negocios_antes_salvar();

drop trigger if exists negocios_registrar_fase on public.negocios;
create trigger negocios_registrar_fase after insert or update of fase on public.negocios
  for each row execute function public.negocios_registrar_fase();

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

-- ============================================================================
-- CRM — Frente F: arquivos por cliente e obra (Storage, bucket "arquivos")
-- ============================================================================
create table if not exists public.arquivos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete cascade,
  projeto_id uuid references public.projetos (id) on delete cascade,
  nome text not null,
  caminho text not null unique,
  tamanho bigint not null default 0,
  tipo_mime text,
  created_at timestamptz not null default now(),
  check (cliente_id is not null or projeto_id is not null)
);

alter table public.arquivos enable row level security;
grant select, insert, update, delete on public.arquivos to authenticated;

drop policy if exists "arquivos_all_own" on public.arquivos;
create policy "arquivos_all_own" on public.arquivos
  for all using (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
  ) with check (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
    and (cliente_id is null or cliente_id in (
      select c.id from public.clientes c
      join public.empresas e on e.id = c.empresa_id
      where e.owner_id = auth.uid()
    ))
    and (projeto_id is null or projeto_id in (
      select p.id from public.projetos p
      join public.empresas e on e.id = p.empresa_id
      where e.owner_id = auth.uid()
    ))
  );

create index if not exists idx_arquivos_cliente on public.arquivos (cliente_id, created_at desc);
create index if not exists idx_arquivos_projeto on public.arquivos (projeto_id, created_at desc);

-- Bucket privado (20 MB por arquivo). Downloads usam URL assinada.
insert into storage.buckets (id, name, public, file_size_limit)
values ('arquivos', 'arquivos', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- Só a empresa dona mexe na própria pasta (primeiro nível do caminho = empresa_id).
drop policy if exists "arquivos_storage_own" on storage.objects;
create policy "arquivos_storage_own" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'arquivos'
    and (storage.foldername(name))[1] in (
      select id::text from public.empresas where owner_id = auth.uid()
    )
  ) with check (
    bucket_id = 'arquivos'
    and (storage.foldername(name))[1] in (
      select id::text from public.empresas where owner_id = auth.uid()
    )
  );
