'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import Stripe from 'stripe'
import { adminLogado } from '@/lib/plataforma/admin'
import { esquecerConfig, lerConfig, lerTodosPlanos } from '@/lib/plataforma/config'
import {
  apagarSegredo,
  ehNomeSegredo,
  gravarSegredo,
  lerSegredo,
  validarFormato,
  type NomeSegredo,
} from '@/lib/plataforma/segredos'
import { EVENTOS_WEBHOOK, itensDePreco, sincronizarPrecos, type ResultadoPreco } from '@/lib/plataforma/stripe-precos'
import { chaveMestraConfigurada } from '@/lib/ia/cripto'
import { MODELO_GALAXIE } from '@/lib/ia/cota'
import { testarChave } from '@/lib/ia/executar'
import { stripeCom } from '@/lib/stripe/servidor'
import { clienteAdmin } from '@/lib/supabase/admin'
import type { PlanoId } from '@/lib/planos'

// Ações do painel do admin master. Toda ação começa conferindo no banco que
// quem pediu é admin master; só depois usa o service role.

export type ResultadoAdmin = { ok: true; mensagem: string } | { ok: false; erro: string }

const negado: ResultadoAdmin = { ok: false, erro: 'Só o admin master pode fazer isso.' }

function semServiceRole(): ResultadoAdmin {
  return { ok: false, erro: 'Falta SUPABASE_SERVICE_ROLE_KEY neste ambiente (só existe em produção).' }
}

const atualizar = () => {
  esquecerConfig()
  revalidatePath('/', 'layout')
}

// Chaves --------------------------------------------------------------------

async function testar(nome: NomeSegredo, valor: string): Promise<string> {
  if (nome === 'STRIPE_SECRET_KEY') {
    const s = new Stripe(valor, { maxNetworkRetries: 0 })
    const conta = await s.accounts.retrieveCurrent()
    const modo = valor.includes('_live_') ? 'produção' : 'teste'
    const nomeConta = conta.settings?.dashboard?.display_name || conta.business_profile?.name || conta.id
    return `Stripe respondeu: conta ${nomeConta}, modo ${modo}.`
  }
  if (nome === 'ANTHROPIC_API_KEY') {
    await testarChave('anthropic', MODELO_GALAXIE, valor)
    return `Anthropic respondeu com o ${MODELO_GALAXIE}.`
  }
  return 'Formato conferido. O Stripe confirma o segredo no próximo evento do webhook.'
}

function erroDeTeste(e: unknown): string {
  if (e instanceof Stripe.errors.StripeAuthenticationError) return 'O Stripe recusou a chave.'
  if (e instanceof Stripe.errors.StripePermissionError) return 'A chave do Stripe não tem permissão para ler a conta.'
  if (e instanceof Anthropic.AuthenticationError) return 'A Anthropic recusou a chave.'
  if (e instanceof Anthropic.RateLimitError) return 'A Anthropic respondeu sem crédito ou com limite de uso atingido.'
  return e instanceof Error ? e.message : 'Não foi possível testar a chave.'
}

export async function salvarSegredoAcao(nome: string, valor: string): Promise<ResultadoAdmin> {
  const admin = await adminLogado()
  if (!admin) return negado
  if (!ehNomeSegredo(nome)) return { ok: false, erro: 'Chave desconhecida.' }
  if (!clienteAdmin()) return semServiceRole()
  if (!chaveMestraConfigurada()) return { ok: false, erro: 'Falta IA_CHAVE_MESTRA no servidor para cifrar a chave.' }
  const v = valor.trim()
  const formato = validarFormato(nome, v)
  if (formato) return { ok: false, erro: formato }
  let teste: string
  try {
    teste = await testar(nome, v)
  } catch (e) {
    return { ok: false, erro: erroDeTeste(e) }
  }
  try {
    await gravarSegredo(nome, v, admin.user.id)
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Não foi possível guardar.' }
  }
  atualizar()
  // Chave nova (talvez de outra conta do Stripe): os preços precisam existir lá.
  const precos = nome === 'STRIPE_SECRET_KEY' ? await sincronizarSeLigado().catch((e) => ` Preços não subiram: ${e instanceof Error ? e.message : e}.`) : ''
  return { ok: true, mensagem: `Guardada e já valendo. ${teste}${precos}` }
}

