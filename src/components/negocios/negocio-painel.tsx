'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FolderKanbanIcon, PencilIcon, ThumbsDownIcon, TrophyIcon, RotateCcwIcon } from 'lucide-react'
import { formatarData, formatarMoeda } from '@/lib/formato'
import { diasNaFase, negocioAberto, probabilidadeDoNegocio, valorDoNegocio } from '@/lib/negocios'
import { totalOrcamento, type AreaOrcamento, type TabelaPrecos } from '@/lib/orcamento'
import { VARIANTE_FASE_NEGOCIO } from '@/lib/status'
import { FASE_NEGOCIO_LABEL, type MembroEquipe, type Negocio } from '@/types'
import { OrcamentoAba } from '@/components/orcamento/orcamento-aba'
import { ClienteLinhaDoTempo, type EventoCliente } from '@/components/clientes/cliente-linha-do-tempo'
import { Badge } from '@/components/reui/badge'
import { Frame, FramePanel } from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAcoesNegocio } from './negocio-acoes'

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <FramePanel className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <span className="truncate text-lg font-semibold tracking-tight tabular-nums sm:text-xl">{valor}</span>
      {detalhe && <span className="text-xs text-muted-foreground">{detalhe}</span>}
    </FramePanel>
  )
}

type Props = {
  negocio: Negocio
  areasIniciais: AreaOrcamento[]
  eventos: EventoCliente[]
  equipe: Pick<MembroEquipe, 'id' | 'nome'>[]
  servicosEmpresa: string[]
  precos: TabelaPrecos
  agora: number
  abaInicial?: string
}

// Tela do negócio (camada abaixo do Funil): números, ações de fase e o
// orçamento por área, que fica aqui até o negócio ser ganho.
export function NegocioPainel({
  negocio: n,
  areasIniciais,
  eventos,
  equipe,
  servicosEmpresa,
  precos,
  agora,
  abaInicial,
}: Props) {
  const [areas, setAreas] = useState(areasIniciais)
  const { acoes, dialogos } = useAcoesNegocio({ empresaId: n.empresa_id, equipe, clienteId: n.cliente_id })
  const aberto = negocioAberto(n)
  const ganho = n.fase === 'ganho'
  const dias = diasNaFase(n, agora)

  return (
    <div className="flex min-w-0 flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-xl font-semibold tracking-tight">{n.titulo}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={VARIANTE_FASE_NEGOCIO[n.fase]}>{FASE_NEGOCIO_LABEL[n.fase]}</Badge>
            <Link href={`/clientes/${n.cliente_id}`} className="hover:underline">
              {n.clientes?.nome ?? 'Cliente'}
            </Link>
            {n.equipe?.nome && <span>· {n.equipe.nome}</span>}
            {n.fase === 'perdido' && n.motivo_perda && <span>· {n.motivo_perda}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => acoes.editar(n)}>
            <PencilIcon data-icon="inline-start" />
            Editar
          </Button>
          {aberto && (
            <>
              <Button variant="outline" onClick={() => acoes.perder(n)}>
                <ThumbsDownIcon data-icon="inline-start" />
                Perdido
              </Button>
              <Button onClick={() => acoes.ganhar(n)}>
                <TrophyIcon data-icon="inline-start" />
                Ganho
              </Button>
            </>
          )}
          {n.fase === 'perdido' && (
            <Button variant="outline" onClick={() => acoes.mover(n, 'negociacao', n.ordem)}>
              <RotateCcwIcon data-icon="inline-start" />
              Reabrir
            </Button>
          )}
          {ganho && n.projeto_id && (
            <Button nativeButton={false} render={<Link href={`/projetos/${n.projeto_id}`} />}>
              <FolderKanbanIcon data-icon="inline-start" />
              Abrir obra
            </Button>
          )}
        </div>
      </header>

      <Frame spacing="default" className="grid grid-cols-2 lg:grid-cols-4">
        <Numero
          rotulo={ganho ? 'Fechado' : 'Valor'}
          valor={formatarMoeda(valorDoNegocio(n))}
          detalhe={
            n.valor_fechado != null
              ? 'Valor do contrato'
              : Number(n.orcamento_total) > 0
                ? 'Total do orçamento'
                : 'Estimativa'
          }
        />
        <Numero
          rotulo="Chance de fechar"
          valor={`${probabilidadeDoNegocio(n)}%`}
          detalhe={`Padrão da fase ${FASE_NEGOCIO_LABEL[n.fase]}`}
        />
        <Numero
          rotulo="Na fase há"
          valor={aberto ? (dias === 1 ? '1 dia' : `${dias} dias`) : '—'}
          detalhe={aberto ? 'Desde a última mudança' : 'Negócio fechado'}
        />
        <Numero
          rotulo="Previsão de fechar"
          valor={n.previsao_fechamento ? formatarData(n.previsao_fechamento) : 'Sem data'}
        />
      </Frame>

      <Tabs defaultValue={abaInicial === 'historico' ? 'historico' : 'orcamento'} className="gap-4">
        <div className="-mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
          <TabsList variant="line">
            <TabsTrigger value="orcamento">
              Orçamento
              {areas.length > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatarMoeda(totalOrcamento(areas))}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="orcamento">
          {ganho && n.projeto_id ? (
            <Frame spacing="default">
              <FramePanel>
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FolderKanbanIcon />
                    </EmptyMedia>
                    <EmptyTitle>O orçamento agora está na obra</EmptyTitle>
                    <EmptyDescription>
                      Ao ganhar, as áreas e medidas foram para a obra {n.projetos?.nome ?? ''}.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      nativeButton={false}
                      render={<Link href={`/projetos/${n.projeto_id}?aba=orcamento`} />}
                    >
                      Abrir orçamento da obra
                    </Button>
                  </EmptyContent>
                </Empty>
              </FramePanel>
            </Frame>
          ) : (
            <OrcamentoAba
              dono={{ negocioId: n.id }}
              empresaId={n.empresa_id}
              areas={areas}
              onAreasChange={setAreas}
              servicosEmpresa={servicosEmpresa}
              precos={precos}
            />
          )}
        </TabsContent>

        <TabsContent value="historico">
          <Frame spacing="default">
            <FramePanel>
              <ClienteLinhaDoTempo eventos={eventos} />
            </FramePanel>
          </Frame>
        </TabsContent>
      </Tabs>
      {dialogos}
    </div>
  )
}
