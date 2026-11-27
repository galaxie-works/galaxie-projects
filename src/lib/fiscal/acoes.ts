'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sessaoEmpresa } from '@/lib/ia/config-servidor'
import { chaveMestraConfigurada, cifrar, decifrar } from '@/lib/ia/cripto'
import { assinarXml } from './assinatura'
import { lerCertificado } from './certificado'
import { hojeBrasilia, montarCancelamento, montarDps, type Ambiente, type MotivoCancelamento } from './dps'
import {
  consultarDps,
  consultarNfse,
  descompactar,
  emitirDps,
  mensagensDeErro,
  numeroDaNfse,
  registrarEvento,
  type MensagemSefin,
} from './sefin'
import type { DadosEmissao, EmpresaFiscal, Resultado } from './tipos'
import { emiteNotaFiscal, type TipoPessoa } from '@/lib/assinatura'

const so = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '')

const SO_PJ = 'Nota fiscal é só para pessoa jurídica. Troque o tipo de conta em Empresa > Dados.'

/** Pessoa física não emite nota. Sem a coluna (antes da migration), vale PJ. */
async function ehPessoaFisica(supabase: SupabaseClient, empresaId: string) {
  const { data, error } = await supabase
    .from('empresas')
    .select('tipo_pessoa')
    .eq('id', empresaId)
    .maybeSingle()
  return !error && !emiteNotaFiscal((data as { tipo_pessoa?: TipoPessoa } | null)?.tipo_pessoa)
}

function textoErro(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|socket hang up|ECONNRESET/i.test(msg)) {
    return 'Não consegui falar com a Sefin Nacional agora. Tente de novo em alguns minutos.'
  }
  return msg
}

// ---------------------------------------------------------------------------
// Dados fiscais
// ---------------------------------------------------------------------------

export async function salvarDadosFiscais(dados: Partial<EmpresaFiscal>): Promise<Resultado> {
  const sessao = await sessaoEmpresa()
  if (!sessao) return { ok: false, erro: 'Sessão expirada. Entre de novo.' }
  if (await ehPessoaFisica(sessao.supabase, sessao.empresaId)) return { ok: false, erro: SO_PJ }
  const linha = {
    ...dados,
    empresa_id: sessao.empresaId,
    cnpj: so(dados.cnpj) || null,
    cep: so(dados.cep) || null,
    codigo_municipio: so(dados.codigo_municipio) || null,
    codigo_tributacao_nacional: so(dados.codigo_tributacao_nacional) || '070201',
    codigo_tributacao_municipal: so(dados.codigo_tributacao_municipal) || null,
    ibscbs_ind_op: so(dados.ibscbs_ind_op) || null,
    ibscbs_cst: so(dados.ibscbs_cst) || '000',
    ibscbs_class_trib: so(dados.ibscbs_class_trib) || '000001',
    telefone: so(dados.telefone) || null,
    updated_at: new Date().toISOString(),
  }
  delete (linha as Record<string, unknown>).proximo_numero_homologacao
  delete (linha as Record<string, unknown>).proximo_numero_producao
  const { error } = await sessao.supabase.from('empresa_fiscal').upsert(linha)
  if (error) return { ok: false, erro: error.message }
  revalidatePath('/empresa')
  return { ok: true }
}

