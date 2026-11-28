'use client'

import { useState } from 'react'
import { CircleAlertIcon, PlusIcon, TicketPercentIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/reui/alert'
import { Badge } from '@/components/reui/badge'
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { alternarCupomAcao, criarCupomAcao, type DadosCupom } from '@/app/(dashboard)/admin/actions'
import { CampoNumero, dataCurta, useAcaoAdmin } from './comum'
import type { Cupom } from './painel-admin'

function descricaoDesconto(c: Cupom) {
  const quanto =
    c.percentual != null
      ? `${c.percentual.toLocaleString('pt-BR')}%`
      : c.valor != null
        ? c.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : '—'
  const quando =
    c.duracao === 'forever' ? 'para sempre' : c.duracao === 'repeating' ? `por ${c.meses} meses` : 'na 1ª cobrança'
  return `${quanto} ${quando}`
}

function NovoCupom({ aberto, onOpenChange }: { aberto: boolean; onOpenChange: (v: boolean) => void }) {
  const [d, setD] = useState<DadosCupom>({ codigo: '', tipo: 'percentual', valor: 10, duracao: 'once', meses: 3, maxUsos: null, validoAte: null })
  const { rodando, rodar } = useAcaoAdmin()
  const set = <K extends keyof DadosCupom>(k: K, v: DadosCupom[K]) => setD((x) => ({ ...x, [k]: v }))

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo cupom</DialogTitle>
        </DialogHeader>
        <form
          id="novo-cupom"
          onSubmit={(e) => {
            e.preventDefault()
            rodar(() => criarCupomAcao(d), (ok) => ok && onOpenChange(false))
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="c-codigo">Código</FieldLabel>
              <Input
                id="c-codigo"
                value={d.codigo}
                maxLength={40}
                placeholder="FUNDADOR"
                className="font-mono uppercase"
                onChange={(e) => set('codigo', e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
              />
            </Field>
            <Field>
              <FieldLabel>Desconto</FieldLabel>
              <div className="flex gap-2">
                <ToggleGroup
                  value={[d.tipo]}
                  onValueChange={(v: string[]) => v[0] && set('tipo', v[0] as DadosCupom['tipo'])}
                  variant="outline"
                  aria-label="Tipo de desconto"
                >
                  <ToggleGroupItem value="percentual">%</ToggleGroupItem>
                  <ToggleGroupItem value="valor">R$</ToggleGroupItem>
                </ToggleGroup>
                <CampoNumero
                  valor={d.valor}
                  onChange={(v) => set('valor', v ?? 0)}
                  formato={d.tipo === 'valor' ? 'reais' : 'porcentagem'}
                  max={d.tipo === 'percentual' ? 100 : undefined}
                />
              </div>
            </Field>
            <Field>
              <FieldLabel>Por quanto tempo</FieldLabel>
              <ToggleGroup
                value={[d.duracao]}
                onValueChange={(v: string[]) => v[0] && set('duracao', v[0] as DadosCupom['duracao'])}
                variant="outline"
                aria-label="Duração do desconto"
              >
                <ToggleGroupItem value="once">1ª cobrança</ToggleGroupItem>
                <ToggleGroupItem value="repeating">Alguns meses</ToggleGroupItem>
                <ToggleGroupItem value="forever">Para sempre</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            {d.duracao === 'repeating' && (
              <Field>
                <FieldLabel htmlFor="c-meses">Meses</FieldLabel>
                <CampoNumero id="c-meses" valor={d.meses ?? null} onChange={(v) => set('meses', v ?? 1)} min={1} max={36} />
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="c-usos">Limite de usos</FieldLabel>
                <CampoNumero id="c-usos" valor={d.maxUsos ?? null} onChange={(v) => set('maxUsos', v || null)} min={1} />
                <FieldDescription>Vazio: sem limite.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="c-ate">Vale até</FieldLabel>
                <Input id="c-ate" type="date" value={d.validoAte ?? ''} onChange={(e) => set('validoAte', e.target.value || null)} />
                <FieldDescription>Vazio: não vence.</FieldDescription>
              </Field>
            </div>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={rodando}>
            Cancelar
          </Button>
          <Button type="submit" form="novo-cupom" disabled={rodando || d.codigo.length < 3}>
            {rodando && <Spinner />}
            Criar cupom
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function Cupons({
  cupons,
  erro,
  stripeLigado,
}: {
  cupons: Cupom[]
  erro: string | null
  stripeLigado: boolean
}) {
  const [novo, setNovo] = useState(false)
  const { rodando, rodar } = useAcaoAdmin()

  return (
    <Frame spacing="default">
      <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <FrameTitle>Cupons</FrameTitle>
        </div>
        <Button disabled={!stripeLigado} onClick={() => setNovo(true)}>
          <PlusIcon />
          Novo cupom
        </Button>
      </FrameHeader>
      <FramePanel className={cupons.length ? 'p-0' : undefined}>
        {!stripeLigado ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <TicketPercentIcon />
              </EmptyMedia>
              <EmptyTitle>Ligue o Stripe primeiro</EmptyTitle>
              <EmptyDescription>Cadastre a chave secreta do Stripe na aba Chaves para criar cupons.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : erro ? (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>Não deu para ler os cupons</AlertTitle>
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        ) : cupons.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <TicketPercentIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhum cupom ainda</EmptyTitle>
              <EmptyDescription>Nenhum cupom criado.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" onClick={() => setNovo(true)}>
                <PlusIcon />
                Novo cupom
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Desconto</TableHead>
                <TableHead className="text-right">Usos</TableHead>
                <TableHead className="hidden sm:table-cell">Vence</TableHead>
                <TableHead className="text-right">Ativo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cupons.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono font-medium">{c.codigo}</TableCell>
                  <TableCell>{descricaoDesconto(c)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.usos}
                    {c.maxUsos ? ` de ${c.maxUsos}` : ''}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden sm:table-cell">{dataCurta(c.expiraEm)}</TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-2">
                      {!c.ativo && <Badge variant="secondary">Desativado</Badge>}
                      <Switch
                        checked={c.ativo}
                        disabled={rodando}
                        aria-label={`Cupom ${c.codigo} ativo`}
                        onCheckedChange={(v) => rodar(() => alternarCupomAcao(c.id, v))}
                      />
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </FramePanel>
      {novo && <NovoCupom aberto onOpenChange={setNovo} />}
    </Frame>
  )
}
