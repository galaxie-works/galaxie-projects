import { Frame, FramePanel } from '@/components/reui/frame'
import { Skeleton } from '@/components/ui/skeleton'

export default function CarregandoProjetos() {
  return (
    <div
      className="flex flex-col gap-6 p-4 md:p-6"
      role="status"
      aria-label="Carregando obras"
    >
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>
      <Frame spacing="default" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <FramePanel key={i} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-24" />
          </FramePanel>
        ))}
      </Frame>
      <Frame spacing="sm" stacked dense>
        <FramePanel className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </FramePanel>
      </Frame>
    </div>
  )
}
