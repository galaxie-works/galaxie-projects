-- ============================================================================
-- Funil de negócios (fase 2 do plano de CRM). Pode rodar de novo com segurança.
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
-- Se a coluna já existia sem FK (criada antes da tabela negocios), liga agora.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.atividades'::regclass and conname = 'atividades_negocio_id_fkey'
  ) then
    alter table public.atividades
      add constraint atividades_negocio_id_fkey
      foreign key (negocio_id) references public.negocios (id) on delete set null;
  end if;
end $$;
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
