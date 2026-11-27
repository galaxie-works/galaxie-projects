import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ResumoAssinatura } from '@/components/assinatura/resumo-assinatura'
import { Planos } from '@/components/assinatura/planos'
import { ComandosIA } from '@/components/assinatura/comandos-ia'
import { BotaoPortal } from '@/components/assinatura/botao-portal'
import { carregarAssinatura, situacaoAssinatura } from '@/lib/assinatura'
import { lerCarteira, lerExtrato } from '@/lib/ia/cota'
import { configPublica } from '@/lib/ia/config-servidor'
import { cobrancaLigada } from '@/lib/stripe/servidor'
import { lerConfig, lerPlanos, planoPorId } from '@/lib/plataforma/config'
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
  const assinatura = await carregarAssinatura(supabase, empresa.id)
  const situacao = situacaoAssinatura(assinatura, empresa.created_at)

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
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-tight">Assinatura</h1>
          <p className="text-muted-foreground text-sm">Seu plano, os comandos de IA e o tipo de conta.</p>
        </div>
        {ligada && assinatura?.gateway_cliente_id && <BotaoPortal />}
      </header>
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
