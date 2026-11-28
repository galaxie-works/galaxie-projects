'use client'

import { useState } from 'react'
import { CircleAlertIcon, EllipsisIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/reui/alert'
import { Badge } from '@/components/reui/badge'
import { Frame, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { darComandosAcao, darCortesiaAcao, estenderTesteAcao } from '@/app/(dashboard)/admin/actions'
import { CampoNumero, dataCurta, useAcaoAdmin } from './comum'
import type { Assinante } from './painel-admin'

const STATUS: Record<string, { rotulo: string; variante: 'info-light' | 'success-light' | 'warning-light' | 'destructive-light' | 'primary-light' }> = {
  teste: { rotulo: 'Teste', variante: 'info-light' },
  ativa: { rotulo: 'Ativa', variante: 'success-light' },
  atrasada: { rotulo: 'Atrasada', variante: 'warning-light' },
  cancelada: { rotulo: 'Cancelada', variante: 'destructive-light' },
  cortesia: { rotulo: 'Cortesia', variante: 'primary-light' },
}

type Acao = { tipo: 'comandos' | 'teste'; empresa: Assinante } | null

function DialogoAcao({ acao, onFechar }: { acao: NonNullable<Acao>; onFechar: () => void }) {
  const [numero, setNumero] = useState<number | null>(acao.tipo === 'teste' ? 7 : 100)
  const [motivo, setMotivo] = useState('')
  const { rodando, rodar } = useAcaoAdmin()
  const comandos = acao.tipo === 'comandos'

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{comandos ? 'Dar comandos de IA' : 'Estender o teste grátis'}</DialogTitle>
          <DialogDescription>{acao.empresa.nome}</DialogDescription>
        </DialogHeader>
        <form
          id="acao-assinante"
          onSubmit={(e) => {
            e.preventDefault()
            const n = numero ?? 0
            rodar(
              () => (comandos ? darComandosAcao(acao.empresa.id, n, motivo) : estenderTesteAcao(acao.empresa.id, n)),
              (ok) => ok && onFechar(),
            )
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="a-num">{comandos ? 'Comandos' : 'Dias a mais'}</FieldLabel>
              <CampoNumero
                id="a-num"
                valor={numero}
                onChange={setNumero}
                min={comandos ? -100000 : 1}
                max={comandos ? 100000 : 365}
              />
              <FieldDescription>
                {comandos
                  ? 'Entram como extra e não vencem. Número negativo tira comandos.'
                  : `Hoje o teste vai até ${dataCurta(acao.empresa.testeFim)}.`}
              </FieldDescription>
            </Field>
            {comandos && (
              <Field>
                <FieldLabel htmlFor="a-motivo">Aparece no extrato do cliente</FieldLabel>
                <Input id="a-motivo" value={motivo} maxLength={100} placeholder="Comandos de presente da Galaxie" onChange={(e) => setMotivo(e.target.value)} />
              </Field>
            )}
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={rodando}>
            Cancelar
          </Button>
          <Button type="submit" form="acao-assinante" disabled={rodando || !numero}>
            {rodando && <Spinner />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function Assinantes({ assinantes }: { assinantes: Assinante[] | null }) {
  const [acao, setAcao] = useState<Acao>(null)
  const { rodando, rodar } = useAcaoAdmin()

  return (
    <Frame spacing="default">
      <FrameHeader>
        <FrameTitle>Assinantes</FrameTitle>
      </FrameHeader>
      <FramePanel className={assinantes?.length ? 'p-0' : undefined}>
        {!assinantes ? (
          <Alert variant="warning">
            <CircleAlertIcon />
            <AlertTitle>Lista indisponível neste ambiente</AlertTitle>
            <AlertDescription>Falta SUPABASE_SERVICE_ROLE_KEY aqui. Ela só existe em produção.</AlertDescription>
          </Alert>
        ) : assinantes.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma empresa ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="hidden md:table-cell">Vence</TableHead>
                <TableHead className="text-right">Comandos</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {assinantes.map((a) => {
                const st = a.status ? STATUS[a.status] : null
                const vence =
                  a.status === 'teste' ? a.testeFim : a.status === 'cortesia' ? null : a.periodoFim
                return (
                  <TableRow key={a.id}>
                    <TableCell className="max-w-56">
                      <div className="flex flex-col">
                        <span className="truncate font-medium">{a.nome}</span>
                        <span className="text-muted-foreground truncate text-xs">
                          {a.email || 'sem e-mail'} · {a.tipo}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-wrap items-center gap-1.5">
                        {st ? <Badge variant={st.variante}>{st.rotulo}</Badge> : <Badge variant="outline">Sem assinatura</Badge>}
                        {a.plano && !['teste', 'cortesia'].includes(a.plano) && (
                          <span className="text-muted-foreground text-xs capitalize">
                            {a.plano}
                            {a.ciclo ? ` ${a.ciclo}` : ''}
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">
                      {a.status === 'cortesia' ? 'Não vence' : dataCurta(vence)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {a.comandos == null ? '—' : a.comandos.toLocaleString('pt-BR')}
                      {a.cota != null && <span className="text-muted-foreground text-xs"> / {a.cota.toLocaleString('pt-BR')} mês</span>}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="icon-sm" aria-label={`Ações para ${a.nome}`} disabled={rodando} />}
                        >
                          <EllipsisIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setAcao({ tipo: 'comandos', empresa: a })}>
                            Dar comandos de IA
                          </DropdownMenuItem>
                          {a.status === 'teste' && (
                            <DropdownMenuItem onClick={() => setAcao({ tipo: 'teste', empresa: a })}>
                              Estender o teste
                            </DropdownMenuItem>
                          )}
                          {a.status !== 'cortesia' && !(a.pagaStripe && ['ativa', 'atrasada'].includes(a.status ?? '')) && (
                            <DropdownMenuItem onClick={() => rodar(() => darCortesiaAcao(a.id))}>
                              Transformar em cortesia
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </FramePanel>
      {acao && <DialogoAcao key={`${acao.tipo}-${acao.empresa.id}`} acao={acao} onFechar={() => setAcao(null)} />}
    </Frame>
  )
}
