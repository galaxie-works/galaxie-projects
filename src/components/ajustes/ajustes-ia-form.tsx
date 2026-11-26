'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlertIcon, ExternalLinkIcon, KeyRoundIcon, SparklesIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { alternarAssistente, removerChaveIA, salvarConfigIA } from '@/app/(dashboard)/ajustes/actions'
import { Alert, AlertDescription, AlertTitle } from '@/components/reui/alert'
import { Badge } from '@/components/reui/badge'
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'
import { ConfirmarExclusao } from '@/components/projetos/confirmar-exclusao'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  LISTA_PROVEDORES,
  PROVEDORES,
  type ConfigIAPublica,
  type ProvedorIA,
} from '@/lib/ia/provedores'

type Props = { config: ConfigIAPublica | null; servidorPronto: boolean }

export function AjustesIAForm({ config, servidorPronto }: Props) {
  const router = useRouter()
  const [provedor, setProvedor] = useState<ProvedorIA>(config?.provedor ?? 'anthropic')
  const [modelo, setModelo] = useState(config?.modelo ?? PROVEDORES.anthropic.modeloPadrao)
  const [chave, setChave] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [confirmarRemocao, setConfirmarRemocao] = useState(false)
  const [salvando, iniciarSalvar] = useTransition()
  const [alternando, iniciarAlternar] = useTransition()

  const info = PROVEDORES[provedor]
  const trocouProvedor = !!config && config.provedor !== provedor
  const precisaChave = !config || trocouProvedor
  const modelos = info.modelos.some((m) => m.id === modelo)
    ? info.modelos
    : [...info.modelos, { id: modelo, nome: modelo, descricao: 'Modelo personalizado' }]

  function escolherProvedor(p: ProvedorIA) {
    setProvedor(p)
    setModelo(config?.provedor === p ? config.modelo : PROVEDORES[p].modeloPadrao)
    setErro(null)
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (precisaChave && !chave.trim()) {
      setErro(`Cole a chave de API da ${info.nome}.`)
      return
    }
    iniciarSalvar(async () => {
      const r = await salvarConfigIA({ provedor, modelo, chave: chave.trim() || undefined })
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      setChave('')
      toast.success(r.mensagem)
      router.refresh()
    })
  }

  function alternar(ativo: boolean) {
    iniciarAlternar(async () => {
      const r = await alternarAssistente(ativo)
      if (!r.ok) toast.error(r.erro)
      else {
        toast.success(r.mensagem)
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={salvar} noValidate>
      <Frame spacing="default">
        <FrameHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <FrameTitle className="flex items-center gap-2">
                <SparklesIcon className="size-4" aria-hidden />
                Assistente de IA
              </FrameTitle>
              <FrameDescription>
                Use a sua própria chave da Anthropic, OpenAI ou DeepSeek. O uso é cobrado pelo provedor
                na sua conta.
              </FrameDescription>
            </div>
            {config ? (
              config.ativo ? (
                <Badge variant="success-light">Ligado</Badge>
              ) : (
                <Badge variant="warning-light">Desligado</Badge>
              )
            ) : (
              <Badge variant="outline">Não configurado</Badge>
            )}
          </div>
        </FrameHeader>
        <FramePanel>
          <FieldGroup>
            {!servidorPronto && (
              <Alert variant="warning">
                <CircleAlertIcon />
                <AlertTitle>Falta um passo no servidor</AlertTitle>
                <AlertDescription>
                  A variável IA_CHAVE_MESTRA ainda não existe na Vercel. Sem ela, não dá para guardar a
                  chave com segurança.
                </AlertDescription>
              </Alert>
            )}

            {config && (
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor="ia-ativo">Assistente ligado</FieldLabel>
                  <FieldDescription>
                    Desligado, o microfone do topo some e nada é enviado à IA.
                  </FieldDescription>
                </FieldContent>
                <Switch
                  id="ia-ativo"
                  checked={config.ativo}
                  disabled={alternando}
                  onCheckedChange={(v) => alternar(v)}
                />
              </Field>
            )}

            <Field>
              <FieldLabel>Provedor</FieldLabel>
              <ToggleGroup
                variant="outline"
                value={[provedor]}
                onValueChange={(v) => {
                  const p = v[0] as ProvedorIA | undefined
                  if (p) escolherProvedor(p)
                }}
                aria-label="Provedor de IA"
                className="flex-wrap"
              >
                {LISTA_PROVEDORES.map((p) => (
                  <ToggleGroupItem key={p.id} value={p.id}>
                    {p.nome}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>

            <Field>
              <FieldLabel htmlFor="ia-modelo">Modelo</FieldLabel>
              <Select
                items={modelos.map((m) => ({ value: m.id, label: m.nome }))}
                value={modelo}
                onValueChange={(v) => v && setModelo(v as string)}
              >
                <SelectTrigger id="ia-modelo" className="w-full sm:w-80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modelos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                {modelos.find((m) => m.id === modelo)?.descricao}
              </FieldDescription>
            </Field>

            <Field data-invalid={!!erro || undefined}>
              <FieldLabel htmlFor="ia-chave">Chave de API</FieldLabel>
              <Input
                id="ia-chave"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={chave}
                onChange={(e) => setChave(e.target.value)}
                placeholder={
                  config && !trocouProvedor
                    ? `Guardada (termina em …${config.chaveFinal}). Cole outra para trocar.`
                    : `${info.prefixoChave ?? ''}…`
                }
                aria-invalid={!!erro || undefined}
                className="font-mono"
              />
              {erro ? (
                <FieldError>{erro}</FieldError>
              ) : (
                <FieldDescription>
                  A chave é testada, cifrada e guardada só no servidor. Ela nunca volta para o navegador.{' '}
                  <a
                    href={info.linkChave}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 underline underline-offset-4"
                  >
                    Criar chave na {info.nome}
                    <ExternalLinkIcon className="size-3" aria-hidden />
                  </a>
                </FieldDescription>
              )}
            </Field>
          </FieldGroup>
        </FramePanel>
        <FrameFooter className="flex-row justify-between gap-2">
          {config ? (
            <Button type="button" variant="ghost" onClick={() => setConfirmarRemocao(true)}>
              <Trash2Icon data-icon="inline-start" />
              Remover chave
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={salvando || !servidorPronto}>
            {salvando ? <Spinner data-icon="inline-start" /> : <KeyRoundIcon data-icon="inline-start" />}
            {salvando ? 'Testando chave…' : 'Testar e salvar'}
          </Button>
        </FrameFooter>
      </Frame>

      <ConfirmarExclusao
        aberto={confirmarRemocao}
        onOpenChange={setConfirmarRemocao}
        titulo="Remover a chave de API?"
        descricao="O assistente para de funcionar até você cadastrar outra chave."
        rotulo="Remover"
        onConfirmar={async () => {
          const r = await removerChaveIA()
          if (!r.ok) {
            toast.error(r.erro)
            return false
          }
          toast.success(r.mensagem)
          router.refresh()
          return true
        }}
      />
    </form>
  )
}
