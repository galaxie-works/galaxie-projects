'use client'

import { CircleAlertIcon, ImageUpIcon, Trash2Icon, UserIcon } from 'lucide-react'
import { formatBytes, useFileUpload } from '@/hooks/use-file-upload'
import { Alert, AlertDescription, AlertTitle } from '@/components/reui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FOTO_TAMANHO_MAXIMO } from '@/lib/equipe'

// O hook devolve mensagens em inglês; mostramos em português.
function traduzirErro(erro: string): string {
  if (erro.includes('exceeds')) return `A foto passa de ${formatBytes(FOTO_TAMANHO_MAXIMO)}.`
  if (erro.includes('accepted')) return 'Use uma imagem JPG, PNG ou WebP.'
  return erro
}

// Foto da pessoa, a partir do exemplo @reui/c-file-upload-2 (avatar upload).
// O arquivo só sobe para o Storage quando o formulário é salvo.
export function FotoMembro({
  fotoAtual,
  onArquivo,
  onRemoverAtual,
}: {
  /** URL assinada da foto já salva (ou null). */
  fotoAtual: string | null
  /** Arquivo novo escolhido (ou null quando desfeito). */
  onArquivo: (arquivo: File | null) => void
  /** Pede para apagar a foto já salva. */
  onRemoverAtual: () => void
}) {
  const [
    { files, isDragging, errors },
    { removeFile, handleDragEnter, handleDragLeave, handleDragOver, handleDrop, openFileDialog, getInputProps },
  ] = useFileUpload({
    maxFiles: 1,
    maxSize: FOTO_TAMANHO_MAXIMO,
    accept: 'image/jpeg,image/png,image/webp',
    multiple: false,
    onFilesChange: (lista) => {
      const f = lista[0]?.file
      onArquivo(f instanceof File ? f : null)
    },
  })

  const novo = files[0]
  const preview = novo?.preview || fotoAtual

  function remover() {
    if (novo) removeFile(novo.id)
    else onRemoverAtual()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label={preview ? 'Trocar foto' : 'Escolher foto'}
          className={cn(
            'relative size-24 shrink-0 cursor-pointer overflow-hidden rounded-full border border-dashed transition-colors',
            isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/40',
            preview && 'border-solid'
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={openFileDialog}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Foto da pessoa" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center">
              <UserIcon className="text-muted-foreground size-6" />
            </span>
          )}
        </button>
        <input {...getInputProps()} className="sr-only" />
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium">Foto</p>
            <p className="text-muted-foreground text-xs">
              JPG, PNG ou WebP até {formatBytes(FOTO_TAMANHO_MAXIMO)}. Opcional.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={openFileDialog}>
              <ImageUpIcon data-icon="inline-start" />
              {preview ? 'Trocar' : 'Escolher foto'}
            </Button>
            {preview && (
              <Button type="button" variant="ghost" size="sm" onClick={remover}>
                <Trash2Icon data-icon="inline-start" />
                Remover
              </Button>
            )}
          </div>
        </div>
      </div>
      {errors.length > 0 && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Não deu para usar essa foto</AlertTitle>
          <AlertDescription>
            {[...new Set(errors.map(traduzirErro))].map((e) => (
              <p key={e}>{e}</p>
            ))}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
