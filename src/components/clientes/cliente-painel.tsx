import Link from 'next/link'
import { FolderKanbanIcon, PhoneIcon, PlusIcon } from 'lucide-react'
import { Badge } from '@/components/reui/badge'
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
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
  ItemTitle,
} from '@/components/ui/item'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PortalAcessoDialog } from '@/components/portal/portal-acesso-dialog'
import { formatarTelefone } from './telefone'
import { ClienteLinhaDoTempo, type EventoCliente } from './cliente-linha-do-tempo'
import { ClienteRelacionamento } from './cliente-relacionamento'
import { RegistrarAtividade } from './registrar-atividade'
import { NovaTarefa } from '@/components/agenda/nova-tarefa'
import { TarefaItem } from '@/components/agenda/tarefa-item'
import { PosVendaPainel } from '@/components/pos-venda/pos-venda-painel'
import { pendentesPosVenda } from '@/lib/pos-venda'
import { BotaoWhatsApp } from './botao-whatsapp'
import { ArquivosLista } from '@/components/arquivos/arquivos-lista'
import { NegociosCliente } from '@/components/negocios/negocios-cliente'
import { formatarData, formatarDataHora, formatarMoeda, iniciais } from '@/lib/formato'
import { faseDoCliente, faseAutomatica, numerosDoCliente, situacaoFollowup } from '@/lib/crm'
import {
  VARIANTE_FASE_CLIENTE,
  VARIANTE_STATUS_PROJETO,
  VARIANTE_TEMPERATURA,
  projetoAtrasado,
} from '@/lib/status'
import {
  FASE_CLIENTE_LABEL,
  STATUS_PROJETO_LABEL,
  TEMPERATURA_LABEL,
  TIPO_ATIVIDADE_LABEL,
  type Atividade,
  type Cliente,
  type MembroEquipe,
  type PosVenda,
  type Negocio,
  type Projeto,
  type Recebimento,
  type TarefaAgenda,
} from '@/types'
import { resumoRecebimentos } from '@/lib/financeiro'
import { FinanceiroCliente } from '@/components/financeiro/financeiro-cliente'

function Dado({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{rotulo}</dt>
      <dd className="text-sm break-words">{valor || '—'}</dd>
    </div>
  )
}

function Numero({
  rotulo,
  valor,
  detalhe,
  alerta,
}: {
  rotulo: string
  valor: string
  detalhe?: string
  alerta?: boolean
}) {
  return (
    <FramePanel className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <span
        className={`truncate text-lg font-semibold tracking-tight tabular-nums sm:text-xl ${alerta ? 'text-destructive-foreground' : ''}`}
      >
        {valor}
      </span>
      {detalhe && <span className="text-xs text-muted-foreground">{detalhe}</span>}
    </FramePanel>
  )
}

function ListaObras({
  obras,
  novoProjeto,
  compacta,
}: {
  obras: Projeto[]
  novoProjeto: string
  /** Coluna estreita: barra e status descem para baixo do nome. */
  compacta?: boolean
}) {
  if (obras.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderKanbanIcon />
          </EmptyMedia>
          <EmptyTitle>Nenhuma obra ainda</EmptyTitle>
          <EmptyDescription>Abra a primeira obra deste cliente.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button nativeButton={false} render={<Link href={novoProjeto} />}>
            <PlusIcon data-icon="inline-start" />
            Novo projeto
          </Button>
        </EmptyContent>
      </Empty>
    )
  }
  return (
    <ItemGroup>
      {obras.map((p) => {
        const atrasado = projetoAtrasado(p)
        return (
          <Item key={p.id} render={<Link href={`/projetos/${p.id}`} />}>
            <ItemContent className={compacta ? 'min-w-0 basis-full' : 'min-w-0'}>
              <ItemTitle className="truncate">{p.nome}</ItemTitle>
              <ItemDescription className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
                {atrasado && <Badge variant="destructive-light">Atrasado</Badge>}
                <span>Prazo {formatarData(p.data_prazo)}</span>
                {p.orcamento_total ? (
                  <>
                    <span aria-hidden className="bg-muted-foreground/40 size-1 shrink-0 rounded-full" />
                    <span>{formatarMoeda(p.orcamento_total)}</span>
                  </>
                ) : null}
              </ItemDescription>
            </ItemContent>
            <ItemActions className={compacta ? 'w-full gap-3' : 'w-full gap-3 sm:w-56'}>
              <Progress
                value={p.percentual_conclusao}
                aria-label={`Conclusão de ${p.nome}`}
                className="flex-1 flex-nowrap items-center"
              >
                <span className="text-muted-foreground order-last w-9 shrink-0 text-end text-xs tabular-nums">
                  {p.percentual_conclusao}%
                </span>
              </Progress>
              <Badge variant={VARIANTE_STATUS_PROJETO[p.status]}>{STATUS_PROJETO_LABEL[p.status]}</Badge>
            </ItemActions>
          </Item>
        )
      })}
    </ItemGroup>
  )
}

