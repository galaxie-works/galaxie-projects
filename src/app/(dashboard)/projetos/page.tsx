import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StatusBadge from '@/components/StatusBadge'
import ProgressBar from '@/components/ProgressBar'
import type { Projeto } from '@/types'

export default async function ProjetosPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: empresa } = await supabase
    .from('empresas')
    .select('id, nome')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!empresa) redirect('/onboarding')

  const { data: projetos } = await supabase
    .from('projetos')
    .select('*, clientes(nome)')
    .eq('empresa_id', empresa.id)
    .order('created_at', { ascending: false })

  const lista = (projetos as Projeto[]) ?? []

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Projetos</h1>
          <p className="text-sm text-muted">Visão geral das obras de {empresa.nome}</p>
        </div>
        <Link
          href="/projetos/novo"
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          + Novo projeto
        </Link>
      </div>

      {lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
          Nenhum projeto ainda.{' '}
          <Link href="/clientes/novo" className="text-accent underline">
            Cadastre um cliente
          </Link>{' '}
          e depois crie o primeiro projeto.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {lista.map((p) => (
            <Link
              key={p.id}
              href={`/projetos/${p.id}`}
              className="rounded-xl border border-border bg-card p-4 hover:border-accent"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium">{p.nome}</span>
                <StatusBadge status={p.status} />
              </div>
              <p className="mb-3 text-sm text-muted">{p.clientes?.nome}</p>
              <ProgressBar percent={p.percentual_conclusao} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
