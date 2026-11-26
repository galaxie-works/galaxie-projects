'use client'

import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

// Resposta do assistente em Markdown, com tipografia própria (sem plugin
// de typography): negrito, itálico, listas, tabelas, código, citações.
const componentes: Components = {
  p: ({ className, ...p }) => <p className={cn('leading-relaxed', className)} {...p} />,
  strong: ({ className, ...p }) => <strong className={cn('font-semibold text-foreground', className)} {...p} />,
  em: ({ className, ...p }) => <em className={cn('italic', className)} {...p} />,
  h1: ({ className, ...p }) => <h3 className={cn('text-base font-semibold tracking-tight', className)} {...p} />,
  h2: ({ className, ...p }) => <h3 className={cn('text-base font-semibold tracking-tight', className)} {...p} />,
  h3: ({ className, ...p }) => <h4 className={cn('text-sm font-semibold', className)} {...p} />,
  ul: ({ className, ...p }) => <ul className={cn('flex list-disc flex-col gap-1 pl-5 marker:text-muted-foreground', className)} {...p} />,
  ol: ({ className, ...p }) => <ol className={cn('flex list-decimal flex-col gap-1 pl-5 marker:text-muted-foreground', className)} {...p} />,
  li: ({ className, ...p }) => <li className={cn('pl-0.5 leading-relaxed', className)} {...p} />,
  a: ({ className, ...p }) => (
    <a className={cn('font-medium underline underline-offset-4', className)} target="_blank" rel="noreferrer" {...p} />
  ),
  blockquote: ({ className, ...p }) => (
    <blockquote className={cn('border-l-2 pl-3 text-muted-foreground', className)} {...p} />
  ),
  hr: () => <hr className="border-border" />,
  code: ({ className, children, ...p }) => {
    const bloco = /language-/.test(className ?? '')
    return bloco ? (
      <code className={cn('font-mono text-xs', className)} {...p}>
        {children}
      </code>
    ) : (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]" {...p}>
        {children}
      </code>
    )
  },
  pre: ({ className, ...p }) => (
    <pre className={cn('overflow-x-auto rounded-lg border bg-muted/50 p-3', className)} {...p} />
  ),
  table: ({ className, ...p }) => (
    <div className="-mx-1 overflow-x-auto rounded-lg border">
      <table className={cn('w-full border-collapse text-xs', className)} {...p} />
    </div>
  ),
  thead: ({ className, ...p }) => <thead className={cn('bg-muted/60', className)} {...p} />,
  th: ({ className, ...p }) => (
    <th className={cn('px-3 py-2 text-left font-medium whitespace-nowrap text-muted-foreground', className)} {...p} />
  ),
  td: ({ className, ...p }) => <td className={cn('border-t px-3 py-2 align-top tabular-nums', className)} {...p} />,
}

export function Markdown({ texto }: { texto: string }) {
  return (
    <div className="flex flex-col gap-3 text-sm text-foreground/90">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={componentes}>
        {texto}
      </ReactMarkdown>
    </div>
  )
}
