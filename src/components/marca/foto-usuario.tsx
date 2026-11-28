'use client'

import { useRouter } from 'next/navigation'
import { UserIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { BUCKET_MARCA, caminhoFotoUsuario } from '@/lib/marca'
import { EnviarImagem } from './enviar-imagem'

// Foto de quem está logado: aparece no menu do usuário. Salva na hora.
export function FotoUsuario({
  empresaId,
  userId,
  caminhoAtual,
  urlAtual,
}: {
  empresaId: string
  userId: string
  caminhoAtual: string | null
  urlAtual: string | null
}) {
  const router = useRouter()

  async function salvar(imagem: Blob | null): Promise<string | null> {
    const supabase = createClient()
    let novo: string | null = null
    if (imagem) {
      novo = caminhoFotoUsuario(empresaId, userId)
      const { error } = await supabase.storage
        .from(BUCKET_MARCA)
        .upload(novo, imagem, { contentType: 'image/webp', cacheControl: '31536000' })
      if (error) return `Não foi possível enviar a foto: ${error.message}`
    }
    const { error } = await supabase
      .from('perfis')
      .upsert({ user_id: userId, foto_caminho: novo, updated_at: new Date().toISOString() })
    if (error) {
      if (novo) await supabase.storage.from(BUCKET_MARCA).remove([novo])
      return `Não foi possível salvar a foto: ${error.message}`
    }
    if (caminhoAtual) await supabase.storage.from(BUCKET_MARCA).remove([caminhoAtual])
    router.refresh()
    return null
  }

  return (
    <EnviarImagem
      titulo="Sua foto"
      descricao="Aparece no menu e, com a equipe no app, para os colegas. Até 5 MB."
      urlAtual={urlAtual}
      iconeVazio={<UserIcon />}
      onSalvar={salvar}
    />
  )
}
