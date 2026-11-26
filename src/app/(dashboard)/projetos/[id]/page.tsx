import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProjetoHeader from '@/components/ProjetoHeader'
import EtapasList from '@/components/EtapasList'
import ComprasList from '@/components/ComprasList'
import type { Compra, Etapa, MembroEquipe, Projeto } from '@/types'

export default async function ProjetoDetalhePage({
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

  const { data: projeto } = await supabase
    .from('projetos')
    .select('*, clientes(nome)')
    .eq('id', id)
    .maybeSingle()

  if (!projeto) notFound()

  const [{ data: etapas }, { data: compras }, { data: equipe }] =
    await Promise.all([
      supabase
        .from('etapas')
        .select('*, equipe(nome)')
        .eq('projeto_id', id)
        .order('ordem'),
      supabase
        .from('compras')
        .select('*, equipe(nome)')
        .eq('projeto_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('equipe')
        .select('*')
        .eq('empresa_id', projeto.empresa_id)
        .order('nome'),
    ])

  const totalGasto = (compras ?? []).reduce(
    (acc, c) => acc + Number(c.valor),
    0
  )

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <ProjetoHeader projeto={projeto as Projeto} totalGasto={totalGasto} />

      <div className="grid gap-5 lg:grid-cols-2">
        <EtapasList
          projetoId={id}
          etapasIniciais={(etapas as Etapa[]) ?? []}
          equipe={(equipe as MembroEquipe[]) ?? []}
        />
        <ComprasList
          projetoId={id}
          comprasIniciais={(compras as Compra[]) ?? []}
          equipe={(equipe as MembroEquipe[]) ?? []}
        />
      </div>
    </div>
  )
}
