'use server'

import { revalidatePath } from 'next/cache'
import { clienteAnonimo } from '@/lib/supabase/anonimo'
import { tokenValido } from '@/lib/portal'

const MENSAGENS: Record<string, string> = {
  'link inválido': 'Este link não vale mais. Peça um novo à empresa.',
  'descreva o problema': 'Conte em poucas palavras o que aconteceu.',
  'obra não encontrada': 'Escolha uma das suas obras.',
  'limite de chamados abertos': 'Você já tem 5 chamados abertos. Aguarde o retorno da empresa.',
}

export async function abrirChamado(
  token: string,
  dados: { projetoId: string | null; titulo: string; texto: string }
): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!tokenValido(token)) return { ok: false, erro: MENSAGENS['link inválido'] }
  const { error } = await clienteAnonimo().rpc('portal_abrir_chamado', {
    p_token: token,
    p_projeto_id: dados.projetoId,
    p_titulo: dados.titulo,
    p_texto: dados.texto,
  })
  if (error) {
    const chave = Object.keys(MENSAGENS).find((k) => error.message.includes(k))
    return { ok: false, erro: chave ? MENSAGENS[chave] : 'Não foi possível abrir o chamado. Tente de novo.' }
  }
  revalidatePath(`/portal/${token}`)
  return { ok: true }
}
