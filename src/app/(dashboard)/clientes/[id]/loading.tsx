import { Frame, FrameHeader, FramePanel } from '@/components/reui/frame'
import { Skeleton } from '@/components/ui/skeleton'

export default function Carregando() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6" role="status" aria-label="Carregando cliente">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
          <Skeleton className="h-8 w-32" />
        </header>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Frame spacing="default">
          <FrameHeader>
            <Skeleton className="h-4 w-24" />
          </FrameHeader>
          <FramePanel>
            <div className="flex flex-col gap-5">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-1 w-32" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          </FramePanel>
        </Frame>
        <Frame spacing="default" className="self-start">
          <FrameHeader>
            <Skeleton className="h-4 w-16" />
          </FrameHeader>
          <FramePanel>
            <div className="flex flex-col gap-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ))}
            </div>
          </FramePanel>
        </Frame>
      </div>
    </div>
  )
}
