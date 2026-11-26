'use client'

import { useState } from 'react'
import { ItensGrid } from '@/components/orcamento/itens-grid'
import Link from 'next/link'
import { toast } from 'sonner'
import { HammerIcon, MicIcon, PlusIcon, RulerIcon, SquareIcon, Trash2Icon } from 'lucide-react'
import { formatarMoeda } from '@/lib/formato'
import {
  AREAS_SUGERIDAS,
  formatarQuantidade,
  lerMedidasDitadas,
  nomeServico,
  novaArea,
  novoItem,
  quantidadePorUnidade,
  totalArea,
  totalOrcamento,
  type AreaOrcamento,
  type ItemOrcamento,
  type TabelaPrecos,
  type Unidade,
} from '@/lib/orcamento'
import { useDitado } from '@/hooks/use-ditado'
import { Badge } from '@/components/reui/badge'
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'
import { BotaoVoz } from '@/components/voz/botao-voz'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'

type Props = {
  areas: AreaOrcamento[]
  onChange: (areas: AreaOrcamento[]) => void
  /** Ids dos serviços que a empresa marcou no onboarding / em Empresa. */
  servicosEmpresa: string[]
  precos: TabelaPrecos
}

// Editor de áreas e medidas. Cada área tem serviços medidos (m², metro
// linear, unidade…) com preço unitário; o total sai sozinho.
export function OrcamentoEditor({ areas, onChange, servicosEmpresa, precos }: Props) {
  const total = totalOrcamento(areas)
  const usados = new Set(areas.map((a) => a.nome.trim().toLowerCase()))
  const sugestoes = AREAS_SUGERIDAS.filter((n) => !usados.has(n.toLowerCase())).slice(0, 6)

  function atualizarArea(chave: string, nova: AreaOrcamento) {
    onChange(areas.map((a) => (a.chave === chave ? nova : a)))
  }

  function adicionarArea(nome = '') {
    // Já começa com o serviço principal da empresa, que é o caso mais comum.
    const area = novaArea(nome)
    if (servicosEmpresa.length > 0) area.itens = [novoItem(servicosEmpresa[0], precos)]
    onChange([...areas, area])
  }

  if (servicosEmpresa.length === 0) {
    return (
      <Frame spacing="default">
        <FramePanel>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HammerIcon />
              </EmptyMedia>
              <EmptyTitle>Escolha os serviços que você faz</EmptyTitle>
              <EmptyDescription>
                O orçamento por área usa os serviços e preços da sua empresa.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button nativeButton={false} size="sm" render={<Link href="/empresa" />}>
                Cadastrar serviços
              </Button>
            </EmptyContent>
          </Empty>
        </FramePanel>
      </Frame>
    )
  }

  return (
    <Frame spacing="default">
      <FrameHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <FrameTitle>Áreas e medidas</FrameTitle>
          <FrameDescription>
            Separe a obra por área e informe as medidas de cada serviço.
          </FrameDescription>
        </div>
        {areas.length > 0 && (
          <span className="text-sm font-semibold tabular-nums">{formatarMoeda(total)}</span>
        )}
      </FrameHeader>

      {areas.length === 0 && (
        <FramePanel>
          <Empty className="py-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <RulerIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhuma área ainda</EmptyTitle>
              <EmptyDescription>
                Ex.: Garagem com 71,11 m² de piso e 20,79 m de rodapé.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" size="sm" onClick={() => adicionarArea()}>
                <PlusIcon data-icon="inline-start" />
                Adicionar área
              </Button>
            </EmptyContent>
          </Empty>
        </FramePanel>
      )}

      {areas.map((area, indice) => (
        <AreaPainel
          key={area.chave}
          area={area}
          indice={indice}
          servicosEmpresa={servicosEmpresa}
          precos={precos}
          onChange={(nova) => atualizarArea(area.chave, nova)}
          onRemover={() => onChange(areas.filter((a) => a.chave !== area.chave))}
        />
      ))}

      <FrameFooter className="flex-row flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => adicionarArea()}>
          <PlusIcon data-icon="inline-start" />
          Nova área
        </Button>
        {sugestoes.map((nome) => (
          <Button
            key={nome}
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => adicionarArea(nome)}
          >
            <PlusIcon data-icon="inline-start" />
            {nome}
          </Button>
        ))}
      </FrameFooter>
    </Frame>
  )
}

