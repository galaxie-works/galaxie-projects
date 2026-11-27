-- SaaS: cada empresa é um tenant com tipo de pessoa e assinatura.
--
-- empresas.tipo_pessoa: 'PF' (pessoa física, não emite nota) ou 'PJ'
-- (pessoa jurídica, emite NFS-e). empresas.cpf guarda o documento da PF;
-- o CNPJ continua em empresas.cnpj.
--
-- assinaturas: uma por empresa. Toda empresa nova nasce em teste grátis de
-- 30 dias (gatilho abaixo). Quem usa o app só lê a própria assinatura:
-- mudar plano, status ou datas fica para o servidor (webhook do gateway, com
-- service role), senão qualquer conta poderia esticar o próprio teste.
--
-- Pensado para a equipe com login: a assinatura é da empresa, não da pessoa.
-- Quando houver membros com login, a política de leitura passa a aceitar
-- membros também, e todos herdam o acesso da empresa.

alter table public.empresas
  add column if not exists tipo_pessoa text not null default 'PJ',
  add column if not exists cpf text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'empresas_tipo_pessoa_check'
  ) then
    alter table public.empresas
      add constraint empresas_tipo_pessoa_check check (tipo_pessoa in ('PF', 'PJ'));
  end if;
end $$;

create table if not exists public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null unique references public.empresas (id) on delete cascade,
  -- 'teste' enquanto não escolhe plano; 'cortesia' não vence (contas da casa).
  plano text not null default 'teste',
  -- teste | ativa | atrasada | cancelada | cortesia
  status text not null default 'teste'
    check (status in ('teste', 'ativa', 'atrasada', 'cancelada', 'cortesia')),
  teste_inicio timestamptz not null default now(),
  teste_fim timestamptz not null default now() + interval '30 days',
  -- Fim do período já pago (assinatura ativa ou cancelada que ainda vale).
  periodo_fim timestamptz,
  -- Preenchidos quando o gateway de pagamento entrar.
  gateway text,
  gateway_cliente_id text,
  gateway_assinatura_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assinaturas enable row level security;

drop policy if exists "assinaturas_select_dono" on public.assinaturas;
create policy "assinaturas_select_dono" on public.assinaturas
  for select using (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
  );

-- Só leitura para quem está logado; escrita só pelo gatilho e pelo servidor.
revoke all on public.assinaturas from anon, authenticated;
grant select on public.assinaturas to authenticated;

-- Empresa nova = teste grátis de 30 dias.
create or replace function public.criar_assinatura_teste()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.assinaturas (empresa_id)
  values (new.id)
  on conflict (empresa_id) do nothing;
  return new;
end;
$$;

drop trigger if exists empresas_assinatura_teste on public.empresas;
create trigger empresas_assinatura_teste
  after insert on public.empresas
  for each row execute function public.criar_assinatura_teste();

-- A empresa pode usar o app agora? Mesma regra de src/lib/assinatura.ts.
create or replace function public.assinatura_vigente(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case a.status
      when 'cortesia' then true
      when 'ativa' then a.periodo_fim is null or a.periodo_fim > now()
      when 'atrasada' then coalesce(a.periodo_fim, now()) + interval '7 days' > now()
      when 'cancelada' then a.periodo_fim is not null and a.periodo_fim > now()
      else a.teste_fim > now()
    end
    from public.assinaturas a
    where a.empresa_id = p_empresa_id
  ), false);
$$;

revoke all on function public.assinatura_vigente(uuid) from public, anon;
grant execute on function public.assinatura_vigente(uuid) to authenticated;

-- Empresas que já existiam antes do SaaS: cortesia (não vencem), menos a
-- conta de teste, que entra no teste grátis para exercitar o fluxo.
insert into public.assinaturas (empresa_id, plano, status)
select e.id, 'cortesia', 'cortesia'
from public.empresas e
where not exists (select 1 from public.assinaturas a where a.empresa_id = e.id);

update public.assinaturas a
set plano = 'teste', status = 'teste', teste_inicio = now(),
    teste_fim = now() + interval '30 days', updated_at = now()
from public.empresas e
join auth.users u on u.id = e.owner_id
where a.empresa_id = e.id
  and u.email = 'teste-claude@example.com'
  and a.status = 'cortesia';

-- Bloqueio também no banco, não só nas telas: em toda tabela com empresa_id
-- (menos empresas e assinaturas), uma política RESTRICTIVE exige assinatura
-- vigente para ler e escrever. Ela se soma (AND) às políticas por dono que já
-- existem. Gatilhos e o servidor com service role não passam por RLS.
do $$
declare
  t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'empresa_id'
      and tb.table_type = 'BASE TABLE'
      and c.table_name not in ('empresas', 'assinaturas')
  loop
    execute format('drop policy if exists "assinatura_vigente" on public.%I', t);
    execute format(
      'create policy "assinatura_vigente" on public.%I as restrictive for all to authenticated '
      || 'using (public.assinatura_vigente(empresa_id)) '
      || 'with check (public.assinatura_vigente(empresa_id))',
      t
    );
  end loop;
end $$;
