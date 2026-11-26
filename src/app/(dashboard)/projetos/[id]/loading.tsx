import { Frame, FramePanel } from '@/components/reui/frame'
import { Skeleton } from '@/components/ui/skeleton'

export default function CarregandoProjeto() {
  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
      role="status"
      aria-label="Carregando obra"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-8 w-72" />
      <Frame spacing="default" className="grid grid-cols-1 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <FramePanel key={i} className="flex flex-col gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-1 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </FramePanel>
        ))}
      </Frame>
    </div>
  )
}
