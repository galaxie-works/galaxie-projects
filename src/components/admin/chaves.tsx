'use client'

import { useState } from 'react'
import { CircleAlertIcon, EyeIcon, EyeOffIcon, KeyRoundIcon, WebhookIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/reui/alert'
import { Badge } from '@/components/reui/badge'
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'
import { ConfirmarExclusao } from '@/components/projetos/confirmar-exclusao'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import {
  criarWebhookAcao,
  removerSegredoAcao,
  salvarSegredoAcao,
  testarSegredoAcao,
} from '@/app/(dashboard)/admin/actions'
import type { SituacaoSegredo } from '@/lib/plataforma/segredos'
import { dataCurta, useAcaoAdmin } from './comum'

function Origem({ s }: { s: SituacaoSegredo }) {
  if (s.origem === 'painel') return <Badge variant="success-light">No painel</Badge>
  if (s.origem === 'vercel') return <Badge variant="info-light">Na Vercel</Badge>
  return <Badge variant="warning-light">Falta</Badge>
}

function LinhaChave({ s, stripeLigado }: { s: SituacaoSegredo; stripeLigado: boolean }) {
  const [valor, setValor] = useState('')
  const [ver, setVer] = useState(false)
  const [remover, setRemover] = useState(false)
  const { rodando, rodar } = useAcaoAdmin()
  const id = `segredo-${s.nome}`

  return (
    <FramePanel className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-2 text-sm font-medium">
            {s.rotulo}
            <Origem s={s} />
          </span>
          <span className="text-muted-foreground text-xs">
            {s.final ? (
              <>
                Valendo agora: <span className="font-mono">••••{s.final}</span>
                {s.origem === 'painel' && ` · trocada em ${dataCurta(s.atualizadoEm)}`}
                {s.origem === 'painel' && s.naVercel && ' · a da Vercel fica de reserva'}
              </>
            ) : (
              'Ainda não configurada.'
            )}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {s.final && s.nome !== 'STRIPE_WEBHOOK_SECRET' && (
            <Button variant="outline" size="sm" disabled={rodando} onClick={() => rodar(() => testarSegredoAcao(s.nome))}>
              Testar
            </Button>
          )}
          {s.nome === 'STRIPE_WEBHOOK_SECRET' && (
            <Button
              variant="outline"
              size="sm"
              disabled={rodando || !stripeLigado}
              onClick={() => rodar(() => criarWebhookAcao())}
            >
              <WebhookIcon />
              Criar webhook no Stripe
            </Button>
          )}
          {s.origem === 'painel' && (
            <Button variant="ghost" size="sm" disabled={rodando} onClick={() => setRemover(true)}>
              Remover do painel
            </Button>
          )}
        </div>
      </div>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valor.trim()) return
          rodar(() => salvarSegredoAcao(s.nome, valor), (ok) => ok && setValor(''))
        }}
      >
        <Field>
          <FieldLabel htmlFor={id} className="sr-only">
            {s.rotulo}
          </FieldLabel>
          <div className="flex flex-col gap-2 sm:flex-row">
            <InputGroup className="flex-1">
              <InputGroupAddon>
                <KeyRoundIcon className="text-muted-foreground size-4" aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                id={id}
                type={ver ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                placeholder={s.final ? 'Cole a nova chave' : 'Cole a chave'}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="font-mono"
              />
              <InputGroupButton
                variant="ghost"
                aria-label={ver ? 'Esconder chave' : 'Mostrar chave'}
                aria-pressed={ver}
                onClick={() => setVer((v) => !v)}
              >
                {ver ? <EyeOffIcon className="text-muted-foreground size-4" /> : <EyeIcon className="text-muted-foreground size-4" />}
              </InputGroupButton>
            </InputGroup>
            <Button type="submit" disabled={rodando || !valor.trim()}>
              {rodando && <Spinner />}
              Testar e guardar
            </Button>
          </div>
          <FieldDescription>{s.ajuda}</FieldDescription>
        </Field>
      </form>
      <ConfirmarExclusao
        aberto={remover}
        onOpenChange={setRemover}
        titulo="Remover esta chave do painel?"
        descricao={
          s.naVercel
            ? 'Volta a valer a chave que está na Vercel.'
            : 'Não há outra na Vercel: essa parte do app fica desligada até cadastrar uma nova.'
        }
        rotulo="Remover"
        onConfirmar={async () => {
          const r = await removerSegredoAcao(s.nome)
          rodar(async () => r)
          return r.ok
        }}
      />
    </FramePanel>
  )
}

export function Chaves({
  segredos,
  stripeLigado,
  servidorPronto,
}: {
  segredos: SituacaoSegredo[]
  stripeLigado: boolean
  servidorPronto: { serviceRole: boolean; chaveMestra: boolean }
}) {
  return (
    <Frame spacing="default">
      <FrameHeader>
        <FrameTitle>Chaves do servidor</FrameTitle>
        <FrameDescription>
          Cifradas no banco. Depois de salvas, só os 4 últimos caracteres ficam visíveis. Valem antes das da Vercel, em até 30 segundos.
        </FrameDescription>
      </FrameHeader>
      {(!servidorPronto.serviceRole || !servidorPronto.chaveMestra) && (
        <FramePanel>
          <Alert variant="warning">
            <CircleAlertIcon />
            <AlertTitle>Este ambiente não consegue guardar chaves</AlertTitle>
            <AlertDescription>
              {!servidorPronto.serviceRole
                ? 'Falta SUPABASE_SERVICE_ROLE_KEY aqui. Ela só existe em produção: use o painel pelo endereço principal do app.'
                : 'Falta IA_CHAVE_MESTRA no servidor.'}
            </AlertDescription>
          </Alert>
        </FramePanel>
      )}
      {segredos.map((s) => (
        <LinhaChave key={s.nome} s={s} stripeLigado={stripeLigado} />
      ))}
      <FrameFooter>
        <p className="text-muted-foreground text-xs">
          IA_CHAVE_MESTRA e a chave do Supabase ficam só na Vercel.
        </p>
      </FrameFooter>
    </Frame>
  )
}
