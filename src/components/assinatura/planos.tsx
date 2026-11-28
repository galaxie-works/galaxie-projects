'use client'

import { useState } from 'react'
import { CheckIcon } from 'lucide-react'
import { Badge } from '@/components/reui/badge'
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemTitle,
} from '@/components/ui/item'
import { reais, type Ciclo, type Plano, type PlanoId } from '@/lib/planos'
import { abrirStripe } from './abrir-stripe'

export function Planos({
  planos,
  usuarioExtra,
  cobrancaLigada,
  planoAtual,
  cicloAtual,
  pago,
}: {
  /** Planos à venda, como estão no painel do admin. */
  planos: Plano[]
  /** Preço do usuário extra no escritório, em reais por mês. */
  usuarioExtra: number
  cobrancaLigada: boolean
  /** Plano já pago (null no teste ou na cortesia). */
  planoAtual: PlanoId | null
  cicloAtual: Ciclo | null
  /** Tem assinatura no Stripe: trocar de plano vai pelo portal. */
  pago: boolean
}) {
  const [ciclo, setCiclo] = useState<Ciclo>(cicloAtual ?? 'mensal')
  const [abrindo, setAbrindo] = useState<PlanoId | null>(null)
  // Quantos meses o anual economiza (os preços vêm do painel do admin).
  const mesesGratis = Math.max(0, ...planos.map((p) => Math.floor(12 - p.anual / p.mensal + 1e-9)))

  async function assinar(plano: PlanoId) {
    setAbrindo(plano)
    const foi = await abrirStripe('/api/stripe/assinar', { plano, ciclo })
    if (!foi) setAbrindo(null)
  }

  return (
    <Frame spacing="default">
      <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <FrameTitle>Planos</FrameTitle>
          <FrameDescription>
            Cartão, renovação automática, cancele quando quiser. Os dias grátis restantes continuam valendo.
          </FrameDescription>
        </div>
        <ToggleGroup
          value={[ciclo]}
          onValueChange={(v: string[]) => v[0] && setCiclo(v[0] as Ciclo)}
          variant="outline"
          aria-label="Forma de cobrança"
        >
          <ToggleGroupItem value="mensal">Mensal</ToggleGroupItem>
          <ToggleGroupItem value="anual" className="gap-2">
            Anual
            {mesesGratis > 0 && (
              <Badge variant="primary-light">
                {mesesGratis === 1 ? '1 mês grátis' : `${mesesGratis} meses grátis`}
              </Badge>
            )}
          </ToggleGroupItem>
        </ToggleGroup>
      </FrameHeader>
      <FramePanel>
        <ItemGroup className="grid gap-3 md:grid-cols-3">
          {planos.map((p) => {
            const atual = planoAtual === p.id && cicloAtual === ciclo
            const preco = ciclo === 'anual' ? p.anual : p.mensal
            return (
              <Item key={p.id} variant="outline" className="content-start">
                <ItemHeader>
                  <ItemTitle>
                    {p.nome}
                    {atual ? (
                      <Badge variant="success-light">Seu plano</Badge>
                    ) : p.destaque ? (
                      <Badge variant="primary-light">Mais escolhido</Badge>
                    ) : null}
                  </ItemTitle>
                </ItemHeader>
                <ItemContent className="basis-full gap-3">
                  <ItemDescription>{p.resumo}</ItemDescription>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-semibold tracking-tight">{reais(preco)}</span>
                    <span className="text-muted-foreground text-sm">
                      {ciclo === 'anual' ? '/ano' : '/mês'}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {[p.escritorio, p.campo, p.obras, `${p.comandosIA.toLocaleString('pt-BR')} comandos de IA por mês`].map(
                      (t) => (
                        <li key={t} className="flex items-start gap-2">
                          <CheckIcon className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                          {t}
                        </li>
                      ),
                    )}
                  </ul>
                </ItemContent>
                <ItemFooter>
                  <Button
                    className="w-full"
                    variant={p.destaque ? 'default' : 'outline'}
                    disabled={!cobrancaLigada || atual || abrindo !== null}
                    onClick={() => assinar(p.id)}
                  >
                    {abrindo === p.id && <Spinner />}
                    {atual ? 'Plano atual' : pago ? 'Trocar para este' : 'Assinar'}
                  </Button>
                </ItemFooter>
              </Item>
            )
          })}
        </ItemGroup>
        <p className="text-muted-foreground mt-3 text-xs">
          {cobrancaLigada
            ? `Usuário extra no escritório: ${reais(usuarioExtra)} por mês. Com a sua própria chave de IA em Ajustes, o assistente não tem limite.`
            : 'O pagamento online está sendo ligado. Até lá, seu acesso continua normalmente.'}
        </p>
      </FramePanel>
    </Frame>
  )
}
