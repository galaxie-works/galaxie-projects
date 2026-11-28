'use server'

import { revalidatePath } from 'next/cache'
import { sessaoEmpresa } from '@/lib/ia/config-servidor'
import { buscarCidades, type CidadeClima } from '@/lib/clima'

export async function procurarCidades(termo: string): Promise<CidadeClima[]> {
  if (typeof termo !== 'string') return []
  const sessao = await sessaoEmpresa()
  if (!sessao) return []
  return buscarCidades(termo.slice(0, 80))
}

export async function salvarCidadeClima(
  cidade: CidadeClima
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const sessao = await sessaoEmpresa()
  if (!sessao) return { ok: false, erro: 'Sessão expirada. Entre de novo.' }
  const { nome, uf, latitude, longitude } = cidade ?? {}
  if (
    typeof nome !== 'string' ||
    !nome.trim() ||
    nome.length > 120 ||
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return { ok: false, erro: 'Cidade inválida.' }
  }

  const { error } = await sessao.supabase
    .from('empresas')
    .update({
      clima_cidade: nome.trim(),
      clima_uf: typeof uf === 'string' ? uf.slice(0, 2).toUpperCase() : null,
      clima_latitude: latitude,
      clima_longitude: longitude,
    })
    .eq('id', sessao.empresaId)
  if (error) return { ok: false, erro: error.message }

  revalidatePath('/inicio')
  return { ok: true }
}
