'use client'

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { ContextoDiario, FotoLocal, RegistroDiario, RegistroLocal } from './tipos'

// Armazenamento no aparelho (IndexedDB). Sobrevive a fechar o app e ficar
// sem internet; é a fila do que ainda não chegou ao servidor.

interface DiarioDB extends DBSchema {
  registros: { key: string; value: RegistroLocal; indexes: { projeto: string } }
  fotos: { key: string; value: FotoLocal; indexes: { registro: string } }
  /** Cópia do servidor para ver sem internet (contexto e registros por obra). */
  cache: { key: string; value: unknown }
}

let banco: Promise<IDBPDatabase<DiarioDB>> | null = null

function abrir() {
  if (!banco) {
    banco = openDB<DiarioDB>('galaxie-diario', 1, {
      upgrade(db) {
        const r = db.createObjectStore('registros', { keyPath: 'id' })
        r.createIndex('projeto', 'projeto_id')
        const f = db.createObjectStore('fotos', { keyPath: 'id' })
        f.createIndex('registro', 'registro_id')
        db.createObjectStore('cache')
      },
    })
  }
  return banco
}

export async function salvarLocal(registro: RegistroLocal, fotos: FotoLocal[]): Promise<void> {
  const db = await abrir()
  const tx = db.transaction(['registros', 'fotos'], 'readwrite')
  await tx.objectStore('registros').put(registro)
  for (const f of fotos) await tx.objectStore('fotos').put(f)
  await tx.done
}

export async function registrosLocais(projetoId?: string): Promise<RegistroLocal[]> {
  const db = await abrir()
  return projetoId ? db.getAllFromIndex('registros', 'projeto', projetoId) : db.getAll('registros')
}

export async function registroLocal(id: string): Promise<RegistroLocal | undefined> {
  return (await abrir()).get('registros', id)
}

export async function fotosLocais(registroId?: string): Promise<FotoLocal[]> {
  const db = await abrir()
  return registroId ? db.getAllFromIndex('fotos', 'registro', registroId) : db.getAll('fotos')
}

export async function marcarErro(id: string, erro: string | null): Promise<void> {
  const db = await abrir()
  const r = await db.get('registros', id)
  if (r) await db.put('registros', { ...r, erro })
}

export async function removerRegistroLocal(id: string): Promise<void> {
  const db = await abrir()
  const tx = db.transaction(['registros', 'fotos'], 'readwrite')
  await tx.objectStore('registros').delete(id)
  const fotos = await tx.objectStore('fotos').index('registro').getAllKeys(id)
  for (const k of fotos) await tx.objectStore('fotos').delete(k)
  await tx.done
}

export async function removerFotoLocal(id: string): Promise<void> {
  await (await abrir()).delete('fotos', id)
}

/** Registros do dia esperando envio (fotos soltas contam pelo registro delas). */
export async function contarPendentes(): Promise<number> {
  const db = await abrir()
  const [ids, fotos] = await Promise.all([db.getAllKeys('registros'), db.getAll('fotos')])
  const todos = new Set<string>(ids)
  for (const f of fotos) todos.add(f.registro_id)
  return todos.size
}

export async function guardarContexto(ctx: ContextoDiario): Promise<void> {
  await (await abrir()).put('cache', ctx, 'contexto')
}

export async function lerContexto(): Promise<ContextoDiario | undefined> {
  return (await abrir()).get('cache', 'contexto') as Promise<ContextoDiario | undefined>
}

export type CacheRegistros = {
  registros: RegistroDiario[]
  fotos: { id: string; diario_id: string; caminho: string }[]
}

export async function guardarRegistrosObra(projetoId: string, dados: CacheRegistros): Promise<void> {
  await (await abrir()).put('cache', dados, `registros:${projetoId}`)
}

export async function lerRegistrosObra(projetoId: string): Promise<CacheRegistros | undefined> {
  return (await abrir()).get('cache', `registros:${projetoId}`) as Promise<CacheRegistros | undefined>
}