type Props = {
  cliente: Cliente
  obras: Projeto[]
  atividades: Atividade[]
  equipe: Pick<MembroEquipe, 'id' | 'nome'>[]
  /** false antes de rodar o SQL do Cliente 360 (colunas e tabela novas). */
  crmDisponivel: boolean
  /** false antes de rodar o SQL da agenda (prazo e conclusão em atividades). */
  agendaDisponivel: boolean
  /** Tarefas abertas deste cliente, da mais próxima para a mais distante. */
  tarefas: TarefaAgenda[]
  posVenda: PosVenda[]
  /** false antes de rodar o SQL do pós-venda. */
  posVendaDisponivel: boolean
  linkGoogle: string | null
  indicadoPor: { id: string; nome: string } | null
  /** 'YYYY-MM-DD' calculado no servidor. */
  hoje: string
  /** Parcelas de todas as obras do cliente. */
  recebimentos: Recebimento[]
  /** Quem está logado pode ver valores recebidos (ver podeVerFinanceiro). */
  verFinanceiro: boolean
  /** false antes de rodar o SQL do financeiro. */
  financeiroDisponivel: boolean
  /** null antes de rodar o SQL do funil. */
  negocios: Negocio[] | null
  /** Nome da empresa, para a mensagem do portal do cliente. */
  empresaNome: string
  agora: number
}

