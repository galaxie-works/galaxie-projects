import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Admin master: o dono da plataforma (tabela plataforma_admins). A conferência
// é sempre no banco, pela função eh_admin_master(), com a sessão de quem pediu.

export async function ehAdminMaster(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc('eh_admin_master')
  // Função ainda não criada (migration pendente): ninguém é admin.
  if (error) return false
  return data === true
}

/** Usuário logado, se for admin master; senão null. */
export async function adminLogado() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  if (!(await ehAdminMaster(supabase))) return null
  return { supabase, user }
}
