'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Fragment, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import {
  ArrowLeftIcon,
  BriefcaseBusinessIcon,
  CalendarDaysIcon,
  HouseIcon,
  Building2Icon,
  FunnelIcon,
  ChevronsUpDownIcon,
  KeyRoundIcon,
  CircleUserRoundIcon,
  FolderKanbanIcon,
  LogOutIcon,
  NotebookPenIcon,
  PlusIcon,
  UsersIcon,
  HardHatIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SparklesIcon,
  WalletIcon,
} from 'lucide-react'
import { textoDiasRestantes } from '@/lib/assinatura'
import { limparPaginasOffline } from '@/components/pwa/registrar-sw'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { iniciais } from '@/lib/formato'
import { STATUS_PROJETO_LABEL, type Projeto, type StatusProjeto } from '@/types'
import { AssistenteVoz } from '@/components/assistente/assistente-voz'
import { BuscaGlobal } from '@/components/busca/busca-global'
import { IconTile } from '@/components/reui/icon-tile'
import { MenuTema } from '@/components/tema/menu-tema'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
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
  useSidebar,
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
  { href: '/inicio', rotulo: 'Início', icone: HouseIcon },
  { href: '/agenda', rotulo: 'Agenda', icone: CalendarDaysIcon },
  { href: '/projetos', rotulo: 'Projetos', icone: FolderKanbanIcon },
  { href: '/diario', rotulo: 'Diário de obra', icone: NotebookPenIcon },
  { href: '/funil', rotulo: 'Funil', icone: FunnelIcon },
  { href: '/clientes', rotulo: 'Clientes', icone: BriefcaseBusinessIcon },
  { href: '/financeiro', rotulo: 'Financeiro', icone: WalletIcon },
  { href: '/equipe', rotulo: 'Equipe', icone: UsersIcon },
]

/** O que quem está logado pode abrir (vem das permissões; o dono vê tudo). */
export type MenuPermitido = {
  modulos: string[]
  empresa: boolean
  assinatura: boolean
  acessos: boolean
}

// Rota do menu → módulo de permissão. Rotas fora da lista aparecem para todos.
const MODULO_DA_ROTA: Record<string, string> = {
  '/agenda': 'agenda',
  '/projetos': 'obras',
  '/diario': 'diario',
  '/funil': 'negocios',
  '/clientes': 'clientes',
  '/financeiro': 'financeiro',
  '/equipe': 'equipe',
}

type Props = {
  empresaNome: string
  email: string
  projetos: Projeto[]
  /** Teste grátis em andamento (null quando já assinou ou é cortesia). */
  teste: { dias: number; progresso: number } | null
  /** Dono da plataforma: vê o painel do admin master. */
  adminMaster?: boolean
  /** URL assinada do logo da empresa (no topo do menu). */
  logoUrl?: string | null
  /** Quem está logado: nome e foto de Minha conta. */
  usuario?: { nome: string | null; fotoUrl: string | null }
  /** Sem isto, mostra tudo (dono). */
  permitido?: MenuPermitido
}