export async function testarSegredoAcao(nome: string): Promise<ResultadoAdmin> {
  if (!(await adminLogado())) return negado
  if (!ehNomeSegredo(nome)) return { ok: false, erro: 'Chave desconhecida.' }
  const valor = await lerSegredo(nome)
  if (!valor) return { ok: false, erro: 'Essa chave ainda não está configurada.' }
  try {
    return { ok: true, mensagem: await testar(nome, valor) }
  } catch (e) {
    return { ok: false, erro: erroDeTeste(e) }
  }
}

export async function removerSegredoAcao(nome: string): Promise<ResultadoAdmin> {
  if (!(await adminLogado())) return negado
  if (!ehNomeSegredo(nome)) return { ok: false, erro: 'Chave desconhecida.' }
  if (!clienteAdmin()) return semServiceRole()
  try {
    await apagarSegredo(nome)
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Não foi possível remover.' }
  }
  atualizar()
  return {
    ok: true,
    mensagem: process.env[nome]
      ? 'Removida do painel. Volta a valer a da Vercel.'
      : 'Removida. Essa parte fica desligada até cadastrar outra.',
  }
}

/** Cria o webhook do app no Stripe e guarda o segredo dele, sem copiar nada à mão. */
export async function criarWebhookAcao(): Promise<ResultadoAdmin> {
  const admin = await adminLogado()
  if (!admin) return negado
  if (!clienteAdmin()) return semServiceRole()
  const chave = await lerSegredo('STRIPE_SECRET_KEY')
  if (!chave) return { ok: false, erro: 'Cadastre a chave secreta do Stripe primeiro.' }

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const base = (process.env.NEXT_PUBLIC_APP_URL || (host ? `https://${host}` : '')).replace(/\/$/, '')
  if (!base || base.includes('localhost')) {
    return { ok: false, erro: 'Abra o painel pelo endereço público do app para criar o webhook.' }
  }
  const url = `${base}/api/stripe/webhook`

  try {
    const s = stripeCom(chave)
    // O Stripe não mostra de novo o segredo de um webhook antigo: cria um novo,
    // guarda o segredo e só então apaga os antigos do mesmo endereço. Se guardar
    // falhar, o novo sai e o antigo continua funcionando.
    const novo = await s.webhookEndpoints.create({
      url,
      enabled_events: EVENTOS_WEBHOOK,
      description: 'Galaxie Obras (criado pelo painel do admin master)',
    })
    try {
      if (!novo.secret) throw new Error('O Stripe criou o webhook mas não devolveu o segredo.')
      await gravarSegredo('STRIPE_WEBHOOK_SECRET', novo.secret, admin.user.id)
    } catch (e) {
      await s.webhookEndpoints.del(novo.id).catch(() => null)
      throw e
    }
    const antigos = await s.webhookEndpoints.list({ limit: 100 })
    for (const w of antigos.data) {
      if (w.url === url && w.id !== novo.id) await s.webhookEndpoints.del(w.id).catch(() => null)
    }
  } catch (e) {
    return { ok: false, erro: erroDeTeste(e) }
  }
  atualizar()
  return { ok: true, mensagem: `Webhook criado em ${url} e segredo guardado.` }
}

// Planos e preços --------------------------------------------------------------

export interface DadosPlano {
  id: PlanoId
  nome: string
  resumo: string
  mensal: number
  anual: number
  escritorio: string
  campo: string
  obras: string
  comandosIA: number
  destaque: boolean
  ativo: boolean
}

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const valorOk = (v: unknown, min = 0.5, max = 100_000) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const inteiroOk = (v: unknown, min = 0, max = 1_000_000) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

