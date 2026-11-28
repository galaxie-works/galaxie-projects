'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { clienteAdmin } from '@/lib/supabase/admin'
import { carregarSessao, ehLoginDeCampo, MODULOS, type Nivel, type Papel, type Permissoes } from '@/lib/acesso'
import { carregarAssinatura } from '@/lib/assinatura'
import { lerTodosPlanos } from '@/lib/plataforma/config'

export type ResultadoAcesso = { ok: true; mensagem: string } | { ok: false; erro: string }

export type DadosAcesso = {
  email: string
  papel: Exclude<Papel, 'dono'>
  permissoes: Permissoes
  equipeId: string | null
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NIVEIS: Nivel[] = ['nenhum', 'ver', 'editar']

function limpar(p: Permissoes): Permissoes {
  const saida: Permissoes = {}
  for (const { id } of MODULOS) {
    const n = p[id]
    if (n && NIVEIS.includes(n) && n !== 'nenhum') saida[id] = n
  }
  return saida
}

async function donoLogado() {
  const s = await carregarSessao()
  if (s.situacao !== 'ok' || !s.acesso.pode('acessos')) return null
  return s
}

async function baseUrl() {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return (process.env.NEXT_PUBLIC_APP_URL || (host ? `${proto}://${host}` : '')).replace(/\/$/, '')
}

type Linha = { id: string; papel: Papel; permissoes: Permissoes; status: string }

/**
 * Logins do plano: o de escritório conta o dono; o de campo é quem só usa
 * diário e agenda. Teste grátis e cortesia usam o maior plano.
 */
async function checarLimite(
  empresaId: string,
  novo: { papel: Papel; permissoes: Permissoes },
  ignorarId?: string
): Promise<string | null> {
  const supabase = await createClient()
  const [{ data }, assinatura, planos] = await Promise.all([
    supabase.from('empresa_membros').select('id, papel, permissoes, status').eq('empresa_id', empresaId),
    carregarAssinatura(supabase, empresaId),
    lerTodosPlanos(),
  ])
  const pago = assinatura && (assinatura.status === 'ativa' || assinatura.status === 'atrasada')
  const plano =
    (pago ? planos.find((p) => p.id === assinatura.plano) : null) ??
    [...planos].sort((a, b) => b.mensal - a.mensal)[0]
  if (!plano) return null

  const linhas = ((data as Linha[] | null) ?? []).filter((l) => l.status !== 'suspenso' && l.id !== ignorarId)
  const campo = ehLoginDeCampo(novo.papel, novo.permissoes)
  const usados = linhas.filter((l) => ehLoginDeCampo(l.papel, l.permissoes ?? {}) === campo).length
  const limite = campo ? plano.usuariosCampo : plano.usuariosEscritorio
  if (limite == null || usados < limite) return null
  return campo
    ? `O plano ${plano.nome} inclui ${limite} login(s) de campo, e todos já estão em uso. Mude de plano em Assinatura para liberar mais.`
    : `O plano ${plano.nome} inclui ${limite} login(s) de escritório (contando você), e todos já estão em uso. Mude de plano em Assinatura para liberar mais.`
}

export async function convidarAcao(d: DadosAcesso): Promise<ResultadoAcesso> {
  const s = await donoLogado()
  if (!s) return { ok: false, erro: 'Só o dono da empresa convida pessoas.' }
  const email = d.email.trim().toLowerCase()
  if (!EMAIL.test(email)) return { ok: false, erro: 'Confira o e-mail.' }
  if (email === s.email) return { ok: false, erro: 'Esse é o seu próprio e-mail.' }
  if (!['gestor', 'membro'].includes(d.papel)) return { ok: false, erro: 'Papel inválido.' }
  const permissoes = d.papel === 'membro' ? limpar(d.permissoes) : {}
  if (d.papel === 'membro' && Object.keys(permissoes).length === 0) {
    return { ok: false, erro: 'Libere pelo menos um módulo para essa pessoa.' }
  }

  const limite = await checarLimite(s.empresaId, { papel: d.papel, permissoes })
  if (limite) return { ok: false, erro: limite }

  const supabase = await createClient()
  const { error } = await supabase.from('empresa_membros').insert({
    empresa_id: s.empresaId,
    email,
    papel: d.papel,
    permissoes,
    equipe_id: d.equipeId,
    status: 'convidado',
    convidado_por: s.userId,
  })
  if (error) {
    if (error.code === '23505') return { ok: false, erro: 'Essa pessoa já foi convidada.' }
    return { ok: false, erro: `Não foi possível salvar o convite: ${error.message}` }
  }

  const envio = await enviarConvite(email)
  revalidatePath('/acessos')
  return { ok: true, mensagem: envio }
}

/** Manda o e-mail do Supabase. Quem já tem conta só precisa entrar de novo. */
async function enviarConvite(email: string): Promise<string> {
  const admin = clienteAdmin()
  const url = await baseUrl()
  if (!admin) {
    return `Convite salvo. Peça para a pessoa criar a conta em ${url}/cadastro com este e-mail; ao entrar, ela já vê a empresa.`
  }
  const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${url}/convite` })
  if (!error) return `Convite enviado para ${email}. A pessoa recebe um link para criar a senha.`
  if (/already|registered|exists/i.test(error.message)) {
    return `${email} já tem conta no Galaxie Obras. Na próxima vez que entrar, já vê a sua empresa.`
  }
  return `Convite salvo, mas o e-mail não saiu (${error.message}). Peça para a pessoa criar a conta em ${url}/cadastro com este e-mail.`
}

export async function reenviarConviteAcao(id: string): Promise<ResultadoAcesso> {
  const s = await donoLogado()
  if (!s) return { ok: false, erro: 'Só o dono da empresa convida pessoas.' }
  const supabase = await createClient()
  const { data } = await supabase
    .from('empresa_membros')
    .select('email, status')
    .eq('id', id)
    .eq('empresa_id', s.empresaId)
    .maybeSingle()
  if (!data) return { ok: false, erro: 'Convite não encontrado.' }
  if (data.status !== 'convidado') return { ok: false, erro: 'Essa pessoa já entrou no app.' }
  return { ok: true, mensagem: await enviarConvite(data.email) }
}

export async function salvarAcessoAcao(
  id: string,
  d: Omit<DadosAcesso, 'email'> & { suspenso: boolean }
): Promise<ResultadoAcesso> {
  const s = await donoLogado()
  if (!s) return { ok: false, erro: 'Só o dono da empresa muda acessos.' }
  if (!['gestor', 'membro'].includes(d.papel)) return { ok: false, erro: 'Papel inválido.' }
  const permissoes = d.papel === 'membro' ? limpar(d.permissoes) : {}
  if (d.papel === 'membro' && Object.keys(permissoes).length === 0 && !d.suspenso) {
    return { ok: false, erro: 'Libere pelo menos um módulo, ou suspenda o acesso.' }
  }
  const supabase = await createClient()
  const { data: atual } = await supabase
    .from('empresa_membros')
    .select('status, user_id')
    .eq('id', id)
    .eq('empresa_id', s.empresaId)
    .maybeSingle()
  if (!atual) return { ok: false, erro: 'Pessoa não encontrada.' }
  if (!d.suspenso) {
    const limite = await checarLimite(s.empresaId, { papel: d.papel, permissoes }, id)
    if (limite) return { ok: false, erro: limite }
  }
  const status = d.suspenso ? 'suspenso' : atual.user_id ? 'ativo' : 'convidado'
  const { error } = await supabase
    .from('empresa_membros')
    .update({ papel: d.papel, permissoes, equipe_id: d.equipeId, status })
    .eq('id', id)
    .eq('empresa_id', s.empresaId)
  if (error) return { ok: false, erro: `Não foi possível salvar: ${error.message}` }
  revalidatePath('/acessos')
  return { ok: true, mensagem: d.suspenso ? 'Acesso suspenso.' : 'Acesso salvo.' }
}

export async function removerAcessoAcao(id: string): Promise<ResultadoAcesso> {
  const s = await donoLogado()
  if (!s) return { ok: false, erro: 'Só o dono da empresa tira acessos.' }
  const supabase = await createClient()
  const { error, count } = await supabase
    .from('empresa_membros')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('empresa_id', s.empresaId)
  if (error) return { ok: false, erro: `Não foi possível remover: ${error.message}` }
  if (!count) return { ok: false, erro: 'Pessoa não encontrada.' }
  revalidatePath('/acessos')
  return { ok: true, mensagem: 'Acesso removido.' }
}
