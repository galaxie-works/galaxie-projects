'use client'

import { useState } from 'react'
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { salvarExtrasAcao, type DadosExtras } from '@/app/(dashboard)/admin/actions'
import type { ConfigPlataforma } from '@/lib/plataforma/config'
import { CampoNumero, useAcaoAdmin } from './comum'

export function Extras({ config }: { config: ConfigPlataforma }) {
  const [d, setD] = useState<DadosExtras>({
    comandosTeste: config.comandosTeste,
    comandosCortesia: config.comandosCortesia,
    pacoteComandos: config.pacoteIA.comandos,
    pacotePreco: config.pacoteIA.preco,
    usuarioExtraPreco: config.usuarioExtra.preco,
  })
  const { rodando, rodar } = useAcaoAdmin()
  const set = (k: keyof DadosExtras) => (v: number | null) => setD((x) => ({ ...x, [k]: v ?? 0 }))
  const porComando = d.pacoteComandos > 0 ? d.pacotePreco / d.pacoteComandos : 0

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        rodar(() => salvarExtrasAcao(d))
      }}
    >
      <Frame spacing="default">
        <FrameHeader>
          <FrameTitle>IA e extras</FrameTitle>
          <FrameDescription>
            Cota de IA de quem não tem plano pago, pacote avulso de comandos e usuário extra. A cota de cada plano
            fica em Planos.
          </FrameDescription>
        </FrameHeader>
        <FramePanel>
          <FieldGroup>
            <FieldSet>
              <FieldLegend variant="label">Comandos de IA por mês</FieldLegend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="x-teste">No teste grátis</FieldLabel>
                  <CampoNumero id="x-teste" valor={d.comandosTeste} onChange={set('comandosTeste')} max={100000} />
                  <FieldDescription>Vale para contas novas.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="x-cortesia">Na cortesia</FieldLabel>
                  <CampoNumero id="x-cortesia" valor={d.comandosCortesia} onChange={set('comandosCortesia')} max={100000} />
                  <FieldDescription>Aplica na hora às contas cortesia.</FieldDescription>
                </Field>
              </div>
            </FieldSet>
            <FieldSet>
              <FieldLegend variant="label">Pacote avulso de comandos</FieldLegend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="x-pacote">Comandos no pacote</FieldLabel>
                  <CampoNumero id="x-pacote" valor={d.pacoteComandos} onChange={set('pacoteComandos')} min={1} max={100000} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="x-pacote-preco">Preço do pacote</FieldLabel>
                  <CampoNumero id="x-pacote-preco" formato="reais" valor={d.pacotePreco} onChange={set('pacotePreco')} />
                  <FieldDescription>
                    {porComando > 0
                      ? `${porComando.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 3 })} por comando. Cada comando custa à Galaxie cerca de US$ 0,004.`
                      : ' '}
                  </FieldDescription>
                </Field>
              </div>
            </FieldSet>
            <Field className="sm:max-w-[calc(50%-0.5rem)]">
              <FieldLabel htmlFor="x-usuario">Usuário extra no escritório (por mês)</FieldLabel>
              <CampoNumero id="x-usuario" formato="reais" valor={d.usuarioExtraPreco} onChange={set('usuarioExtraPreco')} />
            </Field>
          </FieldGroup>
        </FramePanel>
        <FrameFooter className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs">Preços novos sobem para o Stripe ao salvar, se ele estiver ligado.</p>
          <Button type="submit" disabled={rodando}>
            {rodando && <Spinner />}
            Salvar
          </Button>
        </FrameFooter>
      </Frame>
    </form>
  )
}
