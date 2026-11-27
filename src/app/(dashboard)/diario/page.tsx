import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DiarioApp } from '@/components/diario/diario-app'
import type { ContextoDiario } from '@/lib/diario/tipos'

// Diário de obra: a equipe de campo registra o dia (atividades, clima, quem
// veio, ocorrências e fotos). Funciona sem internet: esta página fica guardada
// no aparelho (service worker) e os registros vão para o IndexedDB até enviar.
export default async function DiarioPage({
  searchParams,
}: {
  searchParams: Promise<{ obra?: string }>
}) {
  const { obra } = await searchParams
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

  const [{ data: projetos }, { data: equipe }] = await Promise.all([
    supabase
      .from('projetos')
      .select('id, nome, status, clientes(nome)')
      .eq('empresa_id', empresa.id)
      .order('created_at', { ascending: false }),
    supabase.from('equipe').select('id, nome, funcao').eq('empresa_id', empresa.id).order('nome'),
  ])

  // Obras em andamento primeiro: são as que recebem diário.
  const ordem: Record<string, number> = { em_execucao: 0, planejamento: 1, pausado: 2, completo: 3 }
  const obras = ((projetos ?? []) as unknown as {
    id: string
    nome: string
    status: string
    clientes: { nome: string } | null
  }[])
    .sort((a, b) => (ordem[a.status] ?? 9) - (ordem[b.status] ?? 9))
    .map((p) => ({ id: p.id, nome: p.nome, cliente: p.clientes?.nome ?? null }))

  const contexto: ContextoDiario = {
    empresaId: empresa.id,
    obras,
    equipe: (equipe ?? []).map((m) => ({ id: m.id, nome: m.nome, funcao: m.funcao ?? null })),
    salvoEm: new Date().toISOString(),
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <DiarioApp contexto={contexto} obraInicial={obra} />
    </div>
  )
}
