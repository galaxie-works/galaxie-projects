import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hojeISO } from '@/lib/crm'
import { podeVerFinanceiro } from '@/lib/financeiro'
import { FinanceiroPainel, type ObraMargem } from '@/components/financeiro/financeiro-painel'
import type { Recebimento } from '@/types'
import { exigirAcesso, idDaEmpresa } from '@/lib/acesso'

export default async function FinanceiroPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  await exigirAcesso('financeiro')
  if (!podeVerFinanceiro()) redirect('/projetos')

  const { data: empresa } = await supabase.from('empresas').select('id').eq('id', await idDaEmpresa()).maybeSingle()
  if (!empresa) redirect('/onboarding')

  const [recebimentosRes, { data: projetos }, { data: compras }] = await Promise.all([
    supabase
      .from('recebimentos')
      .select('*, projetos(nome, cliente_id, clientes(nome))')
      .eq('empresa_id', empresa.id)
      .order('vencimento'),
    supabase
      .from('projetos')
      .select('id, nome, status, orcamento_total, cliente_id, clientes(nome)')
      .eq('empresa_id', empresa.id)
      .order('created_at', { ascending: false }),
    supabase.from('compras').select('projeto_id, valor, projetos!inner(empresa_id)').eq('projetos.empresa_id', empresa.id),
  ])

  const gastoPorObra = new Map<string, number>()
  for (const c of compras ?? []) {
    gastoPorObra.set(c.projeto_id, (gastoPorObra.get(c.projeto_id) ?? 0) + Number(c.valor))
  }
  const obras: ObraMargem[] = (projetos ?? []).map((p) => ({
    id: p.id,
    nome: p.nome,
    status: p.status,
    clienteId: p.cliente_id,
    clienteNome: (p.clientes as unknown as { nome: string } | null)?.nome ?? '—',
    orcamento: Number(p.orcamento_total ?? 0),
    compras: gastoPorObra.get(p.id) ?? 0,
  }))

  return (
    <FinanceiroPainel
      recebimentos={recebimentosRes.error ? [] : ((recebimentosRes.data as Recebimento[]) ?? [])}
      disponivel={!recebimentosRes.error}
      obras={obras}
      hoje={hojeISO()}
    />
  )
}
