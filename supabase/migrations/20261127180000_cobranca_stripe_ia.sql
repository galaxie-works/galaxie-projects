-- Cobrança pelo Stripe e cota de IA, no mesmo padrão da Cosmos (Galaxie Sports):
-- carteira pré-paga, extrato com saldo antes e depois, débito atômico numa
-- instrução só, e crédito apenas com pagamento confirmado pelo webhook, uma
-- vez por evento (stripe_eventos, único por id).
--
-- Diferença para a Cosmos: aqui a carteira tem duas partes.
--   saldo_plano: a cota do plano em comandos por mês. Renova sozinha a cada
--                mês enquanto a assinatura vale (teste, ativa, cortesia...).
--   saldo_extra: pacotes comprados. Não vencem e só são usados depois da cota.
-- Quem usa a própria chave de API (empresa_ia_config) não gasta nada daqui.

-- 1. Assinatura: ciclo de cobrança e preço do Stripe -------------------------

alter table public.assinaturas
  add column if not exists ciclo text,
  add column if not exists stripe_preco text,
  add column if not exists cancela_no_fim boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'assinaturas_ciclo_check') then
    alter table public.assinaturas
      add constraint assinaturas_ciclo_check check (ciclo is null or ciclo in ('mensal', 'anual'));
  end if;
end $$;

-- 2. Carteira de IA ---------------------------------------------------------

create table if not exists public.ia_carteira (
  empresa_id uuid primary key references public.empresas (id) on delete cascade,
  -- Comandos por mês que o plano inclui (teste: 150).
  cota_mensal integer not null default 150 check (cota_mensal >= 0),
  saldo_plano integer not null default 150 check (saldo_plano >= 0),
  saldo_extra integer not null default 0 check (saldo_extra >= 0),
  -- Quando a cota volta ao valor cheio.
  renova_em timestamptz not null default now() + interval '1 month',
  updated_at timestamptz not null default now()
);

create table if not exists public.ia_extrato (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  -- uso | cota | pacote | ajuste
  tipo text not null check (tipo in ('uso', 'cota', 'pacote', 'ajuste')),
  -- Positivo entra, negativo sai.
  comandos integer not null,
  saldo_antes integer not null,
  saldo_depois integer not null,
  descricao text,
  -- Só a Galaxie olha estes; a tela do cliente mostra comandos.
  modelo text,
  tokens_entrada integer,
  tokens_saida integer,
  custo_usd numeric(12, 6),
  referencia text,
  created_at timestamptz not null default now()
);

create index if not exists ia_extrato_empresa_data on public.ia_extrato (empresa_id, created_at desc);
-- Um pacote pago entra uma vez só, mesmo que o webhook chegue duas vezes.
create unique index if not exists ia_extrato_referencia_unica
  on public.ia_extrato (referencia) where referencia is not null;

create table if not exists public.stripe_eventos (
  id text primary key,
  tipo text not null,
  created_at timestamptz not null default now()
);

alter table public.ia_carteira enable row level security;
alter table public.ia_extrato enable row level security;
alter table public.stripe_eventos enable row level security;

drop policy if exists "ia_carteira_select_dono" on public.ia_carteira;
create policy "ia_carteira_select_dono" on public.ia_carteira
  for select using (empresa_id in (select id from public.empresas where owner_id = auth.uid()));

drop policy if exists "ia_extrato_select_dono" on public.ia_extrato;
create policy "ia_extrato_select_dono" on public.ia_extrato
  for select using (empresa_id in (select id from public.empresas where owner_id = auth.uid()));

-- Quem está logado só lê. Débito pelas funções abaixo; crédito só o servidor.
revoke all on public.ia_carteira from anon, authenticated;
revoke all on public.ia_extrato from anon, authenticated;
revoke all on public.stripe_eventos from anon, authenticated;
grant select on public.ia_carteira to authenticated;
grant select on public.ia_extrato to authenticated;

-- 3. Carteira nasce com a assinatura ---------------------------------------

create or replace function public.criar_carteira_ia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ia_carteira (empresa_id) values (new.empresa_id)
  on conflict (empresa_id) do nothing;
  return new;
