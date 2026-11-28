import Link from 'next/link'
import {
  CloudDrizzleIcon,
  CloudFogIcon,
  CloudIcon,
  CloudLightningIcon,
  CloudOffIcon,
  CloudRainIcon,
  CloudSunIcon,
  SnowflakeIcon,
  SunIcon,
  UmbrellaIcon,
  type LucideIcon,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/reui/alert'
import { Frame, FramePanel } from '@/components/reui/frame'
import { EscolherCidade } from '@/components/inicio/escolher-cidade'
import { rotuloDiaCurto, type DiaPrevisao, type Previsao, type TipoTempo } from '@/lib/clima'
import { cn } from '@/lib/utils'

const ICONE: Record<TipoTempo, LucideIcon> = {
  sol: SunIcon,
  'poucas-nuvens': CloudSunIcon,
  nublado: CloudIcon,
  neblina: CloudFogIcon,
  garoa: CloudDrizzleIcon,
  chuva: CloudRainIcon,
  temporal: CloudLightningIcon,
  neve: SnowflakeIcon,
}

export interface ObraNaChuva {
  id: string
  nome: string
  /** 'execucao' = já em andamento; 'inicio' = início marcado num dia de chuva. */
  motivo: 'execucao' | 'inicio'
  /** Dia de início (só para motivo 'inicio'). */
  dia?: string
}

interface Props {
  cidade: string | null
  previsao: Previsao | null
  hoje: string
  obras: ObraNaChuva[]
  className?: string
}

function tituloChuva(dias: DiaPrevisao[], total: number, hoje: string): string {
  if (dias.length > 3) return `Chuva em ${dias.length} dos próximos ${total} dias`
  return `Chuva prevista ${listaDias(dias, hoje)}`
}

function listaDias(dias: DiaPrevisao[], hoje: string): string {
  const nomes = dias.map((d) => rotuloDiaCurto(d.data, hoje).toLowerCase())
  if (nomes.length <= 1) return nomes.join('')
  return `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`
}

function DiaColuna({ dia, hoje }: { dia: DiaPrevisao; hoje: string }) {
  const Icone = ICONE[dia.tipo]
  return (
    <li
      className={cn(
        'flex min-w-0 flex-col items-center gap-1 rounded-md px-0.5 py-1.5',
        dia.risco === 'chuva' && 'bg-info/8'
      )}
      title={[dia.descricao, dia.chanceChuva !== null && `${dia.chanceChuva}% de chance de chuva`, dia.chuvaMm > 0 && `${dia.chuvaMm} mm`].filter(Boolean).join(', ')}
    >
      <span className={cn('text-xs text-muted-foreground', dia.data === hoje && 'font-medium text-foreground')}>
        {rotuloDiaCurto(dia.data, hoje)}
      </span>
      <Icone
        className={cn('size-5', dia.risco === 'seco' ? 'text-muted-foreground' : 'text-info')}
        aria-label={dia.descricao}
      />
      <span className="text-xs font-medium tabular-nums">
        {dia.maxima}°<span className="text-muted-foreground font-normal"> {dia.minima}°</span>
      </span>
      <span
        className={cn(
          'flex items-center gap-0.5 text-xs tabular-nums',
          dia.risco === 'seco' ? 'text-muted-foreground' : 'text-info'
        )}
      >
        <UmbrellaIcon className="hidden size-3 sm:block" aria-hidden />
        {dia.chanceChuva !== null ? `${dia.chanceChuva}%` : `${String(dia.chuvaMm).replace('.', ',')} mm`}
      </span>
    </li>
  )
}

/** Previsão de 7 dias com aviso de chuva nas obras. Sem estado: só desenha. */
export function PrevisaoTempoPainel({ cidade, previsao, hoje, obras, className }: Props) {
  if (!cidade) {
    return (
      <Frame spacing="default" className={cn('min-w-0', className)}>
        <FramePanel className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <CloudSunIcon className="size-4 shrink-0 text-muted-foreground" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium">Previsão do tempo</span>
              <span className="text-xs text-muted-foreground">Avisa se a chuva for atrasar obra.</span>
            </div>
          </div>
          <EscolherCidade rotulo="Escolher cidade" variante="outline" />
        </FramePanel>
      </Frame>
    )
  }

  const diasChuva = previsao?.dias.filter((d) => d.risco === 'chuva') ?? []
  const emExecucao = obras.filter((o) => o.motivo === 'execucao')
  const inicios = obras.filter((o) => o.motivo === 'inicio')

  return (
    <Frame spacing="default" className={cn('min-w-0', className)}>
      <FramePanel className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-2">
            {previsao?.atual && (
              <span className="text-lg font-semibold tracking-tight tabular-nums">{previsao.atual.temperatura}°</span>
            )}
            <span className="truncate text-xs text-muted-foreground">
              {previsao?.atual ? `${previsao.atual.descricao} em ` : ''}
              {cidade}
            </span>
          </div>
          <EscolherCidade rotulo="Trocar" />
        </div>

        {previsao ? (
          <ol className="grid grid-cols-7 gap-0.5" aria-label="Previsão dos próximos 7 dias">
            {previsao.dias.map((d) => (
              <DiaColuna key={d.data} dia={d} hoje={hoje} />
            ))}
          </ol>
        ) : (
          <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
            <CloudOffIcon className="size-4" />
            Previsão indisponível agora. Tente de novo mais tarde.
          </div>
        )}

        {diasChuva.length > 0 && (
          <Alert variant="info">
            <CloudRainIcon />
            <AlertTitle>{tituloChuva(diasChuva, previsao?.dias.length ?? 7, hoje)}</AlertTitle>
            <AlertDescription className="text-xs">
              {obras.length === 0 ? (
                'Vale reprogramar serviços externos, como piso, fachada e concretagem.'
              ) : (
                <span>
                  {emExecucao.length > 0 &&
                    `${emExecucao.length} ${emExecucao.length === 1 ? 'obra em execução pode' : 'obras em execução podem'} parar no serviço externo. `}
                  {inicios.length > 0 && (
                    <>
                      Início marcado na chuva:{' '}
                      {inicios.map((o, i) => (
                        <span key={o.id}>
                          {i > 0 && ', '}
                          <Link href={`/projetos/${o.id}`} className="font-medium underline-offset-2 hover:underline">
                            {o.nome}
                          </Link>{' '}
                          ({rotuloDiaCurto(o.dia ?? '', hoje).toLowerCase()})
                        </span>
                      ))}
                      .
                    </>
                  )}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}
      </FramePanel>
    </Frame>
  )
}
