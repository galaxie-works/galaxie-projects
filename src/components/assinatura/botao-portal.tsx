'use client'

import { useState } from 'react'
import { CreditCardIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { abrirStripe } from './abrir-stripe'

/** Trocar cartão, ver faturas ou cancelar, no portal do Stripe. */
export function BotaoPortal() {
  const [abrindo, setAbrindo] = useState(false)
  return (
    <Button
      variant="outline"
      disabled={abrindo}
      onClick={async () => {
        setAbrindo(true)
        if (!(await abrirStripe('/api/stripe/portal'))) setAbrindo(false)
      }}
    >
      {abrindo ? <Spinner /> : <CreditCardIcon />}
      Pagamento e faturas
    </Button>
  )
}
