import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { decifrar } from './cripto'
import { ehProvedor, type ConfigIAPublica, type ProvedorIA } from './provedores'

// Leitura da configuração de IA no servidor. A chave decifrada só existe
// dentro desta função e da chamada ao provedor; nunca é devolvida à tela.

export async function sessaoEmpresa(): Promise<
  { supabase: SupabaseClient; empresaId: string; empresaNome: string } | null
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: empresa } = await supabase
    .from('empresas')
    .select('id, nome')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!empresa) return null
  return { supabase, empresaId: empresa.id as string, empresaNome: empresa.nome as string }
}

interface LinhaConfig {
  provedor: string
  modelo: string
  chave_cifrada: string
  chave_final: string
  ativo: boolean
  updated_at: string
}

async function lerLinha(supabase: SupabaseClient, empresaId: string): Promise<LinhaConfig | null> {
  const { data, error } = await supabase
    .from('empresa_ia_config')
    .select('provedor, modelo, chave_cifrada, chave_final, ativo, updated_at')
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (error) {
    // Tabela ainda não criada (supabase/assistente-ia.sql não rodou).
    if (error.code === '42P01' || error.code === 'PGRST205') return null
    throw new Error(error.message)
  }
  return (data as LinhaConfig | null) ?? null
}

export async function configPublica(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<ConfigIAPublica | null> {
  const linha = await lerLinha(supabase, empresaId)
  if (!linha || !ehProvedor(linha.provedor)) return null
  return {
    provedor: linha.provedor,
    modelo: linha.modelo,
    chaveFinal: linha.chave_final,
    ativo: linha.ativo,
    atualizadoEm: linha.updated_at,
  }
}

export async function configComChave(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<{ provedor: ProvedorIA; modelo: string; chave: string } | null> {
  const linha = await lerLinha(supabase, empresaId)
  if (!linha || !linha.ativo || !ehProvedor(linha.provedor)) return null
  return { provedor: linha.provedor, modelo: linha.modelo, chave: decifrar(linha.chave_cifrada) }
}
