'use server'

import { revalidatePath } from 'next/cache'
import { chaveMestraConfigurada, cifrar } from '@/lib/ia/cripto'
import { configComChave, sessaoEmpresa } from '@/lib/ia/config-servidor'
import { mensagemErroProvedor, testarChave } from '@/lib/ia/executar'
import { ehProvedor, PROVEDORES } from '@/lib/ia/provedores'

export type ResultadoAcao = { ok: true; mensagem: string } | { ok: false; erro: string }

function validarModelo(modelo: unknown): string | null {
  if (typeof modelo !== 'string') return null
  const m = modelo.trim()
  return /^[a-zA-Z0-9._:/-]{2,80}$/.test(m) ? m : null
}

/**
 * Salva provedor, modelo e (opcionalmente) uma chave nova. Sem chave nova,
 * mantém a que já estava guardada. A chave é testada antes de gravar.
 */
export async function salvarConfigIA(dados: {
  provedor: string
  modelo: string
  chave?: string
}): Promise<ResultadoAcao> {
  const sessao = await sessaoEmpresa()
  if (!sessao) return { ok: false, erro: 'Sessão expirada. Entre de novo.' }
  if (!chaveMestraConfigurada()) {
    return {
      ok: false,
      erro: 'O servidor ainda não tem a variável IA_CHAVE_MESTRA. Ela precisa ser criada na Vercel antes de guardar chaves.',
    }
  }
  if (!ehProvedor(dados.provedor)) return { ok: false, erro: 'Provedor inválido.' }
  const modelo = validarModelo(dados.modelo)
  if (!modelo) return { ok: false, erro: 'Nome de modelo inválido.' }

  const chaveNova = dados.chave?.trim()
  let chave = chaveNova
  if (!chave) {
    const atual = await configComChave(sessao.supabase, sessao.empresaId).catch(() => null)
    if (!atual) return { ok: false, erro: 'Cole a chave de API.' }
    if (atual.provedor !== dados.provedor) {
      return { ok: false, erro: `Cole a chave de API da ${PROVEDORES[dados.provedor].nome}.` }
    }
    chave = atual.chave
  }

  try {
    await testarChave(dados.provedor, modelo, chave)
  } catch (e) {
    return { ok: false, erro: mensagemErroProvedor(e) }
  }

  const { error } = await sessao.supabase.from('empresa_ia_config').upsert({
    empresa_id: sessao.empresaId,
    provedor: dados.provedor,
    modelo,
    chave_cifrada: cifrar(chave),
    chave_final: chave.slice(-4),
    ativo: true,
    updated_at: new Date().toISOString(),
  })
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      return { ok: false, erro: 'A tabela empresa_ia_config ainda não existe no Supabase (rode supabase/assistente-ia.sql).' }
    }
    return { ok: false, erro: error.message }
  }
  revalidatePath('/', 'layout')
  return { ok: true, mensagem: 'Chave testada e guardada. O assistente está ligado.' }
}

export async function alternarAssistente(ativo: boolean): Promise<ResultadoAcao> {
  const sessao = await sessaoEmpresa()
  if (!sessao) return { ok: false, erro: 'Sessão expirada. Entre de novo.' }
  const { error } = await sessao.supabase
    .from('empresa_ia_config')
    .update({ ativo, updated_at: new Date().toISOString() })
    .eq('empresa_id', sessao.empresaId)
  if (error) return { ok: false, erro: error.message }
  revalidatePath('/', 'layout')
  return { ok: true, mensagem: ativo ? 'Assistente ligado.' : 'Assistente desligado.' }
}

export async function removerChaveIA(): Promise<ResultadoAcao> {
  const sessao = await sessaoEmpresa()
  if (!sessao) return { ok: false, erro: 'Sessão expirada. Entre de novo.' }
  const { error } = await sessao.supabase
    .from('empresa_ia_config')
    .delete()
    .eq('empresa_id', sessao.empresaId)
  if (error) return { ok: false, erro: error.message }
  revalidatePath('/', 'layout')
  return { ok: true, mensagem: 'Chave removida.' }
}
