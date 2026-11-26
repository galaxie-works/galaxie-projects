'use client'

import { MicIcon, SquareIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDitado, type OpcoesDitado } from '@/hooks/use-ditado'

type Props = OpcoesDitado & {
  rotulo?: string
  size?: 'icon' | 'icon-sm' | 'icon-xs' | 'icon-lg'
  variant?: 'ghost' | 'outline' | 'secondary' | 'default'
}

// Botão de microfone. Some quando o navegador não suporta ditado.
export function BotaoVoz({
  rotulo = 'Falar em vez de digitar',
  size = 'icon-sm',
  variant = 'ghost',
  ...opcoes
}: Props) {
  const { suportado, ouvindo, alternar } = useDitado(opcoes)
  if (!suportado) return null
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size={size}
            variant={ouvindo ? 'default' : variant}
            onClick={alternar}
            aria-pressed={ouvindo}
            aria-label={ouvindo ? 'Parar de ouvir' : rotulo}
          />
        }
      >
        {ouvindo ? <SquareIcon /> : <MicIcon />}
      </TooltipTrigger>
      <TooltipContent>{ouvindo ? 'Ouvindo… toque para parar' : rotulo}</TooltipContent>
    </Tooltip>
  )
}
