import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClientePainel } from '@/components/clientes/cliente-painel'
import { hojeISO } from '@/lib/crm'
import { podeVerFinanceiro } from '@/lib/financeiro'
import type { Atividade, Cliente, MembroEquipe, Projeto, Recebimento } from '@/types'

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

  const [{ data: projetos, error }, atividadesRes, { data: equipe }] = await Promise.all([
    supabase.from('projetos').select('*').eq('cliente_id', id).order('created_at', { ascending: false }),
    supabase
      .from('atividades')
      .select('*, equipe(nome)')
      .eq('cliente_id', id)
      .order('ocorreu_em', { ascending: false })
      .limit(100),
    supabase.from('equipe').select('id, nome').order('nome'),
  ])
  if (error) throw new Error(error.message)

  const c = cliente as Cliente
  const obras = (projetos as Projeto[]) ?? []

  // Parcelas das obras deste cliente (pela obra, que é a fonte da verdade).
  const verFinanceiro = podeVerFinanceiro()
  const recebimentosRes =
    verFinanceiro && obras.length > 0
      ? await supabase
          .from('recebimentos')
          .select('*, projetos(nome, cliente_id)')
          .in(
            'projeto_id',
            obras.map((o) => o.id)
          )
          .order('vencimento')
      : null
  const financeiroDisponivel = verFinanceiro && !recebimentosRes?.error
  // Antes de rodar o SQL do Cliente 360 as colunas e a tabela nova não existem:
  // a tela funciona, só sem salvar os campos novos.
  const crmDisponivel = 'fase_manual' in c && !atividadesRes.error
  const atividades = crmDisponivel ? ((atividadesRes.data as Atividade[]) ?? []) : []

  return (
    <ClientePainel
      cliente={c}
      obras={obras}
      atividades={atividades}
      equipe={(equipe as Pick<MembroEquipe, 'id' | 'nome'>[] | null) ?? []}
      crmDisponivel={crmDisponivel}
      hoje={hojeISO()}
      recebimentos={financeiroDisponivel ? ((recebimentosRes?.data as Recebimento[] | null) ?? []) : []}
      verFinanceiro={verFinanceiro}
      financeiroDisponivel={financeiroDisponivel}
    />
  )
}
