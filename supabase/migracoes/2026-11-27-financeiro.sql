-- ============================================================================
-- CRM — Frente C: Financeiro (recebimentos)
-- Parcelas que o cliente paga por obra: valor, vencimento, quando foi
-- recebida e a forma. Só controle (sem boleto, nota fiscal ou conciliação).
-- Pode rodar de novo com segurança.
-- ============================================================================

create table if not exists public.recebimentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  projeto_id uuid not null references public.projetos (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete set null,
  descricao text not null,
  valor numeric(14, 2) not null default 0 check (valor >= 0),
  vencimento date not null default current_date,
  recebido_em date,
  forma text check (forma in ('pix', 'boleto', 'cartao', 'dinheiro', 'transferencia')),
  comprovante_url text,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.recebimentos enable row level security;
grant select, insert, update, delete on public.recebimentos to authenticated;

drop policy if exists "recebimentos_all_own" on public.recebimentos;
create policy "recebimentos_all_own" on public.recebimentos
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

create index if not exists idx_recebimentos_projeto on public.recebimentos (projeto_id, vencimento);
create index if not exists idx_recebimentos_cliente on public.recebimentos (cliente_id, vencimento);
create index if not exists idx_recebimentos_empresa on public.recebimentos (empresa_id, vencimento);
