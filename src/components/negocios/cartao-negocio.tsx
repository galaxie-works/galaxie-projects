'use client'

import Link from 'next/link'
import {
  CalculatorIcon,
  CalendarIcon,
  EllipsisIcon,
  PencilIcon,
  RotateCcwIcon,
  ThumbsDownIcon,
  Trash2Icon,
  TrophyIcon,
  UserIcon,
} from 'lucide-react'
import { formatarData, formatarMoeda } from '@/lib/formato'
import { diasNaFase, negocioAberto, negocioParado, valorDoNegocio } from '@/lib/negocios'
import { VARIANTE_FASE_NEGOCIO } from '@/lib/status'
import { FASE_NEGOCIO_LABEL, type Negocio } from '@/types'
import { Badge } from '@/components/reui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item'
import type { AcoesNegocio } from './negocio-acoes'

type Props = {
  negocio: Negocio
  acoes: AcoesNegocio
  agora: number
  /** No funil a fase já é a coluna; fora dele mostramos o badge. */
  mostrarFase?: boolean
  /** No painel do cliente o nome do cliente é redundante. */
  mostrarCliente?: boolean
}

function dias(n: number) {
  return n === 1 ? '1 dia' : `${n} dias`
}

export function CartaoNegocio({ negocio: n, acoes, agora, mostrarFase, mostrarCliente = true }: Props) {
  const valor = valorDoNegocio(n)
  const parado = negocioParado(n, agora)
  const aberto = negocioAberto(n)
  const parado_dias = diasNaFase(n, agora)

  return (
    <Item variant="outline" size="sm" className="bg-background">
      <ItemContent className="min-w-0">
        <ItemTitle className="line-clamp-2">{n.titulo}</ItemTitle>
        {mostrarCliente && n.clientes?.nome && (
          <Link
            href={`/clientes/${n.cliente_id}`}
            className="truncate text-xs text-muted-foreground hover:underline"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {n.clientes.nome}
          </Link>
        )}
        <ItemDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="font-medium text-foreground tabular-nums">
            {valor > 0 ? formatarMoeda(valor) : 'Sem valor'}
          </span>
          {mostrarFase && <Badge variant={VARIANTE_FASE_NEGOCIO[n.fase]}>{FASE_NEGOCIO_LABEL[n.fase]}</Badge>}
          {aberto ? (
            <span className={parado ? 'font-medium text-destructive' : ''}>
              {parado_dias === 0 ? 'Mudou hoje' : `${dias(parado_dias)} na fase`}
            </span>
          ) : n.fase === 'perdido' && n.motivo_perda ? (
            <span className="truncate">{n.motivo_perda}</span>
          ) : null}
          {aberto && n.previsao_fechamento && (
            <span className="flex items-center gap-1 tabular-nums">
              <CalendarIcon aria-hidden className="size-3" />
              {formatarData(n.previsao_fechamento)}
            </span>
          )}
          {n.equipe?.nome && (
            <span className="flex items-center gap-1">
              <UserIcon aria-hidden className="size-3" />
              {n.equipe.nome}
            </span>
          )}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Ações do negócio ${n.titulo}`}
                onPointerDown={(e) => e.stopPropagation()}
              />
            }
          >
            <EllipsisIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => acoes.editar(n)}>
              <PencilIcon />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => acoes.orcamento(n)}>
              <CalculatorIcon />
              {n.projeto_id ? 'Abrir orçamento' : 'Montar orçamento'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {aberto ? (
              <>
                <DropdownMenuItem onClick={() => acoes.ganhar(n)}>
                  <TrophyIcon />
                  Marcar ganho
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => acoes.perder(n)}>
                  <ThumbsDownIcon />
                  Marcar perdido
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onClick={() => acoes.mover(n, 'negociacao', n.ordem)}>
                <RotateCcwIcon />
                Reabrir em Negociação
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => acoes.excluir(n)}>
              <Trash2Icon />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ItemActions>
    </Item>
  )
}
