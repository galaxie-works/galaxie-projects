import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProjetoForm from '@/components/ProjetoForm'
import type { Cliente } from '@/types'

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

  const { data: empresa } = await supabase
    .from('empresas')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!empresa) redirect('/onboarding')

  const { data: clientes } = await supabase
    .from('clientes')
    .select('*')
    .eq('empresa_id', empresa.id)
    .order('nome')

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="mb-6 text-xl font-semibold">Novo projeto</h1>
      <ProjetoForm
        empresaId={empresa.id}
        clientes={(clientes as Cliente[]) ?? []}
        clienteIdInicial={clienteId}
      />
    </div>
  )
}
