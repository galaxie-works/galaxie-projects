import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { carregarOrcamento, carregarPrecos } from '@/components/orcamento/dados'
import { NegocioPainel } from '@/components/negocios/negocio-painel'
import type { EventoCliente } from '@/components/clientes/cliente-linha-do-tempo'
import { agoraMs } from '@/lib/crm'
import { SELECT_NEGOCIO } from '@/lib/negocios'
import { TIPO_ATIVIDADE_LABEL, type Atividade, type Negocio } from '@/types'

export default async function NegocioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ aba?: string }>
}) {
  const { id } = await params
  const { aba } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase.from('negocios').select(SELECT_NEGOCIO).eq('id', id).maybeSingle()
  if (!data) notFound()
  const negocio = data as unknown as Negocio

  const [areas, precos, { data: empresa }, { data: equipe }, { data: atividades }] = await Promise.all([
    carregarOrcamento(supabase, { negocioId: id }),
    carregarPrecos(supabase, negocio.empresa_id),
    supabase.from('empresas').select('servicos').eq('id', negocio.empresa_id).maybeSingle(),
    supabase.from('equipe').select('id, nome').eq('empresa_id', negocio.empresa_id).order('nome'),
    supabase
      .from('atividades')
      .select('*, equipe(nome)')
      .eq('negocio_id', id)
      .order('ocorreu_em', { ascending: false }),
  ])

  const eventos: EventoCliente[] = ((atividades as Atividade[] | null) ?? []).map((a) => ({
    id: a.id,
    quando: a.ocorreu_em,
    tipo: a.tipo,
    titulo: a.equipe?.nome ? `${TIPO_ATIVIDADE_LABEL[a.tipo]} · ${a.equipe.nome}` : TIPO_ATIVIDADE_LABEL[a.tipo],
    texto: a.texto,
  }))

  // Remonta o painel quando os dados do servidor mudam (após salvar/refresh).
  const versao = [negocio.fase, negocio.orcamento_total, negocio.titulo, negocio.projeto_id].join('|')

  return (
    <NegocioPainel
      key={versao}
      negocio={negocio}
      areasIniciais={areas}
      eventos={eventos}
      equipe={equipe ?? []}
      servicosEmpresa={(empresa?.servicos as string[]) ?? []}
      precos={precos}
      agora={agoraMs()}
      abaInicial={aba}
    />
  )
}
