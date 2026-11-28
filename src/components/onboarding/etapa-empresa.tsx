'use client'

import { BotaoVoz } from '@/components/voz/botao-voz'
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  cnpjValido,
  cpfValido,
  mascararCnpj,
  mascararCpf,
  type Rascunho,
  type TipoPessoa,
} from './rascunho'

const TIPOS: { value: TipoPessoa; titulo: string; descricao: string }[] = [
  {
    value: 'PJ',
    titulo: 'Pessoa jurídica',
    descricao: 'Empresa com CNPJ, inclusive MEI. Emite nota fiscal de serviço pelo app.',
  },
  {
    value: 'PF',
    titulo: 'Pessoa física',
    descricao: 'Profissional autônomo, sem CNPJ. Sem emissão de nota fiscal.',
  },
]

type Props = {
  rascunho: Rascunho
  atualizar: (patch: Partial<Rascunho>) => void
  mostrarErros: boolean
}

export function EtapaEmpresa({ rascunho, atualizar, mostrarErros }: Props) {
  const pf = rascunho.tipo === 'PF'
  const erroNome = mostrarErros && !rascunho.nome.trim()
  const erroCnpj = mostrarErros && !pf && !cnpjValido(rascunho.cnpj)
  const erroCpf = mostrarErros && pf && !cpfValido(rascunho.cpf)

  return (
    <FieldGroup>
      <FieldSet>
        <FieldLegend variant="label">Você vai usar como</FieldLegend>
        <RadioGroup
          value={rascunho.tipo}
          onValueChange={(v) => atualizar({ tipo: v as TipoPessoa })}
          className="grid gap-3 sm:grid-cols-2"
        >
          {TIPOS.map((t) => (
            <FieldLabel key={t.value} htmlFor={`tipo-${t.value}`}>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>{t.titulo}</FieldTitle>
                  <FieldDescription>{t.descricao}</FieldDescription>
                </FieldContent>
                <RadioGroupItem value={t.value} id={`tipo-${t.value}`} />
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>
      </FieldSet>

      <Field data-invalid={erroNome || undefined}>
        <FieldLabel htmlFor="empresa-nome">{pf ? 'Seu nome profissional' : 'Nome da empresa'}</FieldLabel>
        <Input
          id="empresa-nome"
          value={rascunho.nome}
          onChange={(e) => atualizar({ nome: e.target.value })}
          placeholder={pf ? 'Ex.: João Pisos e Revestimentos' : 'Ex.: Consani Reformas'}
          autoComplete={pf ? 'name' : 'organization'}
          aria-invalid={erroNome || undefined}
          required
        />
        {erroNome ? (
          <FieldError>{pf ? 'Informe o seu nome.' : 'Informe o nome da empresa.'}</FieldError>
        ) : (
          <FieldDescription>
            {pf ? 'Como seus clientes conhecem você' : 'Nome usado nos orçamentos'}
          </FieldDescription>
        )}
      </Field>

      {pf ? (
        <Field data-invalid={erroCpf || undefined}>
          <FieldLabel htmlFor="empresa-cpf">CPF</FieldLabel>
          <Input
            id="empresa-cpf"
            value={rascunho.cpf}
            onChange={(e) => atualizar({ cpf: mascararCpf(e.target.value) })}
            placeholder="000.000.000-00"
            inputMode="numeric"
            className="tabular-nums"
            aria-invalid={erroCpf || undefined}
          />
          {erroCpf ? (
            <FieldError>O CPF tem 11 dígitos. Complete ou deixe em branco.</FieldError>
          ) : (
            <FieldDescription>Opcional.</FieldDescription>
          )}
        </Field>
      ) : (
      <Field data-invalid={erroCnpj || undefined}>
        <FieldLabel htmlFor="empresa-cnpj">CNPJ</FieldLabel>
        <Input
          id="empresa-cnpj"
          value={rascunho.cnpj}
          onChange={(e) => atualizar({ cnpj: mascararCnpj(e.target.value) })}
          placeholder="00.000.000/0000-00"
          inputMode="numeric"
          className="tabular-nums"
          aria-invalid={erroCnpj || undefined}
        />
        {erroCnpj ? (
          <FieldError>O CNPJ tem 14 dígitos. Complete ou deixe em branco.</FieldError>
        ) : (
          <FieldDescription>Opcional. Necessário para emitir nota fiscal.</FieldDescription>
        )}
      </Field>
      )}

      <Field>
        <FieldLabel htmlFor="empresa-descricao">{pf ? 'O que você faz' : 'O que a empresa faz'}</FieldLabel>
        <InputGroup>
          <InputGroupTextarea
            id="empresa-descricao"
            value={rascunho.descricao}
            onChange={(e) => atualizar({ descricao: e.target.value })}
            placeholder="Ex.: Reformas residenciais e acabamento de pisos em Campinas e região."
            rows={3}
          />
          <InputGroupAddon align="block-end">
            <InputGroupText className="text-xs font-normal">Opcional</InputGroupText>
            <span className="ml-auto">
              <BotaoVoz
                rotulo="Ditar descrição"
                size="icon-xs"
                onFinal={(t) =>
                  atualizar({
                    descricao: rascunho.descricao ? `${rascunho.descricao.trimEnd()} ${t}` : t,
                  })
                }
              />
            </span>
          </InputGroupAddon>
        </InputGroup>
      </Field>
    </FieldGroup>
  )
}
