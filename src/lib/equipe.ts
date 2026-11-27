import type { SupabaseClient } from '@supabase/supabase-js'
import type { MembroEquipe } from '@/types'

// Fotos da equipe ficam no bucket privado "arquivos", na pasta da empresa:
// <empresa_id>/equipe/<uuid>.<ext>. A policy do Storage libera só a empresa dona.
export const BUCKET_FOTOS = 'arquivos'
export const FOTO_TAMANHO_MAXIMO = 5 * 1024 * 1024

export function caminhoFoto(empresaId: string, arquivo: File): string {
  const ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  return `${empresaId}/equipe/${crypto.randomUUID()}.${ext}`
}

/** URLs assinadas (1 h) das fotos, por id da pessoa. */
export async function urlsDasFotos(
  supabase: SupabaseClient,
  equipe: Pick<MembroEquipe, 'id' | 'foto_caminho'>[]
): Promise<Record<string, string>> {
  const comFoto = equipe.filter((m) => m.foto_caminho)
  if (comFoto.length === 0) return {}
  const { data } = await supabase.storage
    .from(BUCKET_FOTOS)
    .createSignedUrls(comFoto.map((m) => m.foto_caminho!), 3600)
  const urls: Record<string, string> = {}
  comFoto.forEach((m, i) => {
    const url = data?.[i]?.signedUrl
    if (url) urls[m.id] = url
  })
  return urls
}

export function mascararCep(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const
