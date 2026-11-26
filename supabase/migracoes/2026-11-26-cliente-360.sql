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
