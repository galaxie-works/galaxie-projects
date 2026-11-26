'use client'

import { useMemo, useState } from 'react'
import { MicIcon, SquareIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  AREAS_SERVICO,
  SERVICOS_POR_ID,
  encontrarServicosNoTexto,
  type AreaServico,
} from '@/lib/servicos'
import { useDitado } from '@/hooks/use-ditado'
import { Badge } from '@/components/reui/badge'
import {
  Cascader,
  CascaderChips,
  CascaderEmpty,
  CascaderList,
  CascaderPanel,
  CascaderStatus,
} from '@/components/reui/cascader/cascader'
import { CascaderItems } from '@/components/reui/cascader/cascader-item'
import { CascaderInput, CascaderNav } from '@/components/reui/cascader/cascader-nav'
import type { CascaderLabels, CascaderNode } from '@/components/reui/cascader/cascader-types'
import { Button } from '@/components/ui/button'
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

const itens = (n: number) => `${n} ${n === 1 ? 'item' : 'itens'}`

// Todo texto que a cascata mostra ou anuncia, em português.
const ROTULOS: Partial<CascaderLabels> = {
  search: 'Buscar serviço, ex.: porcelanato',
  back: 'Voltar',
  loading: 'Carregando…',
  empty: 'Nenhum serviço encontrado.',
  selectedCount: (n) => (n === 1 ? '1 marcado' : `${n} marcados`),
  breadcrumbLabel: 'Caminho',
  chipsLabel: 'Serviços selecionados',
  removeChip: (rotulo) => `Remover ${rotulo}`,
  rootLevel: 'Todas as áreas',
  itemCount: itens,
  selectedState: 'marcado',
  partiallySelectedState: 'parcialmente marcado',
  panelLabel: 'Serviços',
  keyboardHint: () =>
    'Use a seta para a direita para abrir e a seta para a esquerda para fechar. Espaço marca ou desmarca.',
  rootAnnouncement: (n) => `Todas as áreas, ${itens(n)}`,
  expandedAnnouncement: (rotulo, n) => `${rotulo} aberto, ${itens(n)}`,
  collapsedAnnouncement: (rotulo) => `${rotulo} fechado`,
  levelAnnouncement: (pai, nivel, n) => `${pai}, nível ${nivel}, ${itens(n)}`,
  resultsAnnouncement: (n) => (n === 1 ? '1 resultado' : `${n} resultados`),
  cascadeAnnouncement: (rotulo, n, marcando) =>
    `${rotulo} ${marcando ? 'marcado' : 'desmarcado'}, ${itens(n)} junto`,
  searchingAnnouncement: 'Buscando…',
}

// Ramos levam prefixo para nunca colidir com o id de um serviço; só os ids
// de serviço (as folhas) saem do componente.
const valorArea = (area: AreaServico) => `area:${area.id}`
const valorCategoria = (area: AreaServico, categoriaId: string) =>
  `categoria:${area.id}:${categoriaId}`

function categoriasComoNos(area: AreaServico): CascaderNode[] {
  return area.categorias.map((categoria) => ({
    value: valorCategoria(area, categoria.id),
    label: categoria.nome,
    children: categoria.servicos.map((servico) => ({
      value: servico.id,
      label: servico.nome,
      keywords: servico.sinonimos,
    })),
  }))
}

// Busca sem acento: "ceramica" acha "Cerâmica".
function casaBusca(no: CascaderNode, consulta: string) {
  const termo = normalizar(consulta)
  if (!termo) return true
  return [no.label, ...(no.keywords ?? [])].some((t) => normalizar(t).includes(termo))
}

export function nomesDosServicos(ids: string[]) {
  return ids.map((id) => SERVICOS_POR_ID[id]?.servico.nome).filter(Boolean) as string[]
}

