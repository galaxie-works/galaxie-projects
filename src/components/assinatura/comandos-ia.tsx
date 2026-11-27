'use client'

import { useState } from 'react'
import { SparklesIcon } from 'lucide-react'
import { Badge } from '@/components/reui/badge'
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PACOTE_IA, reais } from '@/lib/planos'
import type { Carteira, LancamentoIA } from '@/lib/ia/cota'
import { abrirStripe } from './abrir-stripe'

const ROTULO_TIPO: Record<LancamentoIA['tipo'], string> = {
  uso: 'Uso',
  cota: 'Cota do mês',
  pacote: 'Pacote',
  ajuste: 'Plano',
}

const dataCurta = (s: string) =>
  new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Comandos de IA do plano, pacotes comprados e o extrato. */
export function ComandosIA({
  carteira,
  extrato,
  chavePropria,
  cobrancaLigada,
}: {
  carteira: Carteira | null
  extrato: LancamentoIA[]
  chavePropria: boolean
  cobrancaLigada: boolean
}) {
  const [comprando, setComprando] = useState(false)

  async function comprar() {
    setComprando(true)
    if (!(await abrirStripe('/api/stripe/pacote'))) setComprando(false)
  }

  const total = carteira ? carteira.saldo_plano + carteira.saldo_extra : 0
  const usadoPct = carteira?.cota_mensal
    ? Math.min(100, Math.max(0, ((carteira.cota_mensal - carteira.saldo_plano) / carteira.cota_mensal) * 100))
    : 0

  return (
    <Frame spacing="default">
      <FrameHeader>
        <FrameTitle>Comandos de IA</FrameTitle>
        <FrameDescription>
          Cada pedido ao assistente usa 1 comando; pedidos longos podem usar mais. A cota renova todo
          mês e os pacotes não vencem.
        </FrameDescription>
      </FrameHeader>
      <FramePanel className="flex flex-col gap-4">
        <Item variant="outline">
          <ItemMedia variant="icon">
            <SparklesIcon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              {chavePropria
                ? 'Ilimitado com a sua chave'
                : carteira
                  ? `${total.toLocaleString('pt-BR')} comandos disponíveis`
                  : 'Comandos do plano'}
              {chavePropria ? (
                <Badge variant="success-light">Chave própria</Badge>
              ) : carteira && total === 0 ? (
                <Badge variant="destructive-light">Acabou</Badge>
              ) : null}
            </ItemTitle>
            <ItemDescription>
              {carteira
                ? `Cota de ${carteira.cota_mensal.toLocaleString('pt-BR')} por mês: restam ${carteira.saldo_plano.toLocaleString('pt-BR')} até ${new Date(carteira.renova_em).toLocaleDateString('pt-BR')}. Pacotes: ${carteira.saldo_extra.toLocaleString('pt-BR')}.`
                : 'A cota aparece aqui assim que a conta for atualizada.'}
            </ItemDescription>
            {carteira && !chavePropria && (
              <Progress value={usadoPct} aria-label="Quanto da cota do mês já foi usado" className="mt-2" />
            )}
          </ItemContent>
          <ItemActions>
            <Button variant="outline" disabled={!cobrancaLigada || comprando} onClick={comprar}>
              {comprando && <Spinner />}
              {PACOTE_IA.comandos} por {reais(PACOTE_IA.preco)}
            </Button>
          </ItemActions>
        </Item>

        {extrato.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>O quê</TableHead>
                <TableHead className="text-right">Comandos</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extrato.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{dataCurta(l.created_at)}</TableCell>
                  <TableCell className="max-w-64 truncate">
                    <Badge variant="secondary" className="mr-2">
                      {ROTULO_TIPO[l.tipo]}
                    </Badge>
                    {l.tipo === 'uso' ? l.descricao : ''}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.comandos > 0 ? `+${l.comandos}` : l.comandos}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{l.saldo_depois}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </FramePanel>
    </Frame>
  )
}
