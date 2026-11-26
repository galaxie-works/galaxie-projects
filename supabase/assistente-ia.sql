-- ============================================================================
-- Assistente de IA — chave de API por empresa
-- ============================================================================
-- Rode depois de schema.sql (Supabase Dashboard -> SQL Editor -> Run). Pode
-- rodar de novo com segurança.
--
-- A chave do provedor (Anthropic, OpenAI ou DeepSeek) é cifrada no servidor
-- com AES-256-GCM usando a variável de ambiente IA_CHAVE_MESTRA (Vercel) antes
-- de chegar aqui. O banco só guarda o texto cifrado e os 4 últimos caracteres
-- para mostrar na tela; sem a chave mestra, o conteúdo não serve para nada.
-- ============================================================================

create table if not exists public.empresa_ia_config (
  empresa_id uuid primary key references public.empresas (id) on delete cascade,
  provedor text not null check (provedor in ('anthropic', 'openai', 'deepseek')),
  modelo text not null,
  chave_cifrada text not null,
  chave_final text not null,
  ativo boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.empresa_ia_config enable row level security;

grant select, insert, update, delete on public.empresa_ia_config to authenticated;

drop policy if exists "empresa_ia_config_all_own" on public.empresa_ia_config;
create policy "empresa_ia_config_all_own" on public.empresa_ia_config
  for all using (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
  ) with check (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
  );
