import { Frame, FrameFooter, FramePanel } from '@/components/reui/frame'
import { Skeleton } from '@/components/ui/skeleton'

export default function Carregando() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6" role="status" aria-label="Carregando formulário">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Frame spacing="default">
          <FramePanel>
            <div className="flex flex-col gap-5">
              <Skeleton className="h-8 w-64" />
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="grid gap-5 sm:grid-cols-2">
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                </div>
              ))}
            </div>
          </FramePanel>
          <FrameFooter className="flex-row justify-end">
            <Skeleton className="h-8 w-32" />
          </FrameFooter>
        </Frame>
      </div>
    </div>
  )
}
