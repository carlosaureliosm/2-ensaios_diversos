// src/modules/aderencia/utils.ts

import type { AderenciaNormas, CorpoDeProva, CriterioRa } from './types'

const ROMANOS: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
]

/** Converte um número (1, 2, 3...) para algarismo romano (I, II, III...), usado na numeração das Situações. */
export function numeroRomano(n: number): string {
  let resto = n
  let out = ''
  for (const [valor, simbolo] of ROMANOS) {
    while (resto >= valor) {
      out += simbolo
      resto -= valor
    }
  }
  return out
}

/** Formata o código do relatório no padrão `RLT.LAU-XXX.AA-00` usando os 2 últimos dígitos do ano atual. */
export function formatarRltAderencia(rlt: string): string {
  const aa = String(new Date().getFullYear()).slice(-2)
  const n = (rlt ?? '').trim()
  if (!n) return `RLT.LAU-XXX.${aa}-00`
  if (/^RLT/i.test(n)) return n
  if (/^\d+$/.test(n)) return `RLT.LAU-${n.padStart(3, '0')}.${aa}-00`
  return `RLT.LAU-${n}.${aa}-00`
}

/** Sugere o critério de Ra (Tabela 01 ou Tabela 02) a partir das normas marcadas, do modelo de camadas e do tipo de revestimento. */
export function sugerirCriterioRa(
  normas: AderenciaNormas,
  modeloId: string,
  tipoRevestimento = '',
): CriterioRa {
  const tipo = tipoRevestimento.toUpperCase()
  const ehExterno = tipo.includes('EXTERN') || tipo.includes('FACHADA')
  const ehTeto = tipo.includes('TETO') || tipo.includes('FORRO')

  if (normas.nbr13755 && (ehExterno || modeloId === 'parede-ceramica')) {
    return 'nbr13755'
  }
  if (modeloId.startsWith('piso-') || modeloId === 'parede-ceramica' || normas.nbr13753 || normas.nbr13754) {
    return '0.30'
  }
  if (normas.nbr13749 && (ehTeto || (modeloId === 'parede-reboco' && !ehExterno))) {
    return '0.20'
  }
  return '0.30'
}

export function obterLimitesCriterioRa(criterio: CriterioRa): {
  minimo: number
  recomendado: number | null
  label: string
} {
  if (criterio === '0.20') return { minimo: 0.2, recomendado: null, label: '≥ 0,20 MPa (Tabela 01)' }
  if (criterio === 'nbr13755') return { minimo: 0.3, recomendado: 0.5, label: 'NBR 13755 (0,30 / 0,50 MPa)' }
  return { minimo: 0.3, recomendado: null, label: '≥ 0,30 MPa (Tabela 01)' }
}

export interface AvaliacaoPanoRa {
  status: 'aprovado' | 'atencao' | 'reprovado'
  texto: string
}

/** Avalia o conjunto de CPs conforme a regra de 2/3 (Tabela 01) ou os 3 patamares da NBR 13755 (Tabela 02). */
export function avaliarPanoRa(cps: CorpoDeProva[], criterio: CriterioRa): AvaliacaoPanoRa | null {
  const validos = cps.filter(cp => cp.tensaoRa !== null && cp.tensaoRa !== undefined)
  const total = validos.length
  if (total === 0) return null

  const { minimo, recomendado } = obterLimitesCriterioRa(criterio)
  const meta = Math.ceil((total * 2) / 3)
  const qtdMin = validos.filter(cp => (cp.tensaoRa ?? 0) >= minimo).length

  if (recomendado !== null) {
    const qtdRec = validos.filter(cp => (cp.tensaoRa ?? 0) >= recomendado).length
    if (qtdRec >= meta) {
      return { status: 'aprovado', texto: `${qtdRec}/${total} ≥ 0,50 MPa · Aprovado` }
    }
    if (qtdMin >= meta) {
      return { status: 'atencao', texto: `${qtdMin}/${total} ≥ 0,30 MPa · Consultar projetista` }
    }
    return { status: 'reprovado', texto: `${qtdMin}/${total} ≥ 0,30 MPa · Reprovado` }
  }

  const minFmt = minimo.toFixed(2).replace('.', ',')
  if (qtdMin >= meta) {
    return { status: 'aprovado', texto: `${qtdMin}/${total} ≥ ${minFmt} MPa · Aprovado (≥ 2/3)` }
  }
  return { status: 'reprovado', texto: `${qtdMin}/${total} ≥ ${minFmt} MPa · Abaixo de 2/3` }
}
