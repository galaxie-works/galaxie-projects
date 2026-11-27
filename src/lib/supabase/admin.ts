import { createClient as criar, type SupabaseClient } from '@supabase/supabase-js'

// Cliente com service role: só no servidor (webhook do Stripe). Passa por cima
// do RLS, então nunca use em código que roda com dados vindos da tela sem
// checar a empresa antes.
export function clienteAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave) return null
  return criar(url, chave, { auth: { persistSession: false, autoRefreshToken: false } })
}
