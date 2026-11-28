-- Equipe com login: pessoas da empresa entram no app com papel e permissões
-- por módulo. Idempotente.
--
-- Papéis:
--   dono    tudo, inclusive assinatura e acessos
--   gestor  tudo, menos assinatura e acessos
--   membro  só o que as permissões dele liberam, módulo a módulo
-- Níveis por módulo: nenhum (0), ver (1), editar (2).
-- Módulos: clientes, negocios, obras, agenda, diario, financeiro, equipe, empresa.
--
-- As políticas antigas (só o dono, owner_id = auth.uid()) continuam. Este
-- arquivo só ACRESCENTA políticas para os membros; a política RESTRICTIVE
-- de assinatura vigente continua valendo para todos.

-- ---------------------------------------------------------------------------
-- Tabela
-- ---------------------------------------------------------------------------
create table if not exists public.empresa_membros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  email text not null,
  papel text not null default 'membro' check (papel in ('dono', 'gestor', 'membro')),
  permissoes jsonb not null default '{}'::jsonb,
  -- Pessoa do cadastro da equipe ligada a este login (opcional).
  equipe_id uuid references public.equipe (id) on delete set null,
  status text not null default 'convidado' check (status in ('convidado', 'ativo', 'suspenso')),
  convidado_por uuid references auth.users (id) on delete set null,
  convidado_em timestamptz not null default now(),
  aceito_em timestamptz,
  created_at timestamptz not null default now(),
  check (email = lower(email))
);

create unique index if not exists empresa_membros_email on public.empresa_membros (empresa_id, email);
create unique index if not exists empresa_membros_usuario on public.empresa_membros (empresa_id, user_id)
  where user_id is not null;
create index if not exists empresa_membros_user on public.empresa_membros (user_id) where user_id is not null;

-- O dono de cada empresa vira membro "dono" (as empresas antigas e as novas).
insert into public.empresa_membros (empresa_id, user_id, email, papel, status, aceito_em)
select e.id, e.owner_id, lower(u.email), 'dono', 'ativo', e.created_at
from public.empresas e
join auth.users u on u.id = e.owner_id
where u.email is not null
on conflict do nothing;

create or replace function public.empresas_registrar_dono()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.empresa_membros (empresa_id, user_id, email, papel, status, aceito_em)
  select new.id, new.owner_id, lower(u.email), 'dono', 'ativo', now()
  from auth.users u
  where u.id = new.owner_id and u.email is not null
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists empresas_registrar_dono on public.empresas;
create trigger empresas_registrar_dono
  after insert on public.empresas
  for each row execute function public.empresas_registrar_dono();

-- ---------------------------------------------------------------------------
-- Funções de acesso (security definer: leem empresas e membros sem RLS)
-- ---------------------------------------------------------------------------
create or replace function public.nivel_acesso(p_empresa_id uuid, p_modulo text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.empresas e where e.id = p_empresa_id and e.owner_id = auth.uid()) then 2
    else coalesce((
      select case
        when m.papel = 'dono' then 2
        when m.papel = 'gestor' then case when p_modulo in ('acessos', 'assinatura') then 0 else 2 end
        else case m.permissoes ->> p_modulo when 'editar' then 2 when 'ver' then 1 else 0 end
      end
      from public.empresa_membros m
      where m.empresa_id = p_empresa_id and m.user_id = auth.uid() and m.status = 'ativo'
    ), 0)
  end;
$$;

create or replace function public.tem_acesso(p_empresa_id uuid, p_modulo text, p_nivel integer default 1)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.nivel_acesso(p_empresa_id, p_modulo) >= p_nivel;
$$;

-- Dono da empresa ou membro ativo (qualquer papel).
create or replace function public.membro_ativo(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.empresas e where e.id = p_empresa_id and e.owner_id = auth.uid())
    or exists (
      select 1 from public.empresa_membros m
      where m.empresa_id = p_empresa_id and m.user_id = auth.uid() and m.status = 'ativo'
    );
