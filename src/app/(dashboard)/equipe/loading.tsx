import { Frame, FrameHeader, FramePanel } from '@/components/reui/frame'
import { Skeleton } from '@/components/ui/skeleton'

export default function Carregando() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6" role="status" aria-label="Carregando equipe">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-8 w-36" />
        </header>
        <Frame spacing="default">
          <FrameHeader>
            <Skeleton className="h-4 w-20" />
          </FrameHeader>
          <FramePanel>
            <div className="flex flex-col gap-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          </FramePanel>
        </Frame>
      </div>
    </div>
  )
}