export async function enviarCertificado(form: FormData): Promise<Resultado<{ titular: string; validoAte: string }>> {
  const sessao = await sessaoEmpresa()
  if (!sessao) return { ok: false, erro: 'Sessão expirada. Entre de novo.' }
  if (await ehPessoaFisica(sessao.supabase, sessao.empresaId)) return { ok: false, erro: SO_PJ }
  if (!chaveMestraConfigurada()) {
    return { ok: false, erro: 'O servidor ainda não tem a chave mestra (IA_CHAVE_MESTRA) configurada na Vercel.' }
  }
  const arquivo = form.get('arquivo')
  const senha = String(form.get('senha') ?? '')
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, erro: 'Escolha o arquivo .pfx do certificado.' }
  if (arquivo.size > 64 * 1024) return { ok: false, erro: 'Esse arquivo é grande demais para um certificado A1.' }
  if (!senha) return { ok: false, erro: 'Informe a senha do certificado.' }

  const pfx = Buffer.from(await arquivo.arrayBuffer())
  let lido
  try {
    lido = lerCertificado(pfx, senha)
  } catch (e) {
    return { ok: false, erro: textoErro(e) }
  }
  if (lido.validoAte.getTime() < Date.now()) {
    return { ok: false, erro: `Esse certificado venceu em ${lido.validoAte.toLocaleDateString('pt-BR')}.` }
  }

  const { error } = await sessao.supabase.from('empresa_certificados').upsert({
    empresa_id: sessao.empresaId,
    pfx_cifrado: cifrar(pfx.toString('base64')),
    senha_cifrada: cifrar(senha),
    titular: lido.titular,
    documento: lido.documento,
    valido_ate: lido.validoAte.toISOString(),
    enviado_em: new Date().toISOString(),
  })
  if (error) return { ok: false, erro: error.message }

  // Se o CNPJ fiscal ainda está vazio, usa o do certificado.
  if (lido.documento) {
    await sessao.supabase
      .from('empresa_fiscal')
      .upsert({ empresa_id: sessao.empresaId, cnpj: lido.documento }, { onConflict: 'empresa_id', ignoreDuplicates: true })
  }
  revalidatePath('/empresa')
  return { ok: true, dados: { titular: lido.titular, validoAte: lido.validoAte.toISOString() } }
}

