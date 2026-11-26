'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import VoiceTextInput from '@/components/VoiceTextInput'

type Msg = {
  id: string
  role: 'assistant' | 'user'
  text: string
}

type Membro = { nome: string; funcao: string }

type Stage =
  | 'empresa_nome'
  | 'tem_cnpj'
  | 'cnpj_numero'
  | 'descricao'
  | 'modo_operacao'
  | 'sozinho_ou_equipe'
  | 'equipe_quantidade'
  | 'equipe_nome'
  | 'equipe_funcao'
  | 'confirmar'
  | 'salvando'

function uid() {
  return Math.random().toString(36).slice(2)
}

function parseNumero(texto: string): number | null {
  const match = texto.match(/\d+/)
  if (match) return parseInt(match[0], 10)
  const porExtenso: Record<string, number> = {
    um: 1,
    uma: 1,
    dois: 2,
    duas: 2,
    tres: 3,
    três: 3,
    quatro: 4,
    cinco: 5,
    seis: 6,
    sete: 7,
    oito: 8,
    nove: 9,
    dez: 10,
  }
  const palavra = texto.toLowerCase().trim()
  for (const [k, v] of Object.entries(porExtenso)) {
    if (palavra.includes(k)) return v
  }
  return null
}

export default function OnboardingChat() {
  const router = useRouter()
  const supabase = createClient()

  const [messages, setMessages] = useState<Msg[]>([
    {
      id: uid(),
      role: 'assistant',
      text:
        'Oi! Vamos configurar sua conta rapidinho. Você pode responder digitando ou usando o microfone 🎙️.\n\nQual é o nome da sua empresa? (Se você trabalhar sozinho, pode ser só o seu nome.)',
    },
  ])
  const [stage, setStage] = useState<Stage>('empresa_nome')
  const [input, setInput] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Respostas coletadas
  const [empresaNome, setEmpresaNome] = useState('')
  const [cnpj, setCnpj] = useState<string | null>(null)
  const [descricao, setDescricao] = useState('')
  const [modoOperacao, setModoOperacao] = useState('')
  const [equipeQtd, setEquipeQtd] = useState(0)
  const [equipe, setEquipe] = useState<Membro[]>([])
  const [membroAtualNome, setMembroAtualNome] = useState('')
  const [membroIndex, setMembroIndex] = useState(0)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function addAssistant(text: string) {
    setMessages((m) => [...m, { id: uid(), role: 'assistant', text }])
  }
  function addUser(text: string) {
    setMessages((m) => [...m, { id: uid(), role: 'user', text }])
  }

  async function salvar(equipeFinal: Membro[]) {
    setStage('salvando')
    setErro(null)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setErro('Sessão expirada, faça login novamente.')
      return
    }

    const { data: empresa, error: empresaErro } = await supabase
      .from('empresas')
      .insert({
        owner_id: user.id,
        nome: empresaNome,
        cnpj,
        descricao,
        modo_operacao: modoOperacao,
      })
      .select('id')
      .single()

    if (empresaErro || !empresa) {
      setErro(empresaErro?.message ?? 'Erro ao salvar empresa.')
      setStage('confirmar')
      return
    }

    if (equipeFinal.length > 0) {
      const { error: equipeErro } = await supabase.from('equipe').insert(
        equipeFinal.map((m) => ({
          empresa_id: empresa.id,
          nome: m.nome,
          funcao: m.funcao,
        }))
      )
      if (equipeErro) {
        setErro(equipeErro.message)
        setStage('confirmar')
        return
      }
    }

    router.push('/projetos')
    router.refresh()
  }

  function proximaPergunta(novoStage: Stage, texto: string) {
    setStage(novoStage)
    addAssistant(texto)
  }

  function handleTextoEnviado(textoBruto: string) {
    const texto = textoBruto.trim()
    if (!texto) return
    addUser(texto)
    setInput('')

    switch (stage) {
      case 'empresa_nome': {
        setEmpresaNome(texto)
        proximaPergunta(
          'tem_cnpj',
          `Prazer! Sua empresa (ou você, como autônomo) tem CNPJ?`
        )
        break
      }
      case 'cnpj_numero': {
        setCnpj(texto)
        proximaPergunta('descricao', 'E o que a empresa faz, no geral?')
        break
      }
      case 'descricao': {
        setDescricao(texto)
        proximaPergunta(
          'modo_operacao',
          'Entendi. Agora me conta como você costuma conduzir as obras — seu processo, do início ao fim.'
        )
        break
      }
      case 'modo_operacao': {
        setModoOperacao(texto)
        proximaPergunta(
          'sozinho_ou_equipe',
          'Você trabalha sozinho ou tem equipe com você?'
        )
        break
      }
      case 'equipe_quantidade': {
        const n = parseNumero(texto)
        if (!n || n <= 0) {
          addAssistant('Não entendi o número. Quantas pessoas trabalham com você? (ex: 3)')
          return
        }
        setEquipeQtd(n)
        setMembroIndex(0)
        proximaPergunta('equipe_nome', `Beleza, ${n} pessoa(s). Qual o nome da pessoa 1?`)
        break
      }
      case 'equipe_nome': {
        setMembroAtualNome(texto)
        proximaPergunta(
          'equipe_funcao',
          `E o que ${texto} faz / de que é responsável?`
        )
        break
      }
      case 'equipe_funcao': {
        const novoMembro = { nome: membroAtualNome, funcao: texto }
        const novaEquipe = [...equipe, novoMembro]
        setEquipe(novaEquipe)
        const proximoIndex = membroIndex + 1
        if (proximoIndex < equipeQtd) {
          setMembroIndex(proximoIndex)
          proximaPergunta(
            'equipe_nome',
            `Show. Qual o nome da pessoa ${proximoIndex + 1}?`
          )
        } else {
          irParaConfirmacao(novaEquipe)
        }
        break
      }
      default:
        break
    }
  }

  function irParaConfirmacao(equipeFinal: Membro[]) {
    setStage('confirmar')
    const linhasEquipe =
      equipeFinal.length > 0
        ? equipeFinal.map((m) => `• ${m.nome} — ${m.funcao}`).join('\n')
        : '• Você trabalha sozinho'
    addAssistant(
      `Perfeito, é só conferir:\n\n**Empresa:** ${empresaNome}\n**CNPJ:** ${
        cnpj ?? 'não informado'
      }\n**O que faz:** ${descricao}\n**Como conduz as obras:** ${modoOperacao}\n**Equipe:**\n${linhasEquipe}\n\nPodemos salvar?`
    )
  }

  function escolherSimCnpj() {
    addUser('Sim')
    proximaPergunta('cnpj_numero', 'Qual é o CNPJ?')
  }
  function escolherNaoCnpj() {
    addUser('Não tenho CNPJ')
    setCnpj(null)
    proximaPergunta('descricao', 'Sem problema. E o que a empresa faz, no geral?')
  }
  function escolherSozinho() {
    addUser('Trabalho sozinho')
    setEquipe([])
    irParaConfirmacao([])
  }
  function escolherTemEquipe() {
    addUser('Tenho equipe')
    proximaPergunta('equipe_quantidade', 'Quantas pessoas trabalham com você?')
  }

  const mostrarChipsCnpj = stage === 'tem_cnpj'
  const mostrarChipsEquipe = stage === 'sozinho_ou_equipe'
  const mostrarInput = ![
    'tem_cnpj',
    'sozinho_ou_equipe',
    'confirmar',
    'salvando',
  ].includes(stage)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border px-5 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-accent-foreground">
            G
          </div>
          <span className="font-medium">Configuração inicial</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-5 py-6">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                m.role === 'user'
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-card border border-border'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {mostrarChipsCnpj && (
          <div className="flex gap-2">
            <button
              onClick={escolherSimCnpj}
              className="rounded-full border border-border bg-card px-4 py-1.5 text-sm hover:bg-accent/10"
            >
              Sim, tenho CNPJ
            </button>
            <button
              onClick={escolherNaoCnpj}
              className="rounded-full border border-border bg-card px-4 py-1.5 text-sm hover:bg-accent/10"
            >
              Não tenho
            </button>
          </div>
        )}

        {mostrarChipsEquipe && (
          <div className="flex gap-2">
            <button
              onClick={escolherSozinho}
              className="rounded-full border border-border bg-card px-4 py-1.5 text-sm hover:bg-accent/10"
            >
              Trabalho sozinho
            </button>
            <button
              onClick={escolherTemEquipe}
              className="rounded-full border border-border bg-card px-4 py-1.5 text-sm hover:bg-accent/10"
            >
              Tenho equipe
            </button>
          </div>
        )}

        {stage === 'confirmar' && (
          <div className="space-y-2">
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <button
              onClick={() => salvar(equipe)}
              className="rounded-xl bg-accent px-5 py-2.5 text-[15px] font-medium text-accent-foreground hover:opacity-90"
            >
              Confirmar e continuar
            </button>
          </div>
        )}

        {stage === 'salvando' && (
          <p className="text-sm text-muted">Salvando…</p>
        )}

        <div ref={bottomRef} />
      </main>

      {mostrarInput && (
        <div className="border-t border-border bg-background px-5 py-4">
          <div className="mx-auto flex max-w-2xl items-end gap-2">
            <VoiceTextInput
              value={input}
              onChange={setInput}
              placeholder="Escreva ou toque no microfone para falar…"
              onSubmit={() => handleTextoEnviado(input)}
              className="flex-1"
            />
            <button
              onClick={() => handleTextoEnviado(input)}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
