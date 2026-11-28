import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { montarAcesso, type Acesso, type Modulo, type Papel, type Permissoes } from './acesso-regras'

// Sessão no servidor. As regras (módulos, papéis, níveis) ficam em
// acesso-regras.ts, que também roda no navegador.
export * from './acesso-regras'

export type Sessao =
  | {
      situacao: 'ok'
      userId: string
      email: string
      empresaId: string
      acesso: Acesso
    }
  | { situacao: 'sem-empresa' | 'suspenso' | 'sem-login' }

const ID_NENHUM = '00000000-0000-0000-0000-000000000000'

/**
 * Empresa de quem está logado: a que é dona ou, senão, a de que é membro
 * ativo. Liga convites pendentes do e-mail na primeira entrada. Uma vez por
 * requisição.
 */
export const carregarSessao = cache(async (): Promise<Sessao> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { situacao: 'sem-login' }
  const email = (user.email ?? '').toLowerCase()

  const { data: propria } = await supabase.from('empresas').select('id').eq('owner_id', user.id).maybeSingle()
  if (propria) {
    return { situacao: 'ok', userId: user.id, email, empresaId: propria.id, acesso: montarAcesso('dono', {}) }
  }

  async function buscarMembro() {
    const { data } = await supabase
      .from('empresa_membros')
      .select('empresa_id, papel, permissoes, status')
      .eq('user_id', user!.id)
      .order('created_at')
    return (data as { empresa_id: string; papel: Papel; permissoes: Permissoes; status: string }[] | null) ?? []
  }

  let vinculos = await buscarMembro()
  if (!vinculos.some((v) => v.status === 'ativo')) {
    // Primeira entrada de quem foi convidado: liga o convite ao login.
    const { data: ligados } = await supabase.rpc('aceitar_convites')
    if (ligados) vinculos = await buscarMembro()
  }
  const ativo = vinculos.find((v) => v.status === 'ativo')
  if (ativo) {
    return {
      situacao: 'ok',
      userId: user.id,
      email,
      empresaId: ativo.empresa_id,
      acesso: montarAcesso(ativo.papel, ativo.permissoes ?? {}),
    }
  }
  if (vinculos.some((v) => v.status === 'suspenso')) return { situacao: 'suspenso' }
  return { situacao: 'sem-empresa' }
})

/** Id da empresa de quem está logado (ou um id que não acha nada). */
export async function idDaEmpresa(): Promise<string> {
  const s = await carregarSessao()
  return s.situacao === 'ok' ? s.empresaId : ID_NENHUM
}

/** Para páginas de um módulo: sem permissão, volta para o Início. */
export async function exigirAcesso(modulo: Modulo | 'assinatura' | 'acessos', nivel: 'ver' | 'editar' = 'ver') {
  const s = await carregarSessao()
  if (s.situacao !== 'ok') {
    redirect(s.situacao === 'sem-login' ? '/login' : s.situacao === 'suspenso' ? '/sem-acesso' : '/onboarding')
  }
  if (!s.acesso.pode(modulo, nivel)) redirect('/inicio?sem-permissao=1')
  return s
}
