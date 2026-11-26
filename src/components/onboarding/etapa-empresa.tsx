'use client'

import { BotaoVoz } from '@/components/voz/botao-voz'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { cnpjValido, mascararCnpj, type Rascunho } from './rascunho'

type Props = {
  rascunho: Rascunho
  atualizar: (patch: Partial<Rascunho>) => void
  mostrarErros: boolean
}

export function EtapaEmpresa({ rascunho, atualizar, mostrarErros }: Props) {
  const erroNome = mostrarErros && !rascunho.nome.trim()
  const erroCnpj = mostrarErros && !cnpjValido(rascunho.cnpj)

  return (
    <FieldGroup>
      <Field data-invalid={erroNome || undefined}>
        <FieldLabel htmlFor="empresa-nome">Nome da empresa</FieldLabel>
        <Input
          id="empresa-nome"
          value={rascunho.nome}
          onChange={(e) => atualizar({ nome: e.target.value })}
          placeholder="Ex.: Consani Reformas"
          autoComplete="organization"
          aria-invalid={erroNome || undefined}
          required
        />
        {erroNome ? (
          <FieldError>Informe o nome da empresa.</FieldError>
        ) : (
          <FieldDescription>Se você trabalha por conta, pode ser o seu nome.</FieldDescription>
        )}
      </Field>

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
          <FieldDescription>Opcional.</FieldDescription>
        )}
      </Field>

      <Field>
        <FieldLabel htmlFor="empresa-descricao">O que a empresa faz</FieldLabel>
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
