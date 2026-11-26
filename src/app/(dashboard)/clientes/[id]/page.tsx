import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClientePainel } from '@/components/clientes/cliente-painel'
import { hojeISO } from '@/lib/crm'
import type { Atividade, Cliente, MembroEquipe, Projeto, TarefaAgenda } from '@/types'

export default async function ClienteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cliente } = await supabase.from('clientes').select('*').eq('id', id).maybeSingle()
  if (!cliente) notFound()

  const [{ data: projetos, error }, atividadesRes, { data: equipe }, tarefasRes, concluidasRes] =
    await Promise.all([
    supabase.from('projetos').select('*').eq('cliente_id', id).order('created_at', { ascending: false }),
    supabase
      .from('atividades')
      .select('*, equipe(nome)')
      .eq('cliente_id', id)
      .order('ocorreu_em', { ascending: false })
      .limit(100),
    supabase.from('equipe').select('id, nome').order('nome'),
    // Tarefas abertas (frente B). Erra enquanto o SQL da agenda não rodou.
    supabase
      .from('atividades')
      .select('*, equipe(nome)')
      .eq('cliente_id', id)
      .not('previsto_para', 'is', null)
      .is('concluida_em', null)
      .order('previsto_para'),
    // Tarefas concluídas pela data de conclusão: uma tarefa antiga feita hoje
    // pode estar fora das 100 atividades mais recentes por ocorreu_em.
    supabase
      .from('atividades')
      .select('*, equipe(nome)')
      .eq('cliente_id', id)
      .not('concluida_em', 'is', null)
      .order('concluida_em', { ascending: false })
      .limit(50),
  ])
  if (error) throw new Error(error.message)

  const c = cliente as Cliente
  const obras = (projetos as Projeto[]) ?? []
  // Antes de rodar o SQL do Cliente 360 as colunas e a tabela nova não existem:
  // a tela funciona, só sem salvar os campos novos.
  const crmDisponivel = 'fase_manual' in c && !atividadesRes.error
  const recentes = crmDisponivel ? ((atividadesRes.data as Atividade[]) ?? []) : []
  const concluidas = crmDisponivel && !concluidasRes.error ? ((concluidasRes.data as Atividade[]) ?? []) : []
  const ids = new Set(recentes.map((a) => a.id))
  const atividades = [...recentes, ...concluidas.filter((a) => !ids.has(a.id))]
  const agendaDisponivel = crmDisponivel && !tarefasRes.error
  const tarefas = agendaDisponivel ? ((tarefasRes.data as TarefaAgenda[]) ?? []) : []

  return (
    <ClientePainel
      cliente={c}
      obras={obras}
      atividades={atividades}
      equipe={(equipe as Pick<MembroEquipe, 'id' | 'nome'>[] | null) ?? []}
      crmDisponivel={crmDisponivel}
      agendaDisponivel={agendaDisponivel}
      tarefas={tarefas}
      hoje={hojeISO()}
    />
  )
}
