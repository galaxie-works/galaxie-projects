'use client'

import { MonitorIcon, MoonIcon, PaletteIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { TEMAS, temaValido } from '@/lib/temas'
import { useTemaCor } from '@/components/tema/tema-provider'
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'

const MODOS = [
  { value: 'light', rotulo: 'Claro', icone: SunIcon },
  { value: 'dark', rotulo: 'Escuro', icone: MoonIcon },
  { value: 'system', rotulo: 'Sistema', icone: MonitorIcon },
]

// Submenu "Tema" do menu do usuário: escolhe o tema de cor e o modo claro/escuro.
export function MenuTema() {
  const { tema, setTema } = useTemaCor()
  const { theme: modo, setTheme: setModo } = useTheme()

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <PaletteIcon />
        Tema
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Tema</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={tema}
            onValueChange={(v) => {
              if (temaValido(v)) setTema(v)
            }}
          >
            {TEMAS.map((t) => (
              <DropdownMenuRadioItem key={t.slug} value={t.slug} closeOnClick={false}>
                <span
                  aria-hidden
                  data-theme={t.slug}
                  className="size-3.5 shrink-0 rounded-full border bg-primary"
                />
                {t.nome}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Aparência</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={modo ?? 'system'} onValueChange={(v) => setModo(String(v))}>
            {MODOS.map(({ value, rotulo, icone: Icone }) => (
              <DropdownMenuRadioItem key={value} value={value} closeOnClick={false}>
                <Icone />
                {rotulo}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
