'use client'

import { MonitorIcon, MoonIcon, PaletteIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { TEMAS, temaValido } from '@/lib/temas'
import { useTemaCor } from '@/components/tema/tema-provider'
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const MODOS = [
  { value: 'light', rotulo: 'Claro', icone: SunIcon },
  { value: 'dark', rotulo: 'Escuro', icone: MoonIcon },
  { value: 'system', rotulo: 'Sistema', icone: MonitorIcon },
]

function Opcao({ value, rotulo, children }: { value: string; rotulo: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<TabsTrigger value={value} aria-label={rotulo} className="h-7 flex-1" />}>
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{rotulo}</TooltipContent>
    </Tooltip>
  )
}

// Submenu "Tema" do menu do usuário, no padrão do ReUI (c-dropdown-menu-14):
// Tabs com as cores lado a lado e Tabs com claro/escuro/sistema, nome no tooltip.
export function MenuTema() {
  const { tema, setTema } = useTemaCor()
  const { theme: modo, setTheme: setModo } = useTheme()

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <PaletteIcon />
        Tema
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Cor</DropdownMenuLabel>
          <Tabs
            value={tema}
            onValueChange={(v) => {
              if (temaValido(v)) setTema(v)
            }}
            className="px-1 pb-1.5"
          >
            <TabsList className="w-full">
              {TEMAS.map((t) => (
                <Opcao key={t.slug} value={t.slug} rotulo={`${t.cor} · ${t.nome}`}>
                  {/* Amostra: o próprio data-theme pinta a bolinha com a cor do tema. */}
                  <span
                    aria-hidden
                    data-theme={t.slug}
                    className="size-4 rounded-full border border-foreground/10 bg-primary"
                  />
                </Opcao>
              ))}
            </TabsList>
          </Tabs>
        </DropdownMenuGroup>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Aparência</DropdownMenuLabel>
          <Tabs value={modo ?? 'system'} onValueChange={(v) => setModo(String(v))} className="px-1 pb-1.5">
            <TabsList className="w-full">
              {MODOS.map(({ value, rotulo, icone: Icone }) => (
                <Opcao key={value} value={value} rotulo={rotulo}>
                  <Icone aria-hidden />
                </Opcao>
              ))}
            </TabsList>
          </Tabs>
        </DropdownMenuGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
