'use client'

import { useState } from 'react'
import { PencilIcon, RefreshCwIcon } from 'lucide-react'
import { Badge } from '@/components/reui/badge'
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { salvarPlanoAcao, sincronizarStripeAcao, type DadosPlano } from '@/app/(dashboard)/admin/actions'
import { reais } from '@/lib/planos'
import type { PlanoPainel } from '@/lib/plataforma/config'
import { CampoNumero, useAcaoAdmin } from './comum'

const reaisCentavos = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const preco = (v: number) => (Number.isInteger(v) ? reais(v) : reaisCentavos(v))

function EditarPlano({
  plano,
  aberto,
  onOpenChange,
}: {
  plano: PlanoPainel
  aberto: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [d, setD] = useState<DadosPlano>({ ...plano, destaque: !!plano.destaque })
  const { rodando, rodar } = useAcaoAdmin()
  const set = <K extends keyof DadosPlano>(k: K, v: DadosPlano[K]) => setD((x) => ({ ...x, [k]: v }))
  const economia = d.mensal > 0 ? Math.round((1 - d.anual / (d.mensal * 12)) * 100) : 0

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Plano {plano.nome}</DialogTitle>
          <DialogDescription>
            Preço novo vale para quem assinar daqui para frente. Quem já assina continua no preço antigo até
            trocar de plano.
          </DialogDescription>
        </DialogHeader>
        <form
          id={`plano-${plano.id}`}
          onSubmit={(e) => {
            e.preventDefault()
            rodar(() => salvarPlanoAcao(d), (ok) => ok && onOpenChange(false))
          }}
        >
          <FieldGroup className="max-h-[60svh] overflow-y-auto">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="p-nome">Nome</FieldLabel>
                <Input id="p-nome" value={d.nome} maxLength={40} onChange={(e) => set('nome', e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="p-ia">Comandos de IA por mês</FieldLabel>
                <CampoNumero id="p-ia" valor={d.comandosIA} onChange={(v) => set('comandosIA', v ?? 0)} max={100000} />
              </Field>
              <Field>
                <FieldLabel htmlFor="p-mensal">Preço mensal</FieldLabel>
                <CampoNumero id="p-mensal" formato="reais" valor={d.mensal} onChange={(v) => set('mensal', v ?? 0)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="p-anual">Preço anual</FieldLabel>
                <CampoNumero id="p-anual" formato="reais" valor={d.anual} onChange={(v) => set('anual', v ?? 0)} />
                <FieldDescription>
                  {economia > 0 ? `${economia}% mais barato que 12 mensalidades.` : 'Sem desconto sobre o mensal.'}
                </FieldDescription>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="p-resumo">Frase do plano</FieldLabel>
              <Input id="p-resumo" value={d.resumo} maxLength={140} onChange={(e) => set('resumo', e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="p-escritorio">Escritório</FieldLabel>
                <Input id="p-escritorio" value={d.escritorio} maxLength={60} onChange={(e) => set('escritorio', e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="p-campo">Campo</FieldLabel>
                <Input id="p-campo" value={d.campo} maxLength={60} onChange={(e) => set('campo', e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="p-obras">Obras</FieldLabel>
                <Input id="p-obras" value={d.obras} maxLength={60} onChange={(e) => set('obras', e.target.value)} />
              </Field>
            </div>
            <Field orientation="horizontal">
              <Switch id="p-destaque" checked={d.destaque} onCheckedChange={(v) => set('destaque', v)} />
              <FieldLabel htmlFor="p-destaque">Mostrar como &quot;Mais escolhido&quot;</FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <Switch id="p-ativo" checked={d.ativo} onCheckedChange={(v) => set('ativo', v)} />
              <FieldLabel htmlFor="p-ativo">À venda (desligado, some da tela de planos; quem assina continua)</FieldLabel>
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={rodando}>
            Cancelar
          </Button>
          <Button type="submit" form={`plano-${plano.id}`} disabled={rodando}>
            {rodando && <Spinner />}
            Salvar plano
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PlanosAdmin({ planos, stripeLigado }: { planos: PlanoPainel[]; stripeLigado: boolean }) {
  const [editando, setEditando] = useState<PlanoPainel | null>(null)
  const { rodando, rodar } = useAcaoAdmin()

  return (
    <Frame spacing="default">
      <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <FrameTitle>Planos e preços</FrameTitle>
          <FrameDescription>
            O que aparece em Assinatura para todas as empresas. Ao salvar, o preço sobe para o Stripe e a cota
            de IA nova vale na hora para quem já está no plano.
          </FrameDescription>
        </div>
        <Button variant="outline" disabled={!stripeLigado || rodando} onClick={() => rodar(() => sincronizarStripeAcao())}>
          {rodando ? <Spinner /> : <RefreshCwIcon />}
          Conferir no Stripe
        </Button>
      </FrameHeader>
      <FramePanel className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plano</TableHead>
              <TableHead className="text-right">Mensal</TableHead>
              <TableHead className="text-right">Anual</TableHead>
              <TableHead className="text-right">IA por mês</TableHead>
              <TableHead className="hidden md:table-cell">Limites</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {planos.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {p.nome}
                    {!p.ativo && <Badge variant="secondary">Fora da venda</Badge>}
                    {p.destaque && <Badge variant="primary-light">Destaque</Badge>}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{preco(p.mensal)}</TableCell>
                <TableCell className="text-right tabular-nums">{preco(p.anual)}</TableCell>
                <TableCell className="text-right tabular-nums">{p.comandosIA.toLocaleString('pt-BR')}</TableCell>
                <TableCell className="text-muted-foreground hidden max-w-72 truncate text-xs md:table-cell">
                  {[p.escritorio, p.campo, p.obras].filter(Boolean).join(' · ')}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon-sm" aria-label={`Editar plano ${p.nome}`} onClick={() => setEditando(p)}>
                    <PencilIcon />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </FramePanel>
      <FrameFooter>
        <p className="text-muted-foreground text-xs">
          {stripeLigado
            ? '"Conferir no Stripe" cria o que faltar e acerta o que estiver diferente, sem mexer em quem já assina.'
            : 'O Stripe ainda não está ligado. Cadastre a chave em Chaves e os preços sobem sozinhos.'}
        </p>
      </FrameFooter>
      {editando && (
        <EditarPlano
          key={editando.id}
          plano={editando}
          aberto
          onOpenChange={(v) => !v && setEditando(null)}
        />
      )}
    </Frame>
  )
}