function resumoStripe(r: ResultadoPreco[]): string {
  const mudou = r.filter((x) => x.situacao === 'criado' || x.situacao === 'atualizado').length
  const erros = r.filter((x) => x.situacao === 'erro')
  if (erros.length) return ` Stripe: ${erros.length} preço(s) com erro (${erros[0].detalhe}).`
  return mudou ? ` Stripe: ${mudou} preço(s) atualizados.` : ' Stripe já estava igual.'
}

async function sincronizarSeLigado(filtro?: (chave: string) => boolean): Promise<string> {
  const chave = await lerSegredo('STRIPE_SECRET_KEY')
  if (!chave) return ' O Stripe ainda não está ligado: os preços sobem quando a chave for cadastrada.'
  esquecerConfig()
  const itens = itensDePreco(await lerTodosPlanos(), await lerConfig()).filter((i) => !filtro || filtro(i.chave))
  return resumoStripe(await sincronizarPrecos(stripeCom(chave), itens))
}

/** Nova cota para quem já está no plano (ou na cortesia). */
async function aplicarCota(status: 'pago' | 'cortesia', cota: number, plano?: PlanoId) {
  const db = clienteAdmin()!
  let q = db.from('assinaturas').select('empresa_id')
  q = status === 'cortesia' ? q.eq('status', 'cortesia') : q.eq('plano', plano!).in('status', ['ativa', 'atrasada'])
  const { data, error } = await q
  if (error) throw new Error(error.message)
  for (const a of data ?? []) {
    const { error: e } = await db.rpc('ia_definir_cota', { p_empresa_id: a.empresa_id, p_cota: cota })
    if (e) throw new Error(e.message)
  }
  return data?.length ?? 0
}

