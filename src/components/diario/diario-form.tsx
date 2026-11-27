'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeftIcon,
  BanIcon,
  CameraIcon,
  CloudIcon,
  CloudRainIcon,
  ImagePlusIcon,
  SunIcon,
  XIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { hojeISO } from '@/lib/crm'
import { compactarParaWebp } from '@/lib/diario/foto-webp'
import { removerFotoLocal, salvarLocal } from '@/lib/diario/local'
import { sincronizarDiario } from '@/lib/diario/sincronizar'
import {
  CLIMA_LABEL,
  CLIMAS,
  type Clima,
  type ContextoDiario,
  type FotoLocal,
  type RegistroTela,
} from '@/lib/diario/tipos'
import { BotaoVoz } from '@/components/voz/botao-voz'
import { CampoData } from '@/components/projetos/campo-data'
import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupTextarea } from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { EVENTO_LOCAL } from './use-diario'

const ICONE_CLIMA: Record<Clima, typeof SunIcon> = {
  sol: SunIcon,
  nublado: CloudIcon,
  chuva: CloudRainIcon,
  impraticavel: BanIcon,
}

const MAX_FOTOS = 20

type FotoForm = { id: string; url: string; nova?: FotoLocal; tamanho?: number }

type Props = {
  contexto: ContextoDiario
  projetoId: string
  /** Registro a editar; ausente = registro novo. */
  registro?: RegistroTela | null
  onVoltar: () => void
}

