'use client'

import { useEffect } from 'react'
import { CircleAlertIcon } from 'lucide-react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/reui/alert'
import { Button } from '@/components/ui/button'

export default function Erro({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <Alert variant="destructive" role="alert">
        <CircleAlertIcon />
        <AlertTitle>Algo deu errado</AlertTitle>
        <AlertDescription>Não foi possível carregar esta obra.</AlertDescription>
        <AlertAction>
          <Button type="button" size="sm" variant="outline" onClick={() => retry()}>
            Tentar de novo
          </Button>
        </AlertAction>
      </Alert>
    </div>
  )
}
