import { Frame, FramePanel } from '@/components/reui/frame'
import { Skeleton } from '@/components/ui/skeleton'

export default function CarregandoProjeto() {
  return (
    <div
      className="flex flex-col gap-6 p-4 md:p-6"
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
