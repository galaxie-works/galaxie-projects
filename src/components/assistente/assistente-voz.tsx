'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { MicIcon, SendIcon, SettingsIcon, SparklesIcon, SquareIcon } from 'lucide-react'
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
import { InputGroup, InputGroupAddon, InputGroupTextarea } from '@/components/ui/input-group'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { contextoDoFormulario, useRegistroFormularios } from './formulario-assistente'

type Excluir = Extract<AcaoAssistente, { tipo: 'excluir' }>

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Assistente por voz: botão no topo abre um painel, o usuário fala (ou
// digita), a fala vai para a IA com o formulário aberto na tela, e a tela
// aplica o que a IA devolver. Exclusões sempre pedem confirmação aqui.
export function AssistenteVoz({ configurado }: { configurado: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const registro = useRegistroFormularios()
  const [aberto, setAberto] = useState(false)
  const [mensagens, setMensagens] = useState<MensagemHistorico[]>([])
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
    fim.current?.scrollIntoView({ block: 'end' })
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
    const historico = mensagens.slice(-10)
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
        setMensagens((m) => [...m, { papel: 'assistente', texto: e.erro ?? 'Algo deu errado.' }])
        if (e.acoes?.length) await aplicar(e.acoes)
        router.refresh()
        return
      }
      setMensagens((m) => [...m, { papel: 'assistente', texto: corpo.resposta }])
      await aplicar(corpo.acoes)
    } catch {
      setMensagens((m) => [...m, { papel: 'assistente', texto: 'Sem conexão. Tente de novo.' }])
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
    if (pathname.includes(a.id)) router.push(`/${a.tabela === 'equipe' ? 'equipe' : a.tabela}`)
    router.refresh()
    return true
  }

  const exclusaoAtual = exclusoes[0]

  function abrirEFalar() {
    setAberto(true)
    if (!semConfig && ditado.suportado && !ditado.ouvindo) ditado.iniciar()
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
        <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle className="flex items-center gap-2">
              <SparklesIcon className="size-4" aria-hidden />
              Assistente
            </SheetTitle>
            <SheetDescription>
              Fale o que precisa: “cadastra a cliente Ana, telefone…”, “muda o prazo da obra da Rua das
              Acácias para 20 de março”, “salva”.
            </SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            {semConfig ? (
              <Empty>
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
              <p className="text-muted-foreground text-sm">
                {registro?.atual()
                  ? `Formulário aberto: ${registro.atual()?.titulo}. Pode ditar os dados de uma vez.`
                  : 'Toque no microfone e fale.'}
              </p>
            ) : (
              mensagens.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    'max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                    m.papel === 'usuario'
                      ? 'self-end bg-primary text-primary-foreground'
                      : 'self-start bg-muted',
                  )}
                >
                  {m.texto}
                </div>
              ))
            )}
            {rascunho && ditado.ouvindo && (
              <div className="self-end max-w-[85%] rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                {rascunho}
              </div>
            )}
            {pensando && (
              <div className="flex items-center gap-2 self-start text-sm text-muted-foreground">
                <Spinner />
                Pensando…
              </div>
            )}
            <div ref={fim} />
          </div>

          {!semConfig && (
            <form
              className="border-t p-3"
              onSubmit={(e) => {
                e.preventDefault()
                void enviar(rascunho)
              }}
            >
              <InputGroup>
                <InputGroupTextarea
                  value={rascunho}
                  onChange={(e) => setRascunho(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void enviar(rascunho)
                    }
                  }}
                  placeholder={ditado.ouvindo ? 'Ouvindo…' : 'Fale ou digite'}
                  rows={2}
                  disabled={pensando}
                />
                <InputGroupAddon align="block-end" className="justify-end gap-1">
                  {ditado.suportado && (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant={ditado.ouvindo ? 'default' : 'ghost'}
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
                    size="icon-sm"
                    disabled={pensando || !rascunho.trim() || ditado.ouvindo}
                    aria-label="Enviar"
                  >
                    <SendIcon />
                  </Button>
                </InputGroupAddon>
              </InputGroup>
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
