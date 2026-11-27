import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Marca } from '@/components/onboarding/marca'
import { ResumoAssinatura } from '@/components/assinatura/resumo-assinatura'
import { Planos } from '@/components/assinatura/planos'
import { BotaoSair } from '@/components/assinatura/botao-sair'
import { ComandosIA } from '@/components/assinatura/comandos-ia'
import { BotaoPortal } from '@/components/assinatura/botao-portal'
import { carregarAssinatura, situacaoAssinatura } from '@/lib/assinatura'
import { lerCarteira, lerExtrato } from '@/lib/ia/cota'
import { configPublica } from '@/lib/ia/config-servidor'
import { cobrancaLigada } from '@/lib/stripe/servidor'
import { lerConfig, lerPlanos, planoPorId } from '@/lib/plataforma/config'
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
  const assinatura = await carregarAssinatura(supabase, empresa.id)
  const situacao = situacaoAssinatura(assinatura, empresa.created_at)
  if (situacao.liberado) redirect('/inicio')

  const [carteira, extrato, ia, ligada, planos, config] = await Promise.all([
    lerCarteira(supabase, empresa.id),
    lerExtrato(supabase, empresa.id),
    configPublica(supabase, empresa.id).catch(() => null),
    cobrancaLigada(),
    lerPlanos(),
    lerConfig(),
  ])
  const pago = !!assinatura?.gateway_assinatura_id && ['ativa', 'atrasada'].includes(assinatura.status)
  const planoPago = pago ? await planoPorId(assinatura?.plano) : null

  return (
    <div className="flex min-h-svh flex-col gap-6 p-4 md:p-6">
      <header className="flex items-center justify-between gap-4">
        <Marca />
        <div className="flex items-center gap-2">
          {ligada && assinatura?.gateway_cliente_id && <BotaoPortal />}
          <BotaoSair />
        </div>
      </header>
      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold tracking-tight">Seu teste grátis terminou</h1>
        <p className="text-muted-foreground text-sm">
          {empresa.nome}: clientes, obras e orçamentos continuam guardados. Assine para voltar a usar.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ResumoAssinatura situacao={situacao} tipo={empresa.tipo_pessoa ?? 'PJ'} />
        <ComandosIA
          carteira={carteira}
          extrato={extrato}
          chavePropria={!!ia?.ativo}
          cobrancaLigada={ligada}
          pacote={config.pacoteIA}
        />
      </div>
      <Planos
        cobrancaLigada={ligada}
        planos={planos}
        usuarioExtra={config.usuarioExtra.preco}
        planoAtual={planoPago?.id ?? null}
        cicloAtual={pago ? (assinatura?.ciclo ?? null) : null}
        pago={pago}
      />
    </div>
  )
}
