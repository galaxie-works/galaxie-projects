'use client'

import { useRouter } from 'next/navigation'
import { Building2Icon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { BUCKET_MARCA, caminhoLogo } from '@/lib/marca'
import { EnviarImagem } from './enviar-imagem'

// Logo da empresa: aparece no topo do menu lateral. Salva na hora.
export function LogoEmpresa({
  empresaId,
  caminhoAtual,
  urlAtual,
}: {
  empresaId: string
  caminhoAtual: string | null
  urlAtual: string | null
}) {
  const router = useRouter()

  async function salvar(imagem: Blob | null): Promise<string | null> {
    const supabase = createClient()
    let novo: string | null = null
    if (imagem) {
      novo = caminhoLogo(empresaId)
      const { error } = await supabase.storage
        .from(BUCKET_MARCA)
        .upload(novo, imagem, { contentType: 'image/webp', cacheControl: '31536000' })
      if (error) return `Não foi possível enviar o logo: ${error.message}`
    }
    const { error } = await supabase.from('empresas').update({ logo_caminho: novo }).eq('id', empresaId)
    if (error) {
      if (novo) await supabase.storage.from(BUCKET_MARCA).remove([novo])
      return `Não foi possível salvar o logo: ${error.message}`
    }
    if (caminhoAtual) await supabase.storage.from(BUCKET_MARCA).remove([caminhoAtual])
    router.refresh()
    return null
  }

  return (
    <EnviarImagem
      titulo="Logo"
      descricao="PNG com fundo transparente · até 5 MB"
      urlAtual={urlAtual}
      formato="quadrado"
      iconeVazio={<Building2Icon />}
      onSalvar={salvar}
    />
  )
}
