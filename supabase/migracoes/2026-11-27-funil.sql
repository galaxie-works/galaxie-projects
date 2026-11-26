-- ============================================================================
-- Funil de negócios (fase 2 do plano de CRM). Pode rodar de novo com segurança.
-- ============================================================================

-- Obra cancelada: proposta perdida sai das listas sem apagar o orçamento.
alter table public.projetos drop constraint if exists projetos_status_check;
alter table public.projetos add constraint projetos_status_check
  check (status in ('planejamento', 'em_execucao', 'pausado', 'completo', 'cancelado'));

-- NEGÓCIOS — cada oportunidade de venda de um cliente. O orçamento mora numa
-- obra em planejamento ligada ao negócio (projeto_id); ganhar mantém a obra,
-- perder cancela a obra.
create table if not exists public.negocios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  titulo text not null,
  fase text not null default 'novo'
    check (fase in ('novo', 'visita_agendada', 'medicao', 'orcamento_enviado',
                    'negociacao', 'contrato_assinado', 'ganho', 'perdido')),
  valor_estimado numeric(14, 2),
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
