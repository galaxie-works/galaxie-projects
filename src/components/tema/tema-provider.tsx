'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { ThemeProvider } from 'next-themes'
import { TEMA_PADRAO, TEMA_STORAGE_KEY, temaValido, type TemaSlug } from '@/lib/temas'

// Claro/escuro/sistema pelo next-themes (classe .dark no <html>).
export function TemaProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  )
}

const EVENTO = 'galaxie-tema-mudou'

function lerTema(): TemaSlug {
  const atual = document.documentElement.getAttribute('data-theme')
  return temaValido(atual) ? atual : TEMA_PADRAO
}

function assinar(aviso: () => void) {
  window.addEventListener(EVENTO, aviso)
  // Mantém abas abertas em sincronia.
  const aoGuardar = (e: StorageEvent) => {
    if (e.key !== TEMA_STORAGE_KEY) return
    aplicar(temaValido(e.newValue) ? e.newValue : TEMA_PADRAO, false)
  }
  window.addEventListener('storage', aoGuardar)
  return () => {
    window.removeEventListener(EVENTO, aviso)
    window.removeEventListener('storage', aoGuardar)
  }
}

function aplicar(tema: TemaSlug, guardar = true) {
  const html = document.documentElement
  if (tema === TEMA_PADRAO) html.removeAttribute('data-theme')
  else html.setAttribute('data-theme', tema)
  if (guardar) {
    try {
      localStorage.setItem(TEMA_STORAGE_KEY, tema)
    } catch {}
  }
  window.dispatchEvent(new Event(EVENTO))
}

// Tema de cor (paleta + fontes), guardado neste navegador.
export function useTemaCor() {
  const tema = useSyncExternalStore(assinar, lerTema, () => TEMA_PADRAO)
  const setTema = useCallback((novo: TemaSlug) => aplicar(novo), [])
  return { tema, setTema }
}
