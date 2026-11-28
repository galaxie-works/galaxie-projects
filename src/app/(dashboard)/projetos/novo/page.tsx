import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjetoForm } from '@/components/projetos/projeto-form'
import { carregarPrecos } from '@/components/orcamento/dados'
import type { Cliente } from '@/types'
import { exigirAcesso, idDaEmpresa } from '@/lib/acesso'

export default async function NovoProjetoPage({
  searchParams,
}: {
  searchParams: Promise<{ clienteId?: string }>
}) {
  const { clienteId } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  await exigirAcesso('obras', 'editar')

  const { data: empresa } = await supabase
    .from('empresas')
    .select('id, servicos')
    .eq('id', await idDaEmpresa())
    .maybeSingle()
  if (!empresa) redirect('/onboarding')

  const [{ data: clientes }, precos] = await Promise.all([
    supabase.from('clientes').select('*').eq('empresa_id', empresa.id).order('nome'),
    carregarPrecos(supabase, empresa.id),
  ])

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold tracking-tight">Novo projeto</h1>
        <p className="text-sm text-muted-foreground">
          Dados da obra, áreas e medidas. O orçamento é calculado sozinho.
        </p>
      </header>
      <ProjetoForm
        empresaId={empresa.id}
        clientes={(clientes as Cliente[]) ?? []}
        clienteIdInicial={clienteId}
        orcamento={{ servicosEmpresa: (empresa.servicos as string[]) ?? [], precos }}
      />
    </div>
  )
}
