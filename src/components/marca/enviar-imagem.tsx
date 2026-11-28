'use client'

import { useState } from 'react'
import { CircleAlertIcon, ImageUpIcon, Trash2Icon } from 'lucide-react'
import { formatBytes, useFileUpload } from '@/hooks/use-file-upload'
import { Alert, AlertDescription, AlertTitle } from '@/components/reui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { compactarParaWebp } from '@/lib/diario/foto-webp'
import { IMAGEM_LADO, IMAGEM_TAMANHO_MAXIMO } from '@/lib/marca'

function traduzirErro(erro: string): string {
  if (erro.includes('exceeds')) return `A imagem passa de ${formatBytes(IMAGEM_TAMANHO_MAXIMO)}.`
  if (erro.includes('accepted')) return 'Use uma imagem JPG, PNG ou WebP.'
  return erro
}

// Logo ou foto que salva na hora, a partir do exemplo @reui/c-file-upload-2
// (avatar upload). A imagem é compactada em WebP no aparelho antes de subir.
export function EnviarImagem({
  titulo,
  descricao = `JPG, PNG ou WebP · até ${IMAGEM_TAMANHO_MAXIMO / 1024 / 1024} MB`,
  urlAtual,
  formato = 'redondo',
  iconeVazio,
  onSalvar,
}: {
  titulo: string
  /** Dica curta sobre o arquivo. Padrão: formatos e tamanho máximo. */
  descricao?: string
  /** URL assinada da imagem salva (ou null). */
  urlAtual: string | null
  formato?: 'redondo' | 'quadrado'
  iconeVazio: React.ReactNode
  /** Grava a imagem nova (ou remove, com null). Devolve a mensagem de erro, se houver. */
  onSalvar: (imagem: Blob | null) => Promise<string | null>
}) {
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [previa, setPrevia] = useState<string | null>(null)

  const [{ isDragging, errors }, { clearFiles, handleDragEnter, handleDragLeave, handleDragOver, handleDrop, openFileDialog, getInputProps }] =
    useFileUpload({
      maxFiles: 1,
      maxSize: IMAGEM_TAMANHO_MAXIMO,
      accept: 'image/jpeg,image/png,image/webp',
      multiple: false,
      onFilesAdded: async (lista) => {
        const arquivo = lista[0]?.file
        if (!(arquivo instanceof File)) return
        setErro(null)
        setSalvando(true)
        setPrevia(lista[0]?.preview ?? null)
        try {
          const { blob } = await compactarParaWebp(arquivo, IMAGEM_LADO)
          const falha = await onSalvar(blob)
          // A prévia do hook some no clearFiles; fica a imagem já compactada.
          if (falha) {
            setErro(falha)
            setPrevia(null)
          } else setPrevia(URL.createObjectURL(blob))
        } catch (e) {
          setErro(e instanceof Error ? e.message : 'Não deu para processar a imagem.')
          setPrevia(null)
        } finally {
          setSalvando(false)
          clearFiles()
        }
      },
    })

  async function remover() {
    setErro(null)
    setSalvando(true)
    const falha = await onSalvar(null)
    if (falha) setErro(falha)
    setPrevia(null)
    setSalvando(false)
  }

  const mostrada = previa ?? urlAtual
  const arredondado = formato === 'redondo' ? 'rounded-full' : 'rounded-lg'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label={mostrada ? `Trocar ${titulo.toLowerCase()}` : `Escolher ${titulo.toLowerCase()}`}
          disabled={salvando}
          className={cn(
            'relative size-24 shrink-0 cursor-pointer overflow-hidden border border-dashed transition-colors',
            arredondado,
            isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/40',
            mostrada && 'border-solid'
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={openFileDialog}
        >
          {mostrada ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mostrada}
              alt={titulo}
              className={cn('size-full', formato === 'redondo' ? 'object-cover' : 'object-contain p-1')}
            />
          ) : (
            <span className="flex size-full items-center justify-center text-muted-foreground [&_svg]:size-6">
              {iconeVazio}
            </span>
          )}
          {salvando && (
            <span className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Spinner />
            </span>
          )}
        </button>
        <input {...getInputProps()} className="sr-only" />
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium">{titulo}</p>
            <p className="text-muted-foreground text-xs">{descricao}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={openFileDialog} disabled={salvando}>
              <ImageUpIcon data-icon="inline-start" />
              {mostrada ? 'Trocar' : 'Escolher imagem'}
            </Button>
            {urlAtual && (
              <Button type="button" variant="ghost" size="sm" onClick={remover} disabled={salvando}>
                <Trash2Icon data-icon="inline-start" />
                Remover
              </Button>
            )}
          </div>
        </div>
      </div>
      {(errors.length > 0 || erro) && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Não deu para usar essa imagem</AlertTitle>
          <AlertDescription>
            {[...new Set(errors.map(traduzirErro))].map((e) => (
              <p key={e}>{e}</p>
            ))}
            {erro && <p>{erro}</p>}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
