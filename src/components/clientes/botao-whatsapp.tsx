'use client'

import { ChevronDownIcon, MessageCircleIcon } from 'lucide-react'
import { linkWhatsApp } from '@/lib/crm'
import { modelosWhatsApp } from '@/lib/whatsapp'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// WhatsApp com mensagem pronta: o botão abre a conversa; a seta escolhe um
// modelo (visita, orçamento, retorno, andamento, avaliação) já com o nome.
export function BotaoWhatsApp({
  telefone,
  nome,
  obra,
}: {
  telefone: string | null
  nome: string
  obra?: string | null
}) {
  const link = linkWhatsApp(telefone)
  if (!link) return null
  const modelos = modelosWhatsApp({ nome, obra })

  return (
    <ButtonGroup>
      <Button variant="outline" nativeButton={false} render={<a href={link} target="_blank" rel="noreferrer" />}>
        <MessageCircleIcon data-icon="inline-start" />
        WhatsApp
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="icon" aria-label="Mensagens prontas do WhatsApp" />}
        >
          <ChevronDownIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Mensagem pronta</DropdownMenuLabel>
            {modelos.map((m) => (
              <DropdownMenuItem
                key={m.id}
                render={<a href={linkWhatsApp(telefone, m.texto) ?? link} target="_blank" rel="noreferrer" />}
                className="flex-col items-start gap-0.5"
              >
                <span className="font-medium">{m.rotulo}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{m.texto}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  )
}