end;
$$;

drop trigger if exists assinaturas_carteira_ia on public.assinaturas;
create trigger assinaturas_carteira_ia
  after insert on public.assinaturas
  for each row execute function public.criar_carteira_ia();

-- Empresas que já existem: cortesia ganha a cota do maior plano; o resto, a do teste.
insert into public.ia_carteira (empresa_id, cota_mensal, saldo_plano)
select a.empresa_id,
       case when a.status = 'cortesia' then 2000 else 150 end,
       case when a.status = 'cortesia' then 2000 else 150 end
from public.assinaturas a
on conflict (empresa_id) do nothing;

-- 4. Débito ------------------------------------------------------------------

-- Renova a cota se o mês virou (chamada dentro das funções de débito).
create or replace function public.ia_renovar_se_preciso(p_empresa_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.ia_carteira;
  meses integer;
begin
  select * into c from public.ia_carteira where empresa_id = p_empresa_id for update;
  if not found or c.renova_em > now() then
    return;
  end if;
  -- Pula quantos meses passaram, para não renovar várias vezes seguidas.
  meses := greatest(1, ceil(extract(epoch from (now() - c.renova_em)) / extract(epoch from interval '1 month'))::integer);
  update public.ia_carteira
  set saldo_plano = cota_mensal,
      renova_em = c.renova_em + make_interval(months => meses),
      updated_at = now()
  where empresa_id = p_empresa_id;
  insert into public.ia_extrato (empresa_id, tipo, comandos, saldo_antes, saldo_depois, descricao)
  values (p_empresa_id, 'cota', c.cota_mensal - c.saldo_plano,
          c.saldo_plano + c.saldo_extra, c.cota_mensal + c.saldo_extra, 'Cota do mês renovada');
end;
$$;

-- Reserva n comandos antes de chamar a IA. Uma instrução só: duas abas ao mesmo
-- tempo não deixam o saldo negativo. Devolve false sem saldo ou sem assinatura.
create or replace function public.ia_reservar(p_empresa_id uuid, p_comandos integer default 1)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
begin
  if p_comandos is null or p_comandos < 1 then
    raise exception 'Reserva inválida';
  end if;
  if not exists (select 1 from public.empresas where id = p_empresa_id and owner_id = auth.uid()) then
    raise exception 'Sem acesso a esta empresa';
  end if;
  if not public.assinatura_vigente(p_empresa_id) then
    return false;
  end if;
  perform public.ia_renovar_se_preciso(p_empresa_id);

  update public.ia_carteira
  set saldo_plano = saldo_plano - least(saldo_plano, p_comandos),
      saldo_extra = saldo_extra - (p_comandos - least(saldo_plano, p_comandos)),
      updated_at = now()
  where empresa_id = p_empresa_id
    and saldo_plano + saldo_extra >= p_comandos
  returning true into ok;
  return coalesce(ok, false);
end;
$$;

-- Acerta o valor real depois da resposta e grava o extrato. Nunca devolve
-- menos que o reservado (chamar direto não dá crédito a ninguém), e o que
-- passar do saldo é perdoado em vez de ficar negativo.
create or replace function public.ia_acertar(
  p_empresa_id uuid,
  p_reservado integer,
  p_real integer,
  p_modelo text default null,
  p_tokens_entrada integer default null,
  p_tokens_saida integer default null,
  p_custo_usd numeric default null,
  p_descricao text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.ia_carteira;
  falta integer;
  do_plano integer;
  do_extra integer;
  cobrado integer;
begin
  if not exists (select 1 from public.empresas where id = p_empresa_id and owner_id = auth.uid()) then
    raise exception 'Sem acesso a esta empresa';
  end if;
  select * into c from public.ia_carteira where empresa_id = p_empresa_id for update;
  if not found then
    return 0;
  end if;

  falta := greatest(0, coalesce(p_real, 0) - greatest(0, coalesce(p_reservado, 0)));
  do_plano := least(c.saldo_plano, falta);
  do_extra := least(c.saldo_extra, falta - do_plano);
  cobrado := greatest(0, coalesce(p_reservado, 0)) + do_plano + do_extra;

  update public.ia_carteira
  set saldo_plano = saldo_plano - do_plano,
      saldo_extra = saldo_extra - do_extra,
      updated_at = now()
  where empresa_id = p_empresa_id;

  insert into public.ia_extrato (
    empresa_id, tipo, comandos, saldo_antes, saldo_depois, descricao,
    modelo, tokens_entrada, tokens_saida, custo_usd
  ) values (
    p_empresa_id, 'uso', -cobrado,
    c.saldo_plano + c.saldo_extra + greatest(0, coalesce(p_reservado, 0)),
    c.saldo_plano + c.saldo_extra - do_plano - do_extra,
    left(coalesce(p_descricao, 'Assistente'), 120),
    p_modelo, p_tokens_entrada, p_tokens_saida, p_custo_usd
  );
  return cobrado;
end;
$$;

revoke all on function public.ia_renovar_se_preciso(uuid) from public, anon, authenticated;
revoke all on function public.ia_reservar(uuid, integer) from public, anon;
revoke all on function public.ia_acertar(uuid, integer, integer, text, integer, integer, numeric, text) from public, anon;
grant execute on function public.ia_reservar(uuid, integer) to authenticated;
grant execute on function public.ia_acertar(uuid, integer, integer, text, integer, integer, numeric, text) to authenticated;

-- 5. Crédito (só o servidor, com service role) --------------------------------

-- Pacote pago: soma no saldo extra uma vez por referência (id do pagamento).
create or replace function public.ia_creditar_pacote(
  p_empresa_id uuid,
  p_comandos integer,
  p_referencia text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.ia_carteira;
begin
  if p_comandos is null or p_comandos < 1 or p_referencia is null then
    raise exception 'Crédito inválido';
  end if;
  if exists (select 1 from public.ia_extrato where referencia = p_referencia) then
    return false;
  end if;
  insert into public.ia_carteira (empresa_id) values (p_empresa_id) on conflict (empresa_id) do nothing;
  select * into c from public.ia_carteira where empresa_id = p_empresa_id for update;
  update public.ia_carteira
  set saldo_extra = saldo_extra + p_comandos, updated_at = now()
  where empresa_id = p_empresa_id;
  insert into public.ia_extrato (empresa_id, tipo, comandos, saldo_antes, saldo_depois, descricao, referencia)
  values (p_empresa_id, 'pacote', p_comandos, c.saldo_plano + c.saldo_extra,
          c.saldo_plano + c.saldo_extra + p_comandos, 'Pacote de comandos', p_referencia);
  return true;
end;
$$;

-- Plano mudou: nova cota mensal. Subindo de plano, a diferença entra na hora.
create or replace function public.ia_definir_cota(p_empresa_id uuid, p_cota integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.ia_carteira;
begin
  insert into public.ia_carteira (empresa_id, cota_mensal, saldo_plano)
  values (p_empresa_id, p_cota, p_cota)
  on conflict (empresa_id) do nothing;
  select * into c from public.ia_carteira where empresa_id = p_empresa_id for update;
  if c.cota_mensal = p_cota then
    return;
  end if;
  update public.ia_carteira
  set cota_mensal = p_cota,
      saldo_plano = least(p_cota, saldo_plano + greatest(0, p_cota - c.cota_mensal)),
      updated_at = now()
  where empresa_id = p_empresa_id;
  insert into public.ia_extrato (empresa_id, tipo, comandos, saldo_antes, saldo_depois, descricao)
  select p_empresa_id, 'ajuste', k.saldo_plano - c.saldo_plano,
         c.saldo_plano + c.saldo_extra, k.saldo_plano + k.saldo_extra,
         'Cota do plano: ' || p_cota || ' por mês'
  from public.ia_carteira k where k.empresa_id = p_empresa_id;
end;
$$;

revoke all on function public.ia_creditar_pacote(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.ia_definir_cota(uuid, integer) from public, anon, authenticated;
grant execute on function public.ia_creditar_pacote(uuid, integer, text) to service_role;
grant execute on function public.ia_definir_cota(uuid, integer) to service_role;
grant all on public.ia_carteira, public.ia_extrato, public.stripe_eventos to service_role;
