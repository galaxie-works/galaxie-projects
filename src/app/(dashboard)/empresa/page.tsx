import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EmpresaForm from '@/components/EmpresaForm'
import type { Empresa } from '@/types'

export default async function EmpresaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: empresa } = await supabase
    .from('empresas')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!empresa) redirect('/onboarding')

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="mb-6 text-xl font-semibold">Dados da empresa</h1>
      <EmpresaForm empresa={empresa as Empresa} />
    </div>
  )
}
