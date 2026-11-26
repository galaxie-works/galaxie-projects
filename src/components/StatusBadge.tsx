import { STATUS_PROJETO_LABEL, type StatusProjeto } from '@/types'

const STATUS_STYLE: Record<StatusProjeto, string> = {
  planejamento: 'bg-sky-100 text-sky-700',
  em_execucao: 'bg-amber-100 text-amber-700',
  pausado: 'bg-zinc-100 text-zinc-700',
  completo: 'bg-emerald-100 text-emerald-700',
}

export default function StatusBadge({ status }: { status: StatusProjeto }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}
    >
      {STATUS_PROJETO_LABEL[status]}
    </span>
  )
}
