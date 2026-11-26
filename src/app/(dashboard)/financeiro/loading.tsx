import { Frame, FrameFooter, FrameHeader, FramePanel } from '@/components/reui/frame'
import { Skeleton } from '@/components/ui/skeleton'

export default function Carregando() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6" role="status" aria-label="Carregando financeiro">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-32" />
      </header>
      <Frame spacing="default">
        <FrameHeader className="flex-row items-center gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-7 w-20" />
        </FrameHeader>
        <FramePanel>
          <div className="flex flex-col gap-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-6 rounded-full" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="ml-auto h-4 w-24" />
              </div>
            ))}
          </div>
        </FramePanel>
        <FrameFooter>
          <Skeleton className="h-4 w-32" />
        </FrameFooter>
      </Frame>
    </div>
  )
}
