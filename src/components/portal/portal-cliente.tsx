import {
  CalendarIcon,
  DownloadIcon,
  FileIcon,
  FileTextIcon,
  HardHatIcon,
  ImageIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
  WalletIcon,
  WrenchIcon,
} from 'lucide-react'
import { formatarData, formatarDataHora, formatarMoeda } from '@/lib/formato'
import { SITUACAO_LABEL, VARIANTE_SITUACAO, situacaoRecebimento } from '@/lib/financeiro'
import { SITUACAO_POS_VENDA, situacaoPosVenda } from '@/lib/pos-venda'
import { VARIANTE_STATUS_ETAPA, VARIANTE_STATUS_PROJETO } from '@/lib/status'
import type { PortalArquivo, PortalDados, PortalObra, PortalPosVenda } from '@/lib/portal'
import {
  FORMA_PAGAMENTO_LABEL,
  STATUS_ETAPA_LABEL,
  STATUS_PROJETO_LABEL,
  TIPO_POS_VENDA_LABEL,
} from '@/types'
import { Badge } from '@/components/reui/badge'
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import { IconTile } from '@/components/reui/icon-tile'
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from '@/components/reui/timeline'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChamadoDialog } from './chamado-dialog'

const CONSULTA_PUBLICA = 'https://www.nfse.gov.br/consultapublica'

type Props = { token: string; dados: PortalDados; hoje: string }

