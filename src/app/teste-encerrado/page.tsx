import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Marca } from '@/components/onboarding/marca'
import { ResumoAssinatura } from '@/components/assinatura/resumo-assinatura'
import { Planos } from '@/components/assinatura/planos'
import { BotaoSair } from '@/components/assinatura/botao-sair'
import { carregarAssinatura, situacaoAssinatura } from '@/lib/assinatura'
import type { Empresa } from '@/types'

// Tela de quem passou do teste grátis (ou da assinatura) sem pagar. Fica fora
// do layout do app, que manda para cá enquanto o acesso estiver bloqueado.
export default async function TesteEncerradoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase.from('empresas').select('*').eq('owner_id', user.id).maybeSingle()
  if (!data) redirect('/onboarding')
  const empresa = data as Empresa
  const situacao = situacaoAssinatura(await carregarAssinatura(supabase, empresa.id), empresa.created_at)
  if (situacao.liberado) redirect('/inicio')

  return (
    <div className="flex min-h-svh flex-col gap-6 p-4 md:p-6">
      <header className="flex items-center justify-between gap-4">
        <Marca />
        <BotaoSair />
      </header>
      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold tracking-tight">Seu teste grátis terminou</h1>
        <p className="text-muted-foreground text-sm">
          {empresa.nome}: clientes, obras e orçamentos continuam guardados. Assine para voltar a usar.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ResumoAssinatura situacao={situacao} tipo={empresa.tipo_pessoa ?? 'PJ'} />
        <Planos />
      </div>
    </div>
  )
}
