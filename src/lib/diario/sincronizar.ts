'use client'

import { createClient } from '@/lib/supabase/client'
import {
  fotosLocais,
  marcarErro,
  registrosLocais,
  removerFotoLocal,
  removerRegistroLocal,
} from './local'
import { BUCKET_ARQUIVOS, caminhoFoto } from './tipos'

// Envia ao Supabase o que foi registrado sem internet. Pode rodar quantas
// vezes for preciso: o registro é upsert pelo id gerado no aparelho e cada
// foto tem caminho fixo (upsert no Storage e na tabela arquivos).

export const EVENTO_SINCRONIZADO = 'diario:sincronizado'

export type ResultadoSync = { enviados: number; falhas: number; semConexao: boolean }

let emAndamento: Promise<ResultadoSync> | null = null

export function sincronizarDiario(): Promise<ResultadoSync> {
  if (!emAndamento) {
    emAndamento = executar().finally(() => {
      emAndamento = null
    })
  }
  return emAndamento
}

function pareceSemConexao(mensagem: string | undefined): boolean {
  return !navigator.onLine || /failed to fetch|network|load failed|fetch/i.test(mensagem ?? '')
}

async function executar(): Promise<ResultadoSync> {
  const resultado: ResultadoSync = { enviados: 0, falhas: 0, semConexao: false }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ...resultado, semConexao: true }
  }
  const registros = await registrosLocais()
  const fotosSoltas = await fotosLocais()
  if (!registros.length && !fotosSoltas.length) return resultado

  const supabase = createClient()
  const ordenados = [...registros].sort((a, b) => a.registrado_em.localeCompare(b.registrado_em))

  for (const r of ordenados) {
    const { error } = await supabase.from('diario_obra').upsert(
      {
        id: r.id,
        empresa_id: r.empresa_id,
        projeto_id: r.projeto_id,
        data: r.data,
        clima_manha: r.clima_manha,
        clima_tarde: r.clima_tarde,
        equipe_presente: r.equipe_presente,
        atividades: r.atividades,
        ocorrencias: r.ocorrencias,
        registrado_em: r.registrado_em,
      },
      { onConflict: 'id' }
    )
    if (error) {
      if (pareceSemConexao(error.message)) return { ...resultado, semConexao: true }
      resultado.falhas++
      await marcarErro(r.id, error.message)
      continue
    }
    const fotosOk = await enviarFotos(r.id)
    if (fotosOk === 'sem-conexao') return { ...resultado, semConexao: true }
    if (fotosOk) {
      await removerRegistroLocal(r.id)
      resultado.enviados++
    } else {
      resultado.falhas++
      await marcarErro(r.id, 'Algumas fotos não foram enviadas. Tentaremos de novo.')
    }
  }

  // Fotos acrescentadas a um registro que já estava no servidor.
  const restantes = await fotosLocais()
  const semRegistro = new Set(restantes.map((f) => f.registro_id))
  for (const id of ordenados.map((r) => r.id)) semRegistro.delete(id)
  for (const registroId of semRegistro) {
    const ok = await enviarFotos(registroId)
    if (ok === 'sem-conexao') return { ...resultado, semConexao: true }
    if (ok) resultado.enviados++
    else resultado.falhas++
  }

  if (resultado.enviados) window.dispatchEvent(new CustomEvent(EVENTO_SINCRONIZADO))
  return resultado
}

async function enviarFotos(registroId: string): Promise<boolean | 'sem-conexao'> {
  const supabase = createClient()
  const fotos = await fotosLocais(registroId)
  let tudoOk = true
  for (const [i, f] of fotos.entries()) {
    const caminho = caminhoFoto(f)
    const { error: erroUpload } = await supabase.storage
      .from(BUCKET_ARQUIVOS)
      .upload(caminho, f.blob, { contentType: 'image/webp', upsert: true })
    if (erroUpload) {
      if (pareceSemConexao(erroUpload.message)) return 'sem-conexao'
      tudoOk = false
      continue
    }
    const { error } = await supabase.from('arquivos').upsert(
      {
        id: f.id,
        empresa_id: f.empresa_id,
        projeto_id: f.projeto_id,
        diario_id: f.registro_id,
        nome: `diario-${f.data}-${i + 1}.webp`,
        caminho,
        tamanho: f.blob.size,
        tipo_mime: 'image/webp',
      },
      { onConflict: 'id' }
    )
    if (error) {
      if (pareceSemConexao(error.message)) return 'sem-conexao'
      tudoOk = false
      continue
    }
    await removerFotoLocal(f.id)
  }
  return tudoOk
}
