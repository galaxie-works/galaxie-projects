'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  contarPendentes,
  fotosLocais,
  guardarRegistrosObra,
  lerRegistrosObra,
  registrosLocais,
} from '@/lib/diario/local'
import { EVENTO_SINCRONIZADO, sincronizarDiario } from '@/lib/diario/sincronizar'
import { BUCKET_ARQUIVOS, type RegistroDiario, type RegistroTela } from '@/lib/diario/tipos'

export const EVENTO_LOCAL = 'diario:local-mudou'

function assinarConexao(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

/** true quando o aparelho diz que tem rede (no servidor, considera online). */
export function useOnline(): boolean {
  return useSyncExternalStore(
    assinarConexao,
    () => navigator.onLine,
    () => true
  )
}

/** Quantos registros/fotos ainda estão só no aparelho; tenta enviar sozinho. */
export function useFilaDiario() {
  const online = useOnline()
  const [pendentes, setPendentes] = useState(0)
  const [enviando, setEnviando] = useState(false)

  const atualizar = useCallback(async () => {
    setPendentes(await contarPendentes().catch(() => 0))
  }, [])

  const enviar = useCallback(async () => {
    setEnviando(true)
    try {
      return await sincronizarDiario()
    } finally {
      setEnviando(false)
      await atualizar()
    }
  }, [atualizar])

  useEffect(() => {
    // Lê a fila do IndexedDB (sistema externo) ao montar e quando muda.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void atualizar()
    const ouvir = () => void atualizar()
    window.addEventListener(EVENTO_LOCAL, ouvir)
    window.addEventListener(EVENTO_SINCRONIZADO, ouvir)
    return () => {
      window.removeEventListener(EVENTO_LOCAL, ouvir)
      window.removeEventListener(EVENTO_SINCRONIZADO, ouvir)
    }
  }, [atualizar])

  // Voltou a internet (ou abriu o app com rede): envia o que está na fila.
  useEffect(() => {
    if (!online || pendentes === 0) return
    const primeiro = setTimeout(() => void enviar(), 500)
    const t = setInterval(() => void enviar(), 60_000)
    return () => {
      clearTimeout(primeiro)
      clearInterval(t)
    }
  }, [online, pendentes, enviar])

  return { online, pendentes, enviando, enviar }
}

/** Registros de uma obra: do servidor (ou da cópia offline) + os da fila. */
export function useRegistrosObra(projetoId: string | null) {
  const online = useOnline()
  // Guardado junto com a obra: ao trocar de obra, a lista anterior some na hora.
  const [carregados, setCarregados] = useState<{ projetoId: string; lista: RegistroTela[] } | null>(null)
  const [deCopia, setDeCopia] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [versao, setVersao] = useState(0)

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])

  useEffect(() => {
    const ouvir = () => recarregar()
    window.addEventListener(EVENTO_LOCAL, ouvir)
    window.addEventListener(EVENTO_SINCRONIZADO, ouvir)
    return () => {
      window.removeEventListener(EVENTO_LOCAL, ouvir)
      window.removeEventListener(EVENTO_SINCRONIZADO, ouvir)
    }
  }, [recarregar])

  useEffect(() => {
    if (!projetoId) return
    let cancelado = false
    const urlsLocais: string[] = []

    async function carregar(id: string) {
      let servidor: RegistroDiario[] = []
      let fotosServidor: { id: string; diario_id: string; caminho: string; url?: string }[] = []
      let copia = false
      let falha: string | null = null

      if (navigator.onLine) {
        const supabase = createClient()
        const [r, f] = await Promise.all([
          supabase
            .from('diario_obra')
            .select('id, empresa_id, projeto_id, data, clima_manha, clima_tarde, equipe_presente, atividades, ocorrencias, registrado_em')
            .eq('projeto_id', id)
            .order('data', { ascending: false })
            .order('registrado_em', { ascending: false })
            .limit(90),
          supabase
            .from('arquivos')
            .select('id, diario_id, caminho')
            .eq('projeto_id', id)
            .not('diario_id', 'is', null)
            .order('created_at'),
        ])
        if (r.error || f.error) {
          falha = r.error?.message ?? f.error?.message ?? null
        } else {
          servidor = (r.data as RegistroDiario[]) ?? []
          fotosServidor = (f.data as typeof fotosServidor) ?? []
          void guardarRegistrosObra(id, { registros: servidor, fotos: fotosServidor })
          if (fotosServidor.length) {
            const { data: urls } = await supabase.storage
              .from(BUCKET_ARQUIVOS)
              .createSignedUrls(
                fotosServidor.map((x) => x.caminho),
                3600
              )
            const mapa = new Map(urls?.map((u) => [u.path, u.signedUrl]) ?? [])
            fotosServidor = fotosServidor.map((x) => ({ ...x, url: mapa.get(x.caminho) ?? undefined }))
          }
        }
      }
      if (!navigator.onLine || falha) {
        const cache = await lerRegistrosObra(id)
        if (cache) {
          servidor = cache.registros
          fotosServidor = cache.fotos
          copia = true
          if (!navigator.onLine) falha = null
        }
      }

      const [locais, fotosFila] = await Promise.all([registrosLocais(id), fotosLocais()])
      const porId = new Map<string, RegistroTela>()
      for (const s of servidor) {
        porId.set(s.id, {
          ...s,
          equipe_presente: s.equipe_presente ?? [],
          pendente: false,
          noServidor: true,
          fotos: fotosServidor
            .filter((x) => x.diario_id === s.id)
            .map((x) => ({ id: x.id, url: x.url ?? '', pendente: false, caminho: x.caminho })),
        })
      }
      for (const l of locais) {
        const anterior = porId.get(l.id)
        porId.set(l.id, {
          ...l,
          pendente: true,
          noServidor: Boolean(anterior),
          erro: l.erro,
          fotos: anterior?.fotos ?? [],
        })
      }
      for (const f of fotosFila) {
        const alvo = porId.get(f.registro_id)
        if (!alvo || f.projeto_id !== id) continue
        const url = URL.createObjectURL(f.blob)
        urlsLocais.push(url)
        alvo.fotos = [...alvo.fotos, { id: f.id, url, pendente: true }]
        alvo.pendente = true
      }
      const lista = [...porId.values()].sort(
        (a, b) => b.data.localeCompare(a.data) || b.registrado_em.localeCompare(a.registrado_em)
      )
      if (cancelado) return
      setCarregados({ projetoId: id, lista })
      setDeCopia(copia)
      setErro(falha && !copia ? falha : null)
    }

    void carregar(projetoId)
    return () => {
      cancelado = true
      urlsLocais.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [projetoId, online, versao])

  const registros = !projetoId ? [] : carregados?.projetoId === projetoId ? carregados.lista : null
  return { registros, deCopia, erro, recarregar }
}
