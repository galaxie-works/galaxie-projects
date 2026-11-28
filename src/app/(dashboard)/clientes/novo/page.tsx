import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClienteForm } from '@/components/clientes/cliente-form'
import { exigirAcesso, idDaEmpresa } from '@/lib/acesso'

export default async function NovoClientePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  await exigirAcesso('clientes', 'editar')

  const { data: empresa } = await supabase
    .from('empresas')
    .select('id')
    .eq('id', await idDaEmpresa())
    .maybeSingle()
  if (!empresa) redirect('/onboarding')

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold tracking-tight">Novo cliente</h1>
      </header>
      <ClienteForm empresaId={empresa.id} />
    </div>
  )
}
