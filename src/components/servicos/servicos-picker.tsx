'use client'

import { useId, useMemo, useState } from 'react'
import { MicIcon, SearchIcon, SquareIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  AREAS_SERVICO,
  SERVICOS_POR_ID,
  encontrarServicosNoTexto,
  type AreaServico,
  type CategoriaServico,
} from '@/lib/servicos'
import { useDitado } from '@/hooks/use-ditado'
import { Badge } from '@/components/reui/badge'
import { IconTile } from '@/components/reui/icon-tile'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Separator } from '@/components/ui/separator'
import { iconeDaArea } from './icones-area'

type Props = {
  value: string[]
  onChange: (ids: string[]) => void
  /** ids das áreas a mostrar; padrão: todas. */
  areas?: string[]
}

function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

function chaveCategoria(area: AreaServico, categoria: CategoriaServico) {
  return `${area.id}:${categoria.id}`
}

export function nomesDosServicos(ids: string[]) {
  return ids.map((id) => SERVICOS_POR_ID[id]?.servico.nome).filter(Boolean) as string[]
}

export function ServicosPicker({ value, onChange, areas }: Props) {
  const prefixo = useId()
  const [busca, setBusca] = useState('')
  const [abertos, setAbertos] = useState<string[]>([])
  const [parcial, setParcial] = useState('')

  const selecionados = useMemo(() => new Set(value), [value])

  const areasVisiveis = useMemo(
    () => (areas ? AREAS_SERVICO.filter((a) => areas.includes(a.id)) : AREAS_SERVICO),
    [areas]
  )

  // Aplica a busca: mantém só categorias com algum serviço que case (nome,
  // sinônimo ou nome da categoria).
  const filtradas = useMemo(() => {
    const termo = normalizar(busca)
    return areasVisiveis
      .map((area) => ({
        area,
        categorias: area.categorias
          .map((categoria) => {
            if (!termo || normalizar(categoria.nome).includes(termo)) {
              return { categoria, servicos: categoria.servicos }
            }
            const servicos = categoria.servicos.filter((s) =>
              [s.nome, ...(s.sinonimos ?? [])].some((t) => normalizar(t).includes(termo))
            )
            return { categoria, servicos }
          })
          .filter((c) => c.servicos.length > 0),
      }))
      .filter((a) => a.categorias.length > 0)
  }, [areasVisiveis, busca])

  const abertosNaBusca = useMemo(
    () =>
      filtradas.flatMap(({ area, categorias }) =>
        categorias.map(({ categoria }) => chaveCategoria(area, categoria))
      ),
    [filtradas]
  )

  const { suportado, ouvindo, alternar } = useDitado({
    onParcial: setParcial,
    onFinal: (texto) => {
      setParcial('')
      adicionarPorVoz(texto)
    },
  })

  function adicionarPorVoz(texto: string) {
    const idsAreas = new Set(areasVisiveis.map((a) => a.id))
    const achados = encontrarServicosNoTexto(texto)
    const dentro = achados.filter((id) => idsAreas.has(SERVICOS_POR_ID[id]?.area.id))
    const fora = achados.filter((id) => !idsAreas.has(SERVICOS_POR_ID[id]?.area.id))
    const novos = dentro.filter((id) => !selecionados.has(id))

    if (novos.length > 0) {
      onChange([...value, ...novos])
      toast.success(
        novos.length === 1 ? '1 serviço adicionado' : `${novos.length} serviços adicionados`,
        { description: nomesDosServicos(novos).join(', ') }
      )
    } else if (dentro.length > 0) {
      toast('Já estava tudo marcado', { description: nomesDosServicos(dentro).join(', ') })
    } else if (fora.length > 0) {
      toast('Esses serviços são de outra área', {
        description: `${nomesDosServicos(fora).join(', ')}. Marque a área para incluí-los.`,
      })
    } else {
      toast('Não reconheci nenhum serviço', { description: `Ouvi: “${texto}”` })
    }
  }

  function alternarServico(id: string, marcado: boolean) {
    if (marcado) {
      if (!selecionados.has(id)) onChange([...value, id])
    } else {
      onChange(value.filter((v) => v !== id))
    }
  }

  function alternarCategoria(ids: string[], marcar: boolean) {
    if (marcar) {
      onChange([...value, ...ids.filter((id) => !selecionados.has(id))])
    } else {
      const remover = new Set(ids)
      onChange(value.filter((v) => !remover.has(v)))
    }
  }

  const resumo = value.filter((id) =>
    areasVisiveis.some((a) => a.id === SERVICOS_POR_ID[id]?.area.id)
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <InputGroup className="sm:flex-1">
            <InputGroupAddon>
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar serviço, ex.: porcelanato"
              aria-label="Buscar serviço"
            />
            {busca && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label="Limpar busca"
                  onClick={() => setBusca('')}
                >
                  <XIcon />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          {suportado && (
            <Button
              type="button"
              variant={ouvindo ? 'default' : 'outline'}
              onClick={alternar}
              aria-pressed={ouvindo}
            >
              {ouvindo ? <SquareIcon data-icon="inline-start" /> : <MicIcon data-icon="inline-start" />}
              {ouvindo ? 'Parar' : 'Fale o que você faz'}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
          {ouvindo
            ? parcial
              ? `“${parcial}”`
              : 'Ouvindo… diga, por exemplo: “faço porcelanato, fulget e pintura de fachada”.'
            : suportado
              ? 'Fale os serviços que você faz e eles são marcados para você.'
              : null}
        </p>
      </div>

      {filtradas.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Nenhum serviço encontrado</EmptyTitle>
            <EmptyDescription>Nada casa com “{busca}” nas áreas escolhidas.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" variant="outline" size="sm" onClick={() => setBusca('')}>
              Limpar busca
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-6">
          {filtradas.map(({ area, categorias }) => {
            const Icone = iconeDaArea(area.id)
            const naArea = area.categorias
              .flatMap((c) => c.servicos)
              .filter((s) => selecionados.has(s.id)).length
            return (
              <section key={area.id} className="flex flex-col gap-2" aria-label={area.nome}>
                {areasVisiveis.length > 1 && (
                  <div className="flex items-center gap-2">
                    <IconTile size="sm" aria-hidden="true">
                      <Icone />
                    </IconTile>
                    <h3 className="text-sm font-medium tracking-tight">{area.nome}</h3>
                    {naArea > 0 && (
                      <Badge variant="outline" className="tabular-nums">
                        {naArea}
                      </Badge>
                    )}
                  </div>
                )}
                <Accordion
                  multiple
                  value={busca ? abertosNaBusca : abertos}
                  onValueChange={(v) => {
                    if (!busca) setAbertos(v as string[])
                  }}
                >
                  {categorias.map(({ categoria, servicos }) => {
                    const chave = chaveCategoria(area, categoria)
                    const ids = categoria.servicos.map((s) => s.id)
                    const marcados = ids.filter((id) => selecionados.has(id)).length
                    const todos = marcados === ids.length
                    const idTodos = `${prefixo}-${chave}-todos`
                    return (
                      <AccordionItem key={chave} value={chave}>
                        <AccordionTrigger>
                          <span className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="truncate">{categoria.nome}</span>
                            <Badge
                              variant={marcados > 0 ? 'primary-light' : 'outline'}
                              className="tabular-nums"
                            >
                              {marcados > 0 ? `${marcados}/${ids.length}` : ids.length}
                            </Badge>
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <FieldGroup data-slot="checkbox-group" className="gap-3">
                            {!busca && (
                              <>
                                <Field orientation="horizontal">
                                  <Checkbox
                                    id={idTodos}
                                    checked={todos}
                                    indeterminate={marcados > 0 && !todos}
                                    onCheckedChange={() => alternarCategoria(ids, !todos)}
                                  />
                                  <FieldLabel htmlFor={idTodos} className="text-muted-foreground">
                                    Selecionar todos
                                  </FieldLabel>
                                </Field>
                                <Separator />
                              </>
                            )}
                            {servicos.map((servico) => {
                              const idCampo = `${prefixo}-${servico.id}`
                              return (
                                <Field key={servico.id} orientation="horizontal">
                                  <Checkbox
                                    id={idCampo}
                                    checked={selecionados.has(servico.id)}
                                    onCheckedChange={(c) => alternarServico(servico.id, c === true)}
                                  />
                                  <FieldLabel htmlFor={idCampo} className="font-normal">
                                    {servico.nome}
                                  </FieldLabel>
                                </Field>
                              )
                            })}
                          </FieldGroup>
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>
              </section>
            )
          })}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">Selecionados</p>
          <Badge variant="outline" className="tabular-nums">
            {resumo.length}
          </Badge>
        </div>
        {resumo.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum serviço marcado ainda. Abra uma categoria ou use o microfone.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5" aria-label="Serviços selecionados">
            {resumo.map((id) => {
              const nome = SERVICOS_POR_ID[id]?.servico.nome ?? id
              return (
                <li key={id}>
                  <Badge variant="outline" className="gap-1 pr-1">
                    {nome}
                    <button
                      type="button"
                      onClick={() => alternarServico(id, false)}
                      aria-label={`Remover ${nome}`}
                      className="rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <XIcon aria-hidden="true" />
                    </button>
                  </Badge>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
