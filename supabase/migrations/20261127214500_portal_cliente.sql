-- ============================================================================
-- Portal do cliente: o cliente final recebe um link secreto e acompanha as
-- obras dele (etapas, fotos escolhidas, parcelas, notas fiscais, garantia) e
-- abre chamados de assistência. Sem login: o link é a chave.
--
-- Segurança:
--   * portal_acessos só é lido/escrito pela empresa dona (RLS por tenant).
--   * O visitante anônimo NÃO lê tabela nenhuma: só chama duas funções
--     security definer que validam o token e devolvem apenas os dados daquele
--     cliente, daquela empresa. Custos, compras, margem e notas internas nunca
--     saem.
--   * Arquivos só aparecem no portal quando a empresa marca "Mostrar no portal".
-- Idempotente.
-- ============================================================================

create table if not exists public.portal_acessos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  -- 64 caracteres aleatórios (duas uuid v4 sem hífen, ~244 bits).
  token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  revogado_em timestamptz,
  ultimo_acesso_em timestamptz,
  acessos integer not null default 0
);

-- Um link ativo por cliente.
create unique index if not exists portal_acessos_cliente_ativo
  on public.portal_acessos (cliente_id) where revogado_em is null;
create index if not exists portal_acessos_empresa on public.portal_acessos (empresa_id);

alter table public.portal_acessos enable row level security;
grant select, insert, update, delete on public.portal_acessos to authenticated;

drop policy if exists "portal_acessos_all_own" on public.portal_acessos;
create policy "portal_acessos_all_own" on public.portal_acessos
  for all using (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
  ) with check (
    empresa_id in (select id from public.empresas where owner_id = auth.uid())
    and cliente_id in (
      select c.id from public.clientes c
      join public.empresas e on e.id = c.empresa_id
      where e.owner_id = auth.uid()
    )
  );

drop policy if exists "assinatura_vigente" on public.portal_acessos;
create policy "assinatura_vigente" on public.portal_acessos as restrictive for all to authenticated
  using (public.assinatura_vigente(empresa_id))
  with check (public.assinatura_vigente(empresa_id));

-- Arquivo visível no portal (fotos da obra, contrato...). Padrão: não.
alter table public.arquivos add column if not exists no_portal boolean not null default false;

-- Chamado aberto pelo cliente no portal vira pós-venda tipo "assistencia".
alter table public.pos_venda add column if not exists origem text not null default 'interno';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pos_venda_origem_check'
  ) then
    alter table public.pos_venda
      add constraint pos_venda_origem_check check (origem in ('interno', 'portal'));
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Cria (ou troca) o link do cliente. Revoga o anterior. Só o dono da empresa.
-- ----------------------------------------------------------------------------
create or replace function public.portal_gerar_acesso(p_cliente_id uuid)
returns public.portal_acessos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_empresa uuid;
  v_novo public.portal_acessos;
begin
  select c.empresa_id into v_empresa
  from public.clientes c
  join public.empresas e on e.id = c.empresa_id
  where c.id = p_cliente_id and e.owner_id = auth.uid();
  if v_empresa is null then
    raise exception 'cliente não encontrado';
  end if;

  update public.portal_acessos set revogado_em = now()
  where cliente_id = p_cliente_id and revogado_em is null;

  insert into public.portal_acessos (empresa_id, cliente_id)
  values (v_empresa, p_cliente_id)
  returning * into v_novo;
  return v_novo;
end;
$$;

revoke all on function public.portal_gerar_acesso(uuid) from public, anon;
grant execute on function public.portal_gerar_acesso(uuid) to authenticated;

-- Acha o acesso ativo do token (uso interno das funções do portal).
create or replace function public.portal_acesso_do_token(p_token text)
returns public.portal_acessos
language sql
stable
security definer
set search_path = public
as $$
  select a.*
  from public.portal_acessos a
  where p_token is not null
    and length(p_token) = 64
    and a.token = p_token
    and a.revogado_em is null
  limit 1;
$$;

