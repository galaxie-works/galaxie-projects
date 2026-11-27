'use client'

import { toast } from 'sonner'

/** Chama uma rota do Stripe e vai para a página de pagamento que ela devolver. */
export async function abrirStripe(rota: string, corpo?: unknown) {
  const r = await fetch(rota, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  const dados = (await r.json().catch(() => ({}))) as { url?: string; erro?: string }
  if (!r.ok || !dados.url) {
    toast.error(dados.erro ?? 'Não foi possível abrir o pagamento.')
    return false
  }
  window.location.assign(dados.url)
  return true
}
