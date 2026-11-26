import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { projetoAtrasado } from '@/lib/status'
import { ProjetoAbas } from '@/components/projetos/projeto-abas'
import { ProjetoCabecalho } from '@/components/projetos/projeto-cabecalho'
import { carregarOrcamento, carregarPrecos } from '@/components/orcamento/dados'
import { hojeISO } from '@/lib/crm'
import { SELECT_POS_VENDA } from '@/lib/pos-venda'
import type { Cliente, Compra, Etapa, MembroEquipe, PosVenda, Projeto } from '@/types'

export default async function ProjetoDetalhePage({
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

  const { data: projeto } = await supabase
    .from('projetos')
    .select('*, clientes(nome)')
    .eq('id', id)
    .maybeSingle()

  if (!projeto) notFound()

  const [
    { data: etapas },
    { data: compras },
    { data: equipe },
    { data: clientes },
    { data: empresa },
    areas,
    precos,
    posVendaRes,
  ] = await Promise.all([
      supabase.from('etapas').select('*, equipe(nome)').eq('projeto_id', id).order('ordem'),
      supabase
        .from('compras')
        .select('*, equipe(nome)')
        .eq('projeto_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('equipe').select('*').eq('empresa_id', projeto.empresa_id).order('nome'),
      supabase.from('clientes').select('*').eq('empresa_id', projeto.empresa_id).order('nome'),
      supabase.from('empresas').select('*').eq('id', projeto.empresa_id).maybeSingle(),
      carregarOrcamento(supabase, id),
      carregarPrecos(supabase, projeto.empresa_id),
      supabase.from('pos_venda').select(SELECT_POS_VENDA).eq('projeto_id', id).order('vence_em'),
    ])
  const temItens = areas.some((a) => a.itens.length > 0)

  const p = projeto as Projeto
  const hoje = new Date().toISOString().slice(0, 10)
  // Remonta os blocos quando os dados do servidor mudam (após salvar/refresh).
  const versao = [p.status, p.nome, p.percentual_conclusao, p.orcamento_total, p.data_inicio, p.data_prazo].join('|')

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <ProjetoCabecalho
        key={`cabecalho-${versao}`}
        projeto={p}
        clientes={(clientes as Cliente[]) ?? []}
        atrasado={projetoAtrasado(p)}
        totalCalculado={temItens}
      />
      <ProjetoAbas
        key={`abas-${p.id}`}
        projeto={p}
        etapasIniciais={(etapas as Etapa[]) ?? []}
        comprasIniciais={(compras as Compra[]) ?? []}
        equipe={(equipe as MembroEquipe[]) ?? []}
        hoje={hoje}
        areasIniciais={areas}
        servicosEmpresa={(empresa?.servicos as string[]) ?? []}
        precos={precos}
        posVenda={posVendaRes.error ? [] : ((posVendaRes.data as PosVenda[] | null) ?? [])}
        posVendaDisponivel={!posVendaRes.error}
        cliente={(clientes as Cliente[] | null)?.find((c) => c.id === p.cliente_id) ?? null}
        linkGoogle={(empresa?.link_avaliacao_google as string | null | undefined) ?? null}
        hojeBrasil={hojeISO()}
      />
    </div>
  )
}