$$;

create or replace function public.eh_dono(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.empresas e where e.id = p_empresa_id and e.owner_id = auth.uid())
    or exists (
      select 1 from public.empresa_membros m
      where m.empresa_id = p_empresa_id and m.user_id = auth.uid() and m.status = 'ativo' and m.papel = 'dono'
    );
$$;

-- Converte texto em uuid sem erro (pastas do Storage).
create or replace function public.uuid_ou_nulo(p text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

-- Ao entrar, liga os convites feitos para o e-mail de quem entrou.
create or replace function public.aceitar_convites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_total integer;
begin
  if auth.uid() is null or v_email = '' then
    return 0;
  end if;
  update public.empresa_membros
  set user_id = auth.uid(), status = 'ativo', aceito_em = coalesce(aceito_em, now())
  where email = v_email and status = 'convidado' and (user_id is null or user_id = auth.uid());
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

revoke all on function public.nivel_acesso(uuid, text) from public, anon;
revoke all on function public.tem_acesso(uuid, text, integer) from public, anon;
revoke all on function public.membro_ativo(uuid) from public, anon;
revoke all on function public.eh_dono(uuid) from public, anon;
revoke all on function public.aceitar_convites() from public, anon;
grant execute on function public.nivel_acesso(uuid, text) to authenticated;
grant execute on function public.tem_acesso(uuid, text, integer) to authenticated;
grant execute on function public.membro_ativo(uuid) to authenticated;
grant execute on function public.eh_dono(uuid) to authenticated;
grant execute on function public.aceitar_convites() to authenticated;

-- ---------------------------------------------------------------------------
-- Políticas da tabela de membros
-- ---------------------------------------------------------------------------
alter table public.empresa_membros enable row level security;
grant select, insert, update, delete on public.empresa_membros to authenticated;

drop policy if exists "empresa_membros_ver" on public.empresa_membros;
create policy "empresa_membros_ver" on public.empresa_membros
  for select to authenticated
  using (user_id = auth.uid() or public.membro_ativo(empresa_id));

-- Só o dono convida, muda papel e permissões e tira acesso. O registro do
-- próprio dono não pode ser mexido por aqui (evita a empresa ficar sem dono).
drop policy if exists "empresa_membros_dono_insere" on public.empresa_membros;
create policy "empresa_membros_dono_insere" on public.empresa_membros
  for insert to authenticated
  with check (public.eh_dono(empresa_id) and papel <> 'dono');

drop policy if exists "empresa_membros_dono_altera" on public.empresa_membros;
create policy "empresa_membros_dono_altera" on public.empresa_membros
  for update to authenticated
  using (public.eh_dono(empresa_id) and papel <> 'dono')
  with check (public.eh_dono(empresa_id) and papel <> 'dono');

drop policy if exists "empresa_membros_dono_remove" on public.empresa_membros;
create policy "empresa_membros_dono_remove" on public.empresa_membros
  for delete to authenticated
  using (public.eh_dono(empresa_id) and papel <> 'dono');

-- ---------------------------------------------------------------------------
-- Políticas para membros nas tabelas da empresa
-- ---------------------------------------------------------------------------
-- (tabela, módulo para ver, módulo para editar). Ver = nível 1; editar = 2.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('clientes', 'clientes'),
      ('negocios', 'negocios'),
      ('projetos', 'obras'),
      ('diario_obra', 'diario'),
      ('recebimentos', 'financeiro'),
      ('notas_fiscais', 'financeiro'),
      ('empresa_fiscal', 'financeiro'),
      ('empresa_certificados', 'financeiro'),
      ('pos_venda', 'clientes'),
      ('portal_acessos', 'clientes')
    ) as t (tabela, modulo)
  loop
    execute format('drop policy if exists %I on public.%I', r.tabela || '_membros_ver', r.tabela);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.tem_acesso(empresa_id, %L, 1))',
      r.tabela || '_membros_ver', r.tabela, r.modulo
    );
    execute format('drop policy if exists %I on public.%I', r.tabela || '_membros_editar', r.tabela);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.tem_acesso(empresa_id, %L, 2)) with check (public.tem_acesso(empresa_id, %L, 2))',
      r.tabela || '_membros_editar', r.tabela, r.modulo, r.modulo
    );
  end loop;
