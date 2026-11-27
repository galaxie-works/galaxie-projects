import { NextResponse } from 'next/server'
import { configComChave, sessaoEmpresa } from '@/lib/ia/config-servidor'
import { definirFerramentas, executarFerramenta, type ContextoExecucao } from '@/lib/ia/ferramentas'
import { mensagemErroProvedor, rodarAssistente } from '@/lib/ia/executar'
import { MODELO_GALAXIE, acertar, chaveIAGalaxie, reservar, usoVazio } from '@/lib/ia/cota'
import type {
  ErroAssistente,
  FormularioContexto,
  PedidoAssistente,
  RespostaAssistente,
} from '@/lib/ia/protocolo'

export const maxDuration = 60

function erro(status: number, corpo: ErroAssistente) {
  return NextResponse.json(corpo, { status })
}

function montarSistema(empresaNome: string, pagina: string, form: FormularioContexto | null | undefined) {
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const linhas = [
    `Você é o assistente do Galaxie Obras, app de gestão de obras da empresa "${empresaNome}".`,
    'O usuário fala por voz (o texto vem de um ditado, pode ter erros de transcrição: interprete com bom senso).',
    'Seu trabalho: preencher formulários, cadastrar, editar e excluir registros usando as ferramentas, e responder perguntas sobre os dados da empresa.',
    '',
    'Jeito de trabalhar (como um colega competente, não um formulário):',
    '- Seja proativo: antes de pedir uma informação, procure nos dados com buscar. Ex.: para um projeto novo, busque os clientes e ofereça os nomes como opções; se só houver um que combina, já use.',
    '- Se o usuário falou o suficiente para agir, aja e depois diga o que fez. Pergunte só o que não dá para descobrir nem deduzir.',
    '- Quando precisar de uma escolha, use a ferramenta perguntar: UMA pergunta por vez, com 2 a 4 opções reais (busque antes), uma marcada como recomendada. Não repita as opções no texto; no máximo uma frase curta de contexto antes. Se faltar mais de uma coisa, pergunte a mais importante primeiro e as outras depois, uma de cada vez.',
    '- Perguntas abertas (ex.: nome de um cliente novo, um valor) vão em texto, também uma por vez.',
    '- Depois de agir, sugira o próximo passo útil em uma linha (ex.: "Quer que eu já crie as etapas?").',
    '',
    'Formato da resposta (o app mostra Markdown):',
    '- Português do Brasil, direto e curto. Use **negrito** para nomes e valores importantes.',
    '- Listar registros (obras, clientes, etapas, compras): uma frase curta com o total e uma tabela Markdown enxuta, sem parágrafos. No máximo 4 colunas e 10 linhas; se houver mais, diga quantas faltam e ofereça filtrar.',
    '- Para listar ou acompanhar obras, use mostrar_obras (o app desenha o cartão com progresso colorido por etapas); não faça tabela de obras.',
    '- Depois da tabela ou do cartão, no máximo uma linha de destaque (ex.: obra atrasada) e a sugestão de próximo passo.',
    '- Valores em reais no formato R$ 1.234,56 e datas como 20/03/2027 na resposta (nas ferramentas, use número e AAAA-MM-DD).',
    '- Não mostre ids (uuid) ao usuário, nem fale de ferramentas.',
    '',
    'Regras:',
    '- Se há formulário aberto e o usuário descreve dados que cabem nele, use preencher_formulario (não use criar para isso).',
    '- Só use salvar_formulario quando o usuário pedir para salvar, gravar, cadastrar ou concluir.',
    '- Para editar ou excluir algo existente, use buscar primeiro para achar o id. Nunca invente ids.',
    '- Se a busca achar mais de um registro possível, pergunte qual é antes de alterar.',
    '- Excluir sempre passa por confirmação do usuário na tela; avise isso.',
    '- Valores falados viram número nas ferramentas (ex.: "dois mil e quinhentos" = 2500).',
    '- Se o pedido é criar algo que tem página própria de cadastro (ex.: projeto novo) e o usuário não está nela, você pode criar direto com criar quando tiver os dados obrigatórios.',
    `- Hoje é ${hoje}. Página atual: ${pagina || '/'}.`,
  ]
  if (form) {
    linhas.push(
      '',
      `Formulário aberto na tela: "${form.titulo}"${form.descricao ? ` (${form.descricao})` : ''}.`,
      `Valores atuais: ${JSON.stringify(form.valores)}`,
    )
  } else {
    linhas.push('', 'Não há formulário aberto nesta página.')
  }
  return linhas.join('\n')
}

