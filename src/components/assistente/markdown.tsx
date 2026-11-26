'use client'

import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

// O bloco de código da ReUI é pesado (Shiki): só carrega quando aparece um.
const BlocoCodigo = dynamic(() => import('./bloco-codigo'), {
  ssr: false,
  loading: () => <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs" />,
})

// Resposta do assistente em Markdown, com as classes do exemplo de resposta
// formatada da ReUI (@reui/c-bubble-7): negrito, itálico, listas, tabelas.
const componentes: Components = {
  p: ({ className, ...p }) => <p className={cn('leading-relaxed', className)} {...p} />,
  strong: ({ className, ...p }) => <strong className={cn('font-semibold text-foreground', className)} {...p} />,
  em: ({ className, ...p }) => <em className={cn('italic', className)} {...p} />,
  h1: ({ className, ...p }) => <h4 className={cn('font-semibold tracking-tight', className)} {...p} />,
  h2: ({ className, ...p }) => <h4 className={cn('font-semibold tracking-tight', className)} {...p} />,
  h3: ({ className, ...p }) => <h4 className={cn('font-semibold', className)} {...p} />,
  ul: ({ className, ...p }) => <ul className={cn('flex list-disc flex-col gap-1 pl-5 marker:text-muted-foreground', className)} {...p} />,
  ol: ({ className, ...p }) => <ol className={cn('flex list-decimal flex-col gap-1 pl-5 marker:text-muted-foreground', className)} {...p} />,
  li: ({ className, ...p }) => <li className={cn('pl-0.5 leading-relaxed', className)} {...p} />,
  a: ({ className, ...p }) => (
    <a className={cn('font-medium underline underline-offset-4', className)} target="_blank" rel="noopener noreferrer" {...p} />
  ),
  blockquote: ({ className, ...p }) => (
    <blockquote className={cn('border-l-2 pl-3 text-muted-foreground', className)} {...p} />
  ),
  hr: () => <hr className="border-border" />,
  // Código inline; blocos (```) vão para o <pre> abaixo, que vira CodeBlock.
  code: ({ className, children, ...p }) => (
    <code className={cn('rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.85em]', className)} {...p}>
      {children}
    </code>
  ),
  pre: ({ children }) => <BlocoCodigo>{children}</BlocoCodigo>,
  table: ({ className, ...p }) => (
    <div className="-mx-1 overflow-x-auto rounded-lg border">
      <table className={cn('w-full border-collapse text-xs', className)} {...p} />
    </div>
  ),
  thead: ({ className, ...p }) => <thead className={cn('bg-muted/60', className)} {...p} />,
  th: ({ className, ...p }) => (
    <th className={cn('px-3 py-2 text-left font-medium whitespace-nowrap text-muted-foreground', className)} {...p} />
  ),
  td: ({ className, children, ...p }) => (
    <td className={cn('border-t px-3 py-2 align-middle whitespace-nowrap tabular-nums', className)} {...p}>
      {celulaPercentual(children) ?? children}
    </td>
  ),
}

/** Célula só com "65%" vira barra de progresso, como na página do cliente. */
function celulaPercentual(children: ReactNode) {
  const texto = Array.isArray(children) ? children.join('') : children
  const m = typeof texto === 'string' ? texto.trim().match(/^(\d{1,3})\s?%$/) : null
  if (!m) return null
  const valor = Math.min(Number(m[1]), 100)
  return (
    <Progress value={valor} aria-label={`${valor}% concluído`} className="w-28 flex-nowrap items-center gap-2">
      <span className="order-last w-9 shrink-0 text-end text-xs text-muted-foreground tabular-nums">{valor}%</span>
    </Progress>
  )
}

export function Markdown({ texto }: { texto: string }) {
  return (
    // Sem tamanho de fonte aqui: o BubbleContent (ReUI) define o do estilo.
    <div className="flex flex-col gap-3">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={componentes}>
        {texto}
      </ReactMarkdown>
    </div>
  )
}
