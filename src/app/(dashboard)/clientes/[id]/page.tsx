import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { FolderKanbanIcon, PlusIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/reui/badge'
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
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
import { formatarTelefone } from '@/components/clientes/telefone'
import { formatarData, formatarMoeda, iniciais } from '@/lib/formato'
import { VARIANTE_STATUS_PROJETO, projetoAtrasado } from '@/lib/status'
import { STATUS_PROJETO_LABEL, type Cliente, type Projeto } from '@/types'

function Dado({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{rotulo}</dt>
      <dd className="text-sm break-words">{valor || '—'}</dd>
    </div>
  )
}

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

  const { data: projetos, error } = await supabase
    .from('projetos')
    .select('*')
    .eq('cliente_id', id)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  const c = cliente as Cliente
  const lista = (projetos as Projeto[]) ?? []
  const novoProjeto = `/projetos/novo?clienteId=${c.id}`

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href="/clientes" />}>Clientes</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{c.nome}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar size="lg">
              <AvatarFallback>{iniciais(c.nome)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="truncate text-xl font-semibold tracking-tight">{c.nome}</h1>
                <Badge variant="outline">{c.tipo}</Badge>
              </div>
              <p className="text-muted-foreground truncate text-sm">
                {c.tipo === 'PF' ? 'Pessoa física' : c.razao_social || 'Pessoa jurídica'}
              </p>
            </div>
          </div>
          <Button nativeButton={false} render={<Link href={novoProjeto} />}>
            <PlusIcon data-icon="inline-start" />
            Novo projeto
          </Button>
        </header>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Frame spacing="default" className="min-w-0">
          <FrameHeader>
            <FrameTitle>Projetos</FrameTitle>
            <FrameDescription>
              {lista.length === 1 ? '1 obra' : `${lista.length} obras`} para este cliente
            </FrameDescription>
          </FrameHeader>
          <FramePanel>
            {lista.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FolderKanbanIcon />
                  </EmptyMedia>
                  <EmptyTitle>Nenhum projeto ainda</EmptyTitle>
                  <EmptyDescription>Abra a primeira obra deste cliente.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button nativeButton={false} render={<Link href={novoProjeto} />}>
                    <PlusIcon data-icon="inline-start" />
                    Novo projeto
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <ItemGroup>
                {lista.map((p) => {
                  const atrasado = projetoAtrasado(p)
                  return (
                    <Item key={p.id} render={<Link href={`/projetos/${p.id}`} />}>
                      <ItemContent className="min-w-0">
                        <ItemTitle className="truncate">{p.nome}</ItemTitle>
                        <ItemDescription className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
                          {atrasado && (
                            <>
                              <span className="text-destructive font-medium">Atrasado</span>
                              <span
                                aria-hidden
                                className="bg-muted-foreground/40 size-1 shrink-0 rounded-full"
                              />
                            </>
                          )}
                          <span>Prazo {formatarData(p.data_prazo)}</span>
                          {p.orcamento_total ? (
                            <>
                              <span
                                aria-hidden
                                className="bg-muted-foreground/40 size-1 shrink-0 rounded-full"
                              />
                              <span>{formatarMoeda(p.orcamento_total)}</span>
                            </>
                          ) : null}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions className="w-full gap-3 sm:w-56">
                        <Progress
                          value={p.percentual_conclusao}
                          aria-label={`Conclusão de ${p.nome}`}
                          className="flex-1 flex-nowrap items-center"
                        >
                          <span className="text-muted-foreground order-last w-9 shrink-0 text-end text-xs tabular-nums">
                            {p.percentual_conclusao}%
                          </span>
                        </Progress>
                        <Badge variant={VARIANTE_STATUS_PROJETO[p.status]}>
                          {STATUS_PROJETO_LABEL[p.status]}
                        </Badge>
                      </ItemActions>
                    </Item>
                  )
                })}
              </ItemGroup>
            )}
          </FramePanel>
        </Frame>

        <Frame spacing="default" className="min-w-0 self-start">
          <FrameHeader>
            <FrameTitle>Dados</FrameTitle>
          </FrameHeader>
          <FramePanel>
            <dl className="flex flex-col gap-4">
              {c.tipo === 'PJ' && <Dado rotulo="Razão social" valor={c.razao_social} />}
              <Dado rotulo={c.tipo === 'PF' ? 'CPF' : 'CNPJ'} valor={c.tipo === 'PF' ? c.cpf : c.cnpj} />
              <Dado rotulo="Telefone" valor={formatarTelefone(c.telefone)} />
              <Dado rotulo="E-mail" valor={c.email} />
              <Dado rotulo="Endereço" valor={c.endereco} />
              <Dado rotulo="Cliente desde" valor={formatarData(c.created_at)} />
            </dl>
          </FramePanel>
        </Frame>
      </div>
    </div>
  )
}