// Painel do cliente (Cliente 360): cabeçalho com fase e ações, números,
// e abas Resumo (linha do tempo + obras), Obras e Dados.
export function ClientePainel({
  cliente: c,
  obras,
  atividades,
  equipe,
  crmDisponivel,
  agendaDisponivel,
  tarefas,
  posVenda,
  posVendaDisponivel,
  linkGoogle,
  indicadoPor,
  hoje,
  negocios,
  agora,
  recebimentos,
  verFinanceiro,
  financeiroDisponivel,
  empresaNome,
}: Props) {
  const financeiro = resumoRecebimentos(recebimentos, hoje)
  const mostrarFinanceiro = verFinanceiro && financeiroDisponivel
  const pendentesPv = pendentesPosVenda(posVenda)
  const fase = faseDoCliente({ fase_manual: c.fase_manual ?? null }, obras, negocios ?? [])
  const numeros = numerosDoCliente(obras)
  const followup = situacaoFollowup(c.proximo_followup_em ?? null, hoje)
  // Contatos já feitos (sem prazo) e tarefas concluídas entram na linha do tempo;
  // tarefas abertas ficam em "Próximos passos".
  const feitas = atividades.filter((a) => !a.previsto_para || a.concluida_em)
  const ultimoContato = feitas.find((a) => !a.previsto_para)?.ocorreu_em ?? null
  const novoProjeto = `/projetos/novo?clienteId=${c.id}`
  const responsavel = equipe.find(
    (m) => m.id === c.responsavel_id
  )

  const eventos: EventoCliente[] = [
    ...feitas.map((a) => {
      const rotulo = a.concluida_em ? `${TIPO_ATIVIDADE_LABEL[a.tipo]} feita` : TIPO_ATIVIDADE_LABEL[a.tipo]
      return {
        id: `a-${a.id}`,
        quando: a.concluida_em ?? a.ocorreu_em,
        tipo: a.tipo,
        titulo: a.equipe?.nome ? `${rotulo} · ${a.equipe.nome}` : rotulo,
        texto: a.resultado ? `${a.texto}\nResultado: ${a.resultado}` : a.texto,
      }
    }),
    ...obras.map((p) => ({
      id: `p-${p.id}`,
      quando: p.created_at,
      tipo: 'obra' as const,
      titulo: `Obra aberta: ${p.nome}`,
      texto: p.orcamento_total ? `Orçamento de ${formatarMoeda(p.orcamento_total)}` : undefined,
      href: `/projetos/${p.id}`,
    })),
    { id: 'cadastro', quando: c.created_at, tipo: 'cadastro' as const, titulo: 'Cliente cadastrado' },
  ].sort((a, b) => b.quando.localeCompare(a.quando))

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar size="lg">
            <AvatarFallback>{iniciais(c.nome)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="truncate text-xl font-semibold tracking-tight">{c.nome}</h1>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={VARIANTE_FASE_CLIENTE[fase]}>{FASE_CLIENTE_LABEL[fase]}</Badge>
              {c.temperatura && (
                <Badge variant={VARIANTE_TEMPERATURA[c.temperatura]}>{TEMPERATURA_LABEL[c.temperatura]}</Badge>
              )}
              <Badge variant="outline">{c.tipo}</Badge>
              {responsavel && (
                <span className="text-xs text-muted-foreground">Responsável: {responsavel.nome}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <BotaoWhatsApp telefone={c.telefone} nome={c.nome} obra={obras[0]?.nome} />
          <PortalAcessoDialog
            cliente={{ id: c.id, nome: c.nome, telefone: c.telefone }}
            empresaNome={empresaNome}
          />
          {c.telefone && (
            <Button variant="outline" nativeButton={false} render={<a href={`tel:${c.telefone}`} />}>
              <PhoneIcon data-icon="inline-start" />
              Ligar
            </Button>
          )}
          <Button nativeButton={false} render={<Link href={novoProjeto} />}>
            <PlusIcon data-icon="inline-start" />
            Novo projeto
          </Button>
        </div>
      </header>

      <Frame
        spacing="default"
        className={`grid grid-cols-2 ${mostrarFinanceiro ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}
      >
        <Numero
          rotulo="Contratado"
          valor={formatarMoeda(numeros.contratado)}
          detalhe={`${numeros.totalObras} ${numeros.totalObras === 1 ? 'obra' : 'obras'} no total`}
        />
        <Numero
          rotulo="Em proposta"
          valor={formatarMoeda(numeros.emProposta)}
          detalhe="Obras em planejamento"
        />
        {mostrarFinanceiro && (
          <>
            <Numero
              rotulo="Recebido"
              valor={formatarMoeda(financeiro.recebido)}
              detalhe={`${financeiro.parcelas} ${financeiro.parcelas === 1 ? 'parcela' : 'parcelas'} no total`}
            />
            <Numero
              rotulo="A receber"
              valor={formatarMoeda(financeiro.aReceber)}
              detalhe={
                financeiro.atrasado > 0 ? `${formatarMoeda(financeiro.atrasado)} atrasado` : 'Nada atrasado'
              }
              alerta={financeiro.atrasado > 0}
            />
          </>
        )}
        <Numero
          rotulo="Obras ativas"
          valor={String(numeros.obrasAtivas)}
          detalhe="Em execução ou pausadas"
        />
        <Numero
          rotulo="Próximo follow-up"
          valor={
            followup === 'sem'
              ? 'Sem data'
              : followup === 'hoje'
                ? 'Hoje'
                : formatarData(c.proximo_followup_em)
          }
          detalhe={
            followup === 'atrasado'
              ? 'Atrasado'
              : ultimoContato
                ? `Último contato ${formatarDataHora(ultimoContato)}`
                : 'Nenhum contato registrado'
          }
          alerta={followup === 'atrasado'}
        />
      </Frame>

      <Tabs defaultValue="resumo" className="gap-4">
        <div className="-mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
          <TabsList variant="line">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            {negocios && (
              <TabsTrigger value="negocios">
                Negócios
                <span className="text-xs text-muted-foreground tabular-nums">{negocios.length}</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="obras">
              Obras
              <span className="text-xs text-muted-foreground tabular-nums">{obras.length}</span>
            </TabsTrigger>
            {mostrarFinanceiro && (
              <TabsTrigger value="financeiro">
                Financeiro
                {financeiro.parcelasAtrasadas > 0 && (
                  <span className="text-xs text-destructive tabular-nums">{financeiro.parcelasAtrasadas}</span>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="pos-venda">
              Pós-venda
              {pendentesPv > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">{pendentesPv}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="arquivos">Arquivos</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="resumo">
          <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Frame spacing="default" className="min-w-0">
              <FrameHeader>
                <FrameTitle>Linha do tempo</FrameTitle>
              </FrameHeader>
              <FramePanel className="flex flex-col gap-6">
                <RegistrarAtividade
                  clienteId={c.id}
                  empresaId={c.empresa_id}
                  disponivel={crmDisponivel}
                  agendaDisponivel={agendaDisponivel}
                  equipe={equipe}
                  responsavelPadrao={c.responsavel_id ?? null}
                  hoje={hoje}
                />
                <Separator />
                <ClienteLinhaDoTempo eventos={eventos} />
              </FramePanel>
            </Frame>

            <div className="flex min-w-0 flex-col gap-6 self-start">
            {agendaDisponivel && (
              <Frame spacing="default" className="min-w-0">
                <FrameHeader className="flex flex-row items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <FrameTitle>Próximos passos</FrameTitle>
                    <FrameDescription>
                      {tarefas.length === 0
                        ? 'Nada agendado'
                        : tarefas.length === 1
                          ? '1 tarefa aberta'
                          : `${tarefas.length} tarefas abertas`}
                    </FrameDescription>
                  </div>
                  <NovaTarefa
                    variante="outline"
                    empresaId={c.empresa_id}
                    equipe={equipe}
                    hoje={hoje}
                    cliente={{ id: c.id, nome: c.nome, responsavel_id: c.responsavel_id }}
                  />
                </FrameHeader>
                {tarefas.length > 0 && (
                  <FramePanel>
                    <ItemGroup className="gap-2">
                      {tarefas.map((t) => (
                        <TarefaItem key={t.id} tarefa={t} hoje={hoje} mostrarDia />
                      ))}
                    </ItemGroup>
                  </FramePanel>
                )}
              </Frame>
            )}
              {negocios && (
                <Frame spacing="default" className="min-w-0">
                  <FrameHeader>
                    <FrameTitle>Negócios abertos</FrameTitle>
                  </FrameHeader>
                  <FramePanel>
                    <NegociosCliente
                      negocios={negocios}
                      empresaId={c.empresa_id}
                      clienteId={c.id}
                      equipe={equipe}
                      agora={agora}
                      compacta
                    />
                  </FramePanel>
                </Frame>
              )}
            <Frame spacing="default" className="min-w-0">
              <FrameHeader>
                <FrameTitle>Obras</FrameTitle>
                <FrameDescription>
                  {obras.length === 1 ? '1 obra' : `${obras.length} obras`}
                </FrameDescription>
              </FrameHeader>
              <FramePanel>
                <ListaObras obras={obras.slice(0, 4)} novoProjeto={novoProjeto} compacta />
              </FramePanel>
            </Frame>
            </div>
          </div>
        </TabsContent>

        {negocios && (
          <TabsContent value="negocios">
            <Frame spacing="default" className="min-w-0">
              <FramePanel>
                <NegociosCliente
                  negocios={negocios}
                  empresaId={c.empresa_id}
                  clienteId={c.id}
                  equipe={equipe}
                  agora={agora}
                />
              </FramePanel>
            </Frame>
          </TabsContent>
        )}

        <TabsContent value="obras">
          <Frame spacing="default" className="min-w-0">
            <FramePanel>
              <ListaObras obras={obras} novoProjeto={novoProjeto} />
            </FramePanel>
          </Frame>
        </TabsContent>

        {mostrarFinanceiro && (
          <TabsContent value="financeiro">
            <FinanceiroCliente recebimentos={recebimentos} hoje={hoje} temObras={obras.length > 0} />
          </TabsContent>
        )}
        <TabsContent value="pos-venda">
          <PosVendaPainel
            itens={posVenda}
            cliente={{ id: c.id, empresa_id: c.empresa_id, nome: c.nome, telefone: c.telefone }}
            obras={obras.map((o) => ({ id: o.id, nome: o.nome }))}
            linkGoogle={linkGoogle}
            hoje={hoje}
            disponivel={posVendaDisponivel}
          />
        </TabsContent>

        <TabsContent value="arquivos">
          <Frame spacing="default" className="min-w-0">
            <FrameHeader>
              <FrameTitle>Arquivos</FrameTitle>
            </FrameHeader>
            <FramePanel>
              <ArquivosLista
                empresaId={c.empresa_id}
                clienteId={c.id}
                obras={obras.map(({ id, nome }) => ({ id, nome }))}
              />
            </FramePanel>
          </Frame>
        </TabsContent>

        <TabsContent value="dados">
          <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <Frame spacing="default" className="min-w-0">
              <FrameHeader>
                <FrameTitle>Relacionamento</FrameTitle>
              </FrameHeader>
              <FramePanel>
                <ClienteRelacionamento
                  cliente={c}
                  faseCalculada={faseAutomatica(obras, negocios ?? [])}
                  equipe={equipe}
                  disponivel={crmDisponivel}
                  agendaDisponivel={agendaDisponivel}
                />
              </FramePanel>
            </Frame>

            <Frame spacing="default" className="min-w-0 self-start">
              <FrameHeader>
                <FrameTitle>Cadastro</FrameTitle>
              </FrameHeader>
              <FramePanel>
                <dl className="flex flex-col gap-4">
                  {c.tipo === 'PJ' && <Dado rotulo="Razão social" valor={c.razao_social} />}
                  <Dado rotulo={c.tipo === 'PF' ? 'CPF' : 'CNPJ'} valor={c.tipo === 'PF' ? c.cpf : c.cnpj} />
                  <Dado rotulo="Telefone" valor={formatarTelefone(c.telefone)} />
                  <Dado rotulo="E-mail" valor={c.email} />
                  <Dado rotulo="Endereço" valor={c.endereco} />
                  <Dado rotulo="Origem" valor={c.origem} />
                  {indicadoPor && (
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-muted-foreground text-xs">Indicado por</dt>
                      <dd className="text-sm">
                        <Link href={`/clientes/${indicadoPor.id}`} className="hover:underline">
                          {indicadoPor.nome}
                        </Link>
                      </dd>
                    </div>
                  )}
                  <Dado rotulo="Cliente desde" valor={formatarDataHora(c.created_at)} />
                </dl>
              </FramePanel>
            </Frame>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
