import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EmpresaForm } from '@/components/empresa/empresa-form'
import { carregarPrecos } from '@/components/orcamento/dados'
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
  const precos = await carregarPrecos(supabase, empresa.id)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-tight">Empresa</h1>
          <p className="text-muted-foreground text-sm">Seus dados, os serviços que você faz e quanto cobra.</p>
        </header>
        <EmpresaForm empresa={empresa as Empresa} precos={precos} />
      </div>
    </div>
  )
}
