'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DownloadIcon,
  FileIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FolderOpenIcon,
  GlobeIcon,
  PaperclipIcon,
  Trash2Icon,
  UploadIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useFileUpload } from '@/hooks/use-file-upload'
import { formatarDataHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/reui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
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
import { Progress } from '@/components/ui/progress'
import { Toggle } from '@/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmarExclusao } from '@/components/projetos/confirmar-exclusao'

export type Arquivo = {
  id: string
  empresa_id: string
  cliente_id: string | null
  projeto_id: string | null
  nome: string
  caminho: string
  tamanho: number
  tipo_mime: string | null
  created_at: string
  /** Aparece no portal do cliente. */
  no_portal?: boolean
}

const BUCKET = 'arquivos'
const LIMITE = 20 * 1024 * 1024

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

function IconeArquivo({ tipo }: { tipo: string | null }) {
  if (tipo?.startsWith('image/')) return <FileImageIcon />
  if (tipo === 'application/pdf' || tipo?.startsWith('text/')) return <FileTextIcon />
  if (tipo?.includes('sheet') || tipo?.includes('excel') || tipo === 'text/csv') return <FileSpreadsheetIcon />
  return <FileIcon />
}

// Nome seguro para o caminho no Storage (sem acentos nem espaços).
function nomeSeguro(nome: string): string {
  return (
    nome
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .slice(-80) || 'arquivo'
  )
}

type Props = {
  empresaId: string
  /** Lista e envia arquivos do cliente (inclui os enviados nas obras dele). */
  clienteId?: string | null
  /** Lista e envia arquivos de uma obra. */
  projetoId?: string
  /** Nome das obras, para marcar de qual obra veio cada arquivo na tela do cliente. */
  obras?: { id: string; nome: string }[]
}

// Arquivos por cliente e por obra (fotos, plantas, contratos, comprovantes),
// guardados no Supabase Storage em bucket privado. Download por URL assinada.
export function ArquivosLista({ empresaId, clienteId, projetoId, obras = [] }: Props) {
  const [arquivos, setArquivos] = useState<Arquivo[] | null>(null)
  const [indisponivel, setIndisponivel] = useState(false)
  const [miniaturas, setMiniaturas] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState<{ feitos: number; total: number } | null>(null)
  const [excluir, setExcluir] = useState<Arquivo | null>(null)
  const [mudandoPortal, setMudandoPortal] = useState<Set<string>>(new Set())

  const carregar = useCallback(async () => {
    const supabase = createClient()
    let consulta = supabase.from('arquivos').select('*').order('created_at', { ascending: false })
    consulta = projetoId ? consulta.eq('projeto_id', projetoId) : consulta.eq('cliente_id', clienteId!)
    const { data, error } = await consulta
    if (error) {
      // Antes do SQL da Frente F a tabela não existe.
      setIndisponivel(true)
      setArquivos([])
      return
    }
    const lista = (data as Arquivo[]) ?? []
    setArquivos(lista)
    const imagens = lista.filter((a) => a.tipo_mime?.startsWith('image/'))
    if (imagens.length) {
      const { data: urls } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(imagens.map((a) => a.caminho), 3600)
      const mapa: Record<string, string> = {}
      urls?.forEach((u) => {
        if (u.signedUrl && u.path) mapa[u.path] = u.signedUrl
      })
      setMiniaturas(mapa)
    }
  }, [clienteId, projetoId])

  useEffect(() => {
    // Leitura inicial da lista no Supabase (sistema externo).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar()
  }, [carregar])

  async function enviar(files: File[]) {
    const grandes = files.filter((f) => f.size > LIMITE)
    if (grandes.length) toast.error(`${grandes.map((f) => f.name).join(', ')}: passa de 20 MB`)
    const validos = files.filter((f) => f.size <= LIMITE)
    if (!validos.length) return

    const supabase = createClient()
    setEnviando({ feitos: 0, total: validos.length })
    let falhas = 0
    for (const [i, file] of validos.entries()) {
      const pasta = projetoId ? `projetos/${projetoId}` : `clientes/${clienteId}`
      const caminho = `${empresaId}/${pasta}/${crypto.randomUUID()}-${nomeSeguro(file.name)}`
      const { error: erroUpload } = await supabase.storage
        .from(BUCKET)
        .upload(caminho, file, { contentType: file.type || undefined })
      if (erroUpload) {
        falhas++
      } else {
        const { error } = await supabase.from('arquivos').insert({
          empresa_id: empresaId,
          cliente_id: clienteId ?? null,
          projeto_id: projetoId ?? null,
          nome: file.name,
          caminho,
          tamanho: file.size,
          tipo_mime: file.type || null,
        })
        if (error) {
          falhas++
          await supabase.storage.from(BUCKET).remove([caminho])
        }
      }
      setEnviando({ feitos: i + 1, total: validos.length })
    }
    setEnviando(null)
    const ok = validos.length - falhas
    if (ok) toast.success(ok === 1 ? 'Arquivo enviado' : `${ok} arquivos enviados`)
    if (falhas) toast.error(falhas === 1 ? 'Um arquivo não foi enviado' : `${falhas} arquivos não foram enviados`)
    await carregar()
  }

  const [{ isDragging }, upload] = useFileUpload({
    multiple: true,
    onFilesAdded: (novos) => {
      const files = novos.map((n) => n.file).filter((f): f is File => f instanceof File)
      // Esvazia a fila do hook depois que ele termina de guardar o lote;
      // assim o mesmo arquivo pode ser enviado de novo.
      setTimeout(upload.clearFiles, 0)
      void enviar(files)
    },
  })

  async function baixar(a: Arquivo) {
    const { data, error } = await createClient()
      .storage.from(BUCKET)
      .createSignedUrl(a.caminho, 60, { download: a.nome })
    if (error || !data) {
      toast.error('Não foi possível baixar o arquivo')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  // Liga/desliga o arquivo no portal do cliente (fotos da obra, contrato...).
  async function alternarPortal(a: Arquivo, ligar: boolean) {
    // Um pedido por arquivo de cada vez: o botão fica travado até o banco responder.
    if (mudandoPortal.has(a.id)) return
    setMudandoPortal((s) => new Set(s).add(a.id))
    setArquivos((lista) => lista?.map((x) => (x.id === a.id ? { ...x, no_portal: ligar } : x)) ?? null)
    const { error } = await createClient().from('arquivos').update({ no_portal: ligar }).eq('id', a.id)
    setMudandoPortal((s) => {
      const n = new Set(s)
      n.delete(a.id)
      return n
    })
    if (error) {
      setArquivos((lista) => lista?.map((x) => (x.id === a.id ? { ...x, no_portal: !ligar } : x)) ?? null)
      toast.error('Não foi possível mudar o portal', { description: error.message })
      return
    }
    toast.success(ligar ? 'Aparece no portal do cliente' : 'Saiu do portal do cliente')
  }

  async function apagar(a: Arquivo): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase.from('arquivos').delete().eq('id', a.id)
    if (error) {
      toast.error('Não foi possível excluir o arquivo')
      return false
    }
    await supabase.storage.from(BUCKET).remove([a.caminho])
    setArquivos((lista) => lista?.filter((x) => x.id !== a.id) ?? null)
    toast.success('Arquivo excluído')
    return true
  }

  if (indisponivel) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PaperclipIcon />
          </EmptyMedia>
          <EmptyTitle>Arquivos ainda não ativados</EmptyTitle>
          <EmptyDescription>
            Arquivos indisponíveis no momento. Tente de novo mais tarde.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const nomeObra = (id: string | null) => obras.find((o) => o.id === id)?.nome

  return (
    <div className="flex flex-col gap-4">
      <div
        role="button"
        tabIndex={0}
        aria-disabled={!!enviando || undefined}
        onClick={() => !enviando && upload.openFileDialog()}
        onKeyDown={(e) => !enviando && (e.key === 'Enter' || e.key === ' ') && upload.openFileDialog()}
        onDragEnter={upload.handleDragEnter}
        onDragLeave={upload.handleDragLeave}
        onDragOver={upload.handleDragOver}
        onDrop={upload.handleDrop}
        data-dragging={isDragging || undefined}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors outline-none',
          'hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-dragging:border-primary data-dragging:bg-primary/5',
          enviando && 'pointer-events-none opacity-70'
        )}
      >
        <input {...upload.getInputProps()} className="sr-only" aria-label="Enviar arquivos" />
        <span className="flex size-9 items-center justify-center rounded-full border bg-background">
          <UploadIcon className="size-4 text-muted-foreground" />
        </span>
        {enviando ? (
          <div className="flex w-full max-w-xs flex-col gap-2">
            <p className="text-sm font-medium">
              Enviando {enviando.feitos + 1 > enviando.total ? enviando.total : enviando.feitos + 1} de {enviando.total}…
            </p>
            <Progress value={(enviando.feitos / enviando.total) * 100} aria-label="Progresso do envio" />
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium">Arraste arquivos aqui ou toque para enviar</p>
            <p className="text-xs text-muted-foreground">Até 20 MB por arquivo</p>
          </div>
        )}
      </div>

      {arquivos === null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : arquivos.length === 0 ? (
        <Empty className="py-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderOpenIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum arquivo ainda</EmptyTitle>
            <EmptyDescription>
              Fotos, plantas e contratos ficam aqui.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup className="gap-1">
          {arquivos.map((a) => {
            const miniatura = miniaturas[a.caminho]
            const obra = !projetoId ? nomeObra(a.projeto_id) : undefined
            return (
              <Item key={a.id} variant="outline" size="sm">
                <ItemMedia variant={miniatura ? 'image' : 'icon'}>
                  {miniatura ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={miniatura} alt="" />
                  ) : (
                    <IconeArquivo tipo={a.tipo_mime} />
                  )}
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle className="w-full truncate">{a.nome}</ItemTitle>
                  <ItemDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums">
                    <span>{formatarTamanho(a.tamanho)}</span>
                    <span aria-hidden className="bg-muted-foreground/40 size-1 shrink-0 rounded-full" />
                    <span>{formatarDataHora(a.created_at)}</span>
                    {obra && <Badge variant="outline">{obra}</Badge>}
                    {a.no_portal && <Badge variant="info-light">No portal</Badge>}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  {a.no_portal !== undefined && (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Toggle
                            size="sm"
                            pressed={a.no_portal}
                            disabled={mudandoPortal.has(a.id)}
                            onPressedChange={(v) => void alternarPortal(a, v)}
                            aria-label={a.no_portal ? `Tirar ${a.nome} do portal` : `Mostrar ${a.nome} no portal`}
                          />
                        }
                      >
                        <GlobeIcon />
                      </TooltipTrigger>
                      <TooltipContent>{a.no_portal ? 'Tirar do portal do cliente' : 'Mostrar no portal do cliente'}</TooltipContent>
                    </Tooltip>
                  )}
                  <Button variant="ghost" size="icon-sm" onClick={() => baixar(a)} aria-label={`Baixar ${a.nome}`}>
                    <DownloadIcon />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setExcluir(a)} aria-label={`Excluir ${a.nome}`}>
                    <Trash2Icon />
                  </Button>
                </ItemActions>
              </Item>
            )
          })}
        </ItemGroup>
      )}

      <ConfirmarExclusao
        aberto={!!excluir}
        onOpenChange={(v) => !v && setExcluir(null)}
        titulo="Excluir arquivo?"
        descricao={excluir ? `"${excluir.nome}" será apagado de vez.` : ''}
        onConfirmar={() => (excluir ? apagar(excluir) : Promise.resolve(false))}
      />
    </div>
  )
}