export function PortalCliente({ token, dados, hoje }: Props) {
  const { empresa, cliente, obras, arquivos, pos_venda } = dados
  const primeiroNome = cliente.nome.trim().split(/\s+/)[0]
  const arquivosSemObra = arquivos.filter((a) => !a.projeto_id || !obras.some((o) => o.id === a.projeto_id))

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
      <header className="flex items-center gap-3">
        <IconTile variant="soft" size="lg" aria-hidden>
          <HardHatIcon />
        </IconTile>
        <div className="flex min-w-0 flex-col">
          <p className="text-sm text-muted-foreground">{empresa.nome}</p>
          <h1 className="truncate text-xl font-semibold tracking-tight">Olá, {primeiroNome}</h1>
        </div>
      </header>

      {obras.length === 0 ? (
        <Frame spacing="default">
          <FramePanel>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HardHatIcon />
                </EmptyMedia>
                <EmptyTitle>Nenhuma obra por aqui ainda</EmptyTitle>
                <EmptyDescription>Quando a sua obra começar, o andamento aparece nesta página.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </FramePanel>
        </Frame>
      ) : obras.length === 1 ? (
        <ObraPortal obra={obras[0]} arquivos={arquivos.filter((a) => a.projeto_id === obras[0].id)} hoje={hoje} />
      ) : (
        <Tabs defaultValue={obras[0].id} className="gap-4">
          <div className="-mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
            <TabsList variant="line">
              {obras.map((o) => (
                <TabsTrigger key={o.id} value={o.id}>
                  {o.nome}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {obras.map((o) => (
            <TabsContent key={o.id} value={o.id}>
              <ObraPortal obra={o} arquivos={arquivos.filter((a) => a.projeto_id === o.id)} hoje={hoje} />
            </TabsContent>
          ))}
        </Tabs>
      )}

      {arquivosSemObra.length > 0 && (
        <Frame spacing="default" className="min-w-0">
          <FrameHeader>
            <FrameTitle>Documentos</FrameTitle>
          </FrameHeader>
          <FramePanel>
            <ListaArquivos arquivos={arquivosSemObra} />
          </FramePanel>
        </Frame>
      )}

      <Assistencia token={token} itens={pos_venda} obras={obras} hoje={hoje} garantiaMeses={empresa.garantia_meses} />

      <p className="pb-4 text-center text-xs text-muted-foreground">
        Página de acompanhamento enviada por {empresa.nome}. Não compartilhe este link.
      </p>
    </main>
  )
}

function ObraPortal({ obra, arquivos, hoje }: { obra: PortalObra; arquivos: PortalArquivo[]; hoje: string }) {
  const concluidas = obra.etapas.filter((e) => e.status === 'concluida').length
  const fotos = arquivos.filter((a) => a.tipo_mime?.startsWith('image/'))
  const documentos = arquivos.filter((a) => !a.tipo_mime?.startsWith('image/'))
  const pago = obra.recebimentos.filter((r) => r.recebido_em).reduce((s, r) => s + Number(r.valor), 0)
  const total = obra.recebimentos.reduce((s, r) => s + Number(r.valor), 0)

  return (
    <div className="flex flex-col gap-6">
      <Frame spacing="default" className="min-w-0">
        <FrameHeader className="flex flex-row items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <FrameTitle className="truncate">{obra.nome}</FrameTitle>
            <FrameDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <CalendarIcon className="size-3.5" aria-hidden />
                Início {formatarData(obra.data_inicio)}
              </span>
              <span>Previsão {formatarData(obra.data_prazo)}</span>
            </FrameDescription>
          </div>
          <Badge variant={VARIANTE_STATUS_PROJETO[obra.status]}>{STATUS_PROJETO_LABEL[obra.status]}</Badge>
        </FrameHeader>
        <FramePanel className="flex flex-col gap-4">
          <Progress value={obra.percentual_conclusao}>
            <ProgressLabel>Andamento da obra</ProgressLabel>
            <ProgressValue />
          </Progress>
          {obra.etapas.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {concluidas} de {obra.etapas.length} {obra.etapas.length === 1 ? 'etapa concluída' : 'etapas concluídas'}
            </p>
          )}
        </FramePanel>
      </Frame>

      {obra.etapas.length > 0 && (
        <Frame spacing="default" className="min-w-0">
          <FrameHeader>
            <FrameTitle>Etapas</FrameTitle>
          </FrameHeader>
          <FramePanel>
            <Timeline defaultValue={concluidas}>
              {obra.etapas.map((e, i) => (
                <TimelineItem key={e.id} step={i + 1}>
                  <TimelineHeader>
                    <TimelineSeparator />
                    <TimelineDate>{e.data_prazo ? `Prazo ${formatarData(e.data_prazo)}` : 'Sem prazo'}</TimelineDate>
                    <TimelineTitle>{e.nome}</TimelineTitle>
                    <TimelineIndicator />
                  </TimelineHeader>
                  <TimelineContent>
                    <Badge variant={VARIANTE_STATUS_ETAPA[e.status]}>{STATUS_ETAPA_LABEL[e.status]}</Badge>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
          </FramePanel>
        </Frame>
      )}

      {fotos.length > 0 && (
        <Frame spacing="default" className="min-w-0">
          <FrameHeader>
            <FrameTitle>Fotos</FrameTitle>
            <FrameDescription>
              {fotos.length === 1 ? '1 foto' : `${fotos.length} fotos`}
            </FrameDescription>
          </FrameHeader>
          <FramePanel>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {fotos.map((f) =>
                f.url ? (
                  <a
                    key={f.id}
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col gap-1 outline-none"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.url}
                      alt={f.nome}
                      loading="lazy"
                      className="aspect-square w-full rounded-md border object-cover transition-opacity group-hover:opacity-90 group-focus-visible:ring-[3px] group-focus-visible:ring-ring/50"
                    />
                    <span className="text-xs text-muted-foreground">{formatarDataHora(f.created_at)}</span>
                  </a>
                ) : (
                  <div
                    key={f.id}
                    className="flex aspect-square items-center justify-center rounded-md border bg-muted text-muted-foreground"
                  >
                    <ImageIcon className="size-5" aria-label={f.nome} />
                  </div>
                )
              )}
            </div>
          </FramePanel>
        </Frame>
      )}

      {documentos.length > 0 && (
        <Frame spacing="default" className="min-w-0">
          <FrameHeader>
            <FrameTitle>Documentos da obra</FrameTitle>
          </FrameHeader>
          <FramePanel>
            <ListaArquivos arquivos={documentos} />
          </FramePanel>
        </Frame>
      )}

      {obra.recebimentos.length > 0 && (
        <Frame spacing="default" className="min-w-0">
          <FrameHeader>
            <FrameTitle>Pagamentos</FrameTitle>
            <FrameDescription>
              {formatarMoeda(pago)} pagos de {formatarMoeda(total)}
            </FrameDescription>
          </FrameHeader>
          <FramePanel>
            <ItemGroup className="gap-1">
              {obra.recebimentos.map((r) => {
                const situacao = situacaoRecebimento(r, hoje)
                return (
                  <Item key={r.id} variant="outline" size="sm">
                    <ItemMedia variant="icon">
                      <WalletIcon />
                    </ItemMedia>
                    <ItemContent className="min-w-0">
                      <ItemTitle className="w-full truncate">{r.descricao}</ItemTitle>
                      <ItemDescription className="text-xs tabular-nums">
                        {r.recebido_em
                          ? `Pago em ${formatarData(r.recebido_em)}${r.forma ? ` · ${FORMA_PAGAMENTO_LABEL[r.forma]}` : ''}`
                          : `Vence em ${formatarData(r.vencimento)}`}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions className="flex-col items-end gap-1">
                      <span className="text-sm font-medium tabular-nums">{formatarMoeda(Number(r.valor))}</span>
                      <Badge variant={VARIANTE_SITUACAO[situacao]}>
                        {situacao === 'recebido' ? 'Pago' : SITUACAO_LABEL[situacao]}
                      </Badge>
                    </ItemActions>
                  </Item>
                )
              })}
            </ItemGroup>
          </FramePanel>
        </Frame>
      )}

      {obra.notas.length > 0 && (
        <Frame spacing="default" className="min-w-0">
          <FrameHeader>
            <FrameTitle>Notas fiscais</FrameTitle>
            <FrameDescription>Consulte pela chave de acesso no portal da NFS-e</FrameDescription>
          </FrameHeader>
          <FramePanel>
            <ItemGroup className="gap-1">
              {obra.notas.map((n) => (
                <Item key={n.id} variant="outline" size="sm">
                  <ItemMedia variant="icon">
                    <ReceiptTextIcon />
                  </ItemMedia>
                  <ItemContent className="min-w-0">
                    <ItemTitle className="w-full truncate">
                      {n.numero_nfse ? `NFS-e nº ${n.numero_nfse}` : 'NFS-e'} · {formatarMoeda(Number(n.valor))}
                    </ItemTitle>
                    <ItemDescription className="text-xs break-all">
                      {formatarDataHora(n.autorizada_em ?? n.competencia)}
                      {n.chave_acesso ? ` · Chave ${n.chave_acesso}` : ''}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    {n.ambiente === 'homologacao' && <Badge variant="warning-light">Teste</Badge>}
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<a href={CONSULTA_PUBLICA} target="_blank" rel="noopener noreferrer" />}
                    >
                      Consultar
                    </Button>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          </FramePanel>
        </Frame>
      )}
    </div>
  )
}

function ListaArquivos({ arquivos }: { arquivos: PortalArquivo[] }) {
  return (
    <ItemGroup className="gap-1">
      {arquivos.map((a) => (
        <Item key={a.id} variant="outline" size="sm">
          <ItemMedia variant="icon">
            {a.tipo_mime === 'application/pdf' ? <FileTextIcon /> : <FileIcon />}
          </ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle className="w-full truncate">{a.nome}</ItemTitle>
            <ItemDescription className="text-xs">{formatarDataHora(a.created_at)}</ItemDescription>
          </ItemContent>
          {a.url && (
            <ItemActions>
              <Button
                variant="ghost"
                size="icon-sm"
                nativeButton={false}
                render={<a href={a.url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${a.nome}`} />}
              >
                <DownloadIcon />
              </Button>
            </ItemActions>
          )}
        </Item>
      ))}
    </ItemGroup>
  )
}

function Assistencia({
  token,
  itens,
  obras,
  hoje,
  garantiaMeses,
}: {
  token: string
  itens: PortalPosVenda[]
  obras: PortalObra[]
  hoje: string
  garantiaMeses: number | null
}) {
  const nomeObra = (id: string | null) => obras.find((o) => o.id === id)?.nome
  return (
    <Frame spacing="default" className="min-w-0">
      <FrameHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <FrameTitle>Garantia e assistência</FrameTitle>
          <FrameDescription>
            {garantiaMeses ? `Garantia de ${garantiaMeses} meses após a entrega. ` : ''}Algo precisa de reparo? Abra um
            chamado.
          </FrameDescription>
        </div>
        <ChamadoDialog token={token} obras={obras.map((o) => ({ id: o.id, nome: o.nome }))} />
      </FrameHeader>
      <FramePanel>
        {itens.length === 0 ? (
          <Empty className="py-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ShieldCheckIcon />
              </EmptyMedia>
              <EmptyTitle>Nada por aqui</EmptyTitle>
              <EmptyDescription>A garantia aparece quando a obra é entregue. Seus chamados também ficam aqui.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup className="gap-1">
            {itens.map((p) => {
              // Chamado do cliente: sem "atrasado", que assusta e não ajuda quem abriu.
              const situacao =
                p.origem === 'portal'
                  ? p.status === 'resolvido'
                    ? SITUACAO_POS_VENDA.resolvido
                    : p.status === 'agendado'
                      ? SITUACAO_POS_VENDA.agendado
                      : { rotulo: 'Recebido', variante: 'invert-light' as const }
                  : SITUACAO_POS_VENDA[situacaoPosVenda(p, hoje)]
              const obra = nomeObra(p.projeto_id)
              return (
                <Item key={p.id} variant="outline" size="sm">
                  <ItemMedia variant="icon">{p.tipo === 'garantia' ? <ShieldCheckIcon /> : <WrenchIcon />}</ItemMedia>
                  <ItemContent className="min-w-0">
                    <ItemTitle className="w-full truncate">{p.titulo}</ItemTitle>
                    <ItemDescription className="text-xs">
                      {p.origem === 'portal' ? 'Chamado aberto por você' : TIPO_POS_VENDA_LABEL[p.tipo]}
                      {obra ? ` · ${obra}` : ''}
                      {p.tipo === 'garantia' && p.vence_em ? ` · até ${formatarData(p.vence_em)}` : ''}
                      {p.origem === 'portal' ? ` · ${formatarDataHora(p.created_at)}` : ''}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Badge variant={situacao.variante}>{situacao.rotulo}</Badge>
                  </ItemActions>
                </Item>
              )
            })}
          </ItemGroup>
        )}
      </FramePanel>
    </Frame>
  )
}
