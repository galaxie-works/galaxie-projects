import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClientePainel } from '@/components/clientes/cliente-painel'
import { agoraMs, hojeISO } from '@/lib/crm'
import { SELECT_NEGOCIO } from '@/lib/negocios'
import { SELECT_POS_VENDA } from '@/lib/pos-venda'
import type { Atividade, Cliente, MembroEquipe, Negocio, PosVenda, Projeto } from '@/types'

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

  const [{ data: projetos, error }, atividadesRes, { data: equipe }, negociosRes, posVendaRes, { data: empresa }] = await Promise.all([
    supabase.from('projetos').select('*').eq('cliente_id', id).order('created_at', { ascending: false }),
    supabase
      .from('atividades')
      .select('*, equipe(nome)')
      .eq('cliente_id', id)
      .order('ocorreu_em', { ascending: false })
      .limit(100),
    supabase.from('equipe').select('id, nome').order('nome'),
    supabase.from('negocios').select(SELECT_NEGOCIO).eq('cliente_id', id).order('created_at', { ascending: false }),
    supabase.from('pos_venda').select(SELECT_POS_VENDA).eq('cliente_id', id).order('vence_em'),
    supabase.from('empresas').select('*').eq('id', cliente.empresa_id).maybeSingle(),
  ])
  if (error) throw new Error(error.message)

  const c = cliente as Cliente
  const obras = (projetos as Projeto[]) ?? []
  // Antes de rodar o SQL do Cliente 360 as colunas e a tabela nova não existem:
  // a tela funciona, só sem salvar os campos novos.
  const crmDisponivel = 'fase_manual' in c && !atividadesRes.error
  const atividades = crmDisponivel ? ((atividadesRes.data as Atividade[]) ?? []) : []
  // Pós-venda: a aba funciona (vazia) antes de rodar o SQL da frente D.
  const posVendaDisponivel = !posVendaRes.error
  const posVenda = posVendaDisponivel ? ((posVendaRes.data as PosVenda[] | null) ?? []) : []

  const { data: indicadoPor } = c.indicado_por_id
    ? await supabase.from('clientes').select('id, nome').eq('id', c.indicado_por_id).maybeSingle()
    : { data: null }

  return (
    <ClientePainel
      indicadoPor={(indicadoPor as { id: string; nome: string } | null) ?? null}
      cliente={c}
      obras={obras}
      atividades={atividades}
      equipe={(equipe as Pick<MembroEquipe, 'id' | 'nome'>[] | null) ?? []}
      crmDisponivel={crmDisponivel}
      posVenda={posVenda}
      posVendaDisponivel={posVendaDisponivel}
      linkGoogle={(empresa?.link_avaliacao_google as string | null | undefined) ?? null}
      hoje={hojeISO()}
      negocios={negociosRes.error ? null : ((negociosRes.data as unknown as Negocio[]) ?? [])}
      agora={agoraMs()}
    />
  )
}
