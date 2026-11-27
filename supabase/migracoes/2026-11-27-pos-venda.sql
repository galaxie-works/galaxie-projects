-- ============================================================================
-- CRM — Pós-venda (frente D)
-- Garantia, pesquisa de satisfação (0 a 10), pedido de avaliação no Google,
-- revisões periódicas por serviço, chamados de assistência e indicações.
-- Ao marcar a obra como completa, o banco cria garantia, pesquisa (7 dias),
-- avaliação (10 dias) e as revisões dos serviços do orçamento.
-- Pode rodar de novo com segurança.
-- ============================================================================

alter table public.empresas
  add column if not exists garantia_meses integer not null default 12
    check (garantia_meses between 0 and 120),
  add column if not exists link_avaliacao_google text;

-- Quem indicou este cliente (indicação vira cliente lead com origem "Indicação").
alter table public.clientes
  add column if not exists indicado_por_id uuid references public.clientes (id) on delete set null;

create table if not exists public.pos_venda (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  projeto_id uuid references public.projetos (id) on delete cascade,
  tipo text not null
    check (tipo in ('garantia', 'pesquisa', 'avaliacao', 'revisao', 'assistencia', 'indicacao')),
  titulo text not null,
  texto text,
  -- Revisão: serviço do orçamento (ids de src/lib/servicos.ts).
  servico_id text,
  -- Indicação: o cliente novo criado a partir dela.
  indicado_cliente_id uuid references public.clientes (id) on delete set null,
  vence_em date,
  status text not null default 'aberto' check (status in ('aberto', 'agendado', 'resolvido')),
  nota_0_10 integer check (nota_0_10 between 0 and 10),
  resolvido_em timestamptz,
  created_at timestamptz not null default now()
);

alter table public.pos_venda enable row level security;
grant select, insert, update, delete on public.pos_venda to authenticated;

drop policy if exists "pos_venda_all_own" on public.pos_venda;
create policy "pos_venda_all_own" on public.pos_venda
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

create index if not exists idx_pos_venda_cliente on public.pos_venda (cliente_id, vence_em);
create index if not exists idx_pos_venda_projeto on public.pos_venda (projeto_id);
create index if not exists idx_pos_venda_empresa_aberto on public.pos_venda (empresa_id, vence_em)
  where status <> 'resolvido';

-- Intervalo de revisão (meses) por serviço. null = serviço sem revisão periódica.
create or replace function public.revisao_meses_servico(p_servico text)
returns integer
language sql
immutable
as $$
  select case
    when p_servico in ('ar-condicionado', 'casa-maquinas', 'aquecimento-piscina', 'portao-automatico') then 6
    when p_servico in (
      'imper-laje', 'imper-banheiro', 'imper-piscina', 'imper-baldrame',
      'telhado-novo', 'reforma-telhado', 'calhas-rufos',
      'fotovoltaico', 'aquecimento-solar', 'aquecedor', 'spda', 'incendio', 'cerca-eletrica',
      'granilite', 'fulget', 'cimento-queimado', 'piso-epoxi', 'restauracao-pisos',
      'pedras-naturais', 'madeira', 'deck-madeira', 'verniz-madeira'
    ) then 12
    when p_servico in ('pintura-externa', 'textura-grafiato') then 24
    else null
  end
$$;

-- Cria o pós-venda de uma obra concluída. Não duplica: se a garantia já
-- existe, não faz nada. Devolve quantos itens criou.
create or replace function public.gerar_pos_venda(p_projeto_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_proj record;
  v_meses integer;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_criados integer := 0;
  v_n integer;
begin
  select p.id, p.empresa_id, p.cliente_id, p.nome into v_proj
  from public.projetos p where p.id = p_projeto_id;
  if not found then
    return 0;
  end if;

  if exists (
    select 1 from public.pos_venda where projeto_id = p_projeto_id and tipo = 'garantia'
  ) then
    return 0;
  end if;

  select coalesce(e.garantia_meses, 12) into v_meses from public.empresas e where e.id = v_proj.empresa_id;

  insert into public.pos_venda (empresa_id, cliente_id, projeto_id, tipo, titulo, texto, vence_em)
  values
    (v_proj.empresa_id, v_proj.cliente_id, v_proj.id, 'garantia', 'Garantia da obra',
      format('Garantia de %s meses a partir da entrega.', v_meses),
      (v_hoje + make_interval(months => v_meses))::date),
    (v_proj.empresa_id, v_proj.cliente_id, v_proj.id, 'pesquisa', 'Pesquisa de satisfação',
      'De 0 a 10, quanto o cliente recomendaria a empresa?', v_hoje + 7),
    (v_proj.empresa_id, v_proj.cliente_id, v_proj.id, 'avaliacao', 'Pedir avaliação no Google',
      'Mandar o link de avaliação pelo WhatsApp.', v_hoje + 10);
  v_criados := 3;

  insert into public.pos_venda (empresa_id, cliente_id, projeto_id, tipo, titulo, servico_id, vence_em)
  select v_proj.empresa_id, v_proj.cliente_id, v_proj.id, 'revisao', 'Revisão periódica', s.servico_id,
    (v_hoje + make_interval(months => public.revisao_meses_servico(s.servico_id)))::date
  from (
    select distinct i.servico_id from public.projeto_itens i
    where i.projeto_id = p_projeto_id and i.servico_id is not null
  ) s
  where public.revisao_meses_servico(s.servico_id) is not null;
  get diagnostics v_n = row_count;
  v_criados := v_criados + v_n;

  -- A pesquisa vira o próximo follow-up do cliente quando ele não tem um futuro.
  update public.clientes
  set proximo_followup_em = v_hoje + 7
  where id = v_proj.cliente_id
    and (proximo_followup_em is null or proximo_followup_em < v_hoje);

  return v_criados;
end;
$$;

grant execute on function public.gerar_pos_venda(uuid) to authenticated;

create or replace function public.projetos_pos_venda_trigger()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status = 'completo' and (tg_op = 'INSERT' or old.status is distinct from 'completo') then
    perform public.gerar_pos_venda(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists projetos_pos_venda on public.projetos;
create trigger projetos_pos_venda
  after insert or update of status on public.projetos
  for each row execute function public.projetos_pos_venda_trigger();
