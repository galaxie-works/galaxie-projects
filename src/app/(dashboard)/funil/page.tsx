import { redirect } from 'next/navigation'
import { FunnelIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { FunilQuadro } from '@/components/negocios/funil-quadro'
import { Frame, FramePanel } from '@/components/reui/frame'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { agoraMs } from '@/lib/crm'
import { formatarMoeda } from '@/lib/formato'
import {
  negocioAberto,
  negocioParado,
  probabilidadeDoNegocio,
  SELECT_NEGOCIO,
  valorDoNegocio,
} from '@/lib/negocios'
import type { Negocio } from '@/types'

function Numero({ rotulo, valor, detalhe, alerta }: { rotulo: string; valor: string; detalhe: string; alerta?: boolean }) {
  return (
    <FramePanel className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <span
        className={`truncate text-lg font-semibold tracking-tight tabular-nums sm:text-xl ${alerta ? 'text-destructive' : ''}`}
      >
        {valor}
      </span>
      <span className="text-xs text-muted-foreground">{detalhe}</span>
    </FramePanel>
  )
}

export default async function FunilPage() {
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

  const [negociosRes, { data: clientes }, { data: equipe }] = await Promise.all([
    supabase.from('negocios').select(SELECT_NEGOCIO).eq('empresa_id', empresa.id).order('ordem'),
    supabase.from('clientes').select('id, nome').eq('empresa_id', empresa.id).order('nome'),
    supabase.from('equipe').select('id, nome').eq('empresa_id', empresa.id).order('nome'),
  ])

  const cabecalho = (
    <header className="flex flex-col gap-0.5">
      <h1 className="text-xl font-semibold tracking-tight">Negócios</h1>
      <p className="text-sm text-muted-foreground">
        Cada negócio da primeira visita até o contrato. Arraste para mudar de fase.
      </p>
    </header>
  )

  if (negociosRes.error) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        {cabecalho}
        <Frame spacing="default">
          <FramePanel>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FunnelIcon />
                </EmptyMedia>
                <EmptyTitle>Negócios ainda não ativados</EmptyTitle>
                <EmptyDescription>Rode o SQL do funil no Supabase para começar a usar.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </FramePanel>
        </Frame>
      </div>
    )
  }

  const negocios = (negociosRes.data as unknown as Negocio[]) ?? []
  // Hora do servidor, passada adiante para o cálculo de "dias na fase" não
  // mudar entre servidor e navegador.
  const agora = agoraMs()
  const abertos = negocios.filter(negocioAberto)
  const emAberto = abertos.reduce((s, n) => s + valorDoNegocio(n), 0)
  const ponderado = abertos.reduce((s, n) => s + (valorDoNegocio(n) * probabilidadeDoNegocio(n)) / 100, 0)
  const mes = (d: number | string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(d)).slice(0, 7)
  const ganhosMes = negocios.filter((n) => n.fase === 'ganho' && n.fechado_em && mes(n.fechado_em) === mes(agora))
  const parados = abertos.filter((n) => negocioParado(n, agora))

  return (
    <div className="flex min-w-0 flex-col gap-6 p-4 md:p-6">
      {cabecalho}
      <Frame spacing="default" className="grid grid-cols-2 lg:grid-cols-4">
        <Numero
          rotulo="Em aberto"
          valor={formatarMoeda(emAberto)}
          detalhe={`${abertos.length} ${abertos.length === 1 ? 'negócio' : 'negócios'}`}
        />
        <Numero rotulo="Previsão ponderada" valor={formatarMoeda(ponderado)} detalhe="Valor × chance da fase" />
        <Numero
          rotulo="Ganho no mês"
          valor={formatarMoeda(ganhosMes.reduce((s, n) => s + valorDoNegocio(n), 0))}
          detalhe={`${ganhosMes.length} ${ganhosMes.length === 1 ? 'contrato' : 'contratos'}`}
        />
        <Numero
          rotulo="Parados"
          valor={String(parados.length)}
          detalhe="Tempo demais na mesma fase"
          alerta={parados.length > 0}
        />
      </Frame>
      <FunilQuadro
        negocios={negocios}
        empresaId={empresa.id}
        equipe={equipe ?? []}
        clientes={clientes ?? []}
        agora={agora}
      />
    </div>
  )
}
