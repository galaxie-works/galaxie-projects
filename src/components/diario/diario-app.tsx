'use client'

import { useEffect, useState } from 'react'
import { CloudOffIcon, PlusIcon, RefreshCwIcon } from 'lucide-react'
import { toast } from 'sonner'
import { guardarContexto, lerContexto } from '@/lib/diario/local'
import { prepararCodificadorWebp } from '@/lib/diario/foto-webp'
import type { ContextoDiario, RegistroTela } from '@/lib/diario/tipos'
import { Alert, AlertDescription, AlertTitle } from '@/components/reui/alert'
import { Badge } from '@/components/reui/badge'
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { DiarioForm } from './diario-form'
import { DiarioLista, DiarioListaCarregando } from './diario-lista'
import { useFilaDiario, useRegistrosObra } from './use-diario'

const CHAVE_OBRA = 'diario-obra-escolhida'

type Props = {
  contexto: ContextoDiario
  obraInicial?: string
  /** Dentro da página da obra: sem seletor de obra nem título da página. */
  obraFixa?: string
}

function lerObraGuardada(): string | null {
  try {
    return localStorage.getItem(CHAVE_OBRA)
  } catch {
    return null
  }
}

export function DiarioApp({ contexto: contextoServidor, obraInicial, obraFixa }: Props) {
  const [contexto, setContexto] = useState(contextoServidor)
  const [obraEscolhida, setObraEscolhida] = useState<string | null>(obraFixa ?? obraInicial ?? null)
  const [tela, setTela] = useState<{ modo: 'lista' } | { modo: 'form'; registro: RegistroTela | null }>({
    modo: 'lista',
  })
  const { online, pendentes, enviando, enviar } = useFilaDiario()

  // Guarda obras e equipe no aparelho; se a página veio do cache (offline) e o
  // aparelho tem uma cópia mais nova, usa a mais nova.
  useEffect(() => {
    // Na página da obra o contexto é só dela: não substitui a cópia geral.
    if (obraFixa) return
    let cancelado = false
    void lerContexto()
      .then((salvo) => {
        if (cancelado) return
        if (salvo && salvo.empresaId === contextoServidor.empresaId && salvo.salvoEm > contextoServidor.salvoEm) {
          setContexto(salvo)
        } else {
          void guardarContexto(contextoServidor)
        }
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [contextoServidor, obraFixa])

  const obraValida = (id: string | null) => (id && contexto.obras.some((o) => o.id === id) ? id : null)
  const projetoId = obraValida(obraEscolhida) ?? (obraFixa ? null : (contexto.obras[0]?.id ?? null))

  useEffect(() => {
    if (navigator.onLine) void prepararCodificadorWebp().catch(() => {})
  }, [])

  // Volta para a última obra usada neste aparelho (só depois de montar).
  useEffect(() => {
    if (obraFixa || obraInicial) return
    const guardada = lerObraGuardada()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (guardada) setObraEscolhida(guardada)
  }, [obraFixa, obraInicial])

  const { registros, deCopia, erro, recarregar } = useRegistrosObra(projetoId)

  function escolherObra(id: string) {
    setObraEscolhida(id)
    try {
      localStorage.setItem(CHAVE_OBRA, id)
    } catch {}
  }

  async function enviarAgora() {
    const r = await enviar()
    if (r.semConexao) toast.error('Ainda sem internet.')
    else if (r.falhas) toast.warning(`${r.falhas} registro(s) não foram enviados.`)
    else toast.success('Tudo enviado')
  }

  if (tela.modo === 'form' && projetoId) {
    return (
      <DiarioForm
        contexto={contexto}
        projetoId={tela.registro?.projeto_id ?? projetoId}
        registro={tela.registro}
        onVoltar={() => {
          setTela({ modo: 'lista' })
          recarregar()
        }}
      />
    )
  }

  const status = (
    <div className="flex flex-wrap items-center gap-2">
      {!online && (
        <Badge variant="warning-light">
          <CloudOffIcon />
          Sem internet
        </Badge>
      )}
      {pendentes > 0 && (
        <Badge variant="info-light">
          {pendentes === 1 ? '1 registro aguardando envio' : `${pendentes} registros aguardando envio`}
        </Badge>
      )}
      {pendentes > 0 && online && (
        <Button variant="outline" size="sm" onClick={() => void enviarAgora()} disabled={enviando}>
          {enviando ? <Spinner /> : <RefreshCwIcon />}
          Enviar agora
        </Button>
      )}
    </div>
  )

  const botaoNovo = (
    <Button onClick={() => setTela({ modo: 'form', registro: null })} disabled={!projetoId}>
      <PlusIcon />
      Registrar o dia
    </Button>
  )

  if (contexto.obras.length === 0) {
    return (
      <Alert variant="info">
        <AlertTitle>Nenhuma obra cadastrada</AlertTitle>
        <AlertDescription>Cadastre uma obra em Projetos para começar o diário.</AlertDescription>
      </Alert>
    )
  }

  const obra = contexto.obras.find((o) => o.id === projetoId)

  return (
    <div className="flex flex-col gap-6">
      {!obraFixa && (
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-xl font-semibold tracking-tight">Diário de obra</h1>
            <p className="text-sm text-muted-foreground">
              O dia na obra: atividades, clima, equipe, ocorrências e fotos. Funciona sem internet.
            </p>
          </div>
          {botaoNovo}
        </header>
      )}

      {!obraFixa && (
        <div className="flex flex-wrap items-center gap-3">
          <Select
            items={contexto.obras.map((o) => ({ value: o.id, label: o.nome }))}
            value={projetoId}
            onValueChange={(v) => v && escolherObra(v as string)}
          >
            <SelectTrigger className="w-full sm:w-80" aria-label="Obra">
              <SelectValue placeholder="Escolha a obra" />
            </SelectTrigger>
            <SelectContent>
              {contexto.obras.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.cliente ? `${o.nome} · ${o.cliente}` : o.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {status}
        </div>
      )}

      {deCopia && (
        <Alert variant="warning">
          <CloudOffIcon />
          <AlertTitle>Mostrando a última cópia guardada</AlertTitle>
          <AlertDescription>
            Sem internet agora. O que você registrar fica no aparelho e é enviado quando a conexão voltar.
          </AlertDescription>
        </Alert>
      )}

      {erro && (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível carregar o diário</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
          <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={recarregar}>
            Tentar de novo
          </Button>
        </Alert>
      )}
      <Frame spacing="default" className="min-w-0">
        <FrameHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <FrameTitle>{obraFixa ? 'Diário de obra' : (obra?.nome ?? 'Registros')}</FrameTitle>
            <FrameDescription>
              {registros === null
                ? 'Carregando…'
                : registros.length === 1
                  ? '1 registro'
                  : `${registros.length} registros`}
            </FrameDescription>
          </div>
          {obraFixa && (
            <div className="flex flex-wrap items-center gap-2">
              {status}
              {botaoNovo}
            </div>
          )}
        </FrameHeader>
        <FramePanel>
          {registros === null ? (
            <DiarioListaCarregando />
          ) : (
            <DiarioLista
              registros={registros}
              contexto={contexto}
              onNovo={() => setTela({ modo: 'form', registro: null })}
              onEditar={(r) => setTela({ modo: 'form', registro: r })}
              onExcluido={recarregar}
            />
          )}
        </FramePanel>
      </Frame>
    </div>
  )
}