revoke all on function public.portal_acesso_do_token(text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Tudo o que o portal mostra, num JSON. Chamado pelo visitante anônimo.
-- Devolve null quando o link não vale (inexistente, revogado ou empresa sem
-- assinatura vigente).
-- ----------------------------------------------------------------------------
create or replace function public.portal_dados(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.portal_acessos;
  v jsonb;
begin
  a := public.portal_acesso_do_token(p_token);
  if a.id is null or not public.assinatura_vigente(a.empresa_id) then
    return null;
  end if;

  update public.portal_acessos
  set ultimo_acesso_em = now(), acessos = acessos + 1
  where id = a.id;

  select jsonb_build_object(
    'empresa', (
      select jsonb_build_object(
        'nome', e.nome,
        'garantia_meses', e.garantia_meses,
        'link_avaliacao_google', e.link_avaliacao_google
      )
      from public.empresas e where e.id = a.empresa_id
    ),
    'cliente', (
      select jsonb_build_object('nome', c.nome)
      from public.clientes c where c.id = a.cliente_id
    ),
    'obras', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'nome', p.nome,
        'status', p.status,
        'percentual_conclusao', p.percentual_conclusao,
        'data_inicio', p.data_inicio,
        'data_prazo', p.data_prazo,
        'orcamento_total', p.orcamento_total,
        'etapas', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', et.id, 'nome', et.nome, 'status', et.status, 'data_prazo', et.data_prazo
          ) order by et.ordem, et.created_at)
          from public.etapas et where et.projeto_id = p.id
        ), '[]'::jsonb),
        'recebimentos', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', r.id, 'descricao', r.descricao, 'valor', r.valor,
            'vencimento', r.vencimento, 'recebido_em', r.recebido_em, 'forma', r.forma
          ) order by r.vencimento, r.ordem)
          from public.recebimentos r where r.projeto_id = p.id
        ), '[]'::jsonb),
        'notas', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', n.id, 'numero_nfse', n.numero_nfse, 'chave_acesso', n.chave_acesso,
            'valor', n.valor, 'descricao', n.descricao, 'competencia', n.competencia,
            'autorizada_em', n.autorizada_em, 'ambiente', n.ambiente
          ) order by n.autorizada_em desc)
          from public.notas_fiscais n
          where n.projeto_id = p.id and n.status = 'autorizada'
        ), '[]'::jsonb)
      ) order by p.created_at desc)
      from public.projetos p
      where p.cliente_id = a.cliente_id and p.empresa_id = a.empresa_id
    ), '[]'::jsonb),
    -- Arquivos marcados "Mostrar no portal", do cliente ou das obras dele.
    'arquivos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'projeto_id', f.projeto_id, 'nome', f.nome, 'caminho', f.caminho,
        'tipo_mime', f.tipo_mime, 'created_at', f.created_at
      ) order by f.created_at desc)
      from public.arquivos f
      where f.empresa_id = a.empresa_id and f.no_portal
        and (
          f.cliente_id = a.cliente_id
          or f.projeto_id in (select id from public.projetos where cliente_id = a.cliente_id)
        )
    ), '[]'::jsonb),
    -- Garantias, revisões e chamados. Pesquisa, avaliação e indicação são
    -- lembretes internos da empresa e ficam de fora.
    'pos_venda', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pv.id, 'projeto_id', pv.projeto_id, 'tipo', pv.tipo, 'titulo', pv.titulo,
        'texto', case when pv.origem = 'portal' then pv.texto else null end,
        'vence_em', pv.vence_em, 'status', pv.status, 'origem', pv.origem,
        'resolvido_em', pv.resolvido_em, 'created_at', pv.created_at
      ) order by pv.created_at desc)
      from public.pos_venda pv
      where pv.cliente_id = a.cliente_id and pv.empresa_id = a.empresa_id
        and pv.tipo in ('garantia', 'revisao', 'assistencia')
    ), '[]'::jsonb)
  ) into v;

  return v;
end;
$$;

revoke all on function public.portal_dados(text) from public;
grant execute on function public.portal_dados(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Cliente abre um chamado (assistência) pelo portal.
-- Limite: 5 chamados abertos por cliente, para evitar abuso do link.
-- ----------------------------------------------------------------------------
create or replace function public.portal_abrir_chamado(
  p_token text,
  p_projeto_id uuid,
  p_titulo text,
  p_texto text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.portal_acessos;
  v_titulo text := left(btrim(coalesce(p_titulo, '')), 120);
  v_texto text := nullif(left(btrim(coalesce(p_texto, '')), 2000), '');
  v_id uuid;
begin
  a := public.portal_acesso_do_token(p_token);
  if a.id is null or not public.assinatura_vigente(a.empresa_id) then
    raise exception 'link inválido';
  end if;
  if length(v_titulo) < 3 then
    raise exception 'descreva o problema';
  end if;
  if p_projeto_id is not null and not exists (
    select 1 from public.projetos
    where id = p_projeto_id and cliente_id = a.cliente_id and empresa_id = a.empresa_id
  ) then
    raise exception 'obra não encontrada';
  end if;
  if (
    select count(*) from public.pos_venda
    where cliente_id = a.cliente_id and origem = 'portal' and status <> 'resolvido'
  ) >= 5 then
    raise exception 'limite de chamados abertos';
  end if;

  insert into public.pos_venda (empresa_id, cliente_id, projeto_id, tipo, titulo, texto, vence_em, status, origem)
  values (a.empresa_id, a.cliente_id, p_projeto_id, 'assistencia', v_titulo, v_texto,
          (now() at time zone 'America/Sao_Paulo')::date + 2, 'aberto', 'portal')
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.portal_abrir_chamado(text, uuid, text, text) from public;
grant execute on function public.portal_abrir_chamado(text, uuid, text, text) to anon, authenticated;
