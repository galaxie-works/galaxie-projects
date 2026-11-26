import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { projetoAtrasado } from '@/lib/status'
import { ProjetoAbas } from '@/components/projetos/projeto-abas'
import { ProjetoCabecalho } from '@/components/projetos/projeto-cabecalho'
import { carregarOrcamento, carregarPrecos } from '@/components/orcamento/dados'
import { podeVerFinanceiro } from '@/lib/financeiro'
import type { Cliente, Compra, Etapa, MembroEquipe, Projeto, Recebimento } from '@/types'

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
    recebimentosRes,
  ] = await Promise.all([
      supabase.from('etapas').select('*, equipe(nome)').eq('projeto_id', id).order('ordem'),
      supabase
        .from('compras')
        .select('*, equipe(nome)')
        .eq('projeto_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('equipe').select('*').eq('empresa_id', projeto.empresa_id).order('nome'),
      supabase.from('clientes').select('*').eq('empresa_id', projeto.empresa_id).order('nome'),
      supabase.from('empresas').select('servicos').eq('id', projeto.empresa_id).maybeSingle(),
      carregarOrcamento(supabase, id),
      carregarPrecos(supabase, projeto.empresa_id),
      supabase
        .from('recebimentos')
        .select('*')
        .eq('projeto_id', id)
        .order('vencimento')
        .order('ordem'),
    ])
  const verFinanceiro = podeVerFinanceiro()
  // Antes de rodar o SQL do financeiro a tabela não existe: a aba avisa.
  const financeiroDisponivel = !recebimentosRes.error
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
        recebimentosIniciais={financeiroDisponivel ? ((recebimentosRes.data as Recebimento[]) ?? []) : []}
        financeiroDisponivel={financeiroDisponivel}
        verFinanceiro={verFinanceiro}
      />
    </div>
  )
}
