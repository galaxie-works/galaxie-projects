-- Logo da empresa (aparece no topo do menu) e perfil de quem usa o app
-- (nome e foto no menu do usuário). Idempotente.

alter table public.empresas add column if not exists logo_caminho text;

-- Um perfil por login. Fica separado da empresa porque, com a equipe entrando
-- no app, cada pessoa tem o próprio nome e a própria foto.
create table if not exists public.perfis (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  foto_caminho text,
  updated_at timestamptz not null default now()
);

alter table public.perfis enable row level security;

drop policy if exists "perfis_proprio" on public.perfis;
create policy "perfis_proprio" on public.perfis
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.perfis to authenticated;

-- Os arquivos (logo e foto) vão para o bucket privado "arquivos", na pasta
-- da empresa: <empresa_id>/marca/... e <empresa_id>/usuarios/<user_id>/...
-- A política do bucket por empresa já cobre os dois caminhos.
