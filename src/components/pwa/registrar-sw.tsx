'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Registra o service worker (public/sw.js) e manda guardar os arquivos que a
// página já carregou, para a tela abrir sem internet na próxima vez.
const PAGINAS_OFFLINE = ['/diario']

export function RegistrarServiceWorker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production' && !localStorage.getItem('sw-dev')) return
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    let cancelado = false
    navigator.serviceWorker.ready
      .then((reg) => {
        if (cancelado || !reg.active) return
        const recursos = performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .filter((u) => u.startsWith(location.origin) && u.includes('/_next/static/'))
        const paginas = PAGINAS_OFFLINE.includes(pathname) ? [location.origin + pathname] : []
        reg.active.postMessage({
          tipo: 'guardar',
          urls: [...recursos, ...paginas],
          paginas,
        })
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [pathname])

  return null
}

/** Ao sair da conta: apaga as páginas guardadas (os dados pendentes ficam). */
export function limparPaginasOffline() {
  navigator.serviceWorker?.controller?.postMessage({ tipo: 'sair' })
}