function formatarKB(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

function TextoComVoz({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <InputGroup>
      <InputGroupTextarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
      />
      <InputGroupAddon align="block-end" className="justify-end">
        <BotaoVoz
          size="icon-xs"
          rotulo="Ditar"
          onFinal={(falado) => onChange(value ? `${value} ${falado}` : falado)}
        />
      </InputGroupAddon>
    </InputGroup>
  )
}

function SeletorClima({
  rotulo,
  valor,
  onChange,
}: {
  rotulo: string
  valor: Clima | null
  onChange: (c: Clima | null) => void
}) {
  return (
    <Field>
      <FieldLabel>{rotulo}</FieldLabel>
      <ToggleGroup
        variant="outline"
        className="flex-wrap"
        value={valor ? [valor] : []}
        onValueChange={(v) => onChange((v[0] as Clima | undefined) ?? null)}
        aria-label={rotulo}
      >
        {CLIMAS.map((c) => {
          const Icone = ICONE_CLIMA[c]
          return (
            <ToggleGroupItem key={c} value={c} aria-label={CLIMA_LABEL[c]}>
              <Icone />
              {CLIMA_LABEL[c]}
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>
    </Field>
  )
}

// Formulário do diário. Tudo é salvo primeiro no aparelho e enviado em
// seguida (ou quando a internet voltar), então funciona igual com ou sem rede.
export function DiarioForm({ contexto, projetoId, registro, onVoltar }: Props) {
  const [id] = useState(() => registro?.id ?? crypto.randomUUID())
  const [data, setData] = useState(registro?.data ?? hojeISO())
  const [climaManha, setClimaManha] = useState<Clima | null>(registro?.clima_manha ?? null)
  const [climaTarde, setClimaTarde] = useState<Clima | null>(registro?.clima_tarde ?? null)
  const [presentes, setPresentes] = useState<string[]>(registro?.equipe_presente ?? [])
  const [atividades, setAtividades] = useState(registro?.atividades ?? '')
  const [ocorrencias, setOcorrencias] = useState(registro?.ocorrencias ?? '')
  const [fotos, setFotos] = useState<FotoForm[]>(
    () => registro?.fotos.map((f) => ({ id: f.id, url: f.url })) ?? []
  )
  const [processando, setProcessando] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const camera = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)
  const urlsCriadas = useRef<string[]>([])

  useEffect(() => {
    const urls = urlsCriadas.current
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  const obra = contexto.obras.find((o) => o.id === projetoId)
  const novas = fotos.filter((f) => f.nova)
  const tamanhoNovas = novas.reduce((s, f) => s + (f.tamanho ?? 0), 0)

  async function adicionarFotos(lista: FileList | null) {
    if (!lista?.length) return
    const arquivos = [...lista].filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name))
    const vagas = MAX_FOTOS - fotos.length
    if (arquivos.length > vagas) toast.warning(`Até ${MAX_FOTOS} fotos por registro.`)
    const aceitas = arquivos.slice(0, Math.max(0, vagas))
    setProcessando((n) => n + aceitas.length)
    for (const arquivo of aceitas) {
      try {
        const { blob, largura, altura } = await compactarParaWebp(arquivo)
        const fotoId = crypto.randomUUID()
        const url = URL.createObjectURL(blob)
        urlsCriadas.current.push(url)
        const nova: FotoLocal = {
          id: fotoId,
          registro_id: id,
          empresa_id: contexto.empresaId,
          projeto_id: projetoId,
          data,
          blob,
          largura,
          altura,
          criada_em: new Date().toISOString(),
        }
        setFotos((atual) => [...atual, { id: fotoId, url, nova, tamanho: blob.size }])
      } catch {
        toast.error(`Não foi possível ler a foto ${arquivo.name}.`)
      } finally {
        setProcessando((n) => n - 1)
      }
    }
  }

  async function removerFoto(f: FotoForm) {
    setFotos((atual) => atual.filter((x) => x.id !== f.id))
    // Foto que já estava na fila do aparelho sai dela também.
    if (!f.nova && registro?.fotos.find((x) => x.id === f.id)?.pendente) {
      await removerFotoLocal(f.id)
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!atividades.trim() && !ocorrencias.trim() && fotos.length === 0) {
      setErro('Conte o que foi feito, uma ocorrência ou adicione uma foto.')
      return
    }
    setErro(null)
    setSalvando(true)
    try {
      await salvarLocal(
        {
          id,
          empresa_id: contexto.empresaId,
          projeto_id: projetoId,
          data,
          clima_manha: climaManha,
          clima_tarde: climaTarde,
          equipe_presente: presentes,
          atividades: atividades.trim() || null,
          ocorrencias: ocorrencias.trim() || null,
          registrado_em: registro?.registrado_em ?? new Date().toISOString(),
          erro: null,
        },
        novas.map((f) => ({ ...f.nova!, data }))
      )
    } catch {
      setSalvando(false)
      toast.error('Não foi possível guardar no aparelho. Verifique o espaço livre.')
      return
    }
    window.dispatchEvent(new CustomEvent(EVENTO_LOCAL))
    const r = await sincronizarDiario().catch(() => null)
    setSalvando(false)
    if (r && !r.semConexao && r.falhas === 0) toast.success('Diário salvo e enviado')
    else if (r?.semConexao || !navigator.onLine)
      toast.success('Diário salvo no aparelho', { description: 'Vai ser enviado quando a internet voltar.' })
    else toast.warning('Diário salvo no aparelho', { description: 'O envio falhou; tentaremos de novo.' })
    onVoltar()
  }

  const todosPresentes = contexto.equipe.length > 0 && presentes.length === contexto.equipe.length

  return (
    <form onSubmit={salvar} noValidate className="flex flex-col gap-6">
      <header className="flex items-start gap-2">
        <Button type="button" variant="ghost" size="icon" onClick={onVoltar} aria-label="Voltar ao diário">
          <ArrowLeftIcon />
        </Button>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-tight">
            {registro ? 'Editar registro do dia' : 'Registrar o dia'}
          </h1>
          <p className="truncate text-sm text-muted-foreground">{obra?.nome ?? 'Obra'}</p>
        </div>
      </header>

      <Frame spacing="default" className="min-w-0">
        <FrameHeader>
          <FrameTitle>Dia e clima</FrameTitle>
          <FrameDescription>Como estava o tempo para trabalhar.</FrameDescription>
        </FrameHeader>
        <FramePanel>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="diario-data">Data</FieldLabel>
              <CampoData id="diario-data" valor={data} onChange={(v) => setData(v || hojeISO())} />
            </Field>
            <SeletorClima rotulo="Manhã" valor={climaManha} onChange={setClimaManha} />
            <SeletorClima rotulo="Tarde" valor={climaTarde} onChange={setClimaTarde} />
          </FieldGroup>
        </FramePanel>
      </Frame>

      <Frame spacing="default" className="min-w-0">
        <FrameHeader>
          <FrameTitle>Equipe presente</FrameTitle>
          <FrameDescription>
            {presentes.length === 0
              ? 'Marque quem trabalhou na obra hoje.'
              : presentes.length === 1
                ? '1 pessoa presente'
                : `${presentes.length} pessoas presentes`}
          </FrameDescription>
        </FrameHeader>
        <FramePanel>
          {contexto.equipe.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguém cadastrado na equipe ainda.</p>
          ) : (
            <FieldSet>
              <FieldLegend variant="label" className="sr-only">
                Equipe presente
              </FieldLegend>
              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => setPresentes(todosPresentes ? [] : contexto.equipe.map((m) => m.id))}
                >
                  {todosPresentes ? 'Desmarcar todos' : 'Marcar todos'}
                </Button>
                <div className="grid gap-2 sm:grid-cols-2">
                  {contexto.equipe.map((m) => {
                    const idCampo = `presente-${m.id}`
                    return (
                      <FieldLabel key={m.id} htmlFor={idCampo}>
                        <Field orientation="horizontal">
                          <Checkbox
                            id={idCampo}
                            checked={presentes.includes(m.id)}
                            onCheckedChange={(c) =>
                              setPresentes((atual) =>
                                c === true ? [...atual.filter((x) => x !== m.id), m.id] : atual.filter((x) => x !== m.id)
                              )
                            }
                          />
                          <FieldContent>
                            <FieldTitle>{m.nome}</FieldTitle>
                            {m.funcao && <FieldDescription className="text-xs">{m.funcao}</FieldDescription>}
                          </FieldContent>
                        </Field>
                      </FieldLabel>
                    )
                  })}
                </div>
              </div>
            </FieldSet>
          )}
        </FramePanel>
      </Frame>

      <Frame spacing="default" className="min-w-0">
        <FrameHeader>
          <FrameTitle>O que aconteceu</FrameTitle>
          <FrameDescription>Pode falar em vez de digitar.</FrameDescription>
        </FrameHeader>
        <FramePanel>
          <FieldGroup>
            <Field data-invalid={Boolean(erro) || undefined}>
              <FieldLabel htmlFor="diario-atividades">Atividades realizadas</FieldLabel>
              <TextoComVoz
                id="diario-atividades"
                value={atividades}
                onChange={setAtividades}
                placeholder="Ex.: Assentamento do porcelanato na sala, 18 m². Rejunte da cozinha."
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="diario-ocorrencias">Ocorrências</FieldLabel>
              <TextoComVoz
                id="diario-ocorrencias"
                value={ocorrencias}
                onChange={setOcorrencias}
                placeholder="Falta de material, atraso de entrega, acidente, visita do cliente…"
              />
            </Field>
          </FieldGroup>
        </FramePanel>
      </Frame>

      <Frame spacing="default" className="min-w-0">
        <FrameHeader>
          <FrameTitle>Fotos</FrameTitle>
          <FrameDescription>
            {novas.length > 0
              ? `${novas.length} nova${novas.length > 1 ? 's' : ''} · ${formatarKB(tamanhoNovas)} em WebP`
              : 'Compactadas no aparelho antes de enviar.'}
          </FrameDescription>
        </FrameHeader>
        <FramePanel>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => camera.current?.click()}>
                <CameraIcon />
                Tirar foto
              </Button>
              <Button type="button" variant="outline" onClick={() => galeria.current?.click()}>
                <ImagePlusIcon />
                Da galeria
              </Button>
              {processando > 0 && (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner />
                  Compactando {processando} foto{processando > 1 ? 's' : ''}…
                </span>
              )}
            </div>
            <input
              ref={camera}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                void adicionarFotos(e.target.files)
                e.target.value = ''
              }}
            />
            <input
              ref={galeria}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                void adicionarFotos(e.target.files)
                e.target.value = ''
              }}
            />
            {fotos.length > 0 && (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {fotos.map((f) => (
                  <li key={f.id} className="relative aspect-square overflow-hidden rounded-md border bg-muted">
                    {f.url ? (
                      // Prévia local (blob:) ou URL assinada: next/image não se aplica.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.url} alt="Foto do diário" className="size-full object-cover" />
                    ) : (
                      <span className="flex size-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
                        Aparece com internet
                      </span>
                    )}
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="secondary"
                      className="absolute top-1 right-1"
                      aria-label="Tirar esta foto"
                      onClick={() => void removerFoto(f)}
                      disabled={!f.nova && !registro?.fotos.find((x) => x.id === f.id)?.pendente}
                    >
                      <XIcon />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </FramePanel>
        <FrameFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          {erro && <p className="text-sm text-destructive-foreground sm:mr-auto">{erro}</p>}
          <Button type="button" variant="outline" onClick={onVoltar} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" disabled={salvando || processando > 0}>
            {salvando && <Spinner />}
            Salvar diário
          </Button>
        </FrameFooter>
      </Frame>
    </form>
  )
}
