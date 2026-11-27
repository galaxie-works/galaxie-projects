import type { MetadataRoute } from 'next'

// App instalável no celular (Adicionar à tela inicial). Abre direto no
// Diário de obra, que funciona sem internet.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Galaxie Obras',
    short_name: 'Galaxie Obras',
    description: 'Gestão de obras, clientes e equipe. Diário de obra funciona sem internet.',
    start_url: '/diario',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    lang: 'pt-BR',
    icons: [
      { src: '/icone-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icone-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icone-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [{ name: 'Diário de obra', url: '/diario' }],
  }
}
