'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { HammerIcon, MicIcon, PlusIcon, RulerIcon, SquareIcon, Trash2Icon } from 'lucide-react'
import { formatarMoeda } from '@/lib/formato'
import {
  AREAS_SUGERIDAS,
  UNIDADES,
  LISTA_UNIDADES,
  avaliarMedida,
  ehConta,
  formatarQuantidade,
  lerMedidasDitadas,
  nomeServico,
  novaArea,
  novoItem,
  quantidadePorUnidade,
  totalArea,
  totalItem,
  totalOrcamento,
  type AreaOrcamento,
  type ItemOrcamento,
  type TabelaPrecos,
  type Unidade,
} from '@/lib/orcamento'
import { SERVICOS_POR_ID } from '@/lib/servicos'
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
import { CampoMoeda } from '@/components/projetos/campo-moeda'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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

  function atualizarItem(chave: string, novo: ItemOrcamento) {
    onChange({ ...area, itens: area.itens.map((i) => (i.chave === chave ? novo : i)) })
  }

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

      {area.itens.length > 0 && (
        <div className="flex flex-col gap-3">
          <div
            aria-hidden
            className="hidden gap-2 text-xs text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1fr)_6.5rem_2rem]"
          >
            <span>Serviço</span>
            <span>Medida</span>
            <span>Preço unitário</span>
            <span className="text-end">Total</span>
            <span />
          </div>
          {area.itens.map((item) => (
            <ItemLinha
              key={item.chave}
              item={item}
              servicosEmpresa={servicosEmpresa}
              precos={precos}
              onChange={(novo) => atualizarItem(item.chave, novo)}
              onRemover={() =>
                onChange({ ...area, itens: area.itens.filter((i) => i.chave !== item.chave) })
              }
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={adicionarItem}>
          <PlusIcon data-icon="inline-start" />
          Serviço
        </Button>
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

function ItemLinha({
  item,
  servicosEmpresa,
  precos,
  onChange,
  onRemover,
}: {
  item: ItemOrcamento
  servicosEmpresa: string[]
  precos: TabelaPrecos
  onChange: (item: ItemOrcamento) => void
  onRemover: () => void
}) {
  const id = `item-${item.chave}`
  const unidade = UNIDADES[item.unidade]

  // Serviços da empresa agrupados por categoria; mantém um serviço antigo
  // que a empresa desmarcou, para não sumir do orçamento.
  const grupos = useMemo(() => {
    const ids =
      item.servico_id && !servicosEmpresa.includes(item.servico_id)
        ? [...servicosEmpresa, item.servico_id]
        : servicosEmpresa
    const mapa = new Map<string, { nome: string; itens: { value: string; label: string }[] }>()
    for (const sid of ids) {
      const c = SERVICOS_POR_ID[sid]
      if (!c) continue
      const g = mapa.get(c.categoria.id) ?? { nome: c.categoria.nome, itens: [] }
      g.itens.push({ value: sid, label: c.servico.nome })
      mapa.set(c.categoria.id, g)
    }
    return [...mapa.values()]
  }, [servicosEmpresa, item.servico_id])
  const itensSelect = grupos.flatMap((g) => g.itens)

  function trocarServico(servicoId: string) {
    const preco = precos[servicoId]
    const base = novoItem(servicoId, precos)
    onChange({
      ...item,
      servico_id: servicoId,
      unidade: preco?.unidade ?? base.unidade,
      // Serviço sem preço na tabela começa em zero, não herda o do anterior.
      preco_unitario: preco?.preco ?? 0,
    })
  }

  return (
    <div className="grid grid-cols-2 items-start gap-2 border-t pt-3 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1fr)_6.5rem_2rem] sm:border-t-0 sm:pt-0">
      <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
        <Label htmlFor={`${id}-servico`} className="text-xs text-muted-foreground sm:sr-only">
          Serviço
        </Label>
        <Select
          items={itensSelect}
          value={item.servico_id ?? ''}
          onValueChange={(v) => v && trocarServico(v as string)}
        >
          <SelectTrigger id={`${id}-servico`} className="w-full">
            <SelectValue placeholder="Escolha o serviço" />
          </SelectTrigger>
          <SelectContent>
            {grupos.map((g) => (
              <SelectGroup key={g.nome}>
                <SelectLabel>{g.nome}</SelectLabel>
                {g.itens.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-medida`} className="text-xs text-muted-foreground sm:sr-only">
          Medida
        </Label>
        <CampoMedida
          id={`${id}-medida`}
          item={item}
          onChange={(quantidade, memoria) =>
            onChange({ ...item, quantidade, memoria_calculo: memoria })
          }
          onUnidade={(u) => onChange({ ...item, unidade: u })}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-preco`} className="text-xs text-muted-foreground sm:sr-only">
          Preço por {unidade.curto}
        </Label>
        <CampoMoeda
          id={`${id}-preco`}
          valor={item.preco_unitario || null}
          onChange={(v) => onChange({ ...item, preco_unitario: v ?? 0 })}
          placeholder={`R$ 0,00 / ${unidade.curto}`}
        />
      </div>

      <div className="flex items-center justify-between gap-2 sm:h-8 sm:justify-end">
        <span className="text-xs text-muted-foreground sm:hidden">Total</span>
        <span className="text-sm font-medium tabular-nums">{formatarMoeda(totalItem(item))}</span>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemover}
          aria-label={`Remover ${nomeServico(item)}`}
        >
          <Trash2Icon />
        </Button>
      </div>
    </div>
  )
}

// Medida aceita número ou conta: "71,11", "5,2 x 3,4 + 2 x 1,5".
function CampoMedida({
  id,
  item,
  onChange,
  onUnidade,
}: {
  id: string
  item: ItemOrcamento
  onChange: (quantidade: number, memoria: string | null) => void
  onUnidade: (u: Unidade) => void
}) {
  const inicial =
    item.memoria_calculo ?? (item.quantidade ? formatarQuantidade(item.quantidade) : '')
  const [texto, setTexto] = useState(inicial)
  const [ultimoExterno, setUltimoExterno] = useState(inicial)
  // Valor mudou de fora (ditado): mostra o novo.
  if (inicial !== ultimoExterno) {
    setUltimoExterno(inicial)
    setTexto(inicial)
  }

  const valor = avaliarMedida(texto)
  const invalido = texto.trim() !== '' && valor === null
  const conta = ehConta(texto) && valor !== null

  function mudar(t: string) {
    setTexto(t)
    const v = avaliarMedida(t)
    if (t.trim() === '') onChange(0, null)
    else if (v !== null) onChange(v, ehConta(t) ? t.trim() : null)
  }

  const itensUnidade = LISTA_UNIDADES

  return (
    <div className="flex flex-col gap-1">
      <InputGroup>
        <InputGroupInput
          id={id}
          inputMode="decimal"
          value={texto}
          onChange={(e) => mudar(e.target.value)}
          onBlur={() => {
            if (!invalido && !conta) {
              const novo = item.quantidade ? formatarQuantidade(item.quantidade) : ''
              setTexto(novo)
              setUltimoExterno(novo)
            }
          }}
          placeholder="0 ou 5 x 3,2"
          aria-invalid={invalido || undefined}
          className="tabular-nums"
        />
        <InputGroupAddon align="inline-end">
          <Select
            items={itensUnidade}
            value={item.unidade}
            onValueChange={(v) => v && onUnidade(v as Unidade)}
          >
            <SelectTrigger
              size="sm"
              aria-label="Unidade"
              className="border-0 bg-transparent dark:bg-transparent"
            >
              <InputGroupText>{UNIDADES[item.unidade].curto}</InputGroupText>
            </SelectTrigger>
            <SelectContent>
              {itensUnidade.map((u) => (
                <SelectItem key={u.value} value={u.value}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </InputGroupAddon>
      </InputGroup>
      {conta && (
        <span className="text-xs text-muted-foreground tabular-nums">
          = {formatarQuantidade(valor, item.unidade)}
        </span>
      )}
      {invalido && <span className="text-xs text-destructive">Use números, x, + ou −.</span>}
    </div>
  )
}
