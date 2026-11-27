import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ResumoAssinatura } from '@/components/assinatura/resumo-assinatura'
import { Planos } from '@/components/assinatura/planos'
import { carregarAssinatura, situacaoAssinatura } from '@/lib/assinatura'
import type { Empresa } from '@/types'

export default async function AssinaturaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase.from('empresas').select('*').eq('owner_id', user.id).maybeSingle()
  if (!data) redirect('/onboarding')
  const empresa = data as Empresa
  const situacao = situacaoAssinatura(await carregarAssinatura(supabase, empresa.id), empresa.created_at)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold tracking-tight">Assinatura</h1>
        <p className="text-muted-foreground text-sm">Seu plano, o teste grátis e o tipo de conta.</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-2">
        <ResumoAssinatura situacao={situacao} tipo={empresa.tipo_pessoa ?? 'PJ'} />
        <Planos />
      </div>
    </div>
  )
}
