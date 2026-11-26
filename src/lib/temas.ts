// Temas de cor do app. As variáveis de cada um ficam em src/app/temas.css;
// o padrão ("claude") vive em :root/.dark e os demais em <html data-theme="slug">.
// Cada tema tem versão clara e escura (classe .dark, controlada pelo next-themes).
export const TEMAS = [
  { slug: 'claude', nome: 'Claude +' },
  { slug: 'supabase', nome: 'Supabase' },
  { slug: 'brutalist', nome: 'MX Brutalist' },
  { slug: 'alpha', nome: 'Alpha' },
  { slug: 'vs-code', nome: 'VS Code' },
  { slug: 'stella', nome: 'Stella' },
  { slug: 'typewriter', nome: 'Typewriter' },
] as const

export type TemaSlug = (typeof TEMAS)[number]['slug']

export const TEMA_PADRAO: TemaSlug = 'claude'
export const TEMA_STORAGE_KEY = 'galaxie-tema'

export function temaValido(valor: string | null | undefined): valor is TemaSlug {
  return TEMAS.some((t) => t.slug === valor)
}

// Roda no <head> antes da pintura, para não piscar o tema padrão ao recarregar.
export const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  TEMA_STORAGE_KEY
)});var ok=${JSON.stringify(TEMAS.map((t) => t.slug))};if(t&&t!==${JSON.stringify(
  TEMA_PADRAO
)}&&ok.indexOf(t)>-1)document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`
