'use client'

import { useMemo } from 'react'
import { TagIcon } from 'lucide-react'
import {
  LISTA_UNIDADES,
  UNIDADES,
  unidadePadrao,
  type TabelaPrecos,
  type Unidade,
} from '@/lib/orcamento'
import { SERVICOS_POR_ID } from '@/lib/servicos'
import { CampoMoeda } from '@/components/projetos/campo-moeda'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Props = {
  servicos: string[]
  precos: TabelaPrecos
  onChange: (precos: TabelaPrecos) => void
}

// Tabela de preços: para cada serviço da empresa, como cobra (m², metro
// linear, unidade…) e quanto. Vem preenchida em cada orçamento novo.
export function PrecosServicos({ servicos, precos, onChange }: Props) {
  const grupos = useMemo(() => {
    const mapa = new Map<string, { nome: string; ids: string[] }>()
    for (const id of servicos) {
      const c = SERVICOS_POR_ID[id]
      if (!c) continue
      const g = mapa.get(c.categoria.id) ?? { nome: c.categoria.nome, ids: [] }
      g.ids.push(id)
      mapa.set(c.categoria.id, g)
    }
    return [...mapa.values()]
  }, [servicos])

  if (servicos.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TagIcon />
          </EmptyMedia>
          <EmptyTitle>Nenhum serviço escolhido</EmptyTitle>
          <EmptyDescription>
            Marque seus serviços na aba Serviços para definir os preços.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  function mudar(id: string, parcial: Partial<{ unidade: Unidade; preco: number }>) {
    const atual = precos[id] ?? { unidade: unidadePadrao(id), preco: 0 }
    onChange({ ...precos, [id]: { ...atual, ...parcial } })
  }

  return (
    <div className="flex flex-col gap-6">
      {grupos.map((g) => (
        <section key={g.nome} className="flex flex-col gap-3">
          <h3 className="text-xs font-medium text-muted-foreground">{g.nome}</h3>
          {g.ids.map((id) => {
            const p = precos[id] ?? { unidade: unidadePadrao(id), preco: 0 }
            const nome = SERVICOS_POR_ID[id].servico.nome
            return (
              <div
                key={id}
                className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_10rem]"
              >
                <span className="col-span-2 text-sm font-medium sm:col-span-1">{nome}</span>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`preco-${id}-unidade`} className="sr-only">
                    Como cobra {nome}
                  </Label>
                  <Select
                    items={LISTA_UNIDADES}
                    value={p.unidade}
                    onValueChange={(v) => v && mudar(id, { unidade: v as Unidade })}
                  >
                    <SelectTrigger id={`preco-${id}-unidade`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LISTA_UNIDADES.map((u) => (
                        <SelectItem key={u.value} value={u.value}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`preco-${id}-valor`} className="sr-only">
                    Preço de {nome} por {UNIDADES[p.unidade].curto}
                  </Label>
                  <CampoMoeda
                    id={`preco-${id}-valor`}
                    valor={p.preco || null}
                    onChange={(v) => mudar(id, { preco: v ?? 0 })}
                    placeholder={`R$ 0,00 / ${UNIDADES[p.unidade].curto}`}
                  />
                </div>
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}
