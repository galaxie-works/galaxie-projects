'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/reui/alert'
import {
  Stepper,
  StepperContent,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperTitle,
  StepperTrigger,
} from '@/components/reui/stepper'
import { ServicosPicker } from '@/components/servicos/servicos-picker'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FieldError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { EtapaAreas } from './etapa-areas'
import { EtapaEmpresa } from './etapa-empresa'
import { EtapaEquipe } from './etapa-equipe'
import { EtapaRevisao } from './etapa-revisao'
import { Marca } from './marca'
import {
  RASCUNHO_INICIAL,
  TOTAL_ETAPAS,
  apagarRascunho,
  etapaMaximaLiberada,
  lerRascunho,
  membrosValidos,
  salvarRascunho,
  servicosEfetivos,
  type Rascunho,
} from './rascunho'

const ETAPAS = [
  { rotulo: 'Empresa', titulo: 'Sua empresa', descricao: 'Como seus clientes conhecem você.' },
  { rotulo: 'Áreas', titulo: 'Áreas de atuação', descricao: 'Marque tudo o que você atende.' },
  { rotulo: 'Serviços', titulo: 'Serviços', descricao: 'Escolha o que você faz em cada área.' },
  { rotulo: 'Equipe', titulo: 'Como você trabalha', descricao: 'Sua equipe e seu jeito de tocar a obra.' },
  { rotulo: 'Revisão', titulo: 'Revisão', descricao: 'Confira e ajuste antes de concluir.' },
]

