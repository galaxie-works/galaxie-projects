import { createClient as criar } from '@supabase/supabase-js'

// Cliente sem sessão (papel anon), para o portal do cliente: não usa os
// cookies de quem estiver logado, então o portal enxerga só o que as funções
// portal_* liberam para o token.
export function clienteAnonimo() {
  return criar(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
