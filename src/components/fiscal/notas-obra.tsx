'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  CircleAlertIcon,
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  FileCodeIcon,
  ReceiptTextIcon,
  RefreshCwIcon,
  SettingsIcon,
  XCircleIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cancelarNota, conferirNota } from '@/lib/fiscal/acoes'
import { ROTULO_STATUS, type NotaFiscal, type StatusNota } from '@/lib/fiscal/tipos'
import type { MotivoCancelamento } from '@/lib/fiscal/dps'
import { formatarMoeda } from '@/lib/formato'
import type { Cliente, Projeto, Recebimento } from '@/types'
import { Badge } from '@/components/reui/badge'
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { OpcaoSelect } from './campos'
import { EmitirNotaDialog, type PrefillNota } from './emitir-nota-dialog'

const CONSULTA_PUBLICA = 'https://www.nfse.gov.br/consultapublica'

const VARIANTE: Record<StatusNota, 'success-light' | 'destructive-light' | 'warning-light' | 'info-light' | 'secondary'> = {
  autorizada: 'success-light',
  rejeitada: 'destructive-light',
  erro_envio: 'warning-light',
  processando: 'info-light',
  cancelada: 'secondary',
}

const MOTIVOS = [
  { value: '1', label: 'Erro na emissão' },
  { value: '2', label: 'Serviço não prestado' },
  { value: '9', label: 'Outros' },
]

type Config = {
  pronto: boolean
  producao: boolean
  descricaoPadrao: string | null
}