export function Onboarding({ userId }: { userId: string }) {
  const router = useRouter()
  const rotuloId = useId()
  const tituloRef = useRef<HTMLDivElement>(null)
  const empresaId = useRef<string | null>(null)

  const [rascunho, setRascunho] = useState<Rascunho>(RASCUNHO_INICIAL)
  const [carregado, setCarregado] = useState(false)
  const [errosNaEtapa, setErrosNaEtapa] = useState<number | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)

  // Rascunho local: recarregar a página não perde o que já foi preenchido.
  useEffect(() => {
    const salvo = lerRascunho(userId)
    if (salvo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage só existe no cliente
      setRascunho({ ...salvo, etapa: Math.min(salvo.etapa, etapaMaximaLiberada(salvo)) })
    }
    setCarregado(true)
  }, [userId])

  useEffect(() => {
    if (carregado) salvarRascunho(userId, rascunho)
  }, [rascunho, carregado, userId])

  const { etapa } = rascunho
  const maxLiberada = etapaMaximaLiberada(rascunho)
  const etapaAtual = ETAPAS[etapa - 1]
  const qtdServicos = servicosEfetivos(rascunho).length

  function atualizar(patch: Partial<Rascunho>) {
    setRascunho((r) => ({ ...r, ...patch }))
  }

  function irPara(destino: number) {
    const alvo = Math.max(1, Math.min(destino, TOTAL_ETAPAS))
    setErrosNaEtapa(null)
    setErroSalvar(null)
    atualizar({ etapa: alvo })
    window.scrollTo({ top: 0 })
    requestAnimationFrame(() => tituloRef.current?.focus({ preventScroll: true }))
  }

  function continuar() {
    if (etapa >= maxLiberada && etapa < 4) {
      setErrosNaEtapa(etapa)
      return
    }
    irPara(etapa + 1)
  }

  async function concluir() {
    setSalvando(true)
    setErroSalvar(null)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSalvando(false)
      setErroSalvar('Sua sessão expirou. Entre de novo para concluir.')
      return
    }

    // Se a empresa já entrou numa tentativa anterior, só falta a equipe.
    if (!empresaId.current) {
      const { data: empresa, error } = await supabase
        .from('empresas')
        .insert({
          owner_id: user.id,
          nome: rascunho.nome.trim(),
          cnpj: rascunho.cnpj.trim() || null,
          descricao: rascunho.descricao.trim() || null,
          modo_operacao: rascunho.processo.trim() || null,
          servicos: servicosEfetivos(rascunho),
        })
        .select('id')
        .single()
      if (error || !empresa) {
        setSalvando(false)
        setErroSalvar(error?.message ?? 'Não foi possível salvar a empresa.')
        return
      }
      empresaId.current = empresa.id
    }

    const membros = membrosValidos(rascunho)
    if (membros.length > 0) {
      const { error } = await supabase.from('equipe').insert(
        membros.map((m) => ({
          empresa_id: empresaId.current,
          nome: m.nome,
          funcao: m.funcao || null,
        }))
      )
      if (error) {
        // Desfaz a empresa para não deixar um cadastro pela metade: senão a
        // página redirecionaria para o app e a equipe se perderia.
        const { error: erroDesfazer } = await supabase
          .from('empresas')
          .delete()
          .eq('id', empresaId.current)
        if (!erroDesfazer) empresaId.current = null
        setSalvando(false)
        setErroSalvar(error.message)
        return
      }
    }

    apagarRascunho(userId)
    router.push('/projetos')
    router.refresh()
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-center px-4 pt-6 sm:pt-10">
        <Marca />
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-12">
        <Stepper
          value={etapa}
          onValueChange={irPara}
          className="@container flex flex-col gap-6"
          aria-labelledby={rotuloId}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
              <p id={rotuloId} className="text-sm font-medium">
                Configuração inicial
              </p>
              <StepperNav className="order-last hidden flex-wrap gap-y-2.5 @md:flex @xl:order-none @xl:w-auto @xl:flex-1 @xl:justify-center">
                {ETAPAS.map((item, index) => {
                  const step = index + 1
                  return (
                    <StepperItem
                      key={item.rotulo}
                      step={step}
                      disabled={step > maxLiberada}
                      className="not-last:flex-none"
                    >
                      <StepperTrigger className="-mx-1.5 -my-1.25 px-1.5 py-1.25">
                        <StepperTitle className="whitespace-nowrap text-muted-foreground data-[state=active]:text-foreground">
                          {item.rotulo}
                        </StepperTitle>
                        {step < etapa && <span className="sr-only">, concluída</span>}
                      </StepperTrigger>
                      {step < ETAPAS.length && (
                        <ChevronRightIcon
                          aria-hidden="true"
                          className="mx-1.5 size-3.5 text-ring/50 group-data-[state=completed]/step:text-ring"
                        />
                      )}
                    </StepperItem>
                  )
                })}
              </StepperNav>
              <p className="flex gap-1.5 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                <span>Etapa</span>
                <span>
                  <span className="text-foreground">{etapa}</span>{' '}
                  <span aria-hidden="true">/</span>
                  <span className="sr-only">de</span> {ETAPAS.length}
                </span>
              </p>
            </div>
            <div aria-hidden="true" className="flex h-1 gap-1">
              {ETAPAS.map((item, index) => (
                <span
                  key={item.rotulo}
                  className={cn(
                    'flex-1 rounded-full transition-colors',
                    index < etapa ? 'bg-foreground' : 'bg-ring/20'
                  )}
                />
              ))}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle ref={tituloRef} tabIndex={-1} className="tracking-tight outline-none">
                {etapaAtual.titulo}
              </CardTitle>
              <CardDescription>{etapaAtual.descricao}</CardDescription>
            </CardHeader>

            <CardContent>
              <StepperPanel>
                <StepperContent value={1}>
                  <EtapaEmpresa
                    rascunho={rascunho}
                    atualizar={atualizar}
                    mostrarErros={errosNaEtapa === 1}
                  />
                </StepperContent>
                <StepperContent value={2}>
                  <EtapaAreas
                    rascunho={rascunho}
                    atualizar={atualizar}
                    mostrarErros={errosNaEtapa === 2}
                  />
                </StepperContent>
                <StepperContent value={3}>
                  <div className="flex flex-col gap-3">
                    <ServicosPicker
                      value={rascunho.servicos}
                      onChange={(servicos) => atualizar({ servicos })}
                      areas={rascunho.areas}
                    />
                    {errosNaEtapa === 3 && qtdServicos === 0 && (
                      <FieldError>Marque pelo menos um serviço.</FieldError>
                    )}
                  </div>
                </StepperContent>
                <StepperContent value={4}>
                  <EtapaEquipe rascunho={rascunho} atualizar={atualizar} />
                </StepperContent>
                <StepperContent value={5}>
                  <div className="flex flex-col gap-4">
                    <EtapaRevisao rascunho={rascunho} atualizar={atualizar} irPara={irPara} />
                    {erroSalvar && (
                      <Alert variant="destructive">
                        <AlertTitle>Não deu para salvar</AlertTitle>
                        <AlertDescription>{erroSalvar}</AlertDescription>
                        <AlertAction>
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={concluir}
                            disabled={salvando}
                          >
                            Tentar de novo
                          </Button>
                        </AlertAction>
                      </Alert>
                    )}
                  </div>
                </StepperContent>
              </StepperPanel>
            </CardContent>

            <CardFooter className="justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => irPara(etapa - 1)}
                disabled={etapa === 1 || salvando}
              >
                <ArrowLeftIcon data-icon="inline-start" />
                Voltar
              </Button>
              <div className="flex items-center gap-3">
                {etapa === 3 && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {qtdServicos === 1 ? '1 serviço' : `${qtdServicos} serviços`}
                  </span>
                )}
                {etapa < TOTAL_ETAPAS ? (
                  <Button type="button" onClick={continuar}>
                    Continuar
                    <ArrowRightIcon data-icon="inline-end" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={concluir}
                    disabled={salvando || maxLiberada < TOTAL_ETAPAS}
                  >
                    {salvando ? <Spinner data-icon="inline-start" /> : <CheckIcon data-icon="inline-start" />}
                    {salvando ? 'Salvando…' : 'Concluir'}
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>
        </Stepper>
      </main>
    </div>
  )
}
