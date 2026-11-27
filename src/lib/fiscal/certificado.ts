import forge from 'node-forge'

// Lê o certificado A1 (.pfx/.p12) da empresa. Só roda no servidor.
// Devolve a chave e o certificado em PEM (para assinar o XML) e os dados
// que mostramos no painel: titular, CNPJ/CPF e validade.

export type CertificadoLido = {
  chavePem: string
  certPem: string
  titular: string
  documento: string | null // CNPJ (14) ou CPF (11), só dígitos
  validoDe: Date
  validoAte: Date
}

// OIDs ICP-Brasil gravados no SubjectAltName (otherName).
const OID_CNPJ = '2.16.76.1.3.3'
const OID_PF = '2.16.76.1.3.1' // dados da pessoa física: nascimento (8) + CPF (11) + ...

// Junta os textos (folhas) de um nó ASN.1.
function textos(no: forge.asn1.Asn1): string {
  if (Array.isArray(no.value)) return (no.value as forge.asn1.Asn1[]).map(textos).join('')
  if (no.type === forge.asn1.Type.OID) return ''
  if (no.constructed === false && typeof no.value === 'string') {
    // Pode vir como texto (PrintableString/UTF8) ou como OCTET STRING com outro nó dentro.
    try {
      const interno = forge.asn1.fromDer(no.value)
      return textos(interno)
    } catch {
      return no.value
    }
  }
  return ''
}

function documentoDoSan(cert: forge.pki.Certificate): string | null {
  const ext = cert.extensions.find((e) => e.name === 'subjectAltName') as { value?: string } | undefined
  if (!ext?.value) return null
  try {
    const pilha: forge.asn1.Asn1[] = [forge.asn1.fromDer(ext.value)]
    while (pilha.length) {
      const no = pilha.pop()!
      if (!Array.isArray(no.value)) continue
      const filhos = no.value as forge.asn1.Asn1[]
      const oidNo = filhos.find((f) => f.type === forge.asn1.Type.OID && typeof f.value === 'string')
      if (oidNo) {
        const oid = forge.asn1.derToOid(oidNo.value as string)
        const digitos = filhos.filter((f) => f !== oidNo).map(textos).join('').replace(/\D/g, '')
        if (oid === OID_CNPJ && digitos.length >= 14) return digitos.slice(0, 14)
        if (oid === OID_PF && digitos.length >= 19) return digitos.slice(8, 19)
      }
      pilha.push(...filhos)
    }
  } catch {
    // SAN fora do padrão: tenta pelo nome
  }
  return null
}

export function lerCertificado(pfx: Buffer, senha: string): CertificadoLido {
  let p12: forge.pkcs12.Pkcs12Pfx
  try {
    const asn = forge.asn1.fromDer(forge.util.createBuffer(pfx.toString('binary')))
    p12 = forge.pkcs12.pkcs12FromAsn1(asn, false, senha)
  } catch {
    throw new Error('Não consegui abrir o certificado. Confira o arquivo .pfx e a senha.')
  }

  const chaves = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []),
  ]
  const certs = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? []
  const chave = chaves.find((b) => b.key)?.key
  if (!chave) throw new Error('O certificado não tem a chave privada. Exporte o A1 com a chave.')

  // O certificado do titular é o que casa com a chave privada.
  const rsa = chave as forge.pki.rsa.PrivateKey
  const doTitular =
    certs.find((b) => {
      const pub = b.cert?.publicKey as forge.pki.rsa.PublicKey | undefined
      return pub?.n && pub.n.equals(rsa.n)
    })?.cert ?? certs[0]?.cert
  if (!doTitular) throw new Error('O arquivo não traz o certificado do titular.')

  const cn = (doTitular.subject.getField('CN')?.value as string | undefined) ?? ''
  const [nome, docNoNome] = cn.split(':')
  const documento =
    documentoDoSan(doTitular) ?? (docNoNome?.replace(/\D/g, '').match(/^\d{11}$|^\d{14}$/)?.[0] ?? null)

  return {
    chavePem: forge.pki.privateKeyToPem(chave),
    certPem: forge.pki.certificateToPem(doTitular),
    titular: (nome || cn).trim(),
    documento,
    validoDe: doTitular.validity.notBefore,
    validoAte: doTitular.validity.notAfter,
  }
}
