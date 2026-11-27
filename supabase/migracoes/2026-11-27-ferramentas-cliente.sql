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
