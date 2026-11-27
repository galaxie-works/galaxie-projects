import { FramePanel } from '@/components/reui/frame'

// Um número do painel (rótulo, valor grande e detalhe), dentro de um Frame.
export function Numero({
  rotulo,
  valor,
  detalhe,
  alerta,
}: {
  rotulo: string
  valor: string
  detalhe?: string
  alerta?: boolean
}) {
  return (
    <FramePanel className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <span
        className={`truncate text-lg font-semibold tracking-tight tabular-nums sm:text-xl ${alerta ? 'text-destructive' : ''}`}
      >
        {valor}
      </span>
      {detalhe && <span className={`text-xs ${alerta ? 'text-destructive' : 'text-muted-foreground'}`}>{detalhe}</span>}
    </FramePanel>
  )
}
