import { notFound } from 'next/navigation'
import type Stripe from 'stripe'
import { adminLogado } from '@/lib/plataforma/admin'
import { lerConfig, lerTodosPlanos } from '@/lib/plataforma/config'
import { lerSegredo, situacaoSegredos } from '@/lib/plataforma/segredos'
import { chaveMestraConfigurada } from '@/lib/ia/cripto'
import { stripeCom } from '@/lib/stripe/servidor'
import { clienteAdmin } from '@/lib/supabase/admin'
import { PainelAdmin, type Assinante, type Cupom } from '@/components/admin/painel-admin'

export const dynamic = 'force-dynamic'

async function carregarCupons(s: Stripe): Promise<{ cupons: Cupom[]; erro: string | null }> {
  try {
    const lista = await s.promotionCodes.list({ limit: 100, expand: ['data.promotion.coupon'] })
    const cupons = lista.data.map((p): Cupom => {
      const c = typeof p.promotion.coupon === 'object' ? p.promotion.coupon : null
      return {
        id: p.id,
        codigo: p.code,
        ativo: p.active && (c?.valid ?? true),
        percentual: c?.percent_off ?? null,
        valor: c?.amount_off != null ? c.amount_off / 100 : null,
        duracao: (c?.duration ?? 'once') as Cupom['duracao'],
        meses: c?.duration_in_months ?? null,
        usos: p.times_redeemed,
        maxUsos: p.max_redemptions ?? c?.max_redemptions ?? null,
        expiraEm: p.expires_at ? new Date(p.expires_at * 1000).toISOString() : null,
      }
    })
    return { cupons, erro: null }
  } catch (e) {
    return { cupons: [], erro: e instanceof Error ? e.message : 'Não foi possível ler os cupons do Stripe.' }
  }
}

async function carregarAssinantes(): Promise<Assinante[] | null> {
  const db = clienteAdmin()
  if (!db) return null
  const [empresas, assinaturas, carteiras, usuarios] = await Promise.all([
    db.from('empresas').select('id, nome, tipo_pessoa, owner_id, created_at').order('created_at', { ascending: false }),
    db.from('assinaturas').select('empresa_id, status, plano, ciclo, teste_fim, periodo_fim, gateway_assinatura_id'),
    db.from('ia_carteira').select('empresa_id, cota_mensal, saldo_plano, saldo_extra'),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ])
  if (empresas.error) return null
  const porEmpresa = <T extends { empresa_id: string }>(l: T[] | null) => new Map((l ?? []).map((x) => [x.empresa_id, x]))
  const a = porEmpresa(assinaturas.data)
  const c = porEmpresa(carteiras.data)
  const emails = new Map((usuarios.data?.users ?? []).map((u) => [u.id, u.email ?? '']))
  return (empresas.data ?? []).map((e) => {
    const s = a.get(e.id)
    const k = c.get(e.id)
    return {
      id: e.id,
      nome: e.nome,
      email: emails.get(e.owner_id) ?? '',
      tipo: e.tipo_pessoa ?? 'PJ',
      criadaEm: e.created_at,
      status: s?.status ?? null,
      plano: s?.plano ?? null,
      ciclo: s?.ciclo ?? null,
      testeFim: s?.teste_fim ?? null,
      periodoFim: s?.periodo_fim ?? null,
      pagaStripe: !!s?.gateway_assinatura_id,
      comandos: k ? k.saldo_plano + k.saldo_extra : null,
      cota: k?.cota_mensal ?? null,
    }
  })
}

export default async function AdminPage() {
  // Quem não é admin master nem fica sabendo que a página existe.
  if (!(await adminLogado())) notFound()

  const chaveStripe = await lerSegredo('STRIPE_SECRET_KEY')
  const s = chaveStripe ? stripeCom(chaveStripe) : null
  const [segredos, planos, config, cupons, assinantes] = await Promise.all([
    situacaoSegredos(),
    lerTodosPlanos(),
    lerConfig(),
    s ? carregarCupons(s) : Promise.resolve({ cupons: [], erro: null }),
    carregarAssinantes().catch(() => null),
  ])

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold tracking-tight">Admin master</h1>
      </header>
      <PainelAdmin
        segredos={segredos}
        planos={planos}
        config={config}
        cupons={cupons.cupons}
        erroCupons={cupons.erro}
        assinantes={assinantes}
        stripeLigado={!!s}
        stripeModo={chaveStripe ? (chaveStripe.includes('_live_') ? 'producao' : 'teste') : null}
        servidorPronto={{ serviceRole: !!clienteAdmin(), chaveMestra: chaveMestraConfigurada() }}
      />
    </div>
  )
}
