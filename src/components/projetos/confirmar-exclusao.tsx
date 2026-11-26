'use client'

import { useState } from 'react'
import { Trash2Icon } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Spinner } from '@/components/ui/spinner'

type Props = {
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  titulo: string
  descricao: string
  rotulo?: string
  /** Devolve true quando deu certo; o diálogo fecha sozinho. */
  onConfirmar: () => Promise<boolean>
}

// Confirmação destrutiva: não fecha enquanto a exclusão está em andamento.
export function ConfirmarExclusao({
  aberto,
  onOpenChange,
  titulo,
  descricao,
  rotulo = 'Excluir',
  onConfirmar,
}: Props) {
  const [excluindo, setExcluindo] = useState(false)

  async function confirmar() {
    setExcluindo(true)
    const ok = await onConfirmar()
    setExcluindo(false)
    if (ok) onOpenChange(false)
  }

  return (
    <AlertDialog open={aberto} onOpenChange={(v) => !excluindo && onOpenChange(v)}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descricao}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
          <AlertDialogAction type="button" variant="destructive" onClick={confirmar} disabled={excluindo}>
            {excluindo && <Spinner data-icon="inline-start" />}
            {rotulo}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