end;
$$;

-- Diário: quem vê obras também lê o diário delas.
drop policy if exists "diario_obra_membros_obras" on public.diario_obra;
create policy "diario_obra_membros_obras" on public.diario_obra
  for select to authenticated
  using (public.tem_acesso(empresa_id, 'obras', 1));

-- Tarefas e contatos: são da Agenda e do Cliente.
drop policy if exists "atividades_membros_ver" on public.atividades;
create policy "atividades_membros_ver" on public.atividades
  for select to authenticated
  using (public.tem_acesso(empresa_id, 'agenda', 1) or public.tem_acesso(empresa_id, 'clientes', 1));
drop policy if exists "atividades_membros_editar" on public.atividades;
create policy "atividades_membros_editar" on public.atividades
  for all to authenticated
  using (public.tem_acesso(empresa_id, 'agenda', 2) or public.tem_acesso(empresa_id, 'clientes', 2))
  with check (public.tem_acesso(empresa_id, 'agenda', 2) or public.tem_acesso(empresa_id, 'clientes', 2));

-- Equipe, preços e configurações: todo membro lê (aparecem em listas e no
-- orçamento); edita quem tem o módulo.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('equipe', 'equipe'),
      ('precos_servicos', 'empresa'),
      ('empresa_ia_config', 'empresa')
    ) as t (tabela, modulo)
  loop
    execute format('drop policy if exists %I on public.%I', r.tabela || '_membros_ver', r.tabela);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.membro_ativo(empresa_id))',
      r.tabela || '_membros_ver', r.tabela
    );
    execute format('drop policy if exists %I on public.%I', r.tabela || '_membros_editar', r.tabela);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.tem_acesso(empresa_id, %L, 2)) with check (public.tem_acesso(empresa_id, %L, 2))',
      r.tabela || '_membros_editar', r.tabela, r.modulo, r.modulo
    );
  end loop;
end;
$$;

-- Arquivos: todo membro vê; envia quem edita clientes, obras ou diário.
drop policy if exists "arquivos_membros_ver" on public.arquivos;
create policy "arquivos_membros_ver" on public.arquivos
  for select to authenticated
  using (public.membro_ativo(empresa_id));
drop policy if exists "arquivos_membros_editar" on public.arquivos;
create policy "arquivos_membros_editar" on public.arquivos
  for all to authenticated
  using (
    public.tem_acesso(empresa_id, 'clientes', 2) or public.tem_acesso(empresa_id, 'obras', 2)
    or public.tem_acesso(empresa_id, 'diario', 2)
  )
  with check (
    public.tem_acesso(empresa_id, 'clientes', 2) or public.tem_acesso(empresa_id, 'obras', 2)
    or public.tem_acesso(empresa_id, 'diario', 2)
  );

-- Assinatura e IA: todo membro lê (o app checa se a assinatura vale).
drop policy if exists "assinaturas_membros_ver" on public.assinaturas;
create policy "assinaturas_membros_ver" on public.assinaturas
  for select to authenticated using (public.membro_ativo(empresa_id));
drop policy if exists "ia_carteira_membros_ver" on public.ia_carteira;
create policy "ia_carteira_membros_ver" on public.ia_carteira
  for select to authenticated using (public.membro_ativo(empresa_id));
drop policy if exists "ia_extrato_membros_ver" on public.ia_extrato;
create policy "ia_extrato_membros_ver" on public.ia_extrato
  for select to authenticated using (public.membro_ativo(empresa_id));

