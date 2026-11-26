'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowUpIcon,
  CheckIcon,
  CircleAlertIcon,
  MicIcon,
  SettingsIcon,
  SparklesIcon,
  SquareIcon,
  SquarePenIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useDitado } from '@/hooks/use-ditado'
import type {
  AcaoAssistente,
  ErroAssistente,
  MensagemHistorico,
  RespostaAssistente,
} from '@/lib/ia/protocolo'
import { TABELAS } from '@/lib/ia/ferramentas-rotulos'
import { ConfirmarExclusao } from '@/components/projetos/confirmar-exclusao'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { contextoDoFormulario, useRegistroFormularios } from './formulario-assistente'
import { Markdown } from './markdown'

type Excluir = Extract<AcaoAssistente, { tipo: 'excluir' }>

interface Mensagem extends MensagemHistorico {
  passos?: string[]
  erro?: boolean
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Sugestões de início, conforme a página aberta. */
function sugestoes(pagina: string, formulario: string | null): string[] {
  if (formulario) {
    return [`Preencher “${formulario}” por voz`, 'O que falta preencher?', 'Salvar']
  }
  if (pagina.startsWith('/projetos/') && pagina !== '/projetos/novo') {
    return ['Resumo desta obra', 'Adicionar uma etapa', 'Lançar uma compra']
  }
  if (pagina.startsWith('/clientes')) {
    return ['Listar meus clientes', 'Cadastrar um cliente', 'Quais clientes têm obra em andamento?']
  }
  return ['Quais obras estão em execução?', 'Cadastrar um projeto novo', 'Cadastrar um cliente']
}

// Assistente por voz: botão no topo abre um painel, o usuário fala (ou
// digita), a fala vai para a IA com o formulário aberto na tela, e a tela
// aplica o que a IA devolver. Exclusões sempre pedem confirmação aqui.
export function AssistenteVoz({ configurado }: { configurado: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const registro = useRegistroFormularios()
  const [aberto, setAberto] = useState(false)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [rascunho, setRascunho] = useState('')
  const [pensando, setPensando] = useState(false)
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
  const fim = useRef<HTMLDivElement>(null)

  const ditado = useDitado({
    onParcial: (t) => setRascunho(t),
    onFinal: (t) => {
      setRascunho('')
      void enviar(t)
    },
  })

  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [mensagens, pensando])

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
    if (!t || pensando) return
    const historico: MensagemHistorico[] = mensagens
      .filter((m) => !m.erro)
      .slice(-10)
      .map(({ papel, texto }) => ({ papel, texto }))
    setMensagens((m) => [...m, { papel: 'usuario', texto: t }])
    setRascunho('')
    setPensando(true)
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
      if (!r.ok || 'erro' in corpo) {
        const e = corpo as ErroAssistente
        if (e.semConfiguracao) setRecusado(true)
        setMensagens((m) => [
          ...m,
          { papel: 'assistente', texto: e.erro ?? 'Algo deu errado.', passos: e.passos, erro: true },
        ])
        if (e.acoes?.length) await aplicar(e.acoes)
        router.refresh()
        return
      }
      setMensagens((m) => [...m, { papel: 'assistente', texto: corpo.resposta, passos: corpo.passos }])
      await aplicar(corpo.acoes)
    } catch {
      setMensagens((m) => [...m, { papel: 'assistente', texto: 'Sem conexão. Tente de novo.', erro: true }])
    } finally {
      setPensando(false)
    }
  }

  async function confirmarExclusao(a: Excluir): Promise<boolean> {
    const { error } = await createClient().from(a.tabela).delete().eq('id', a.id)
    if (error) {
      toast.error(`Não foi possível excluir: ${error.message}`)
      return false
    }
    toast.success(`Excluído: ${a.descricao}`)
    setMensagens((m) => [...m, { papel: 'assistente', texto: `Excluí ${a.descricao}.` }])
    if (pathname.includes(a.id)) router.push(`/${a.tabela}`)
    router.refresh()
    return true
  }

  const exclusaoAtual = exclusoes[0]
  const formularioAtual = registro?.atual()?.titulo ?? null

  function abrirEFalar() {
    setAberto(true)
    if (!semConfig && ditado.suportado && !ditado.ouvindo) ditado.iniciar()
  }

  function novaConversa() {
    ditado.parar()
    setMensagens([])
    setRascunho('')
  }

  return (
    <>
      <Button
        type="button"
        variant={ditado.ouvindo ? 'default' : 'outline'}
        size="sm"
        className="ml-auto"
        onClick={abrirEFalar}
        aria-label="Falar com o assistente"
      >
        {ditado.ouvindo ? <MicIcon data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
        <span className="hidden sm:inline">{ditado.ouvindo ? 'Ouvindo…' : 'Assistente'}</span>
      </Button>

      <Sheet
        open={aberto}
        onOpenChange={(v) => {
          setAberto(v)
          if (!v) ditado.parar()
        }}
      >
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-lg" showCloseButton>
          {/* Cabeçalho enxuto, como no app do Claude */}
          <div className="flex h-14 shrink-0 items-center gap-2 border-b pr-12 pl-4">
            <SparklesIcon className="size-4 text-primary" aria-hidden />
            <SheetTitle className="text-sm font-semibold">Assistente</SheetTitle>
            <SheetDescription className="sr-only">
              Fale ou digite o que precisa. O assistente preenche, salva, edita e exclui por você.
            </SheetDescription>
            {mensagens.length > 0 && !semConfig && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="ml-auto"
                      onClick={novaConversa}
                      aria-label="Nova conversa"
                    />
                  }
                >
                  <SquarePenIcon />
                </TooltipTrigger>
                <TooltipContent>Nova conversa</TooltipContent>
              </Tooltip>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {semConfig ? (
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
                <Button nativeButton={false} render={<Link href="/ajustes" onClick={() => setAberto(false)} />}>
                  Abrir Ajustes
                </Button>
              </Empty>
            ) : mensagens.length === 0 && !rascunho ? (
              <div className="flex flex-1 flex-col justify-end gap-6 px-5 pb-6">
                <div className="flex flex-col gap-1.5">
                  <p className="text-2xl font-semibold tracking-tight">Como posso ajudar?</p>
                  <p className="text-sm text-muted-foreground">
                    {formularioAtual
                      ? `Você está em “${formularioAtual}”. Pode ditar tudo de uma vez que eu preencho.`
                      : 'Fale ou digite. Eu busco, cadastro, edito e preencho formulários por você.'}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {sugestoes(pathname, formularioAtual).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void enviar(s)}
                      className="rounded-xl border bg-card px-4 py-3 text-left text-sm transition-colors hover:bg-muted"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6 px-5 py-5">
                {mensagens.map((m, i) =>
                  m.papel === 'usuario' ? (
                    <div
                      key={i}
                      className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-muted px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
                    >
                      {m.texto}
                    </div>
                  ) : (
                    <div key={i} className="flex flex-col gap-3">
                      {m.passos && m.passos.length > 0 && (
                        <ul className="flex flex-col gap-1.5 border-l pl-3">
                          {m.passos.map((p, j) => (
                            <li key={j} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <CheckIcon className="size-3.5 shrink-0 text-success" aria-hidden />
                              {p}
                            </li>
                          ))}
                        </ul>
                      )}
                      {m.erro ? (
                        <p className="flex items-start gap-2 text-sm text-destructive">
                          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                          {m.texto}
                        </p>
                      ) : (
                        <Markdown texto={m.texto} />
                      )}
                    </div>
                  ),
                )}
                {rascunho && ditado.ouvindo && (
                  <div className="max-w-[85%] self-end rounded-2xl rounded-br-md border border-dashed px-4 py-2.5 text-sm text-muted-foreground">
                    {rascunho}
                  </div>
                )}
                {pensando && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                    <SparklesIcon className="size-4 animate-pulse text-primary" aria-hidden />
                    Pensando…
                  </div>
                )}
                <div ref={fim} />
              </div>
            )}
          </div>

          {!semConfig && (
            <form
              className="shrink-0 p-3 pt-0"
              onSubmit={(e) => {
                e.preventDefault()
                void enviar(rascunho)
              }}
            >
              <div
                className={cn(
                  'flex flex-col gap-1 rounded-3xl border bg-background px-4 pt-3 pb-2 shadow-sm transition-colors focus-within:border-ring',
                  ditado.ouvindo && 'border-primary',
                )}
              >
                <textarea
                  value={rascunho}
                  onChange={(e) => setRascunho(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void enviar(rascunho)
                    }
                  }}
                  placeholder={ditado.ouvindo ? 'Ouvindo…' : 'Fale ou digite'}
                  rows={1}
                  disabled={pensando}
                  aria-label="Mensagem para o assistente"
                  className="field-sizing-content max-h-40 min-h-6 w-full resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
                />
                <div className="flex items-center justify-end gap-1.5">
                  {ditado.ouvindo && (
                    <span className="mr-auto flex items-center gap-1.5 text-xs text-primary">
                      <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden />
                      Ouvindo, toque no quadrado para parar
                    </span>
                  )}
                  {ditado.suportado && (
                    <Button
                      type="button"
                      size="icon"
                      variant={ditado.ouvindo ? 'secondary' : 'ghost'}
                      className="rounded-full"
                      onClick={ditado.alternar}
                      disabled={pensando}
                      aria-pressed={ditado.ouvindo}
                      aria-label={ditado.ouvindo ? 'Parar de ouvir' : 'Falar'}
                    >
                      {ditado.ouvindo ? <SquareIcon /> : <MicIcon />}
                    </Button>
                  )}
                  <Button
                    type="submit"
                    size="icon"
                    className="rounded-full"
                    disabled={pensando || !rascunho.trim() || ditado.ouvindo}
                    aria-label="Enviar"
                  >
                    <ArrowUpIcon />
                  </Button>
                </div>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>

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
    </>
  )
}