export async function POST(request: Request) {
  const sessao = await sessaoEmpresa()
  if (!sessao) return erro(401, { erro: 'Entre na sua conta para usar o assistente.' })

  let pedido: PedidoAssistente
  try {
    pedido = (await request.json()) as PedidoAssistente
  } catch {
    return erro(400, { erro: 'Pedido inválido.' })
  }
  const texto = typeof pedido.texto === 'string' ? pedido.texto.trim().slice(0, 4000) : ''
  if (!texto) return erro(400, { erro: 'Não ouvi nada. Tente falar de novo.' })

  let config
  try {
    config = await configComChave(sessao.supabase, sessao.empresaId)
  } catch (e) {
    return erro(500, { erro: e instanceof Error ? e.message : 'Erro ao ler a configuração da IA.' })
  }
  // Sem chave própria: usa a IA da Galaxie, que gasta a cota do plano.
  const daGalaxie = !config
  if (!config) {
    const chaveGalaxie = await chaveIAGalaxie()
    if (!chaveGalaxie) {
      return erro(400, {
        erro: 'Configure uma chave de API em Ajustes para usar o assistente.',
        semConfiguracao: true,
      })
    }
    try {
      if (!(await reservar(sessao.supabase, sessao.empresaId))) {
        return erro(402, {
          erro: 'Seus comandos de IA deste mês acabaram. Compre um pacote em Assinatura ou use sua própria chave em Ajustes.',
          semCota: true,
        })
      }
    } catch (e) {
      return erro(500, { erro: e instanceof Error ? e.message : 'Erro ao ler seus comandos de IA.' })
    }
    config = { provedor: 'anthropic' as const, modelo: MODELO_GALAXIE, chave: chaveGalaxie }
  }
  const uso = usoVazio()

  const formulario = pedido.formulario ?? null
  const historico = Array.isArray(pedido.historico)
    ? pedido.historico
        .filter((m) => (m.papel === 'usuario' || m.papel === 'assistente') && typeof m.texto === 'string')
        .slice(-10)
    : []

  const ctx: ContextoExecucao = {
    supabase: sessao.supabase,
    empresaId: sessao.empresaId,
    formulario,
    acoes: [],
    passos: [],
  }

  try {
    const resposta = await rodarAssistente({
      ...config,
      sistema: montarSistema(sessao.empresaNome, String(pedido.pagina ?? ''), formulario),
      historico,
      texto,
      ferramentas: definirFerramentas(formulario),
      executar: (nome, args) => executarFerramenta(nome, args, ctx),
      parar: () => !!ctx.pergunta,
      uso: daGalaxie ? uso : undefined,
    })
    const corpo: RespostaAssistente = {
      resposta,
      acoes: ctx.acoes,
      passos: ctx.passos,
      pergunta: ctx.pergunta,
      obras: ctx.obras,
    }
    return NextResponse.json(corpo)
  } catch (e) {
    // O que já foi gravado antes do erro precisa chegar na tela (atualizar a
    // lista, avisar), senão o usuário repete o pedido e duplica o registro.
    const feitas = ctx.acoes.length ? ' O que já tinha sido feito antes do erro foi mantido.' : ''
    return erro(502, { erro: mensagemErroProvedor(e) + feitas, acoes: ctx.acoes, passos: ctx.passos })
  } finally {
    // Cobra o que foi usado, mesmo se deu erro no meio (a reserva já saiu).
    if (daGalaxie) await acertar(sessao.supabase, sessao.empresaId, uso, texto.slice(0, 80))
  }
}