-- Conversas com o assistente: cada um as suas, na empresa de que é membro.
drop policy if exists "assistente_conversas_membros" on public.assistente_conversas;
create policy "assistente_conversas_membros" on public.assistente_conversas
  for all to authenticated
  using (usuario_id = auth.uid() and public.membro_ativo(empresa_id))
  with check (usuario_id = auth.uid() and public.membro_ativo(empresa_id));

-- A empresa: membro lê; edita quem tem o módulo Empresa.
drop policy if exists "empresas_membros_ver" on public.empresas;
create policy "empresas_membros_ver" on public.empresas
  for select to authenticated using (public.membro_ativo(id));
drop policy if exists "empresas_membros_editar" on public.empresas;
create policy "empresas_membros_editar" on public.empresas
  for update to authenticated
  using (public.tem_acesso(id, 'empresa', 2))
  with check (public.tem_acesso(id, 'empresa', 2));

-- Tabelas sem empresa_id: seguem a obra (ou o negócio).
drop policy if exists "etapas_membros_ver" on public.etapas;
create policy "etapas_membros_ver" on public.etapas
  for select to authenticated
  using (exists (select 1 from public.projetos p where p.id = projeto_id and public.tem_acesso(p.empresa_id, 'obras', 1)));
drop policy if exists "etapas_membros_editar" on public.etapas;
create policy "etapas_membros_editar" on public.etapas
  for all to authenticated
  using (exists (select 1 from public.projetos p where p.id = projeto_id and public.tem_acesso(p.empresa_id, 'obras', 2)))
  with check (exists (select 1 from public.projetos p where p.id = projeto_id and public.tem_acesso(p.empresa_id, 'obras', 2)));

-- Compras são custo da obra: entram no financeiro.
drop policy if exists "compras_membros_ver" on public.compras;
create policy "compras_membros_ver" on public.compras
  for select to authenticated
  using (exists (select 1 from public.projetos p where p.id = projeto_id and public.tem_acesso(p.empresa_id, 'financeiro', 1)));
drop policy if exists "compras_membros_editar" on public.compras;
create policy "compras_membros_editar" on public.compras
  for all to authenticated
  using (exists (select 1 from public.projetos p where p.id = projeto_id and public.tem_acesso(p.empresa_id, 'financeiro', 2)))
  with check (exists (select 1 from public.projetos p where p.id = projeto_id and public.tem_acesso(p.empresa_id, 'financeiro', 2)));

do $$
declare
  t text;
begin
  foreach t in array array['projeto_areas', 'projeto_itens'] loop
    execute format('drop policy if exists %I on public.%I', t || '_membros_ver', t);
    execute format($f$
      create policy %I on public.%I for select to authenticated using (
        exists (select 1 from public.projetos p where p.id = projeto_id and public.tem_acesso(p.empresa_id, 'obras', 1))
        or exists (select 1 from public.negocios n where n.id = negocio_id and public.tem_acesso(n.empresa_id, 'negocios', 1))
      )$f$, t || '_membros_ver', t);
    execute format('drop policy if exists %I on public.%I', t || '_membros_editar', t);
    execute format($f$
      create policy %I on public.%I for all to authenticated
      using (
        exists (select 1 from public.projetos p where p.id = projeto_id and public.tem_acesso(p.empresa_id, 'obras', 2))
        or exists (select 1 from public.negocios n where n.id = negocio_id and public.tem_acesso(n.empresa_id, 'negocios', 2))
      )
      with check (
        (projeto_id is null or exists (select 1 from public.projetos p where p.id = projeto_id and public.tem_acesso(p.empresa_id, 'obras', 2)))
        and (negocio_id is null or exists (select 1 from public.negocios n where n.id = negocio_id and public.tem_acesso(n.empresa_id, 'negocios', 2)))
      )$f$, t || '_membros_editar', t);
  end loop;