function AreaPainel({
  area,
  indice,
  servicosEmpresa,
  precos,
  onChange,
  onRemover,
}: {
  area: AreaOrcamento
  indice: number
  servicosEmpresa: string[]
  precos: TabelaPrecos
  onChange: (area: AreaOrcamento) => void
  onRemover: () => void
}) {
  const subtotal = totalArea(area)
  const porUnidade = quantidadePorUnidade(area)
  const idNome = `area-${area.chave}-nome`

  function adicionarItem() {
    // Sugere o próximo serviço da empresa que ainda não está nesta área.
    const jaTem = new Set(area.itens.map((i) => i.servico_id))
    const proximo = servicosEmpresa.find((s) => !jaTem.has(s)) ?? servicosEmpresa[0]
    onChange({ ...area, itens: [...area.itens, novoItem(proximo, precos)] })
  }

  function aplicarDitado(texto: string) {
    const lidos = lerMedidasDitadas(texto, servicosEmpresa, precos)
    if (lidos.length === 0) {
      toast.error('Não entendi as medidas', {
        description: 'Tente algo como “71 metros quadrados de porcelanato e 20 metros de rodapé”.',
      })
      return
    }
    let itens = [...area.itens]
    for (const l of lidos) {
      const item: ItemOrcamento = {
        ...novoItem(l.servico_id, precos),
        unidade: l.unidade,
        quantidade: l.quantidade,
        memoria_calculo: l.memoria_calculo,
      }
      if (l.preco_unitario !== null) item.preco_unitario = l.preco_unitario
      // Preenche a linha vazia do mesmo serviço em vez de duplicar.
      const vazio = itens.findIndex((i) => i.servico_id === l.servico_id && i.quantidade === 0)
      if (vazio >= 0)
        itens[vazio] = {
          ...item,
          chave: itens[vazio].chave,
          preco_unitario: l.preco_unitario ?? itens[vazio].preco_unitario,
        }
      else itens = [...itens, item]
    }
    onChange({ ...area, itens })
    toast.success(
      `${lidos.length} ${lidos.length === 1 ? 'medida adicionada' : 'medidas adicionadas'}`,
      {
        description: lidos
          .map(
            (l) =>
              `${nomeServico({ servico_id: l.servico_id, descricao: null })}: ${formatarQuantidade(l.quantidade, l.unidade)}`,
          )
          .join(' · '),
      },
    )
  }

  return (
    <FramePanel className="flex flex-col gap-4">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor={idNome} className="sr-only">
            Nome da área {indice + 1}
          </Label>
          <NomeArea
            id={idNome}
            value={area.nome}
            placeholder={`Área ${indice + 1} (ex.: Garagem)`}
            onChange={(nome) => onChange({ ...area, nome })}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {(Object.entries(porUnidade) as [Unidade, number][]).map(([u, q]) => (
              <Badge key={u} variant="outline" className="tabular-nums">
                {formatarQuantidade(q, u)}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 pt-1.5">
          <span className="text-sm font-semibold tabular-nums">{formatarMoeda(subtotal)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRemover}
            aria-label={`Remover a área ${area.nome || indice + 1}`}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>

      <div className="-mx-(--frame-panel-px)">
        <ItensGrid
          itens={area.itens}
          onChange={(itens) => onChange({ ...area, itens })}
          onAdicionar={adicionarItem}
          servicosEmpresa={servicosEmpresa}
          precos={precos}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <BotaoDitarMedidas onTexto={aplicarDitado} />
      </div>
    </FramePanel>
  )
}

function NomeArea({
  id,
  value,
  placeholder,
  onChange,
}: {
  id: string
  value: string
  placeholder: string
  onChange: (v: string) => void
}) {
  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="font-medium"
      />
      <InputGroupAddon align="inline-end">
        <BotaoVoz
          size="icon-xs"
          rotulo="Ditar o nome da área"
          onParcial={onChange}
          onFinal={onChange}
        />
      </InputGroupAddon>
    </InputGroup>
  )
}

function BotaoDitarMedidas({ onTexto }: { onTexto: (texto: string) => void }) {
  const [parcial, setParcial] = useState('')
  const { suportado, ouvindo, alternar } = useDitado({
    onParcial: setParcial,
    onFinal: (t) => {
      setParcial('')
      onTexto(t)
    },
  })
  if (!suportado) return null
  return (
    <>
      <Button
        type="button"
        variant={ouvindo ? 'default' : 'ghost'}
        size="sm"
        onClick={alternar}
        aria-pressed={ouvindo}
      >
        {ouvindo ? <SquareIcon data-icon="inline-start" /> : <MicIcon data-icon="inline-start" />}
        {ouvindo ? 'Parar' : 'Ditar medidas'}
      </Button>
      {ouvindo && (
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" aria-live="polite">
          {parcial || 'Ex.: “71 metros quadrados de porcelanato e 20 metros de rodapé”'}
        </span>
      )}
    </>
  )
}
