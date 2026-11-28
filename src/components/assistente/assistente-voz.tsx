'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowLeftIcon,
  ArrowUpIcon,
  CheckIcon,
  CircleAlertIcon,
  CopyIcon,
  MessageSquareIcon,
  MicIcon,
  SettingsIcon,
  SparklesIcon,
  SquareIcon,
  SquarePenIcon,
  Trash2Icon,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { BUCKET_FOTOS } from '@/lib/equipe'
import { useDitado } from '@/hooks/use-ditado'
import type {
  AcaoAssistente,
  ErroAssistente,
  MensagemHistorico,
  RespostaAssistente,
} from '@/lib/ia/protocolo'
import { TABELAS } from '@/lib/ia/ferramentas-rotulos'
import { ConfirmarExclusao } from '@/components/projetos/confirmar-exclusao'
import { Bubble, BubbleContent, BubbleGroup } from '@/components/ui/bubble'
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
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item'
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker'
import { Message, MessageContent, MessageFooter } from '@/components/ui/message'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import {
  adicionarMensagem,
  apagarConversa,
  marcarEscolha,
  novoId,
  obterConversa,
  sincronizarConversas,
  textoParaHistorico,
  useConversas,
  type Conversa,
} from './conversas'
import { CartaoObrasView } from './cartao-obras'
import { CartaoPergunta } from './cartao-pergunta'
import { contextoDoFormulario, useRegistroFormularios } from './formulario-assistente'
import { Markdown } from './markdown'

type Excluir = Extract<AcaoAssistente, { tipo: 'excluir' }>
/** 0 fechado, 1 lista de conversas, 2 conversa aberta. */
type Camada = 0 | 1 | 2

const semAssinatura = () => () => {}
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))
const REVELAR = 'duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-0'

function camadaDoHistorico(): Camada {
  const n = (window.history.state as { assistente?: number } | null)?.assistente
  return n === 1 || n === 2 ? n : 0
}

/** Sugestões de início, conforme a página aberta. */
function sugestoes(pagina: string, formulario: string | null): string[] {
  if (formulario) return [`Preencher “${formulario}” por voz`, 'O que falta preencher?', 'Salvar']
  if (pagina.startsWith('/projetos/') && pagina !== '/projetos/novo') {
    return ['Resumo desta obra', 'Adicionar uma etapa', 'Lançar uma compra']
  }
  if (pagina.startsWith('/clientes')) {
    return ['Listar meus clientes', 'Cadastrar um cliente', 'Quais clientes têm obra em andamento?']
  }
  return ['Quais obras estão em execução?', 'Cadastrar um projeto novo', 'Cadastrar um cliente']
}

