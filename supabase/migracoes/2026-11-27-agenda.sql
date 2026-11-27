-- ============================================================================
-- CRM — Agenda, follow-ups e Início (frente B)
-- Atividades ganham prazo (previsto_para), conclusão e resultado, e viram
-- tarefas / próximos passos. O próximo follow-up do cliente passa a ser
-- calculado a partir das tarefas abertas (gatilho abaixo).
-- Pode rodar de novo com segurança.
-- ============================================================================

alter table public.atividades
  add column if not exists previsto_para timestamptz,
  add column if not exists concluida_em timestamptz,
  add column if not exists resultado text,
  add column if not exists negocio_id uuid;

-- Lista completa de tipos (compartilhada entre as frentes do CRM).
alter table public.atividades drop constraint if exists atividades_tipo_check;
alter table public.atividades add constraint atividades_tipo_check
  check (tipo in ('nota', 'ligacao', 'whatsapp', 'visita', 'reuniao', 'email', 'audio', 'tarefa', 'sistema'));

-- negocio_id só vira chave estrangeira quando a tabela de negócios existir
-- (frente A). Rodar este arquivo de novo depois dela liga a FK.
do $$
begin
  if to_regclass('public.negocios') is not null
     and not exists (select 1 from pg_constraint where conname = 'atividades_negocio_id_fkey') then
    alter table public.atividades
      add constraint atividades_negocio_id_fkey
      foreign key (negocio_id) references public.negocios (id) on delete set null;
  end if;
end $$;

create index if not exists idx_atividades_agenda
  on public.atividades (empresa_id, previsto_para)
  where previsto_para is not null and concluida_em is null;

-- Follow-ups marcados à mão antes da agenda (campo do Cliente 360) viram
-- tarefas, para o gatilho abaixo não apagá-los. Só para clientes sem tarefa
-- aberta, então rodar de novo não duplica.
insert into public.atividades (empresa_id, cliente_id, tipo, texto, responsavel_id, previsto_para)
select c.empresa_id, c.id, 'tarefa', 'Follow-up', c.responsavel_id,
       (c.proximo_followup_em::text || ' 09:00 America/Sao_Paulo')::timestamptz
from public.clientes c
where c.proximo_followup_em is not null
  and not exists (
    select 1 from public.atividades a
    where a.cliente_id = c.id and a.previsto_para is not null and a.concluida_em is null
  );

-- Próximo follow-up do cliente = data da tarefa aberta mais próxima
-- (no fuso de Brasília). Sem tarefa aberta, fica sem data.
-- Só roda quando a linha é (ou era) uma tarefa: registrar uma nota não mexe.
create or replace function public.atualizar_followup_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo uuid;
begin
  if not coalesce(
    (tg_op <> 'INSERT' and old.previsto_para is not null)
    or (tg_op <> 'DELETE' and new.previsto_para is not null),
    false
  ) then
    return null;
  end if;
  foreach alvo in array array[
    case when tg_op <> 'INSERT' then old.cliente_id end,
    case when tg_op <> 'DELETE' then new.cliente_id end
  ] loop
    if alvo is not null then
      update public.clientes c
      set proximo_followup_em = (
        select min((a.previsto_para at time zone 'America/Sao_Paulo')::date)
        from public.atividades a
        where a.cliente_id = alvo and a.previsto_para is not null and a.concluida_em is null
      )
      where c.id = alvo;
    end if;
  end loop;
  return null;
end $$;

drop trigger if exists trg_atividades_followup on public.atividades;
create trigger trg_atividades_followup
  after insert or delete or update of previsto_para, concluida_em, cliente_id
  on public.atividades
  for each row execute function public.atualizar_followup_cliente();
