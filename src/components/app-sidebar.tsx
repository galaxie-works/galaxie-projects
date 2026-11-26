'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Fragment, useMemo, useState } from 'react'
import {
  BriefcaseBusinessIcon,
  Building2Icon,
  ChevronsUpDownIcon,
  FolderKanbanIcon,
  LogOutIcon,
  PlusIcon,
  UsersIcon,
  HardHatIcon,
  SettingsIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { iniciais } from '@/lib/formato'
import { STATUS_PROJETO_LABEL, type Projeto, type StatusProjeto } from '@/types'
import { AssistenteVoz } from '@/components/assistente/assistente-voz'
import { IconTile } from '@/components/reui/icon-tile'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar'

// Cor do ponto de status (identidade do status, via tokens semânticos).
const PONTO_STATUS: Record<StatusProjeto, string> = {
  planejamento: 'bg-info',
  em_execucao: 'bg-primary',
  pausado: 'bg-warning',
  completo: 'bg-success',
}

type FiltroStatus = StatusProjeto | 'todos'

const ITENS_FILTRO: { value: FiltroStatus; label: string }[] = [
  { value: 'todos', label: 'Todos os status' },
  ...(Object.entries(STATUS_PROJETO_LABEL) as [StatusProjeto, string][]).map(
    ([value, label]) => ({ value, label })
  ),
]

const NAVEGACAO = [
  { href: '/projetos', rotulo: 'Projetos', icone: FolderKanbanIcon },
  { href: '/clientes', rotulo: 'Clientes', icone: BriefcaseBusinessIcon },
  { href: '/equipe', rotulo: 'Equipe', icone: UsersIcon },
  { href: '/empresa', rotulo: 'Empresa', icone: Building2Icon },
  { href: '/ajustes', rotulo: 'Ajustes', icone: SettingsIcon },
]

type Props = {
  empresaNome: string
  email: string
  projetos: Projeto[]
}

export function AppSidebar({ empresaNome, email, projetos }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [filtro, setFiltro] = useState<FiltroStatus>('todos')

  const projetosFiltrados = useMemo(
    () => (filtro === 'todos' ? projetos : projetos.filter((p) => p.status === filtro)),
    [projetos, filtro]
  )

  async function sair() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/projetos" />}>
              <IconTile variant="solid" size="sm" aria-hidden>
                <HardHatIcon />
              </IconTile>
              <span className="flex min-w-0 flex-col gap-0.5 leading-none">
                <span className="truncate font-semibold tracking-tight">{empresaNome}</span>
                <span className="truncate text-xs text-muted-foreground">Galaxie Obras</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAVEGACAO.map(({ href, rotulo, icone: Icone }) => {
                const ativo =
                  href === '/projetos' ? pathname === '/projetos' : pathname.startsWith(href)
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      isActive={ativo}
                      render={<Link href={href} aria-current={ativo ? 'page' : undefined} />}
                    >
                      <Icone />
                      <span>{rotulo}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="min-h-0 flex-1">
          <SidebarGroupLabel>Obras</SidebarGroupLabel>
          <SidebarGroupAction
            render={<Link href="/projetos/novo" />}
            aria-label="Novo projeto"
            title="Novo projeto"
          >
            <PlusIcon />
          </SidebarGroupAction>
          <SidebarGroupContent className="flex min-h-0 flex-col gap-2">
            <Select
              items={ITENS_FILTRO}
              value={filtro}
              onValueChange={(v) => setFiltro((v as FiltroStatus | null) ?? 'todos')}
            >
              <SelectTrigger size="sm" className="w-full" aria-label="Filtrar obras por status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITENS_FILTRO.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {projetosFiltrados.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                {projetos.length === 0 ? 'Nenhuma obra cadastrada ainda.' : 'Nenhuma obra neste status.'}
              </p>
            ) : (
              <SidebarMenu>
                {projetosFiltrados.map((p) => {
                  const ativo = pathname === `/projetos/${p.id}`
                  return (
                    <SidebarMenuItem key={p.id}>
                      <SidebarMenuButton
                        size="lg"
                        isActive={ativo}
                        render={
                          <Link
                            href={`/projetos/${p.id}`}
                            aria-current={ativo ? 'page' : undefined}
                          />
                        }
                      >
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              aria-hidden
                              className={cn('size-1.5 shrink-0 rounded-full', PONTO_STATUS[p.status])}
                            />
                            <span className="truncate">{p.nome}</span>
                            <span className="sr-only">{STATUS_PROJETO_LABEL[p.status]}</span>
                          </span>
                          <span className="flex min-w-0 items-center justify-between gap-2 pl-3.5 text-xs text-muted-foreground">
                            <span className="truncate">{p.clientes?.nome ?? 'Sem cliente'}</span>
                            <span className="shrink-0 tabular-nums">{p.percentual_conclusao}%</span>
                          </span>
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
                <Avatar className="size-8">
                  <AvatarFallback>{iniciais(empresaNome) || '?'}</AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-none">
                  <span className="truncate font-medium">{empresaNome}</span>
                  <span className="truncate text-xs text-muted-foreground">{email}</span>
                </span>
                <ChevronsUpDownIcon className="ml-auto" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="min-w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href="/empresa" />}>
                  <Building2Icon />
                  Dados da empresa
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={sair}>
                  <LogOutIcon />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

const SECOES: Record<string, string> = {
  projetos: 'Projetos',
  clientes: 'Clientes',
  equipe: 'Equipe',
  empresa: 'Empresa',
  ajustes: 'Ajustes',
}

// Cabeçalho fino do conteúdo: botão da sidebar + trilha de navegação.
export function AppHeader({
  projetos,
  assistenteConfigurado,
  empresaId,
}: {
  projetos: Pick<Projeto, 'id' | 'nome'>[]
  assistenteConfigurado: boolean
  empresaId: string
}) {
  const pathname = usePathname()
  const [secao, sub] = pathname.split('/').filter(Boolean)

  const trilha: { rotulo: string; href?: string }[] = []
  if (secao && SECOES[secao]) {
    trilha.push({ rotulo: SECOES[secao], href: sub ? `/${secao}` : undefined })
    if (sub === 'novo') {
      trilha.push({ rotulo: secao === 'projetos' ? 'Novo projeto' : 'Novo cadastro' })
    } else if (sub) {
      const nome =
        secao === 'projetos' ? projetos.find((p) => p.id === sub)?.nome : undefined
      trilha.push({ rotulo: nome ?? 'Detalhes' })
    }
  }

  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="my-auto h-4" />
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap">
          {trilha.map((item, i) => (
            <Fragment key={`${item.rotulo}-${i}`}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem className="min-w-0">
                {item.href ? (
                  <BreadcrumbLink render={<Link href={item.href} />}>{item.rotulo}</BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="truncate">{item.rotulo}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <AssistenteVoz configurado={assistenteConfigurado} empresaId={empresaId} />
    </header>
  )
}