end;
$$;

-- Perfis: colegas da mesma empresa veem nome e foto uns dos outros.
drop policy if exists "perfis_colegas" on public.perfis;
create policy "perfis_colegas" on public.perfis
  for select to authenticated
  using (exists (
    select 1 from public.empresa_membros m
    where m.user_id = perfis.user_id and m.status = 'ativo' and public.membro_ativo(m.empresa_id)
  ));

-- Storage (bucket "arquivos", pasta = empresa): membro lê; envia quem edita
-- clientes, obras ou diário. A própria foto vai na pasta usuarios/<id>.
drop policy if exists "arquivos_storage_membros_ver" on storage.objects;
create policy "arquivos_storage_membros_ver" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'arquivos'
    and public.membro_ativo(public.uuid_ou_nulo((storage.foldername(name))[1]))
  );
drop policy if exists "arquivos_storage_membros_editar" on storage.objects;
create policy "arquivos_storage_membros_editar" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'arquivos'
    and (
      public.tem_acesso(public.uuid_ou_nulo((storage.foldername(name))[1]), 'clientes', 2)
      or public.tem_acesso(public.uuid_ou_nulo((storage.foldername(name))[1]), 'obras', 2)
      or public.tem_acesso(public.uuid_ou_nulo((storage.foldername(name))[1]), 'diario', 2)
      or public.tem_acesso(public.uuid_ou_nulo((storage.foldername(name))[1]), 'empresa', 2)
      or (
        (storage.foldername(name))[2] = 'usuarios'
        and (storage.foldername(name))[3] = auth.uid()::text
        and public.membro_ativo(public.uuid_ou_nulo((storage.foldername(name))[1]))
      )
    )
  )
  with check (
    bucket_id = 'arquivos'
    and (
      public.tem_acesso(public.uuid_ou_nulo((storage.foldername(name))[1]), 'clientes', 2)
      or public.tem_acesso(public.uuid_ou_nulo((storage.foldername(name))[1]), 'obras', 2)
      or public.tem_acesso(public.uuid_ou_nulo((storage.foldername(name))[1]), 'diario', 2)
      or public.tem_acesso(public.uuid_ou_nulo((storage.foldername(name))[1]), 'empresa', 2)
      or (
        (storage.foldername(name))[2] = 'usuarios'
        and (storage.foldername(name))[3] = auth.uid()::text
        and public.membro_ativo(public.uuid_ou_nulo((storage.foldername(name))[1]))
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Funções que checavam só o dono passam a aceitar membros
-- ---------------------------------------------------------------------------
do $$
declare
  f record;
  novo text;
begin
  for f in
    select p.oid, pg_get_functiondef(p.oid) as def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('ia_reservar', 'ia_acertar', 'portal_gerar_acesso')
  loop
    novo := replace(
      f.def,
      'select 1 from public.empresas where id = p_empresa_id and owner_id = auth.uid()',
      'select 1 where public.membro_ativo(p_empresa_id)'
    );
    novo := replace(novo, 'e.owner_id = auth.uid()', 'public.tem_acesso(e.id, ''clientes'', 2)');
    if novo <> f.def then
      execute novo;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Logins incluídos em cada plano (o admin master muda em /admin)
-- ---------------------------------------------------------------------------
alter table public.plataforma_planos add column if not exists usuarios_escritorio integer;
alter table public.plataforma_planos add column if not exists usuarios_campo integer;
update public.plataforma_planos set usuarios_escritorio = 1, usuarios_campo = 2
  where id = 'autonomo' and usuarios_escritorio is null;
update public.plataforma_planos set usuarios_escritorio = 5
  where id = 'equipe' and usuarios_escritorio is null;
update public.plataforma_planos set usuarios_escritorio = 15
  where id = 'empresa' and usuarios_escritorio is null;
