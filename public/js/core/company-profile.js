export const COMPANY_PROFILE = Object.freeze({
  brandName: 'MADERARTE',
  legalName: 'GRUPO EMPRESARIAL MADERARTE WILLRES SAS',
  nit: '901188291-2',
  mobile: '3006478590',
  whatsapp: '3117476465',
  website: 'www.maderartepopayan.com',
  socialHandle: '@maderartepopayan',
  socialNetworks: Object.freeze(['Instagram', 'Facebook', 'TikTok']),
  slogan: 'Muebles con un estilo diferente para cada cliente',
  branches: Object.freeze({
    MP: Object.freeze({
      code: 'MP',
      name: 'Sede principal',
      displayName: 'Maderarte Principal',
      address: 'Transversal 9 # 6N-26 · Edificio Dorado',
      reference: 'Frente al Éxito Panamericana'
    }),
    TP: Object.freeze({
      code: 'TP',
      name: 'Sede norte',
      displayName: 'Maderarte Terraplaza',
      address: 'Centro Comercial Terraplaza · Local 113 · Primer piso',
      reference: ''
    })
  })
});

export function companyBranch(code) {
  return COMPANY_PROFILE.branches[String(code || '').trim().toUpperCase()] || null;
}
