-- Diário de obra (RDO): registro do dia feito pela equipe de campo, com
-- atividades, clima, equipe presente, ocorrências e fotos. O app grava no
-- celular sem internet e sincroniza depois, por isso o id vem do aparelho
-- (upsert pelo id, sem duplicar quando a sincronização repete).
-- As fotos vão para o bucket privado "arquivos" (já em .webp, compactadas no
-- aparelho) e entram na tabela arquivos com diario_id: aparecem também na aba
-- Arquivos da obra. Idempotente.

create table if not exists public.diario_obra (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  projeto_id uuid not null references public.projetos (id) on delete cascade,
  data date not null,
  clima_manha text check (clima_manha is null or clima_manha in ('sol', 'nublado', 'chuva', 'impraticavel')),
  clima_tarde text check (clima_tarde is null or clima_tarde in ('sol', 'nublado', 'chuva', 'impraticavel')),
  equipe_presente uuid[] not null default '{}',
  atividades text,
  ocorrencias text,
  criado_por uuid default auth.uid(),
  registrado_em timestamptz not null default now(), -- quando foi anotado no aparelho
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_diario_obra_projeto on public.diario_obra (projeto_id, data desc, registrado_em desc);
create index if not exists idx_diario_obra_empresa on public.diario_obra (empresa_id, data desc);

alter table public.diario_obra enable row level security;
grant select, insert, update, delete on public.diario_obra to authenticated;

drop policy if exists "diario_obra_all_own" on public.diario_obra;
create policy "diario_obra_all_own" on public.diario_obra
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

-- Mesmo bloqueio por assinatura das outras tabelas com empresa_id.
drop policy if exists "assinatura_vigente" on public.diario_obra;
create policy "assinatura_vigente" on public.diario_obra
  as restrictive for all to authenticated
  using (public.assinatura_vigente(empresa_id))
  with check (public.assinatura_vigente(empresa_id));

create or replace function public.diario_obra_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists diario_obra_updated_at on public.diario_obra;
create trigger diario_obra_updated_at
  before update on public.diario_obra
  for each row execute function public.diario_obra_updated_at();

-- Fotos do diário: ficam na tabela arquivos, ligadas ao registro do dia.
alter table public.arquivos add column if not exists diario_id uuid
  references public.diario_obra (id) on delete cascade;
alter table public.arquivos add column if not exists legenda text;
create index if not exists idx_arquivos_diario on public.arquivos (diario_id) where diario_id is not null;
