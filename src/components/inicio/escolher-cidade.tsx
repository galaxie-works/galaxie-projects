'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MapPinIcon, SearchIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Item, ItemContent, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Spinner } from '@/components/ui/spinner'
import type { CidadeClima } from '@/lib/clima'
import { procurarCidades, salvarCidadeClima } from '@/lib/clima-acoes'

/** Botão que abre a busca de cidade da previsão do tempo. */
export function EscolherCidade({ rotulo, variante = 'ghost' }: { rotulo: string; variante?: 'ghost' | 'outline' }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [termo, setTermo] = useState('')
  const [resultado, setResultado] = useState<{ termo: string; cidades: CidadeClima[] } | null>(null)
  const [salvando, iniciarSalvar] = useTransition()

  const termoLimpo = termo.trim()
  const buscando = termoLimpo.length >= 2 && resultado?.termo !== termoLimpo

  useEffect(() => {
    if (termoLimpo.length < 2) return
    let cancelado = false
    const t = setTimeout(async () => {
      const cidades = await procurarCidades(termoLimpo)
      if (!cancelado) setResultado({ termo: termoLimpo, cidades })
    }, 300)
    return () => {
      cancelado = true
      clearTimeout(t)
    }
  }, [termoLimpo])

  const cidades = termoLimpo.length >= 2 && resultado?.termo === termoLimpo ? resultado.cidades : []

  function escolher(cidade: CidadeClima) {
    iniciarSalvar(async () => {
      const r = await salvarCidadeClima(cidade)
      if (!r.ok) {
        toast.error('Não foi possível salvar a cidade', { description: r.erro })
        return
      }
      setAberto(false)
      setTermo('')
      router.refresh()
    })
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger render={<Button type="button" variant={variante} size="sm" />}>
        <MapPinIcon data-icon="inline-start" />
        {rotulo}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <div className="flex flex-col gap-3">
          <InputGroup>
            <InputGroupAddon>{buscando || salvando ? <Spinner /> : <SearchIcon />}</InputGroupAddon>
            <InputGroupInput
              autoFocus
              placeholder="Cidade da obra, ex.: Campinas, SP"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              aria-label="Buscar cidade"
            />
          </InputGroup>
          {cidades.length > 0 ? (
            <ItemGroup className="gap-1">
              {cidades.map((c) => (
                <Item
                  key={`${c.latitude},${c.longitude}`}
                  size="sm"
                  render={<button type="button" disabled={salvando} onClick={() => escolher(c)} />}
                  className="text-left"
                >
                  <ItemMedia>
                    <MapPinIcon className="size-4 text-muted-foreground" />
                  </ItemMedia>
                  <ItemContent className="min-w-0">
                    <ItemTitle className="w-full min-w-0">
                      <span className="truncate">{c.nome}</span>
                      {c.uf && <span className="text-muted-foreground font-normal">{c.uf}</span>}
                    </ItemTitle>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          ) : (
            <p className="text-muted-foreground text-xs">
              {termoLimpo.length < 2
                ? 'A previsão usa essa cidade para avisar de chuva nos dias de obra.'
                : buscando
                  ? 'Procurando…'
                  : 'Nenhuma cidade encontrada.'}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
