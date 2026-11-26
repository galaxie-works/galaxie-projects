'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { ThemeProvider } from 'next-themes'
import { TEMA_COOKIE, TEMA_PADRAO, temaValido, type TemaSlug } from '@/lib/temas'

// Claro/escuro/sistema pelo next-themes (classe .dark no <html>).
// O tema de cor fica fora dele: o next-themes só controla um atributo por vez e
// ignora um segundo provider aninhado. A cor vai num cookie que o layout raiz lê.
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
  return () => window.removeEventListener(EVENTO, aviso)
}

function aplicar(tema: TemaSlug) {
  const html = document.documentElement
  if (tema === TEMA_PADRAO) html.removeAttribute('data-theme')
  else html.setAttribute('data-theme', tema)
  document.cookie = `${TEMA_COOKIE}=${tema}; path=/; max-age=31536000; samesite=lax`
  window.dispatchEvent(new Event(EVENTO))
}

// Tema de cor do usuário neste navegador.
export function useTemaCor() {
  const tema = useSyncExternalStore(assinar, lerTema, () => TEMA_PADRAO)
  const setTema = useCallback((novo: TemaSlug) => aplicar(novo), [])
  return { tema, setTema }
}
