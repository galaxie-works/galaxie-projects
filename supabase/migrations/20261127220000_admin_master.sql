-- Painel do admin master (dono da plataforma, acima das empresas/tenants).
--
-- plataforma_admins   quem é admin master (hoje só o Wagner).
-- plataforma_segredos chaves do servidor (Stripe, Anthropic) cifradas com
--                     IA_CHAVE_MESTRA. Ninguém logado lê: só o servidor, com
--                     service role. Sem linha aqui, vale a variável da Vercel.
-- plataforma_planos   planos, preços e cota de IA editáveis pelo painel.
-- plataforma_config   valores soltos (teste, cortesia, pacote de IA, extras).
--
-- Planos e config não são segredo: qualquer um lê (a tela de planos mostra);
-- só o servidor grava, depois de conferir que quem pediu é admin master.

-- 1. Admin master -------------------------------------------------------------

create table if not exists public.plataforma_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.plataforma_admins enable row level security;
revoke all on public.plataforma_admins from anon, authenticated;
grant all on public.plataforma_admins to service_role;

-- Wagner (dono da Consani Builder). Só entra se o usuário existir.
insert into public.plataforma_admins (user_id)
select id from auth.users where id = '52f94284-00b3-42eb-a6ea-6b4065187c28'
on conflict (user_id) do nothing;

create or replace function public.eh_admin_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.plataforma_admins where user_id = auth.uid());
$$;

revoke all on function public.eh_admin_master() from public, anon;
grant execute on function public.eh_admin_master() to authenticated, service_role;

-- 2. Chaves do servidor ------------------------------------------------------

create table if not exists public.plataforma_segredos (
  nome text primary key
    check (nome in ('STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'ANTHROPIC_API_KEY')),
  -- v1.<iv>.<tag>.<dados>, AES-256-GCM com IA_CHAVE_MESTRA (src/lib/ia/cripto.ts).
  valor_cifrado text not null,
  -- Últimos 4 caracteres, para mostrar mascarado.
  final text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.plataforma_segredos enable row level security;
revoke all on public.plataforma_segredos from anon, authenticated;
grant all on public.plataforma_segredos to service_role;

-- 3. Planos ------------------------------------------------------------------

create table if not exists public.plataforma_planos (
  id text primary key check (id in ('autonomo', 'equipe', 'empresa')),
  nome text not null,
  resumo text not null default '',
  mensal numeric(10, 2) not null check (mensal > 0),
  anual numeric(10, 2) not null check (anual > 0),
  escritorio text not null default '',
  campo text not null default '',
  obras text not null default '',
  comandos_ia integer not null check (comandos_ia >= 0),
  destaque boolean not null default false,
  -- Fora da venda: some da tela de planos; quem já assina continua.
  ativo boolean not null default true,
  ordem integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.plataforma_planos
  (id, nome, resumo, mensal, anual, escritorio, campo, obras, comandos_ia, destaque, ordem)
values
  ('autonomo', 'Autônomo', 'Para quem toca as obras sozinho.', 89, 890,
   '1 usuário no escritório', 'Até 2 na equipe de campo', 'Até 5 obras ativas', 150, false, 1),
  ('equipe', 'Equipe', 'Para a empresa com escritório e turmas em campo.', 199, 1990,
   'Até 5 no escritório', 'Equipe de campo ilimitada', 'Até 20 obras ativas', 600, true, 2),
  ('empresa', 'Empresa', 'Para construtoras com várias frentes.', 399, 3990,
   'Até 15 no escritório', 'Equipe de campo ilimitada', 'Obras ativas ilimitadas', 2000, false, 3)
on conflict (id) do nothing;

alter table public.plataforma_planos enable row level security;
drop policy if exists "plataforma_planos_leitura" on public.plataforma_planos;
create policy "plataforma_planos_leitura" on public.plataforma_planos for select using (true);
revoke all on public.plataforma_planos from anon, authenticated;
grant select on public.plataforma_planos to anon, authenticated;
grant all on public.plataforma_planos to service_role;

-- 4. Valores soltos ----------------------------------------------------------

create table if not exists public.plataforma_config (
  chave text primary key,
  valor jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.plataforma_config (chave, valor) values
  ('comandos_teste', '150'),
  ('comandos_cortesia', '2000'),
  ('pacote_ia_comandos', '500'),
  ('pacote_ia_preco', '29'),
  ('usuario_extra_preco', '29')
on conflict (chave) do nothing;

alter table public.plataforma_config enable row level security;
drop policy if exists "plataforma_config_leitura" on public.plataforma_config;
create policy "plataforma_config_leitura" on public.plataforma_config for select using (true);
revoke all on public.plataforma_config from anon, authenticated;
grant select on public.plataforma_config to anon, authenticated;
grant all on public.plataforma_config to service_role;

-- 5. Carteira nova usa a cota do teste do painel ------------------------------

create or replace function public.criar_carteira_ia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cota integer;
begin
  select coalesce((select (valor #>> '{}')::integer from public.plataforma_config where chave = 'comandos_teste'), 150)
  into cota;
  insert into public.ia_carteira (empresa_id, cota_mensal, saldo_plano)
  values (new.empresa_id, cota, cota)
  on conflict (empresa_id) do nothing;
  return new;
end;
$$;

-- 6. Ajuste manual de comandos pelo admin (só o servidor) ----------------------

-- Positivo dá comandos (entram no saldo extra, não vencem); negativo tira,
-- primeiro do extra e depois da cota, sem passar de zero.
create or replace function public.ia_ajuste_admin(
  p_empresa_id uuid,
  p_comandos integer,
  p_descricao text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.ia_carteira;
  tira_extra integer;
  tira_plano integer;
  efeito integer;
begin
  if p_comandos is null or p_comandos = 0 then
    raise exception 'Ajuste inválido';
  end if;
  insert into public.ia_carteira (empresa_id) values (p_empresa_id) on conflict (empresa_id) do nothing;
  select * into c from public.ia_carteira where empresa_id = p_empresa_id for update;

  if p_comandos > 0 then
    update public.ia_carteira set saldo_extra = saldo_extra + p_comandos, updated_at = now()
    where empresa_id = p_empresa_id;
    efeito := p_comandos;
  else
    tira_extra := least(c.saldo_extra, -p_comandos);
    tira_plano := least(c.saldo_plano, -p_comandos - tira_extra);
    update public.ia_carteira
    set saldo_extra = saldo_extra - tira_extra, saldo_plano = saldo_plano - tira_plano, updated_at = now()
    where empresa_id = p_empresa_id;
    efeito := -(tira_extra + tira_plano);
  end if;

  insert into public.ia_extrato (empresa_id, tipo, comandos, saldo_antes, saldo_depois, descricao)
  values (p_empresa_id, 'ajuste', efeito, c.saldo_plano + c.saldo_extra,
          c.saldo_plano + c.saldo_extra + efeito, left(coalesce(p_descricao, 'Ajuste da Galaxie'), 120));
  return efeito;
end;
$$;

revoke all on function public.ia_ajuste_admin(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.ia_ajuste_admin(uuid, integer, text) to service_role;
