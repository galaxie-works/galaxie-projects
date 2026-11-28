import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { projetoAtrasado } from '@/lib/status'
import { ProjetosPainel, type LinhaProjeto } from '@/components/projetos/projetos-painel'
import type { Projeto } from '@/types'
import { exigirAcesso, idDaEmpresa } from '@/lib/acesso'

export default async function ProjetosPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  await exigirAcesso('obras')

  const { data: empresa } = await supabase
    .from('empresas')
    .select('id, nome')
    .eq('id', await idDaEmpresa())
    .maybeSingle()
  if (!empresa) redirect('/onboarding')

  const { data: projetos, error } = await supabase
    .from('projetos')
    .select('*, clientes(nome)')
    .eq('empresa_id', empresa.id)
    .order('created_at', { ascending: false })

  const lista = (projetos as Projeto[]) ?? []

  // Gasto por obra = soma das compras registradas nela.
  const gastoPorProjeto = new Map<string, number>()
  if (lista.length > 0) {
    const { data: compras } = await supabase
      .from('compras')
      .select('projeto_id, valor')
      .in(
        'projeto_id',
        lista.map((p) => p.id)
      )
    for (const c of compras ?? []) {
      gastoPorProjeto.set(c.projeto_id, (gastoPorProjeto.get(c.projeto_id) ?? 0) + Number(c.valor))
    }
  }

  const linhas: LinhaProjeto[] = lista.map((p) => ({
    ...p,
    gasto: gastoPorProjeto.get(p.id) ?? 0,
    atrasado: projetoAtrasado(p),
  }))

  return (
    <div className="flex flex-col p-4 md:p-6">
      <ProjetosPainel projetos={linhas} erro={error?.message ?? null} />
    </div>
  )
}
