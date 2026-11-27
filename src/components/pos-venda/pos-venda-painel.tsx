'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  CalendarClockIcon,
  CheckIcon,
  EllipsisIcon,
  HeartHandshakeIcon,
  MessageCircleIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  SmileIcon,
  StarIcon,
  Trash2Icon,
  UserPlusIcon,
  WrenchIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatarData } from '@/lib/formato'
import { linkWhatsApp } from '@/lib/crm'
import {
  SITUACAO_POS_VENDA,
  mediaNotas,
  mensagemAvaliacao,
  mensagemPesquisa,
  ordenarPosVenda,
  pendentesPosVenda,
  situacaoPosVenda,
  tituloPosVenda,
} from '@/lib/pos-venda'
import { Badge } from '@/components/reui/badge'
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import { IconTile } from '@/components/reui/icon-tile'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Spinner } from '@/components/ui/spinner'
import { TIPO_POS_VENDA_LABEL, type PosVenda, type StatusProjeto, type TipoPosVenda } from '@/types'
import { ConfirmarExclusao } from '@/components/projetos/confirmar-exclusao'
import { AgendarDialog, ChamadoDialog, IndicacaoDialog, NotaDialog, type DadosCliente } from './pos-venda-dialogos'

const ICONE: Record<TipoPosVenda, typeof StarIcon> = {
  garantia: ShieldCheckIcon,
  pesquisa: SmileIcon,
  avaliacao: StarIcon,
  revisao: CalendarClockIcon,
  assistencia: WrenchIcon,
  indicacao: UserPlusIcon,
}

function comTexto(link: string | null, texto: string): string | null {
  return link ? `${link}?text=${encodeURIComponent(texto)}` : null
}

type Props = {
  itens: PosVenda[]
  cliente: DadosCliente
  /** Obras do cliente, para escolher no chamado. */
  obras: { id: string; nome: string }[]
  /** Na aba da obra: a obra fixa (chamados vão para ela). */
  projeto?: { id: string; status: StatusProjeto }
  linkGoogle: string | null
  hoje: string
  /** false antes de rodar o SQL do pós-venda. */
  disponivel: boolean
}

