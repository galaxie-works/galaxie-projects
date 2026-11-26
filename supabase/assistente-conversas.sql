-- ============================================================================
-- Assistente de IA — conversas de cada usuário
-- ============================================================================
-- Rode depois de schema.sql. Pode rodar de novo com segurança.
--
-- Cada linha é uma conversa (lista "Recentes" do assistente). As mensagens
-- ficam em jsonb, no mesmo formato que a tela usa. Cada pessoa só vê as suas.
-- ============================================================================

create table if not exists public.assistente_conversas (
  id uuid primary key,
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null default '',
  mensagens jsonb not null default '[]'::jsonb,
  atualizada_em timestamptz not null default now()
);

create index if not exists idx_assistente_conversas_usuario
  on public.assistente_conversas (usuario_id, atualizada_em desc);

alter table public.assistente_conversas enable row level security;

grant select, insert, update, delete on public.assistente_conversas to authenticated;

drop policy if exists "assistente_conversas_proprias" on public.assistente_conversas;
create policy "assistente_conversas_proprias" on public.assistente_conversas
  for all using (
    usuario_id = auth.uid()
  ) with check (
    usuario_id = auth.uid()
    and empresa_id in (select id from public.empresas where owner_id = auth.uid())
  );
