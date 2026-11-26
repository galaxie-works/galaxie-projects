import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Cliente } from '@/types'

export default async function ClientesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: empresa } = await supabase
    .from('empresas')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!empresa) redirect('/onboarding')

  const { data: clientes } = await supabase
    .from('clientes')
    .select('*')
    .eq('empresa_id', empresa.id)
    .order('created_at', { ascending: false })

  const lista = (clientes as Cliente[]) ?? []

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clientes</h1>
        <Link
          href="/clientes/novo"
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          + Novo cliente
        </Link>
      </div>

      {lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
          Nenhum cliente cadastrado ainda.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {lista.map((c) => (
            <Link
              key={c.id}
              href={`/clientes/${c.id}`}
              className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-accent"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{c.nome}</span>
                <span className="rounded-full bg-border px-2 py-0.5 text-xs text-muted">
                  {c.tipo}
                </span>
              </div>
              <p className="mt-1 truncate text-sm text-muted">
                {c.tipo === 'PJ' ? c.razao_social : c.email || c.telefone || '—'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