export function ServicosPicker({ value, onChange, areas }: Props) {
  const [parcial, setParcial] = useState('')

  const areasVisiveis = useMemo(
    () => (areas ? AREAS_SERVICO.filter((a) => areas.includes(a.id)) : AREAS_SERVICO),
    [areas]
  )

  // Uma área só: a árvore já começa nas categorias.
  const nos = useMemo<CascaderNode[]>(() => {
    if (areasVisiveis.length === 1) return categoriasComoNos(areasVisiveis[0])
    return areasVisiveis.map((area) => {
      const Icone = iconeDaArea(area.id)
      return {
        value: valorArea(area),
        label: area.nome,
        icon: <Icone aria-hidden="true" />,
        children: categoriasComoNos(area),
      }
    })
  }, [areasVisiveis])

  const [abertos, setAbertos] = useState<string[]>(() =>
    areasVisiveis.length > 1 ? areasVisiveis.map(valorArea) : []
  )

  const idsVisiveis = useMemo(
    () =>
      new Set(
        areasVisiveis.flatMap((a) => a.categorias.flatMap((c) => c.servicos.map((s) => s.id)))
      ),
    [areasVisiveis]
  )

  const resumo = useMemo(() => value.filter((id) => idsVisiveis.has(id)), [value, idsVisiveis])

  // Com `cascade`, um ramo marcado faz parte do valor. Deriva os ramos
  // completos a partir dos serviços guardados.
  const valorCascata = useMemo(() => {
    const marcados = new Set(resumo)
    const ramos: string[] = []
    for (const area of areasVisiveis) {
      let areaCompleta = true
      for (const categoria of area.categorias) {
        const completa = categoria.servicos.every((s) => marcados.has(s.id))
        if (completa) ramos.push(valorCategoria(area, categoria.id))
        else areaCompleta = false
      }
      if (areaCompleta && areasVisiveis.length > 1) ramos.push(valorArea(area))
    }
    return [...resumo, ...ramos]
  }, [resumo, areasVisiveis])

  function aoMudar(proximo: string[]) {
    const folhas = proximo.filter((v) => idsVisiveis.has(v))
    const manter = new Set(folhas)
    const antes = new Set(value)
    onChange([
      // Serviços de áreas fora da tela continuam guardados.
      ...value.filter((id) => !idsVisiveis.has(id) || manter.has(id)),
      ...folhas.filter((id) => !antes.has(id)),
    ])
  }

  const { suportado, ouvindo, alternar } = useDitado({
    onParcial: setParcial,
    onFinal: (texto) => {
      setParcial('')
      adicionarPorVoz(texto)
    },
  })

  function adicionarPorVoz(texto: string) {
    const achados = encontrarServicosNoTexto(texto)
    const dentro = achados.filter((id) => idsVisiveis.has(id))
    const fora = achados.filter((id) => !idsVisiveis.has(id))
    const jaMarcados = new Set(value)
    const novos = dentro.filter((id) => !jaMarcados.has(id))

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

  return (
    <div className="flex flex-col gap-4">
      {suportado && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant={ouvindo ? 'default' : 'outline'}
            onClick={alternar}
            aria-pressed={ouvindo}
          >
            {ouvindo ? <SquareIcon data-icon="inline-start" /> : <MicIcon data-icon="inline-start" />}
            {ouvindo ? 'Parar' : 'Fale o que você faz'}
          </Button>
          <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
            {ouvindo
              ? parcial
                ? `“${parcial}”`
                : 'Ouvindo… diga, por exemplo: “faço porcelanato, fulget e pintura de fachada”.'
              : 'Fale os serviços que você faz e eles são marcados para você.'}
          </p>
        </div>
      )}

      <Cascader
        inline
        multiple
        cascade
        selectable="any"
        mode="tree"
        items={nos}
        value={valorCascata}
        onValueChange={aoMudar}
        expanded={abertos}
        onExpandedChange={setAbertos}
        filter={casaBusca}
        labels={ROTULOS}
      >
        {/* Inline não tem popup: a borda é a mesma da cascata em popover. */}
        <CascaderPanel className="rounded-lg ring-1 ring-foreground/10">
          <CascaderNav>
            <CascaderInput showBack={false} aria-label="Buscar serviço" />
          </CascaderNav>
          <CascaderEmpty />
          <CascaderList maxHeight={360}>
            <CascaderItems />
          </CascaderList>
          <CascaderStatus />
        </CascaderPanel>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Selecionados</p>
            <Badge variant="outline" className="tabular-nums">
              {resumo.length}
            </Badge>
          </div>
          <CascaderChips
            strategy="child"
            placeholder="Nenhum serviço marcado ainda. Abra uma categoria ou use o microfone."
          />
        </div>
      </Cascader>
    </div>
  )
}