function quando(ms: number) {
  const d = new Date(ms)
  if (d.toDateString() === new Date().toDateString()) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// Assistente em tela cheia, em camadas como o app do Claude no celular:
// a conversa fica por cima da lista de conversas, que fica por cima do app.
// A seta (e o "voltar" do celular) desce uma camada. O app continua montado
// por baixo, então o formulário aberto segue disponível para a IA preencher.
export function AssistenteVoz({ configurado, empresaId }: { configurado: boolean; empresaId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const registro = useRegistroFormularios()
  const conversas = useConversas()
  // O portal só existe no navegador.
  const montado = useSyncExternalStore(semAssinatura, () => true, () => false)
  const [camada, setCamada] = useState<Camada>(0)
  const [ativaId, setAtivaId] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState('')
  const [pensandoEm, setPensandoEm] = useState<string | null>(null)
  const [copiada, setCopiada] = useState<number | null>(null)
  // O servidor pode dizer que falta configuração mesmo com a prop true (ex.:
  // chave removida em outra aba). A recusa vale até a prop mudar.
  const [recusado, setRecusado] = useState(false)
  const [configuradoAntes, setConfiguradoAntes] = useState(configurado)
  if (configuradoAntes !== configurado) {
    setConfiguradoAntes(configurado)
    setRecusado(false)
  }
  const semConfig = !configurado || recusado
  const [exclusoes, setExclusoes] = useState<Excluir[]>([])
  const [apagando, setApagando] = useState<Conversa | null>(null)
  const gatilho = useRef<HTMLButtonElement>(null)
  const campo = useRef<HTMLTextAreaElement>(null)

  const ativa = conversas.find((c) => c.id === ativaId)
  const mensagens = ativa?.mensagens ?? []
  const pensando = pensandoEm !== null && pensandoEm === ativaId

  const ditado = useDitado({
    onParcial: (t) => setRascunho(t),
    onFinal: (t) => {
      setRascunho('')
      void enviar(t)
    },
  })

  // Traz as conversas salvas no Supabase (as de outros aparelhos).
  useEffect(() => {
    void sincronizarConversas(empresaId)
  }, [empresaId])

  // "Voltar" do navegador ou do celular desce uma camada.
  useEffect(() => {
    const aoVoltar = () => setCamada(camadaDoHistorico())
    window.addEventListener('popstate', aoVoltar)
    return () => window.removeEventListener('popstate', aoVoltar)
  }, [])

  // Com o assistente aberto, a página de baixo não rola.
  useEffect(() => {
    if (camada === 0) return
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = antes
    }
  }, [camada])

  const ditadoRef = useRef(ditado)
  useEffect(() => {
    ditadoRef.current = ditado
  })
  useEffect(() => {
    if (camada === 2 && !ditadoRef.current.ouvindo) campo.current?.focus({ preventScroll: true })
    if (camada === 0) gatilho.current?.focus({ preventScroll: true })
    if (camada !== 2) ditadoRef.current.parar()
  }, [camada])

  useEffect(() => {
    if (copiada === null) return
    const id = window.setTimeout(() => setCopiada(null), 1600)
    return () => window.clearTimeout(id)
  }, [copiada])

  function irPara(destino: Camada) {
    for (let n = camada + 1; n <= destino; n++) {
      window.history.pushState({ ...(window.history.state ?? {}), assistente: n }, '')
    }
    setCamada(destino)
  }

  function voltar() {
    if (camadaDoHistorico() > 0) window.history.back()
    else setCamada((c) => (c > 0 ? ((c - 1) as Camada) : 0))
  }

  function fechar() {
    const n = camadaDoHistorico()
    if (n > 0) window.history.go(-n)
    else setCamada(0)
  }

  function abrir() {
    setAtivaId(null)
    setRascunho('')
    irPara(2)
    if (!semConfig && ditado.suportado && !ditado.ouvindo) ditado.iniciar()
  }

  function abrirConversa(id: string | null) {
    setAtivaId(id)
    setRascunho('')
    irPara(2)
  }

  function novaConversa() {
    ditado.parar()
    setAtivaId(null)
    setRascunho('')
    campo.current?.focus()
  }

  async function aplicar(acoes: AcaoAssistente[]) {
    const novasExclusoes: Excluir[] = []
    let atualizar = false
    for (const a of acoes) {
      const form = registro?.atual()
      if (a.tipo === 'preencher') {
        if (form?.id === a.formularioId) form.preencher(a.valores)
      } else if (a.tipo === 'salvar') {
        // Espera a tela renderizar os valores preenchidos antes de salvar.
        await espera(80)
        const f = registro?.atual()
        if (f?.id === a.formularioId) f.salvar?.()
      } else if (a.tipo === 'excluir') {
        novasExclusoes.push(a)
      } else if (a.tipo === 'navegar') {
        // A IA abriu uma página para o usuário ver: sai do assistente.
        setCamada(0)
        router.push(a.caminho)
      } else if (a.tipo === 'atualizar') {
        atualizar = true
      }
    }
    if (atualizar) router.refresh()
    if (novasExclusoes.length) setExclusoes((atual) => [...atual, ...novasExclusoes])
  }

  async function enviar(texto: string) {
    const t = texto.trim()
    if (!t || pensandoEm) return
    const id = ativaId ?? novoId()
    const historico: MensagemHistorico[] = (obterConversa(id)?.mensagens ?? [])
      .filter((m) => !m.erro)
      .slice(-10)
      .map((m) => ({ papel: m.papel, texto: textoParaHistorico(m) }))
    adicionarMensagem(id, { papel: 'usuario', texto: t })
    setAtivaId(id)
    setRascunho('')
    setPensandoEm(id)
    try {
      const r = await fetch('/api/assistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texto: t,
          pagina: pathname,
          formulario: contextoDoFormulario(registro?.atual() ?? null),
          historico,
        }),
      })
      const corpo = (await r.json().catch(() => ({ erro: 'Resposta inválida do servidor.' }))) as
        | RespostaAssistente
        | ErroAssistente
      const acoes = corpo.acoes ?? []
      const mexeuNaTela = acoes.some((a) => a.tipo === 'preencher' || a.tipo === 'salvar')
      if (!r.ok || 'erro' in corpo) {
        const e = corpo as ErroAssistente
        if (e.semConfiguracao) setRecusado(true)
        adicionarMensagem(id, {
          papel: 'assistente',
          texto: e.erro ?? 'Algo deu errado.',
          passos: e.passos,
          erro: true,
          mexeuNaTela,
        })
        if (acoes.length) await aplicar(acoes)
        router.refresh()
        return
      }
      adicionarMensagem(id, {
        papel: 'assistente',
        texto: corpo.resposta,
        passos: corpo.passos,
        mexeuNaTela,
        pergunta: corpo.pergunta,
        obras: corpo.obras,
      })
      await aplicar(acoes)
    } catch {
      adicionarMensagem(id, { papel: 'assistente', texto: 'Sem conexão. Tente de novo.', erro: true })
    } finally {
      setPensandoEm(null)
    }
  }

  async function confirmarExclusao(a: Excluir): Promise<boolean> {
    const supabase = createClient()
    const { data: apagados, error } = await supabase.from(a.tabela).delete().eq('id', a.id).select('*')
    if (error) {
      toast.error(`Não foi possível excluir: ${error.message}`)
      return false
    }
    // Pessoa da equipe com foto: apaga também o arquivo no Storage.
    const foto = a.tabela === 'equipe' ? (apagados?.[0] as { foto_caminho?: string | null } | undefined)?.foto_caminho : null
    if (foto) await supabase.storage.from(BUCKET_FOTOS).remove([foto])
    toast.success(`Excluído: ${a.descricao}`)
    if (ativaId) adicionarMensagem(ativaId, { papel: 'assistente', texto: `Excluí **${a.descricao}**.` })
    if (pathname.includes(a.id)) router.push(`/${a.tabela}`)
    router.refresh()
    return true
  }

  function escolher(mensagem: number, opcao: number) {
    const p = mensagens[mensagem]?.pergunta
    if (!ativaId || !p || pensandoEm) return
    marcarEscolha(ativaId, mensagem, opcao)
    void enviar(p.opcoes[opcao].rotulo)
  }

  function copiar(i: number, texto: string) {
    void navigator.clipboard?.writeText?.(texto)
    setCopiada(i)
  }

  const exclusaoAtual = exclusoes[0]
  const formularioAtual = registro?.atual()?.titulo ?? null
  const aberto = camada > 0

  const cabecalho = (titulo: string, extra?: React.ReactNode) => (
    <header className="flex shrink-0 items-center gap-1 border-b px-2 pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 w-full items-center gap-1">
        <Button type="button" variant="ghost" size="icon-lg" onClick={voltar} aria-label="Voltar">
          <ArrowLeftIcon />
        </Button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">{titulo}</h2>
        {extra}
      </div>
    </header>
  )

  const botaoNovaConversa = (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      onClick={() => (camada === 2 ? novaConversa() : abrirConversa(null))}
      aria-label="Nova conversa"
      title="Nova conversa"
    >
      <SquarePenIcon />
    </Button>
  )

  const telaDesligado = (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SettingsIcon />
        </EmptyMedia>
        <EmptyTitle>Assistente desligado</EmptyTitle>
        <EmptyDescription>
          Cadastre uma chave da Anthropic, OpenAI ou DeepSeek em Ajustes para começar.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button nativeButton={false} render={<Link href="/ajustes" onClick={() => setCamada(0)} />}>
          Abrir Ajustes
        </Button>
      </EmptyContent>
    </Empty>
  )

  const lista = (
    <section
      aria-label="Conversas"
      inert={camada !== 1}
      className={cn(
        'absolute inset-0 flex flex-col bg-background transition-transform',
        REVELAR,
        camada === 2 && '-translate-x-1/4',
      )}
    >
      {cabecalho('Assistente', botaoNovaConversa)}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5">
          <Button type="button" size="lg" onClick={() => abrirConversa(null)}>
            <SquarePenIcon data-icon="inline-start" />
            Nova conversa
          </Button>
          {conversas.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessageSquareIcon />
                </EmptyMedia>
                <EmptyTitle>Nenhuma conversa ainda</EmptyTitle>
                <EmptyDescription>Nenhuma conversa ainda.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-1">
              <p className="px-3 text-xs font-medium text-muted-foreground">Recentes</p>
              <ItemGroup className="gap-0.5">
                {conversas.map((c) => (
                  <Item
                    key={c.id}
                    size="sm"
                    className="cursor-pointer hover:bg-muted"
                    render={<div role="button" tabIndex={0} />}
                    onClick={() => abrirConversa(c.id)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        abrirConversa(c.id)
                      }
                    }}
                  >
                    <ItemContent className="min-w-0">
                      <ItemTitle className="w-full truncate">{c.titulo}</ItemTitle>
                      <ItemDescription className="tabular-nums">{quando(c.atualizadaEm)}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Apagar conversa ${c.titulo}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setApagando(c)
                        }}
                      >
                        <Trash2Icon />
                      </Button>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            </div>
          )}
        </div>
      </div>
    </section>
  )

  const vazio = (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-end gap-6 px-4 pb-6">
        <div className="flex flex-col gap-1.5">
          <SparklesIcon className="size-6 text-primary" aria-hidden />
          <p className="text-2xl font-semibold tracking-tight">Como posso ajudar?</p>
          <p className="text-sm text-muted-foreground">
            {formularioAtual
              ? `Você está em “${formularioAtual}”. Pode ditar tudo de uma vez que eu preencho.`
              : 'Fale ou digite. Eu busco, cadastro, edito e preencho formulários por você.'}
          </p>
        </div>
        {/* Opções como balões clicáveis (@reui/c-bubble-6). */}
        <BubbleGroup aria-label="Sugestões">
          {sugestoes(pathname, formularioAtual).map((s) => (
            <Bubble key={s} variant="tinted" align="end">
              <BubbleContent render={<button type="button" onClick={() => void enviar(s)} />}>
                {s}
              </BubbleContent>
            </Bubble>
          ))}
        </BubbleGroup>
      </div>
    </div>
  )

  const transcricao = (
    <MessageScrollerProvider key={ativaId ?? 'nova'}>
      <MessageScroller className="min-h-0 flex-1">
        <MessageScrollerViewport aria-label="Conversa com o assistente">
          <MessageScrollerContent className="mx-auto w-full max-w-2xl gap-6 px-4 py-5">
            {mensagens.map((m, i) => {
              const usuario = m.papel === 'usuario'
              return (
                <MessageScrollerItem key={i} messageId={`m${i}`} scrollAnchor={usuario}>
                  <Message align={usuario ? 'end' : 'start'}>
                    <MessageContent>
                      {!usuario && m.passos && m.passos.length > 0 && (
                        <div data-slot="passos" className="flex flex-col gap-1.5">
                          {m.passos.map((p, j) => (
                            <Marker key={j} className="text-xs">
                              <MarkerIcon>
                                <CheckIcon className="size-3.5" />
                              </MarkerIcon>
                              <MarkerContent>{p}</MarkerContent>
                            </Marker>
                          ))}
                        </div>
                      )}
                      {usuario ? (
                        <Bubble variant="muted" align="end">
                          <BubbleContent className="whitespace-pre-wrap">{m.texto}</BubbleContent>
                        </Bubble>
                      ) : m.erro ? (
                        <Bubble variant="destructive">
                          <BubbleContent className="flex items-start gap-2">
                            <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                            {m.texto}
                          </BubbleContent>
                        </Bubble>
                      ) : (
                        <>
                          {m.texto && (
                            <Bubble variant="ghost">
                              <BubbleContent>
                                <Markdown texto={m.texto} />
                              </BubbleContent>
                            </Bubble>
                          )}
                          {m.obras && <CartaoObrasView cartao={m.obras} onAbrir={() => setCamada(0)} />}
                          {m.pergunta && (
                            <CartaoPergunta
                              pergunta={m.pergunta}
                              escolhida={m.escolhida}
                              onEscolher={
                                i === mensagens.length - 1 && !pensando ? (o) => escolher(i, o) : undefined
                              }
                            />
                          )}
                        </>
                      )}
                      {!usuario && !m.erro && m.texto && (
                        <MessageFooter className="gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={copiada === i ? 'Resposta copiada' : 'Copiar resposta'}
                            title={copiada === i ? 'Copiada' : 'Copiar'}
                            onClick={() => copiar(i, m.texto)}
                          >
                            {copiada === i ? <CheckIcon /> : <CopyIcon />}
                          </Button>
                          {m.mexeuNaTela && (
                            <Button type="button" variant="outline" size="xs" onClick={fechar}>
                              Ver na tela
                            </Button>
                          )}
                        </MessageFooter>
                      )}
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              )
            })}
            {rascunho && ditado.ouvindo && (
              <MessageScrollerItem messageId="rascunho">
                <Message align="end">
                  <MessageContent>
                    <Bubble variant="outline" align="end">
                      <BubbleContent className="text-muted-foreground">{rascunho}</BubbleContent>
                    </Bubble>
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            )}
            {pensando && (
              // Resposta pendente (@reui/c-message-7).
              <MessageScrollerItem messageId="pensando">
                <Message>
                  <MessageContent>
                    <span role="status" className="sr-only">
                      Gerando resposta
                    </span>
                    <Bubble variant="ghost" aria-busy>
                      <BubbleContent>
                        <Marker>
                          <MarkerIcon>
                            <Spinner />
                          </MarkerIcon>
                          <MarkerContent>
                            <span className="animate-pulse motion-reduce:animate-none">Pensando…</span>
                          </MarkerContent>
                        </Marker>
                      </BubbleContent>
                    </Bubble>
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton variant="outline" className="rounded-full" />
      </MessageScroller>
    </MessageScrollerProvider>
  )

  const composer = (
    <form
      className="mx-auto w-full max-w-2xl shrink-0 px-3 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      onSubmit={(e) => {
        e.preventDefault()
        void enviar(rascunho)
      }}
    >
      <InputGroup className={cn('rounded-3xl bg-background', ditado.ouvindo && 'border-primary')}>
        <InputGroupTextarea
          ref={campo}
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void enviar(rascunho)
            }
          }}
          placeholder={ditado.ouvindo ? 'Ouvindo…' : 'Fale ou digite'}
          rows={1}
          disabled={pensando}
          aria-label="Mensagem para o assistente"
          className="max-h-40 min-h-11 px-4 pt-3 text-base md:text-sm"
        />
        <InputGroupAddon align="block-end" className="gap-1.5">
          {ditado.ouvindo && (
            <span className="flex items-center gap-1.5 text-xs text-primary">
              <span
                className="size-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
                aria-hidden
              />
              Ouvindo
            </span>
          )}
          <span className="flex-1" />
          {ditado.suportado && (
            <InputGroupButton
              size="icon-sm"
              variant={ditado.ouvindo ? 'secondary' : 'ghost'}
              className="rounded-full"
              onClick={ditado.alternar}
              disabled={pensando}
              aria-pressed={ditado.ouvindo}
              aria-label={ditado.ouvindo ? 'Parar de ouvir' : 'Falar'}
            >
              {ditado.ouvindo ? <SquareIcon /> : <MicIcon />}
            </InputGroupButton>
          )}
          <InputGroupButton
            type="submit"
            size="icon-sm"
            variant="default"
            className="rounded-full"
            disabled={pensando || !rascunho.trim() || ditado.ouvindo}
            aria-label="Enviar"
          >
            <ArrowUpIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  )

  const conversa = (
    <section
      aria-label="Conversa"
      inert={camada !== 2}
      className={cn(
        'absolute inset-0 flex flex-col bg-background transition-transform',
        REVELAR,
        camada !== 2 && 'translate-x-full',
      )}
    >
      {cabecalho(
        ativa?.titulo ?? 'Nova conversa',
        !semConfig && mensagens.length > 0 ? botaoNovaConversa : undefined,
      )}
      {semConfig ? (
        telaDesligado
      ) : (
        <>
          {mensagens.length === 0 && !rascunho ? vazio : transcricao}
          {composer}
        </>
      )}
    </section>
  )

  return (
    <>
      <Button
        ref={gatilho}
        type="button"
        variant="outline"
        size="sm"
        className="ml-auto"
        onClick={abrir}
        aria-label="Abrir o assistente"
      >
        <SparklesIcon data-icon="inline-start" />
        <span className="hidden sm:inline">Assistente</span>
      </Button>

      {montado &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Assistente"
            inert={!aberto}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !e.defaultPrevented) {
                e.preventDefault()
                voltar()
              }
            }}
            className={cn(
              'fixed inset-0 z-50 overflow-hidden bg-background transition-[opacity,transform,visibility]',
              REVELAR,
              aberto ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-4 opacity-0',
            )}
          >
            {lista}
            {conversa}
          </div>,
          document.body,
        )}

      {exclusaoAtual && (
        <ConfirmarExclusao
          aberto
          onOpenChange={(v) => {
            if (!v) setExclusoes((l) => l.slice(1))
          }}
          titulo={`Excluir ${TABELAS[exclusaoAtual.tabela]}?`}
          descricao={`O assistente pediu para excluir ${exclusaoAtual.descricao}. Isso não pode ser desfeito.`}
          onConfirmar={() => confirmarExclusao(exclusaoAtual)}
        />
      )}

      {apagando && (
        <ConfirmarExclusao
          aberto
          onOpenChange={(v) => {
            if (!v) setApagando(null)
          }}
          titulo="Apagar conversa?"
          descricao={`“${apagando.titulo}” sai deste aparelho. Os dados da empresa não mudam.`}
          rotulo="Apagar"
          onConfirmar={async () => {
            apagarConversa(apagando.id)
            if (ativaId === apagando.id) setAtivaId(null)
            return true
          }}
        />
      )}
    </>
  )
}
