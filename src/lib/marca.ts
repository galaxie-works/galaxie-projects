import type { SupabaseClient } from '@supabase/supabase-js'

// Logo da empresa e foto de quem usa o app. Ficam no bucket privado
// "arquivos", na pasta da empresa, sempre em WebP:
//   <empresa_id>/marca/logo-<uuid>.webp
//   <empresa_id>/usuarios/<user_id>/<uuid>.webp
// Nome novo a cada troca, para o navegador não mostrar a imagem antiga.
export const BUCKET_MARCA = 'arquivos'
export const IMAGEM_TAMANHO_MAXIMO = 5 * 1024 * 1024
/** Lado maior depois de compactar: sobra para tela de alta densidade. */
export const IMAGEM_LADO = 512

export function caminhoLogo(empresaId: string): string {
  return `${empresaId}/marca/logo-${crypto.randomUUID()}.webp`
}

export function caminhoFotoUsuario(empresaId: string, userId: string): string {
  return `${empresaId}/usuarios/${userId}/${crypto.randomUUID()}.webp`
}

/** URL assinada (12 h) de um arquivo do bucket, ou null. */
export async function urlAssinada(supabase: SupabaseClient, caminho: string | null | undefined): Promise<string | null> {
  if (!caminho) return null
  const { data } = await supabase.storage.from(BUCKET_MARCA).createSignedUrl(caminho, 60 * 60 * 12)
  return data?.signedUrl ?? null
}
