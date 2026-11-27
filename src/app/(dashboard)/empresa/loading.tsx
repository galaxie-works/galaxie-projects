import { Frame, FrameHeader, FramePanel } from '@/components/reui/frame'
import { Skeleton } from '@/components/ui/skeleton'

export default function Carregando() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6" role="status" aria-label="Carregando empresa">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex flex-col gap-6 md:flex-row">
          <div className="flex gap-2 md:w-48 md:flex-col">
            <Skeleton className="h-7 w-24 md:w-full" />
            <Skeleton className="h-7 w-24 md:w-full" />
          </div>
          <Frame spacing="default" className="flex-1">
            <FrameHeader>
              <Skeleton className="h-4 w-32" />
            </FrameHeader>
            <FramePanel>
              <div className="flex flex-col gap-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                </div>
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            </FramePanel>
          </Frame>
        </div>
      </div>
    </div>
  )
}
