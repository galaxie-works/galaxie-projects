import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StatusBadge from '@/components/StatusBadge'
import ProgressBar from '@/components/ProgressBar'
import type { Cliente, Projeto } from '@/types'

export default async function ClienteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cliente } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!cliente) notFound()

  const { data: projetos } = await supabase
    .from('projetos')
    .select('*')
    .eq('cliente_id', id)
    .order('created_at', { ascending: false })

  const c = cliente as Cliente
  const lista = (projetos as Projeto[]) ?? []

  const campo = (label: string, valor: string | null | undefined) =>
    valor ? (
      <div>
        <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
        <dd className="text-sm">{valor}</dd>
      </div>
    ) : null

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <span className="mb-1 inline-block rounded-full bg-border px-2 py-0.5 text-xs text-muted">
            {c.tipo === 'PF' ? 'Pessoa física' : 'Pessoa jurídica'}
          </span>
          <h1 className="text-xl font-semibold">{c.nome}</h1>
        </div>
        <Link
          href={`/projetos/novo?clienteId=${c.id}`}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          + Novo projeto
        </Link>
      </div>

      <dl className="mb-8 grid grid-cols-2 gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-3">
        {campo('Razão social', c.razao_social)}
        {campo('CPF', c.cpf)}
        {campo('CNPJ', c.cnpj)}
        {campo('E-mail', c.email)}
        {campo('Telefone', c.telefone)}
        {campo('Endereço', c.endereco)}
      </dl>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        Projetos deste cliente
      </h2>

      {lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
          Nenhum projeto para este cliente ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map((p) => (
            <Link
              key={p.id}
              href={`/projetos/${p.id}`}
              className="block rounded-xl border border-border bg-card p-4 hover:border-accent"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">{p.nome}</span>
                <StatusBadge status={p.status} />
              </div>
              <ProgressBar percent={p.percentual_conclusao} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
