'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  DESCRICAO_PAPEL,
  MODELOS_PERMISSAO,
  MODULOS,
  ROTULO_NIVEL,
  ROTULO_PAPEL,
  type Nivel,
  type Papel,
  type Permissoes,
} from '@/lib/acesso-regras'
import { convidarAcao, salvarAcessoAcao } from '@/app/(dashboard)/acessos/actions'

export type MembroAcesso = {
  id: string
  email: string
  papel: Papel
  permissoes: Permissoes
  equipe_id: string | null
  status: 'convidado' | 'ativo' | 'suspenso'
}

const SEM_PESSOA = 'nenhuma'

// Convidar alguém, ou mudar papel e permissões de quem já tem acesso.
export function AcessoDialog({
  aberto,
  onOpenChange,
  membro,
  equipe,
}: {
  aberto: boolean
  onOpenChange: (v: boolean) => void
  /** Sem membro = convite novo. */
  membro?: MembroAcesso
  equipe: { id: string; nome: string }[]
}) {
  const [email, setEmail] = useState(membro?.email ?? '')
  const [papel, setPapel] = useState<'gestor' | 'membro'>(membro?.papel === 'gestor' ? 'gestor' : 'membro')
  const [permissoes, setPermissoes] = useState<Permissoes>(
    membro?.permissoes ?? MODELOS_PERMISSAO.find((m) => m.id === 'campo')!.permissoes
  )
  const [equipeId, setEquipeId] = useState<string>(membro?.equipe_id ?? SEM_PESSOA)
  const [suspenso, setSuspenso] = useState(membro?.status === 'suspenso')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const itensEquipe = [{ value: SEM_PESSOA, label: 'Sem vínculo' }, ...equipe.map((e) => ({ value: e.id, label: e.nome }))]

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    const dados = { papel, permissoes, equipeId: equipeId === SEM_PESSOA ? null : equipeId }
    const r = membro ? await salvarAcessoAcao(membro.id, { ...dados, suspenso }) : await convidarAcao({ ...dados, email })
    setSalvando(false)
    if (!r.ok) {
      setErro(r.erro)
      return
    }
    toast.success(r.mensagem)
    onOpenChange(false)
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{membro ? membro.email : 'Convidar pessoa'}</DialogTitle>
        </DialogHeader>
        <form id="form-acesso" onSubmit={salvar}>
          <FieldGroup className="max-h-[60svh] overflow-y-auto">
            {!membro && (
              <Field>
                <FieldLabel htmlFor="acesso-email">E-mail</FieldLabel>
                <Input
                  id="acesso-email"
                  type="email"
                  autoComplete="off"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@empresa.com.br"
                />
              </Field>
            )}

            <FieldSet>
              <FieldLegend variant="label">Papel</FieldLegend>
              <RadioGroup
                value={papel}
                onValueChange={(v) => setPapel(v as 'gestor' | 'membro')}
                className="grid gap-3 sm:grid-cols-2"
              >
                {(['membro', 'gestor'] as const).map((p) => (
                  <FieldLabel key={p} htmlFor={`acesso-papel-${p}`}>
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldTitle>{ROTULO_PAPEL[p]}</FieldTitle>
                        <FieldDescription>{DESCRICAO_PAPEL[p]}</FieldDescription>
                      </FieldContent>
                      <RadioGroupItem value={p} id={`acesso-papel-${p}`} />
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>
            </FieldSet>

            {papel === 'membro' && (
              <FieldSet>
                <FieldLegend variant="label">Permissões</FieldLegend>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground text-xs">Modelos:</span>
                  {MODELOS_PERMISSAO.map((m) => (
                    <Button key={m.id} type="button" variant="outline" size="xs" onClick={() => setPermissoes(m.permissoes)}>
                      {m.rotulo}
                    </Button>
                  ))}
                </div>
                <div className="flex flex-col divide-y rounded-lg border">
                  {MODULOS.map((m) => (
                    <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <div className="flex min-w-0 flex-col">
                        <span className="text-sm font-medium">{m.rotulo}</span>
                        <span className="text-muted-foreground text-xs">{m.descricao}</span>
                      </div>
                      <ToggleGroup
                        variant="outline"
                        size="sm"
                        value={[permissoes[m.id] ?? 'nenhum']}
                        onValueChange={(v) => {
                          const n = v[0] as Nivel | undefined
                          if (n) setPermissoes((x) => ({ ...x, [m.id]: n }))
                        }}
                        aria-label={`Acesso a ${m.rotulo}`}
                      >
                        {(['nenhum', 'ver', 'editar'] as const).map((n) => (
                          <ToggleGroupItem key={n} value={n}>
                            {ROTULO_NIVEL[n]}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </div>
                  ))}
                </div>
              </FieldSet>
            )}

            {equipe.length > 0 && (
              <Field>
                <FieldLabel htmlFor="acesso-equipe">Cadastro na equipe</FieldLabel>
                <Select items={itensEquipe} value={equipeId} onValueChange={(v) => setEquipeId((v as string) ?? SEM_PESSOA)}>
                  <SelectTrigger id="acesso-equipe" className="w-full sm:w-72">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {itensEquipe.map((i) => (
                      <SelectItem key={i.value} value={i.value}>
                        {i.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {membro && (
              <Field orientation="horizontal">
                <Switch id="acesso-suspenso" checked={suspenso} onCheckedChange={setSuspenso} />
                <FieldLabel htmlFor="acesso-suspenso">Suspender acesso</FieldLabel>
              </Field>
            )}

            {erro && <FieldError>{erro}</FieldError>}
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" form="form-acesso" disabled={salvando}>
            {salvando && <Spinner data-icon="inline-start" />}
            {membro ? 'Salvar' : 'Enviar convite'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