// Pós-venda da obra ou do cliente: garantia, pesquisa 0–10, avaliação no
// Google, revisões, chamados de assistência e indicações.
export function PosVendaPainel({ itens, cliente, obras, projeto, linkGoogle, hoje, disponivel }: Props) {
  const router = useRouter()
  const [chamado, setChamado] = useState<{ projetoId: string | null } | null>(null)
  const [indicando, setIndicando] = useState(false)
  const [notaDe, setNotaDe] = useState<PosVenda | null>(null)
  const [agendando, setAgendando] = useState<PosVenda | null>(null)
  const [excluindo, setExcluindo] = useState<PosVenda | null>(null)
  const [gerando, setGerando] = useState(false)

  const atualizar = () => router.refresh()
  const whatsapp = linkWhatsApp(cliente.telefone)
  const lista = ordenarPosVenda(itens)
  const pendentes = pendentesPosVenda(itens)
  const media = mediaNotas(itens)
  const indicacoes = itens.filter((i) => i.tipo === 'indicacao').length
  const temGarantia = itens.some((i) => i.tipo === 'garantia')

  async function mudarStatus(item: PosVenda, status: PosVenda['status']) {
    const { error } = await createClient()
      .from('pos_venda')
      .update({ status, resolvido_em: status === 'resolvido' ? new Date().toISOString() : null })
      .eq('id', item.id)
    if (error) {
      toast.error('Não foi possível atualizar', { description: error.message })
      return
    }
    toast.success(status === 'resolvido' ? 'Concluído' : 'Reaberto')
    atualizar()
  }

  async function excluir() {
    if (!excluindo) return false
    const { error } = await createClient().from('pos_venda').delete().eq('id', excluindo.id)
    if (error) {
      toast.error('Não foi possível excluir', { description: error.message })
      return false
    }
    toast.success('Excluído')
    atualizar()
    return true
  }

  async function gerar() {
    if (!projeto) return
    setGerando(true)
    const { data, error } = await createClient().rpc('gerar_pos_venda', { p_projeto_id: projeto.id })
    setGerando(false)
    if (error) {
      toast.error('Não foi possível gerar o pós-venda', { description: error.message })
      return
    }
    toast.success(`${data ?? 0} itens de pós-venda criados`)
    atualizar()
  }

  function acaoPrincipal(item: PosVenda) {
    if (item.status === 'resolvido') {
      if (item.tipo === 'indicacao' && item.indicado_cliente_id) {
        return (
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href={`/clientes/${item.indicado_cliente_id}`} />}
          >
            Ver cliente
          </Button>
        )
      }
      return null
    }
    switch (item.tipo) {
      case 'garantia':
        return (
          <Button size="sm" variant="outline" onClick={() => setChamado({ projetoId: item.projeto_id })}>
            <WrenchIcon data-icon="inline-start" />
            Acionar
          </Button>
        )
      case 'pesquisa':
        return (
          <Button size="sm" variant="outline" onClick={() => setNotaDe(item)}>
            <SmileIcon data-icon="inline-start" />
            Registrar nota
          </Button>
        )
      case 'avaliacao': {
        const link = comTexto(whatsapp, mensagemAvaliacao(cliente.nome, linkGoogle))
        return link ? (
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<a href={link} target="_blank" rel="noreferrer" />}
          >
            <MessageCircleIcon data-icon="inline-start" />
            Pedir no WhatsApp
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => mudarStatus(item, 'resolvido')}>
            <CheckIcon data-icon="inline-start" />
            Já pedi
          </Button>
        )
      }
      default:
        return item.status === 'agendado' ? (
          <Button size="sm" variant="outline" onClick={() => mudarStatus(item, 'resolvido')}>
            <CheckIcon data-icon="inline-start" />
            Concluir
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setAgendando(item)}>
            <CalendarClockIcon data-icon="inline-start" />
            Agendar
          </Button>
        )
    }
  }

  function menu(item: PosVenda) {
    const pesquisaZap =
      item.tipo === 'pesquisa' && item.status !== 'resolvido'
        ? comTexto(whatsapp, mensagemPesquisa(cliente.nome))
        : null
    return (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Mais ações" />}>
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {pesquisaZap && (
            <DropdownMenuItem render={<a href={pesquisaZap} target="_blank" rel="noreferrer" />}>
              <MessageCircleIcon />
              Perguntar no WhatsApp
            </DropdownMenuItem>
          )}
          {item.status !== 'resolvido' && (item.tipo === 'revisao' || item.tipo === 'assistencia') && (
            <DropdownMenuItem onClick={() => setAgendando(item)}>
              <CalendarClockIcon />
              {item.status === 'agendado' ? 'Mudar data' : 'Agendar'}
            </DropdownMenuItem>
          )}
          {item.status !== 'resolvido' && item.tipo !== 'pesquisa' && (
            <DropdownMenuItem onClick={() => mudarStatus(item, 'resolvido')}>
              <CheckIcon />
              {item.tipo === 'garantia' ? 'Encerrar garantia' : 'Marcar como feito'}
            </DropdownMenuItem>
          )}
          {item.status === 'resolvido' && item.tipo !== 'indicacao' && (
            <DropdownMenuItem onClick={() => mudarStatus(item, item.vence_em ? 'agendado' : 'aberto')}>
              <RotateCcwIcon />
              Reabrir
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setExcluindo(item)}>
            <Trash2Icon />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const acoes = (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={() => setIndicando(true)} disabled={!disponivel}>
        <UserPlusIcon data-icon="inline-start" />
        Indicação
      </Button>
      <Button size="sm" onClick={() => setChamado({ projetoId: projeto?.id ?? null })} disabled={!disponivel}>
        <WrenchIcon data-icon="inline-start" />
        Abrir chamado
      </Button>
    </div>
  )

  const podeGerar = disponivel && projeto && projeto.status === 'completo' && !temGarantia

  return (
    <Frame spacing="default" className="min-w-0">
      <FrameHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <FrameTitle>Pós-venda</FrameTitle>
          <FrameDescription className="tabular-nums">
            {pendentes === 0 ? 'Nada pendente' : pendentes === 1 ? '1 pendente' : `${pendentes} pendentes`}
            {media != null && ` · Nota média ${media.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}`}
            {indicacoes > 0 && ` · ${indicacoes} ${indicacoes === 1 ? 'indicação' : 'indicações'}`}
          </FrameDescription>
        </div>
        {acoes}
      </FrameHeader>
      <FramePanel>
        {!disponivel ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HeartHandshakeIcon />
              </EmptyMedia>
              <EmptyTitle>Pós-venda ainda não ligado</EmptyTitle>
              <EmptyDescription>Rode o SQL do pós-venda no Supabase para ativar esta aba.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : lista.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HeartHandshakeIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhum pós-venda ainda</EmptyTitle>
              <EmptyDescription>
                {podeGerar
                  ? 'Esta obra foi concluída antes do pós-venda existir. Gere a garantia, a pesquisa e a avaliação agora.'
                  : 'Quando a obra for marcada como Completa, criamos a garantia, a pesquisa de 0 a 10 em 7 dias, o pedido de avaliação no Google e as revisões dos serviços.'}
              </EmptyDescription>
            </EmptyHeader>
            {podeGerar && (
              <EmptyContent>
                <Button onClick={gerar} disabled={gerando}>
                  {gerando ? <Spinner data-icon="inline-start" /> : <ShieldCheckIcon data-icon="inline-start" />}
                  Gerar pós-venda
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <ItemGroup>
            {podeGerar && (
              <Item variant="muted">
                <ItemContent>
                  <ItemTitle>Garantia, pesquisa e avaliação ainda não criadas</ItemTitle>
                  <ItemDescription>A obra foi concluída antes do pós-venda existir.</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button size="sm" onClick={gerar} disabled={gerando}>
                    {gerando && <Spinner data-icon="inline-start" />}
                    Gerar
                  </Button>
                </ItemActions>
              </Item>
            )}
            {lista.map((item) => {
              const situacao = SITUACAO_POS_VENDA[situacaoPosVenda(item, hoje)]
              const Icone = ICONE[item.tipo]
              const obra = !projeto && item.projetos?.nome
              const data =
                item.tipo === 'garantia'
                  ? `Até ${formatarData(item.vence_em)}`
                  : item.status === 'resolvido'
                    ? `Feito em ${formatarData(item.resolvido_em)}`
                    : item.vence_em
                      ? formatarData(item.vence_em)
                      : 'Sem data'
              return (
                <Item key={item.id} variant="outline" className={item.status === 'resolvido' ? 'opacity-80' : undefined}>
                  <ItemMedia>
                    <IconTile variant="soft" size="sm" aria-hidden>
                      <Icone />
                    </IconTile>
                  </ItemMedia>
                  <ItemContent className="min-w-0 basis-48">
                    <ItemTitle className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate">{tituloPosVenda(item)}</span>
                      <Badge variant={situacao.variante}>{situacao.rotulo}</Badge>
                      {item.origem === 'portal' && <Badge variant="info-light">Pelo portal</Badge>}
                      {item.nota_0_10 != null && (
                        <Badge variant={item.nota_0_10 >= 9 ? 'success-light' : item.nota_0_10 >= 7 ? 'warning-light' : 'destructive-light'}>
                          Nota {item.nota_0_10}
                        </Badge>
                      )}
                    </ItemTitle>
                    <ItemDescription className="flex flex-wrap items-center gap-x-2 text-xs tabular-nums">
                      <span>{TIPO_POS_VENDA_LABEL[item.tipo]}</span>
                      <span aria-hidden className="size-1 shrink-0 rounded-full bg-muted-foreground/40" />
                      <span>{data}</span>
                      {obra && (
                        <>
                          <span aria-hidden className="size-1 shrink-0 rounded-full bg-muted-foreground/40" />
                          <Link href={`/projetos/${item.projeto_id}`} className="truncate hover:text-foreground">
                            {obra}
                          </Link>
                        </>
                      )}
                    </ItemDescription>
                    {item.texto && item.tipo !== 'garantia' && item.tipo !== 'avaliacao' && (
                      <p className="text-sm whitespace-pre-line">{item.texto}</p>
                    )}
                  </ItemContent>
                  <ItemActions className="ms-auto">
                    {acaoPrincipal(item)}
                    {menu(item)}
                  </ItemActions>
                </Item>
              )
            })}
          </ItemGroup>
        )}
      </FramePanel>

      <ChamadoDialog
        aberto={!!chamado}
        onOpenChange={(a) => !a && setChamado(null)}
        cliente={cliente}
        obras={obras}
        projetoInicial={chamado?.projetoId ?? null}
        onSalvo={atualizar}
      />
      <IndicacaoDialog aberto={indicando} onOpenChange={setIndicando} cliente={cliente} onSalvo={atualizar} />
      <NotaDialog item={notaDe} onOpenChange={(a) => !a && setNotaDe(null)} onSalvo={atualizar} />
      <AgendarDialog item={agendando} onOpenChange={(a) => !a && setAgendando(null)} onSalvo={atualizar} />
      <ConfirmarExclusao
        aberto={!!excluindo}
        onOpenChange={(a) => !a && setExcluindo(null)}
        titulo="Excluir este item do pós-venda?"
        descricao={
          excluindo?.tipo === 'indicacao'
            ? 'O cliente indicado continua cadastrado. Não dá para desfazer.'
            : 'Não dá para desfazer.'
        }
        rotulo="Excluir"
        onConfirmar={excluir}
      />
    </Frame>
  )
}