function CancelarDialog({
  nota,
  onFechar,
  onCancelada,
}: {
  nota: NotaFiscal | null
  onFechar: () => void
  onCancelada: () => void
}) {
  const [motivo, setMotivo] = useState<MotivoCancelamento>('1')
  const [texto, setTexto] = useState('')
  const [enviando, iniciar] = useTransition()

  function cancelar() {
    if (!nota) return
    iniciar(async () => {
      const r = await cancelarNota(nota.id, motivo, texto)
      if (!r.ok) {
        toast.error(r.erro)
        return
      }
      toast.success('Nota cancelada.')
      setTexto('')
      onCancelada()
    })
  }

  return (
    <Dialog open={!!nota} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar nota {nota?.numero_nfse ? `nº ${nota.numero_nfse}` : ''}</DialogTitle>
          <DialogDescription>O cancelamento é registrado na Sefin Nacional e não pode ser desfeito.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="cancelar-motivo">Motivo</FieldLabel>
            <OpcaoSelect
              id="cancelar-motivo"
              valor={motivo}
              opcoes={MOTIVOS}
              onChange={(v) => setMotivo(v as MotivoCancelamento)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="cancelar-texto">Explique o motivo</FieldLabel>
            <Textarea
              id="cancelar-texto"
              rows={3}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Valor da parcela saiu errado, vou emitir de novo."
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar} disabled={enviando}>
            Voltar
          </Button>
          <Button type="button" variant="destructive" onClick={cancelar} disabled={enviando || texto.trim().length < 15}>
            {enviando && <Spinner data-icon="inline-start" />}
            Cancelar nota
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function NotasObra({
  projeto,
  cliente,
  recebimentos,
}: {
  projeto: Projeto
  cliente: Cliente | null
  recebimentos: Recebimento[]
}) {
  const supabase = createClient()
  const [notas, setNotas] = useState<NotaFiscal[] | null>(null)
  const [config, setConfig] = useState<Config | null>(null)
  const [cno, setCno] = useState<string | null>(null)
  const [emitir, setEmitir] = useState(false)
  const [cancelando, setCancelando] = useState<NotaFiscal | null>(null)
  const [conferindo, iniciarConferir] = useTransition()
  const [indisponivel, setIndisponivel] = useState(false)

  const carregar = useCallback(async () => {
    const [n, f, c, p] = await Promise.all([
      supabase
        .from('notas_fiscais')
        .select(
          'id, projeto_id, cliente_id, recebimento_id, ambiente, serie, numero_dps, status, valor, descricao, competencia, tomador, chave_acesso, numero_nfse, mensagens, autorizada_em, cancelada_em, created_at',
        )
        .eq('projeto_id', projeto.id)
        .order('created_at', { ascending: false }),
      supabase.from('empresa_fiscal').select('codigo_municipio, ambiente, descricao_padrao').maybeSingle(),
      supabase.from('empresa_certificados').select('empresa_id').maybeSingle(),
      supabase.from('projetos').select('cno').eq('id', projeto.id).maybeSingle(),
    ])
    if (n.error) {
      setIndisponivel(true)
      setNotas([])
      return
    }
    setNotas((n.data ?? []) as NotaFiscal[])
    setConfig({
      pronto: !!f.data?.codigo_municipio && !!c.data,
      producao: f.data?.ambiente === 'producao',
      descricaoPadrao: (f.data?.descricao_padrao as string | null) ?? null,
    })
    setCno((p.data?.cno as string | null) ?? null)
  }, [supabase, projeto.id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar()
  }, [carregar])

  if (indisponivel) return null

  const ultima = notas?.find((n) => n.status === 'autorizada') ?? notas?.[0]
  const prefill: PrefillNota = {
    projetoId: projeto.id,
    clienteId: cliente?.id ?? null,
    tomador: {
      documento: ultima?.tomador?.documento ?? cliente?.cnpj ?? cliente?.cpf ?? '',
      nome: ultima?.tomador?.nome ?? (cliente?.tipo === 'PJ' ? cliente?.razao_social || cliente?.nome : cliente?.nome) ?? '',
      email: ultima?.tomador?.email ?? cliente?.email ?? null,
      telefone: cliente?.telefone ?? null,
      endereco: ultima?.tomador?.endereco ?? null,
    },
    obra: { cno, endereco: null },
    descricao: config?.descricaoPadrao ? `${config.descricaoPadrao}\nObra: ${projeto.nome}` : `Serviços da obra ${projeto.nome}`,
    recebimentos,
    parcelasComNota: (notas ?? [])
      .filter((n) => n.recebimento_id && (n.status === 'autorizada' || n.status === 'processando'))
      .map((n) => n.recebimento_id as string),
    producao: !!config?.producao,
  }

  function conferir(nota: NotaFiscal) {
    iniciarConferir(async () => {
      const r = await conferirNota(nota.id)
      if (!r.ok) toast.error(r.erro)
      else toast.success(r.dados?.status === 'autorizada' ? 'A nota foi autorizada.' : 'A Sefin não recebeu a nota. Emita de novo.')
      await carregar()
    })
  }

  return (
    <Frame spacing="default">
      <FrameHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <FrameTitle>Notas fiscais</FrameTitle>
          <FrameDescription>
            NFS-e pelo emissor nacional, sem custo por nota.
            {config && !config.producao ? ' Modo teste ligado.' : ''}
          </FrameDescription>
        </div>
        {config?.pronto && (
          <Button type="button" size="sm" onClick={() => setEmitir(true)}>
            <ReceiptTextIcon data-icon="inline-start" />
            Emitir nota
          </Button>
        )}
      </FrameHeader>
      <FramePanel className={notas && notas.length > 0 ? 'p-0' : undefined}>
        {notas === null ? (
          <div className="flex justify-center p-6">
            <Spinner />
          </div>
        ) : config && !config.pronto ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SettingsIcon />
              </EmptyMedia>
              <EmptyTitle>Configure a nota fiscal</EmptyTitle>
              <EmptyDescription>Envie o certificado A1 e os dados fiscais da empresa para emitir.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm" variant="outline" render={<Link href="/empresa" />} nativeButton={false}>
                Abrir Empresa
              </Button>
            </EmptyContent>
          </Empty>
        ) : notas.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ReceiptTextIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhuma nota desta obra</EmptyTitle>
              <EmptyDescription>Emita a nota de uma parcela ou de um valor livre.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nota</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {notas.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="tabular-nums">
                    <div className="flex flex-col">
                      <span className="font-medium">{n.numero_nfse ? `nº ${n.numero_nfse}` : `DPS ${n.numero_dps}`}</span>
                      <span className="text-muted-foreground text-xs">
                        {new Date(n.created_at).toLocaleDateString('pt-BR')}
                        {n.ambiente === 'homologacao' ? ' · teste' : ''}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-48 truncate">{n.tomador?.nome}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatarMoeda(Number(n.valor))}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <Badge variant={VARIANTE[n.status]}>{ROTULO_STATUS[n.status]}</Badge>
                      {(n.status === 'rejeitada' || n.status === 'erro_envio') && n.mensagens?.[0] && (
                        <span className="text-muted-foreground flex max-w-64 items-start gap-1 text-xs">
                          <CircleAlertIcon className="mt-0.5 size-3 shrink-0" />
                          <span className="line-clamp-2">
                            {[n.mensagens[0].codigo, n.mensagens[0].descricao ?? n.mensagens[0].mensagem]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon-sm" aria-label="Ações da nota" />}
                      >
                        <EllipsisVerticalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {n.chave_acesso && (
                          <DropdownMenuItem
                            onClick={() => {
                              void navigator.clipboard?.writeText(n.chave_acesso!)
                              window.open(CONSULTA_PUBLICA, '_blank', 'noopener')
                              toast.success('Chave copiada. Cole na consulta pública para ver o DANFSe.')
                            }}
                          >
                            <ExternalLinkIcon />
                            Ver no gov.br
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem render={<a href={`/api/fiscal/notas/${n.id}/xml`} download />}>
                          <FileCodeIcon />
                          Baixar XML
                        </DropdownMenuItem>
                        {(n.status === 'erro_envio' || n.status === 'processando') && (
                          <DropdownMenuItem onClick={() => conferir(n)} disabled={conferindo}>
                            <RefreshCwIcon />
                            Conferir na Sefin
                          </DropdownMenuItem>
                        )}
                        {n.status === 'autorizada' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setCancelando(n)}>
                              <XCircleIcon />
                              Cancelar nota
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </FramePanel>

      {config?.pronto && (
        <EmitirNotaDialog
          aberto={emitir}
          onOpenChange={setEmitir}
          prefill={prefill}
          onEmitida={(fechar) => {
            if (fechar) setEmitir(false)
            void carregar()
          }}
        />
      )}
      <CancelarDialog
        nota={cancelando}
        onFechar={() => setCancelando(null)}
        onCancelada={() => {
          setCancelando(null)
          void carregar()
        }}
      />
    </Frame>
  )
}
