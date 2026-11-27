import { SignedXml } from 'xml-crypto'

// Assinatura XMLDSig envelopada, no mesmo formato que a Sefin Nacional aceita
// (igual ao NFePHP): RSA-SHA1, canonicalização C14N, transform enveloped,
// Reference com URI="#<Id>" e o bloco <Signature> como último filho da raiz
// (DPS ou pedRegEvento), logo depois de infDPS/infPedReg.

const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'

export function assinarXml(
  xml: string,
  opcoes: { tag: string; raiz: string; chavePem: string; certPem: string },
): string {
  const sig = new SignedXml({
    privateKey: opcoes.chavePem,
    publicCert: opcoes.certPem,
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
    canonicalizationAlgorithm: C14N,
  })
  sig.addReference({
    xpath: `//*[local-name(.)='${opcoes.tag}']`,
    transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', C14N],
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
  })
  sig.computeSignature(xml, {
    location: { reference: `//*[local-name(.)='${opcoes.raiz}']`, action: 'append' },
  })
  return sig.getSignedXml()
}
