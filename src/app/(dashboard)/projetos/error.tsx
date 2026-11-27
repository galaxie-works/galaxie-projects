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
    <div className="flex flex-col gap-6 p-4 md:p-6">
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
