'use client'

import { Menu as MenuPrimitive } from '@base-ui/react/menu'
import { MonitorIcon, MoonIcon, PaletteIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { TEMAS, temaValido } from '@/lib/temas'
import { useTemaCor } from '@/components/tema/tema-provider'
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const MODOS = [
  { value: 'light', rotulo: 'Claro', icone: SunIcon },
  { value: 'dark', rotulo: 'Escuro', icone: MoonIcon },
  { value: 'system', rotulo: 'Sistema', icone: MonitorIcon },
]

// Opção redonda numa linha, com o nome no tooltip. Item de menu de verdade:
// navega pelas setas e não fecha o menu ao escolher.
function Opcao({
  value,
  rotulo,
  className,
  children,
}: {
  value: string
  rotulo: string
  className?: string
  children?: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <MenuPrimitive.RadioItem
            value={value}
            closeOnClick={false}
            aria-label={rotulo}
            className={cn(
              'flex size-7 shrink-0 cursor-default items-center justify-center rounded-full outline-hidden transition-colors select-none',
              'ring-offset-2 ring-offset-popover data-highlighted:bg-accent data-checked:ring-2 data-checked:ring-foreground/60',
              "[&_svg:not([class*='size-'])]:size-4",
              className
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{rotulo}</TooltipContent>
    </Tooltip>
  )
}

// Submenu "Tema" do menu do usuário: cores dos temas lado a lado e modo claro/escuro.
export function MenuTema() {
  const { tema, setTema } = useTemaCor()
  const { theme: modo, setTheme: setModo } = useTheme()

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <PaletteIcon />
        Tema
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-auto min-w-0">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Cor</DropdownMenuLabel>
          <MenuPrimitive.RadioGroup
            value={tema}
            onValueChange={(v) => {
              if (temaValido(v)) setTema(v)
            }}
            className="flex items-center gap-1.5 px-1.5 pb-1.5"
          >
            {TEMAS.map((t) => (
              <Opcao key={t.slug} value={t.slug} rotulo={`${t.cor} · ${t.nome}`}>
                <span
                  aria-hidden
                  data-theme={t.slug}
                  className="size-5 rounded-full border border-foreground/10 bg-primary"
                />
              </Opcao>
            ))}
          </MenuPrimitive.RadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Aparência</DropdownMenuLabel>
          <MenuPrimitive.RadioGroup
            value={modo ?? 'system'}
            onValueChange={(v) => setModo(String(v))}
            className="flex items-center gap-1.5 px-1.5 pb-1.5"
          >
            {MODOS.map(({ value, rotulo, icone: Icone }) => (
              <Opcao key={value} value={value} rotulo={rotulo}>
                <Icone />
              </Opcao>
            ))}
          </MenuPrimitive.RadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
