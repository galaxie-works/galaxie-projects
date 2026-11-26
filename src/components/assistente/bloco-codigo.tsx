'use client'

import type { ReactNode } from 'react'
import {
  CodeBlock,
  CodeBlockCopyButton,
  markdownCodeProps,
} from '@/components/reui/code-block/code-block'

// Bloco de código da resposta (@reui/code-block, como em @reui/c-code-block-4).
// Carregado sob demanda pelo markdown.tsx: só baixa quando a resposta tem código.
export default function BlocoCodigo({ children }: { children?: ReactNode }) {
  const { code, language } = markdownCodeProps({ children })
  return (
    <CodeBlock code={code.replace(/\n$/, '')} language={language}>
      <CodeBlockCopyButton />
    </CodeBlock>
  )
}
