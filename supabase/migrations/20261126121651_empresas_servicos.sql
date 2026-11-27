alter table public.empresas add column if not exists servicos text[] not null default '{}';
