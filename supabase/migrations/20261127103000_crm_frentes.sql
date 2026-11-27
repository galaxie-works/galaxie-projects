-- CRM: recebimentos (C), agenda/follow-ups (B), pós-venda (D) e arquivos (F).
-- Idempotente. O funil (A) entra numa migration própria quando for refeito.

-- ===== financeiro-recebimentos.sql =====
-- ============================================================================
-- CRM — Frente C: Financeiro (recebimentos)
-- Parcelas que o cliente paga por obra: valor, vencimento, quando foi
-- recebida e a forma. Só controle (sem boleto, nota fiscal ou conciliação).
-- Pode rodar de novo com segurança.
-- ============================================================================

create table if not exists public.recebimentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  projeto_id uuid not null references public.projetos (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete set null,
  descricao text not null,
  valor numeric(14, 2) not null default 0 check (valor >= 0),
  vencimento date not null default current_date,
  recebido_em date,
  forma text check (forma in ('pix', 'boleto', 'cartao', 'dinheiro', 'transferencia')),
  comprovante_url text,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.recebimentos enable row level security;
grant select, insert, update, delete on public.recebimentos to authenticated;

drop policy if exists "recebimentos_all_own" on public.recebimentos;
create policy "recebimentos_all_own" on public.recebimentos
  for all using (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
  ) with check (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
    and projeto_id in (
      select p.id from public.projetos p
      join public.empresas e on e.id = p.empresa_id
      where e.owner_id = auth.uid()
    )
  );

create index if not exists idx_recebimentos_projeto on public.recebimentos (projeto_id, vencimento);
create index if not exists idx_recebimentos_cliente on public.recebimentos (cliente_id, vencimento);
create index if not exists idx_recebimentos_empresa on public.recebimentos (empresa_id, vencimento);

-- ===== agenda-followups.sql =====
-- ============================================================================
-- CRM — Agenda, follow-ups e Início (frente B)
-- Atividades ganham prazo (previsto_para), conclusão e resultado, e viram
-- tarefas / próximos passos. O próximo follow-up do cliente passa a ser
-- calculado a partir das tarefas abertas (gatilho abaixo).
-- Pode rodar de novo com segurança.
-- ============================================================================

alter table public.atividades
  add column if not exists previsto_para timestamptz,
  add column if not exists concluida_em timestamptz,
  add column if not exists resultado text,
  add column if not exists negocio_id uuid;

-- Lista completa de tipos (compartilhada entre as frentes do CRM).
alter table public.atividades drop constraint if exists atividades_tipo_check;
alter table public.atividades add constraint atividades_tipo_check
  check (tipo in ('nota', 'ligacao', 'whatsapp', 'visita', 'reuniao', 'email', 'audio', 'tarefa', 'sistema'));

-- negocio_id só vira chave estrangeira quando a tabela de negócios existir
-- (frente A). Rodar este arquivo de novo depois dela liga a FK.
do $$
begin
  if to_regclass('public.negocios') is not null
     and not exists (select 1 from pg_constraint where conname = 'atividades_negocio_id_fkey') then
    alter table public.atividades
      add constraint atividades_negocio_id_fkey
      foreign key (negocio_id) references public.negocios (id) on delete set null;
  end if;
end $$;

create index if not exists idx_atividades_agenda
  on public.atividades (empresa_id, previsto_para)
  where previsto_para is not null and concluida_em is null;

-- Follow-ups marcados à mão antes da agenda (campo do Cliente 360) viram
-- tarefas, para o gatilho abaixo não apagá-los. Só para clientes sem tarefa
-- aberta, então rodar de novo não duplica.
insert into public.atividades (empresa_id, cliente_id, tipo, texto, responsavel_id, previsto_para)
select c.empresa_id, c.id, 'tarefa', 'Follow-up', c.responsavel_id,
       (c.proximo_followup_em::text || ' 09:00 America/Sao_Paulo')::timestamptz
from public.clientes c
where c.proximo_followup_em is not null
  and not exists (
    select 1 from public.atividades a
    where a.cliente_id = c.id and a.previsto_para is not null and a.concluida_em is null
  );

-- Próximo follow-up do cliente = data da tarefa aberta mais próxima
-- (no fuso de Brasília). Sem tarefa aberta, fica sem data.
-- Só roda quando a linha é (ou era) uma tarefa: registrar uma nota não mexe.
create or replace function public.atualizar_followup_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo uuid;
begin
  if not coalesce(
    (tg_op <> 'INSERT' and old.previsto_para is not null)
    or (tg_op <> 'DELETE' and new.previsto_para is not null),
    false
  ) then
    return null;
  end if;
  foreach alvo in array array[
    case when tg_op <> 'INSERT' then old.cliente_id end,
    case when tg_op <> 'DELETE' then new.cliente_id end
  ] loop
    if alvo is not null then
      update public.clientes c
      set proximo_followup_em = (
        select min((a.previsto_para at time zone 'America/Sao_Paulo')::date)
        from public.atividades a
        where a.cliente_id = alvo and a.previsto_para is not null and a.concluida_em is null
      )
      where c.id = alvo;
    end if;
  end loop;
  return null;
end $$;

drop trigger if exists trg_atividades_followup on public.atividades;
create trigger trg_atividades_followup
  after insert or delete or update of previsto_para, concluida_em, cliente_id
  on public.atividades
  for each row execute function public.atualizar_followup_cliente();

-- ===== pos-venda.sql =====
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

-- ===== ferramentas-cliente-arquivos.sql =====
-- ============================================================================
-- CRM — Frente F (ferramentas de cliente): arquivos por cliente e por obra.
-- Os arquivos ficam no Supabase Storage (bucket privado "arquivos"), com o
-- caminho começando pelo id da empresa: <empresa_id>/<cliente_id>/<uuid>-<nome>.
-- A tabela guarda o índice para listar sem varrer o Storage.
-- Pode rodar de novo com segurança.
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

