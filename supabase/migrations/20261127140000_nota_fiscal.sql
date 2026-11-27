-- ============================================================================
-- Nota fiscal de serviço (NFS-e padrão nacional), emitida direto na API
-- pública da Sefin Nacional com o certificado A1 da empresa. Sem fornecedor
-- pago no meio. Pode rodar de novo com segurança.
-- ============================================================================

-- DADOS FISCAIS da empresa (painel Empresa > Nota fiscal).
create table if not exists public.empresa_fiscal (
  empresa_id uuid primary key references public.empresas (id) on delete cascade,
  razao_social text,
  cnpj text,
  inscricao_municipal text,
  -- 1 não optante, 2 MEI, 3 ME/EPP (Simples Nacional)
  opcao_simples text not null default '3' check (opcao_simples in ('1', '2', '3')),
  regime_apuracao_simples text default '1' check (regime_apuracao_simples in ('1', '2', '3')),
  regime_especial text not null default '0'
    check (regime_especial in ('0', '1', '2', '3', '4', '5', '6', '9')),
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  codigo_municipio text, -- IBGE, 7 dígitos
  telefone text,
  email text,
  -- Serviço padrão: 07.02.01 = execução de obras de construção civil (LC 116).
  codigo_tributacao_nacional text not null default '070201',
  codigo_tributacao_municipal text,
  codigo_nbs text,
  aliquota_iss numeric(5, 2),
  iss_retido boolean not null default false,
  percentual_tributos_simples numeric(5, 2),
  descricao_padrao text,
  ambiente text not null default 'homologacao' check (ambiente in ('homologacao', 'producao')),
  serie text not null default '1',
  proximo_numero_homologacao bigint not null default 1 check (proximo_numero_homologacao > 0),
  proximo_numero_producao bigint not null default 1 check (proximo_numero_producao > 0),
  updated_at timestamptz not null default now()
);

alter table public.empresa_fiscal enable row level security;
grant select, insert, update, delete on public.empresa_fiscal to authenticated;

drop policy if exists "empresa_fiscal_all_own" on public.empresa_fiscal;
create policy "empresa_fiscal_all_own" on public.empresa_fiscal
  for all using (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
  ) with check (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
  );

-- CERTIFICADO A1. O .pfx e a senha ficam cifrados (AES-256-GCM, chave mestra
-- só no servidor da Vercel). A tela só lê titular, documento e validade.
create table if not exists public.empresa_certificados (
  empresa_id uuid primary key references public.empresas (id) on delete cascade,
  pfx_cifrado text not null,
  senha_cifrada text not null,
  titular text,
  documento text,
  valido_ate timestamptz,
  enviado_em timestamptz not null default now()
);

alter table public.empresa_certificados enable row level security;
grant select, insert, update, delete on public.empresa_certificados to authenticated;

drop policy if exists "empresa_certificados_all_own" on public.empresa_certificados;
create policy "empresa_certificados_all_own" on public.empresa_certificados
  for all using (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
  ) with check (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
  );

-- CNO (Cadastro Nacional de Obras) da obra, usado na nota de construção civil.
alter table public.projetos add column if not exists cno text;

-- NOTAS FISCAIS emitidas.
create table if not exists public.notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  projeto_id uuid references public.projetos (id) on delete set null,
  cliente_id uuid references public.clientes (id) on delete set null,
  recebimento_id uuid references public.recebimentos (id) on delete set null,
  ambiente text not null check (ambiente in ('homologacao', 'producao')),
  serie text not null,
  numero_dps bigint not null,
  id_dps text not null,
  status text not null default 'processando'
    check (status in ('processando', 'autorizada', 'rejeitada', 'cancelada', 'erro_envio')),
  valor numeric(14, 2) not null check (valor > 0),
  descricao text not null,
  competencia date not null default current_date,
  tomador jsonb not null default '{}'::jsonb,
  obra jsonb,
  chave_acesso text,
  numero_nfse text,
  xml_dps text,
  xml_nfse text,
  mensagens jsonb not null default '[]'::jsonb,
  cancelamento_motivo text,
  autorizada_em timestamptz,
  cancelada_em timestamptz,
  created_at timestamptz not null default now(),
  unique (empresa_id, id_dps)
);

create index if not exists notas_fiscais_empresa_idx on public.notas_fiscais (empresa_id, created_at desc);
create index if not exists notas_fiscais_projeto_idx on public.notas_fiscais (projeto_id);
create index if not exists notas_fiscais_recebimento_idx on public.notas_fiscais (recebimento_id);

alter table public.notas_fiscais enable row level security;
grant select, insert, update, delete on public.notas_fiscais to authenticated;

drop policy if exists "notas_fiscais_all_own" on public.notas_fiscais;
create policy "notas_fiscais_all_own" on public.notas_fiscais
  for all using (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
  ) with check (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
  );

-- Reserva o próximo número da DPS de forma atômica (duas notas ao mesmo
-- tempo nunca recebem o mesmo número).
create or replace function public.reservar_numero_dps(p_empresa_id uuid, p_ambiente text)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_numero bigint;
begin
  if p_ambiente = 'producao' then
    update public.empresa_fiscal
       set proximo_numero_producao = proximo_numero_producao + 1
     where empresa_id = p_empresa_id
    returning proximo_numero_producao - 1 into v_numero;
  else
    update public.empresa_fiscal
       set proximo_numero_homologacao = proximo_numero_homologacao + 1
     where empresa_id = p_empresa_id
    returning proximo_numero_homologacao - 1 into v_numero;
  end if;
  if v_numero is null then
    raise exception 'Preencha os dados fiscais da empresa antes de emitir.';
  end if;
  return v_numero;
end;
$$;

revoke all on function public.reservar_numero_dps(uuid, text) from public, anon;
grant execute on function public.reservar_numero_dps(uuid, text) to authenticated;