export function AppSidebar({
  empresaNome,
  email,
  projetos,
  teste,
  adminMaster = false,
  logoUrl = null,
  usuario,
  permitido,
}: Props) {
  const rotaVisivel = (href: string) => {
    const modulo = MODULO_DA_ROTA[href]
    return !permitido || !modulo || permitido.modulos.includes(modulo)
  }
  // Sem nome em Minha conta: o dono aparece como a empresa; quem foi
  // convidado, pelo começo do e-mail.
  const nomeExibido = usuario?.nome || (permitido ? email.split('@')[0] : empresaNome)
  const pathname = usePathname()
  const router = useRouter()
  const [filtro, setFiltro] = useState<FiltroStatus>('todos')
  const { isMobile, setOpenMobile } = useSidebar()

  // No celular o menu é uma gaveta: ao tocar num link, ela fecha sozinha.
  function fecharSeLink(evento: MouseEvent<HTMLDivElement>) {
    if (isMobile && (evento.target as HTMLElement).closest('a')) setOpenMobile(false)
  }

  const projetosFiltrados = useMemo(
    () => (filtro === 'todos' ? projetos : projetos.filter((p) => p.status === filtro)),
    [projetos, filtro]
  )

  async function sair() {
    limparPaginasOffline()
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <Sidebar>
      <div className="contents" onClick={fecharSeLink}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/inicio" />}>
              {logoUrl ? (
                <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="" className="size-full object-contain" />
                </span>
              ) : (
                <IconTile variant="solid" size="sm" aria-hidden>
                  <HardHatIcon />
                </IconTile>
              )}
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
              {NAVEGACAO.filter((n) => rotaVisivel(n.href)).map(({ href, rotulo, icone: Icone }) => {
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

        {rotaVisivel('/projetos') && (
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
        )}
      </SidebarContent>

      <SidebarFooter>
        {teste && (!permitido || permitido.assinatura) && (
          <Link
            href="/assinatura"
            className="flex flex-col gap-2 rounded-md border bg-card p-3 text-card-foreground transition-colors hover:bg-accent group-data-[collapsible=icon]:hidden"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <SparklesIcon className="size-4 text-primary" aria-hidden />
              Teste grátis
              <span className="ml-auto text-xs font-normal text-muted-foreground tabular-nums">
                {textoDiasRestantes(teste.dias)}
              </span>
            </span>
            <Progress value={teste.progresso} aria-label="Quanto do teste grátis já passou" />
            <span className="text-xs text-muted-foreground">Ver planos e assinatura</span>
          </Link>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    isActive={pathname.startsWith('/empresa') ||
                      pathname.startsWith('/conta') ||
                      pathname.startsWith('/acessos') ||
                      pathname.startsWith('/ajustes') ||
                      pathname.startsWith('/assinatura')}
                  />
                }
              >
                <Avatar className="size-8">
                  {usuario?.fotoUrl && <AvatarImage src={usuario.fotoUrl} alt="" />}
                  <AvatarFallback>{iniciais(nomeExibido) || '?'}</AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-none">
                  <span className="truncate font-medium">{nomeExibido}</span>
                  <span className="truncate text-xs text-muted-foreground">{email}</span>
                </span>
                <ChevronsUpDownIcon className="ml-auto" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="min-w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  render={<Link href="/conta" />}
                  onClick={() => isMobile && setOpenMobile(false)}
                >
                  <CircleUserRoundIcon />
                  Minha conta
                </DropdownMenuItem>
                {(!permitido || permitido.empresa) && (
                  <DropdownMenuItem
                    render={<Link href="/empresa" />}
                    onClick={() => isMobile && setOpenMobile(false)}
                  >
                    <Building2Icon />
                    Empresa
                  </DropdownMenuItem>
                )}
                {(!permitido || permitido.acessos) && (
                  <DropdownMenuItem
                    render={<Link href="/acessos" />}
                    onClick={() => isMobile && setOpenMobile(false)}
                  >
                    <KeyRoundIcon />
                    Acessos da equipe
                  </DropdownMenuItem>
                )}
                {(!permitido || permitido.empresa) && (
                  <DropdownMenuItem
                    render={<Link href="/ajustes" />}
                    onClick={() => isMobile && setOpenMobile(false)}
                  >
                    <SettingsIcon />
                    Ajustes
                  </DropdownMenuItem>
                )}
                {(!permitido || permitido.assinatura) && (
                  <DropdownMenuItem
                    render={<Link href="/assinatura" />}
                    onClick={() => isMobile && setOpenMobile(false)}
                  >
                    <SparklesIcon />
                    Assinatura
                  </DropdownMenuItem>
                )}
                {adminMaster && (
                  <DropdownMenuItem
                    render={<Link href="/admin" />}
                    onClick={() => isMobile && setOpenMobile(false)}
                  >
                    <ShieldCheckIcon />
                    Admin master
                  </DropdownMenuItem>
                )}
                <MenuTema />
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
      </div>
      <SidebarRail />
    </Sidebar>
  )
}

const SECOES: Record<string, string> = {
  inicio: 'Início',
  agenda: 'Agenda',
  projetos: 'Projetos',
  diario: 'Diário de obra',
  funil: 'Funil',
  clientes: 'Clientes',
  financeiro: 'Financeiro',
  equipe: 'Equipe',
  empresa: 'Empresa',
  conta: 'Minha conta',
  acessos: 'Acessos',
  ajustes: 'Ajustes',
  assinatura: 'Assinatura',
  admin: 'Admin master',
}

type Camada = { id: string; nome: string }

// Cabeçalho fino do conteúdo. Navegação em camadas: em telas de detalhe
// aparece a seta de voltar, que desce uma camada (como no app do Claude no
// celular). No celular a camada atual vira o título; no computador fica a trilha.
export function AppHeader({
  projetos,
  clientes,
  assistenteConfigurado,
  empresaId,
}: {
  projetos: Camada[]
  clientes: Camada[]
  assistenteConfigurado: boolean
  empresaId: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [secao, sub] = pathname.split('/').filter(Boolean)

  // Quantas telas foram vistas nesta sessão do app: com mais de uma, voltar
  // usa o histórico (mantém filtro e rolagem da tela anterior).
  const telasVistas = useRef(0)
  useEffect(() => {
    telasVistas.current += 1
  }, [pathname])

  const trilha: { rotulo: string; href?: string }[] = []
  if (secao && SECOES[secao]) {
    trilha.push({ rotulo: SECOES[secao], href: sub ? `/${secao}` : undefined })
    if (sub === 'novo') {
      trilha.push({
        rotulo: secao === 'projetos' ? 'Novo projeto' : secao === 'equipe' ? 'Nova pessoa' : 'Novo cadastro',
      })
    } else if (sub === 'importar') {
      trilha.push({ rotulo: 'Importar planilha' })
    } else if (sub) {
      const lista = secao === 'projetos' ? projetos : secao === 'clientes' ? clientes : []
      trilha.push({ rotulo: lista.find((p) => p.id === sub)?.nome ?? (secao === 'funil' ? 'Negócio' : secao === 'equipe' ? 'Pessoa' : 'Detalhes') })
    }
  }
  const emCamada = Boolean(sub) && Boolean(SECOES[secao ?? ''])
  const atual = trilha.at(-1)?.rotulo

  function voltar() {
    if (telasVistas.current > 1) router.back()
    else router.push(`/${secao}`)
  }

  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
      {emCamada ? (
        <Button variant="ghost" size="icon-sm" className="-ml-1.5" onClick={voltar} aria-label="Voltar">
          <ArrowLeftIcon />
        </Button>
      ) : null}
      <SidebarTrigger className={cn('-ml-1', emCamada && 'max-md:hidden')} />
      <Separator orientation="vertical" className={cn('my-auto h-4', emCamada && 'max-md:hidden')} />
      {emCamada && atual && (
        <span className="min-w-0 truncate text-sm font-medium md:hidden">{atual}</span>
      )}
      <Breadcrumb className={cn('min-w-0', emCamada && 'max-md:hidden')}>
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
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <BuscaGlobal empresaId={empresaId} />
        <AssistenteVoz configurado={assistenteConfigurado} empresaId={empresaId} />
      </div>
    </header>
  )
}