export async function salvarPlanoAcao(d: DadosPlano): Promise<ResultadoAdmin> {
  if (!(await adminLogado())) return negado
  const db = clienteAdmin()
  if (!db) return semServiceRole()
  if (!['autonomo', 'equipe', 'empresa'].includes(d.id)) return { ok: false, erro: 'Plano inválido.' }
  const nome = texto(d.nome, 40)
  if (!nome) return { ok: false, erro: 'Dê um nome ao plano.' }
  if (!valorOk(d.mensal) || !valorOk(d.anual)) return { ok: false, erro: 'Preços precisam ser de pelo menos R$ 0,50.' }
  if (!inteiroOk(d.comandosIA, 0, 100_000)) return { ok: false, erro: 'Comandos de IA: um número inteiro de 0 a 100.000.' }

  const antes = (await lerTodosPlanos()).find((p) => p.id === d.id)
  if (!d.ativo && (await lerTodosPlanos()).filter((p) => p.ativo && p.id !== d.id).length === 0) {
    return { ok: false, erro: 'Pelo menos um plano precisa continuar à venda.' }
  }
  const { error } = await db
    .from('plataforma_planos')
    .update({
      nome,
      resumo: texto(d.resumo, 140),
      mensal: d.mensal,
      anual: d.anual,
      escritorio: texto(d.escritorio, 60),
      campo: texto(d.campo, 60),
      obras: texto(d.obras, 60),
      comandos_ia: d.comandosIA,
      destaque: !!d.destaque,
      ativo: !!d.ativo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', d.id)
  if (error) return { ok: false, erro: error.message }
  // Só um plano em destaque na tela.
  if (d.destaque) await db.from('plataforma_planos').update({ destaque: false }).neq('id', d.id)
  atualizar()

  let extra = ''
  try {
    if (antes && antes.comandosIA !== d.comandosIA) {
      const n = await aplicarCota('pago', d.comandosIA, d.id)
      if (n) extra += ` Cota nova aplicada a ${n} assinante(s).`
    }
  } catch (e) {
    extra += ` A cota dos assinantes não foi atualizada: ${e instanceof Error ? e.message : e}.`
  }
  const precoMudou = !antes || antes.mensal !== d.mensal || antes.anual !== d.anual || antes.nome !== nome
  if (precoMudou) extra += await sincronizarSeLigado((c) => c.startsWith(`obras_${d.id}_`))
  return { ok: true, mensagem: `Plano ${nome} salvo.${extra}` }
}

export interface DadosExtras {
  comandosTeste: number
  comandosCortesia: number
  pacoteComandos: number
  pacotePreco: number
  usuarioExtraPreco: number
}

export async function salvarExtrasAcao(d: DadosExtras): Promise<ResultadoAdmin> {
  if (!(await adminLogado())) return negado
  const db = clienteAdmin()
  if (!db) return semServiceRole()
  if (!inteiroOk(d.comandosTeste, 0, 100_000) || !inteiroOk(d.comandosCortesia, 0, 100_000)) {
    return { ok: false, erro: 'Comandos do teste e da cortesia: números inteiros de 0 a 100.000.' }
  }
  if (!inteiroOk(d.pacoteComandos, 1, 100_000)) return { ok: false, erro: 'O pacote precisa ter pelo menos 1 comando.' }
  if (!valorOk(d.pacotePreco) || !valorOk(d.usuarioExtraPreco)) {
    return { ok: false, erro: 'Preços precisam ser de pelo menos R$ 0,50.' }
  }
  const antes = await lerConfig()
  const agora = new Date().toISOString()
  const { error } = await db.from('plataforma_config').upsert([
    { chave: 'comandos_teste', valor: d.comandosTeste, updated_at: agora },
    { chave: 'comandos_cortesia', valor: d.comandosCortesia, updated_at: agora },
    { chave: 'pacote_ia_comandos', valor: d.pacoteComandos, updated_at: agora },
    { chave: 'pacote_ia_preco', valor: d.pacotePreco, updated_at: agora },
    { chave: 'usuario_extra_preco', valor: d.usuarioExtraPreco, updated_at: agora },
  ])
  if (error) return { ok: false, erro: error.message }
  atualizar()

  let extra = ''
  try {
    if (antes.comandosCortesia !== d.comandosCortesia) {
      const n = await aplicarCota('cortesia', d.comandosCortesia)
      if (n) extra += ` Cota nova aplicada a ${n} conta(s) cortesia.`
    }
  } catch (e) {
    extra += ` A cota da cortesia não foi atualizada: ${e instanceof Error ? e.message : e}.`
  }
  const chaves: string[] = []
  if (antes.pacoteIA.preco !== d.pacotePreco || antes.pacoteIA.comandos !== d.pacoteComandos) chaves.push(antes.pacoteIA.lookupKey)
  if (antes.usuarioExtra.preco !== d.usuarioExtraPreco) chaves.push(antes.usuarioExtra.lookupKey)
  if (chaves.length) extra += await sincronizarSeLigado((c) => chaves.includes(c))
  return { ok: true, mensagem: `Valores salvos.${extra}` }
}

export async function sincronizarStripeAcao(): Promise<ResultadoAdmin> {
  if (!(await adminLogado())) return negado
  const chave = await lerSegredo('STRIPE_SECRET_KEY')
  if (!chave) return { ok: false, erro: 'Cadastre a chave secreta do Stripe primeiro.' }
  const r = await sincronizarPrecos(stripeCom(chave), itensDePreco(await lerTodosPlanos(), await lerConfig()))
  const erros = r.filter((x) => x.situacao === 'erro')
  if (erros.length) return { ok: false, erro: `${erros.length} preço(s) com erro: ${erros[0].chave}: ${erros[0].detalhe}` }
  const criados = r.filter((x) => x.situacao === 'criado').length
  const atualizados = r.filter((x) => x.situacao === 'atualizado').length
  revalidatePath('/admin')
  return {
    ok: true,
    mensagem:
      criados + atualizados === 0
        ? `Os ${r.length} preços do Stripe já estavam iguais ao painel.`
        : `Stripe em dia: ${criados} preço(s) criados e ${atualizados} atualizados.`,
  }
}

// Cupons -----------------------------------------------------------------------

export interface DadosCupom {
  codigo: string
  tipo: 'percentual' | 'valor'
  valor: number
  duracao: 'once' | 'repeating' | 'forever'
  meses?: number
  maxUsos?: number | null
  /** 'AAAA-MM-DD', último dia que vale. */
  validoAte?: string | null
}

export async function criarCupomAcao(d: DadosCupom): Promise<ResultadoAdmin> {
  if (!(await adminLogado())) return negado
  const chave = await lerSegredo('STRIPE_SECRET_KEY')
  if (!chave) return { ok: false, erro: 'Cadastre a chave secreta do Stripe primeiro.' }
  const codigo = texto(d.codigo, 40).toUpperCase()
  if (!/^[A-Z0-9_-]{3,40}$/.test(codigo)) return { ok: false, erro: 'Código: de 3 a 40 letras, números, - ou _.' }
  if (d.tipo === 'percentual' ? !valorOk(d.valor, 1, 100) : !valorOk(d.valor, 0.5)) {
    return { ok: false, erro: d.tipo === 'percentual' ? 'Desconto entre 1% e 100%.' : 'Desconto de pelo menos R$ 0,50.' }
  }
  if (d.duracao === 'repeating' && !inteiroOk(d.meses, 1, 36)) return { ok: false, erro: 'Meses: de 1 a 36.' }
  if (d.maxUsos != null && !inteiroOk(d.maxUsos, 1, 100_000)) return { ok: false, erro: 'Limite de usos inválido.' }
  let expira: number | undefined
  if (d.validoAte) {
    // Vale até o fim do dia, no horário de Brasília.
    expira = Math.floor(Date.parse(`${d.validoAte}T23:59:59-03:00`) / 1000)
    if (!Number.isFinite(expira) || expira * 1000 <= Date.now()) return { ok: false, erro: 'A data final já passou.' }
  }

  const s = stripeCom(chave)
  try {
    const existe = await s.promotionCodes.list({ code: codigo, limit: 1 })
    if (existe.data.length) return { ok: false, erro: `Já existe um cupom com o código ${codigo}.` }
    const cupom = await s.coupons.create({
      name: codigo,
      ...(d.tipo === 'percentual' ? { percent_off: d.valor } : { amount_off: Math.round(d.valor * 100), currency: 'brl' }),
      duration: d.duracao,
      ...(d.duracao === 'repeating' ? { duration_in_months: d.meses } : {}),
      ...(d.maxUsos ? { max_redemptions: d.maxUsos } : {}),
      ...(expira ? { redeem_by: expira } : {}),
      metadata: { galaxie_obras: 'cupom' },
    })
    await s.promotionCodes.create({
      promotion: { type: 'coupon', coupon: cupom.id },
      code: codigo,
      ...(d.maxUsos ? { max_redemptions: d.maxUsos } : {}),
      ...(expira ? { expires_at: expira } : {}),
    })
  } catch (e) {
    return { ok: false, erro: erroDeTeste(e) }
  }
  revalidatePath('/admin')
  return { ok: true, mensagem: `Cupom ${codigo} criado. O cliente digita o código no pagamento.` }
}

export async function alternarCupomAcao(promocaoId: string, ativo: boolean): Promise<ResultadoAdmin> {
  if (!(await adminLogado())) return negado
  const chave = await lerSegredo('STRIPE_SECRET_KEY')
  if (!chave) return { ok: false, erro: 'Cadastre a chave secreta do Stripe primeiro.' }
  if (!/^promo_[A-Za-z0-9]+$/.test(promocaoId)) return { ok: false, erro: 'Cupom inválido.' }
  try {
    await stripeCom(chave).promotionCodes.update(promocaoId, { active: ativo })
  } catch (e) {
    return { ok: false, erro: erroDeTeste(e) }
  }
  revalidatePath('/admin')
  return { ok: true, mensagem: ativo ? 'Cupom reativado.' : 'Cupom desativado. Quem já usou mantém o desconto.' }
}

// Assinantes ---------------------------------------------------------------------

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function darComandosAcao(empresaId: string, comandos: number, motivo: string): Promise<ResultadoAdmin> {
  if (!(await adminLogado())) return negado
  const db = clienteAdmin()
  if (!db) return semServiceRole()
  if (!uuid.test(empresaId)) return { ok: false, erro: 'Empresa inválida.' }
  if (!inteiroOk(Math.abs(comandos), 1, 100_000)) return { ok: false, erro: 'Comandos: de 1 a 100.000 (negativo para tirar).' }
  const { data, error } = await db.rpc('ia_ajuste_admin', {
    p_empresa_id: empresaId,
    p_comandos: comandos,
    p_descricao: texto(motivo, 100) || (comandos > 0 ? 'Comandos de presente da Galaxie' : 'Ajuste da Galaxie'),
  })
  if (error) return { ok: false, erro: error.message }
  revalidatePath('/admin')
  const n = Number(data)
  return { ok: true, mensagem: n >= 0 ? `${n} comandos adicionados.` : `${-n} comandos retirados.` }
}

export async function estenderTesteAcao(empresaId: string, dias: number): Promise<ResultadoAdmin> {
  if (!(await adminLogado())) return negado
  const db = clienteAdmin()
  if (!db) return semServiceRole()
  if (!uuid.test(empresaId)) return { ok: false, erro: 'Empresa inválida.' }
  if (!inteiroOk(dias, 1, 365)) return { ok: false, erro: 'Dias: de 1 a 365.' }
  const { data: a, error } = await db.from('assinaturas').select('status, teste_fim').eq('empresa_id', empresaId).maybeSingle()
  if (error) return { ok: false, erro: error.message }
  if (!a) return { ok: false, erro: 'Essa empresa não tem assinatura.' }
  if (a.status !== 'teste') return { ok: false, erro: 'Só dá para estender quem está no teste grátis.' }
  const base = Math.max(Date.parse(a.teste_fim), Date.now())
  const fim = new Date(base + dias * 86_400_000).toISOString()
  const { error: e2 } = await db
    .from('assinaturas')
    .update({ teste_fim: fim, updated_at: new Date().toISOString() })
    .eq('empresa_id', empresaId)
  if (e2) return { ok: false, erro: e2.message }
  revalidatePath('/admin')
  return { ok: true, mensagem: `Teste estendido até ${new Date(fim).toLocaleDateString('pt-BR')}.` }
}

export async function darCortesiaAcao(empresaId: string): Promise<ResultadoAdmin> {
  if (!(await adminLogado())) return negado
  const db = clienteAdmin()
  if (!db) return semServiceRole()
  if (!uuid.test(empresaId)) return { ok: false, erro: 'Empresa inválida.' }
  const { data: a } = await db.from('assinaturas').select('status, gateway_assinatura_id').eq('empresa_id', empresaId).maybeSingle()
  if (!a) return { ok: false, erro: 'Essa empresa não tem assinatura.' }
  if (a.gateway_assinatura_id && ['ativa', 'atrasada'].includes(a.status)) {
    return { ok: false, erro: 'Essa empresa paga pelo Stripe. Cancele lá antes de dar cortesia.' }
  }
  const { error } = await db
    .from('assinaturas')
    .update({ status: 'cortesia', plano: 'cortesia', updated_at: new Date().toISOString() })
    .eq('empresa_id', empresaId)
  if (error) return { ok: false, erro: error.message }
  const { error: e2 } = await db.rpc('ia_definir_cota', {
    p_empresa_id: empresaId,
    p_cota: (await lerConfig()).comandosCortesia,
  })
  if (e2) return { ok: false, erro: e2.message }
  revalidatePath('/admin')
  return { ok: true, mensagem: 'Agora é cortesia: acesso sem vencer e cota de IA da cortesia.' }
}