export async function removerCertificado(): Promise<Resultado> {
  const sessao = await sessaoEmpresa()
  if (!sessao) return { ok: false, erro: 'Sessão expirada. Entre de novo.' }
  const { error } = await sessao.supabase.from('empresa_certificados').delete().eq('empresa_id', sessao.empresaId)
  if (error) return { ok: false, erro: error.message }
  revalidatePath('/empresa')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Emissão
// ---------------------------------------------------------------------------

type Contexto = {
  supabase: SupabaseClient
  empresaId: string
  fiscal: EmpresaFiscal
  cert: { pfx: Buffer; senha: string; chavePem: string; certPem: string; documento: string }
}

async function contexto(): Promise<Contexto | string> {
  const sessao = await sessaoEmpresa()
  if (!sessao) return 'Sessão expirada. Entre de novo.'
  if (await ehPessoaFisica(sessao.supabase, sessao.empresaId)) return SO_PJ
  const [{ data: fiscal }, { data: cert }] = await Promise.all([
    sessao.supabase.from('empresa_fiscal').select('*').eq('empresa_id', sessao.empresaId).maybeSingle(),
    sessao.supabase
      .from('empresa_certificados')
      .select('pfx_cifrado, senha_cifrada')
      .eq('empresa_id', sessao.empresaId)
      .maybeSingle(),
  ])
  if (!fiscal) return 'Preencha os dados fiscais em Empresa > Nota fiscal.'
  if (!cert) return 'Envie o certificado A1 em Empresa > Nota fiscal.'
  const f = fiscal as EmpresaFiscal
  if (!f.codigo_municipio || so(f.codigo_municipio).length !== 7) return 'Falta o município da empresa (código IBGE).'
  try {
    const pfx = Buffer.from(decifrar(cert.pfx_cifrado as string), 'base64')
    const senha = decifrar(cert.senha_cifrada as string)
    const lido = lerCertificado(pfx, senha)
    const documento = so(f.cnpj) || lido.documento || ''
    if (!documento) return 'Informe o CNPJ da empresa nos dados fiscais.'
    if (lido.documento && lido.documento !== documento) {
      return 'O CNPJ do certificado é diferente do CNPJ dos dados fiscais.'
    }
    return {
      supabase: sessao.supabase,
      empresaId: sessao.empresaId,
      fiscal: f,
      cert: { pfx, senha, chavePem: lido.chavePem, certPem: lido.certPem, documento },
    }
  } catch (e) {
    return textoErro(e)
  }
}

function resumoMensagens(m: MensagemSefin[]): string {
  return m
    .map((x) => [x.codigo, x.descricao ?? x.mensagem, x.complemento].filter(Boolean).join(' · '))
    .filter(Boolean)
    .join('\n')
}

export async function emitirNota(d: DadosEmissao): Promise<Resultado<{ id: string; status: string }>> {
  const ctx = await contexto()
  if (typeof ctx === 'string') return { ok: false, erro: ctx }
  const { supabase, empresaId, fiscal, cert } = ctx

  const valor = Math.round(Number(d.valor) * 100) / 100
  if (!(valor > 0)) return { ok: false, erro: 'Informe o valor da nota.' }
  if (!d.descricao.trim()) return { ok: false, erro: 'Descreva o serviço.' }
  const docTomador = so(d.tomador.documento)
  if (docTomador.length !== 11 && docTomador.length !== 14) {
    return { ok: false, erro: 'Informe o CPF ou CNPJ do cliente.' }
  }
  const construcao = so(fiscal.codigo_tributacao_nacional).startsWith('07')
  const obra = d.obra && (so(d.obra.cno) || so(d.obra.endereco?.cep)) ? d.obra : null
  if (construcao && !obra) {
    return { ok: false, erro: 'Nota de obra precisa do CNO ou do endereço da obra.' }
  }

  const precisaIbsCbs = fiscal.opcao_simples === '1' || fiscal.ibscbs_sempre
  if (precisaIbsCbs && so(fiscal.ibscbs_ind_op).length !== 6) {
    return {
      ok: false,
      erro: 'Falta o código indicador da operação (IBS/CBS) em Empresa > Nota fiscal. Peça ao seu contador.',
    }
  }

  const ambiente = fiscal.ambiente as Ambiente
  const { data: numero, error: erroNumero } = await supabase.rpc('reservar_numero_dps', {
    p_empresa_id: empresaId,
    p_ambiente: ambiente,
  })
  if (erroNumero || !numero) return { ok: false, erro: erroNumero?.message ?? 'Não consegui reservar o número.' }

  const municipioPrestacao = so(d.obra?.endereco?.codigoMunicipio) || so(fiscal.codigo_municipio)
  const { xml, id } = montarDps({
    ambiente,
    emitidaEm: new Date(),
    competencia: d.competencia || hojeBrasilia(),
    serie: fiscal.serie || '1',
    numero: Number(numero),
    prestador: {
      documento: cert.documento,
      inscricaoMunicipal: fiscal.inscricao_municipal,
      telefone: fiscal.telefone,
      email: fiscal.email,
      codigoMunicipio: fiscal.codigo_municipio!,
      opcaoSimples: fiscal.opcao_simples,
      regimeApuracaoSimples: fiscal.regime_apuracao_simples,
      regimeEspecial: fiscal.regime_especial,
    },
    tomador: {
      documento: docTomador,
      nome: d.tomador.nome,
      endereco:
        d.tomador.endereco && so(d.tomador.endereco.cep).length === 8 && so(d.tomador.endereco.codigoMunicipio).length === 7
          ? d.tomador.endereco
          : null,
      email: d.tomador.email,
      telefone: d.tomador.telefone,
    },
    servico: {
      codigoMunicipioPrestacao: municipioPrestacao,
      codigoTributacaoNacional: fiscal.codigo_tributacao_nacional,
      codigoTributacaoMunicipal: fiscal.codigo_tributacao_municipal,
      codigoNbs: fiscal.codigo_nbs,
      descricao: d.descricao,
      obra: obra
        ? {
            cno: so(obra.cno) || null,
            endereco: obra.endereco && so(obra.endereco.cep).length === 8 ? obra.endereco : null,
          }
        : null,
      informacoesComplementares: d.informacoes || null,
    },
    valores: {
      valorServico: valor,
      tributacaoIssqn: '1',
      retencaoIssqn: fiscal.iss_retido ? '2' : '1',
      aliquotaIssqn: fiscal.aliquota_iss,
      percentualTributosSimples: fiscal.percentual_tributos_simples,
    },
    ibscbs: precisaIbsCbs
      ? {
          indicadorOperacao: fiscal.ibscbs_ind_op!,
          cst: fiscal.ibscbs_cst || '000',
          classificacao: fiscal.ibscbs_class_trib || '000001',
        }
      : null,
  })

  let assinada: string
  try {
    assinada = assinarXml(xml, { tag: 'infDPS', raiz: 'DPS', chavePem: cert.chavePem, certPem: cert.certPem })
  } catch (e) {
    return { ok: false, erro: `Não consegui assinar a nota: ${textoErro(e)}` }
  }

  const { data: nota, error: erroNota } = await supabase
    .from('notas_fiscais')
    .insert({
      empresa_id: empresaId,
      projeto_id: d.projetoId ?? null,
      cliente_id: d.clienteId ?? null,
      recebimento_id: d.recebimentoId ?? null,
      ambiente,
      serie: fiscal.serie || '1',
      numero_dps: numero,
      id_dps: id,
      status: 'processando',
      valor,
      descricao: d.descricao,
      competencia: d.competencia || hojeBrasilia(),
      tomador: d.tomador,
      obra,
      xml_dps: assinada,
    })
    .select('id')
    .single()
  if (erroNota || !nota) return { ok: false, erro: erroNota?.message ?? 'Não consegui registrar a nota.' }

  if (d.projetoId && obra?.cno) {
    await supabase.from('projetos').update({ cno: so(obra.cno) }).eq('id', d.projetoId)
  }

  try {
    const r = await emitirDps(ambiente, cert, assinada)
    const chave = typeof r.corpo?.chaveAcesso === 'string' ? r.corpo.chaveAcesso : null
    if (r.status >= 200 && r.status < 300 && chave) {
      const xmlNfse = descompactar(r.corpo?.nfseXmlGZipB64)
      await supabase
        .from('notas_fiscais')
        .update({
          status: 'autorizada',
          chave_acesso: chave,
          numero_nfse: numeroDaNfse(xmlNfse),
          xml_nfse: xmlNfse,
          mensagens: (r.corpo?.alertas as unknown[]) ?? [],
          autorizada_em: new Date().toISOString(),
        })
        .eq('id', nota.id)
      revalidar(d.projetoId)
      return { ok: true, dados: { id: nota.id, status: 'autorizada' } }
    }
    const mensagens = mensagensDeErro(r.corpo)
    const semResposta = r.status >= 500 || (!r.corpo && r.status !== 400)
    await supabase
      .from('notas_fiscais')
      .update({
        status: semResposta ? 'erro_envio' : 'rejeitada',
        mensagens: mensagens.length ? mensagens : [{ codigo: `HTTP ${r.status}`, descricao: r.bruto.slice(0, 500) }],
      })
      .eq('id', nota.id)
    revalidar(d.projetoId)
    return {
      ok: false,
      erro: resumoMensagens(mensagens) || `A Sefin Nacional respondeu ${r.status}.`,
      dados: { id: nota.id, status: semResposta ? 'erro_envio' : 'rejeitada' },
    }
  } catch (e) {
    await supabase
      .from('notas_fiscais')
      .update({ status: 'erro_envio', mensagens: [{ descricao: textoErro(e) }] })
      .eq('id', nota.id)
    revalidar(d.projetoId)
    return { ok: false, erro: textoErro(e), dados: { id: nota.id, status: 'erro_envio' } }
  }
}

function revalidar(projetoId?: string | null) {
  revalidatePath('/financeiro')
  if (projetoId) revalidatePath(`/projetos/${projetoId}`)
}

// Confere na Sefin uma nota que ficou sem resposta (erro de rede): se a DPS
// virou NFS-e, grava a chave; senão deixa como erro para emitir de novo.
export async function conferirNota(notaId: string): Promise<Resultado<{ status: string }>> {
  const ctx = await contexto()
  if (typeof ctx === 'string') return { ok: false, erro: ctx }
  const { supabase, cert } = ctx
  const { data: nota } = await supabase.from('notas_fiscais').select('*').eq('id', notaId).maybeSingle()
  if (!nota) return { ok: false, erro: 'Nota não encontrada.' }
  try {
    const r = await consultarDps(nota.ambiente as Ambiente, cert, nota.id_dps as string)
    const chave = typeof r.corpo?.chaveAcesso === 'string' ? r.corpo.chaveAcesso : null
    if (!chave) {
      if (r.status === 404) {
        await supabase.from('notas_fiscais').update({ status: 'rejeitada' }).eq('id', notaId)
        return { ok: true, dados: { status: 'rejeitada' } }
      }
      return { ok: false, erro: resumoMensagens(mensagensDeErro(r.corpo)) || `A Sefin respondeu ${r.status}.` }
    }
    const n = await consultarNfse(nota.ambiente as Ambiente, cert, chave)
    const xmlNfse = descompactar(n.corpo?.nfseXmlGZipB64)
    if (n.status < 200 || n.status >= 300 || !xmlNfse) {
      // A nota existe, mas o XML não veio: guarda a chave e deixa conferir de novo.
      await supabase.from('notas_fiscais').update({ chave_acesso: chave }).eq('id', notaId)
      return {
        ok: false,
        erro: resumoMensagens(mensagensDeErro(n.corpo)) || `A nota existe, mas a Sefin não devolveu o XML (${n.status}). Tente de novo.`,
      }
    }
    await supabase
      .from('notas_fiscais')
      .update({
        status: 'autorizada',
        chave_acesso: chave,
        xml_nfse: xmlNfse,
        numero_nfse: numeroDaNfse(xmlNfse),
        autorizada_em: new Date().toISOString(),
      })
      .eq('id', notaId)
    revalidar(nota.projeto_id as string | null)
    return { ok: true, dados: { status: 'autorizada' } }
  } catch (e) {
    return { ok: false, erro: textoErro(e) }
  }
}

export async function cancelarNota(
  notaId: string,
  motivo: MotivoCancelamento,
  justificativa: string,
): Promise<Resultado> {
  if (justificativa.trim().length < 15) return { ok: false, erro: 'Explique o motivo com pelo menos 15 letras.' }
  const ctx = await contexto()
  if (typeof ctx === 'string') return { ok: false, erro: ctx }
  const { supabase, cert } = ctx
  const { data: nota } = await supabase.from('notas_fiscais').select('*').eq('id', notaId).maybeSingle()
  if (!nota) return { ok: false, erro: 'Nota não encontrada.' }
  if (nota.status !== 'autorizada' || !nota.chave_acesso) return { ok: false, erro: 'Só dá para cancelar nota autorizada.' }

  const pedido = montarCancelamento({
    ambiente: nota.ambiente as Ambiente,
    documentoAutor: cert.documento,
    chave: nota.chave_acesso as string,
    motivo,
    justificativa: justificativa.trim(),
    quando: new Date(),
  })
  try {
    const assinado = assinarXml(pedido, {
      tag: 'infPedReg',
      raiz: 'pedRegEvento',
      chavePem: cert.chavePem,
      certPem: cert.certPem,
    })
    const r = await registrarEvento(nota.ambiente as Ambiente, cert, nota.chave_acesso as string, assinado)
    if (r.status >= 200 && r.status < 300) {
      await supabase
        .from('notas_fiscais')
        .update({ status: 'cancelada', cancelamento_motivo: justificativa.trim(), cancelada_em: new Date().toISOString() })
        .eq('id', notaId)
      revalidar(nota.projeto_id as string | null)
      return { ok: true }
    }
    const msgs = mensagensDeErro(r.corpo)
    if (msgs.some((m) => m.codigo === 'E0822')) {
      return { ok: false, erro: 'O prazo para cancelar essa nota já passou. Agora só pela prefeitura (análise fiscal).' }
    }
    return { ok: false, erro: resumoMensagens(msgs) || `A Sefin respondeu ${r.status}.` }
  } catch (e) {
    return { ok: false, erro: textoErro(e) }
  }
}
