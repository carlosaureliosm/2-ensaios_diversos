// src/modules/aderencia/calculos.ts

import type { CorpoDeProva, FormatoPlaca } from './types'

export const GRAVIDADE = 9.80665 // m/s²

/** Área da placa em m²: circular Ø 0,05 m ou quadrada 0,10 x 0,10 m. */
export function areaPlacaM2(formato: FormatoPlaca = 'circular'): number {
  return formato === 'quadrada' ? 0.1 * 0.1 : Math.PI * 0.025 ** 2
}

/** Ra (MPa) = carga(kgf) × 9,80665 (N) ÷ área (m²) ÷ 10⁶ (Pa → MPa). */
export function calcularTensaoRa(cargaKgf: number | null | undefined, formato: FormatoPlaca = 'circular'): number | null {
  if (cargaKgf === null || cargaKgf === undefined || isNaN(cargaKgf)) return null
  const forcaN = cargaKgf * GRAVIDADE
  const tensaoPa = forcaN / areaPlacaM2(formato)
  return tensaoPa / 1e6
}

/** Recalcula `tensaoRa` dos CPs que têm carga informada (CPs sem carga mantêm o valor, p.ex. rascunhos antigos). */
export function recalcularTensoes(cps: CorpoDeProva[], formato: FormatoPlaca = 'circular'): CorpoDeProva[] {
  return cps.map(cp => (cp.cargaKgf === null || cp.cargaKgf === undefined ? cp : { ...cp, tensaoRa: calcularTensaoRa(cp.cargaKgf, formato) }))
}

/** Cria um corpo de prova vazio, com a coluna de forma de ruptura já inicializada para o modelo escolhido. */
export function criarCorpoDeProva(numero: number, colunasFormaRuptura: string[]): CorpoDeProva {
  const formaRuptura: Record<string, number> = {}
  colunasFormaRuptura.forEach(c => { formaRuptura[c] = 0 })
  return {
    numero,
    bloco: '',
    junta: '',
    cargaKgf: null,
    tensaoRa: null,
    profRuptura: null,
    formaRuptura,
    localizacao: '',
    fotos: [null, null],
  }
}

/**
 * Ajusta a quantidade de corpos de prova de uma Situação para `novoTamanho`, preservando os
 * já preenchidos e renumerando sequencialmente. Usado quando o campo "Nº de corpos de prova" muda.
 */
export function redimensionarCorposDeProva(
  atual: CorpoDeProva[],
  novoTamanho: number,
  colunasFormaRuptura: string[]
): CorpoDeProva[] {
  const tamanho = Math.max(0, novoTamanho)
  const next = atual.slice(0, tamanho)
  while (next.length < tamanho) next.push(criarCorpoDeProva(next.length + 1, colunasFormaRuptura))
  return next.map((cp, i) => ({ ...cp, numero: i + 1 }))
}

function media(valores: number[]): number | null {
  return valores.length === 0 ? null : valores.reduce((a, b) => a + b, 0) / valores.length
}

/** Desvio padrão amostral (n-1), mesmo critério usado no módulo pacometria. */
function desvioPadrao(valores: number[], mediaValor: number): number | null {
  if (valores.length === 0) return null
  if (valores.length === 1) return 0
  const somaQuadrados = valores.reduce((acc, v) => acc + (v - mediaValor) ** 2, 0)
  return Math.sqrt(somaQuadrados / (valores.length - 1))
}

export interface EstatisticasCPs {
  raMedia: number | null
  profRupturaMedia: number | null
  dp: number | null
  cv: number | null // %
}

/** Calcula Ra médio, profundidade de ruptura média, desvio padrão e coeficiente de variação (%). */
export function calcularEstatisticasCPs(corposDeProva: CorpoDeProva[]): EstatisticasCPs {
  const rasValidos = corposDeProva
    .map(cp => cp.tensaoRa)
    .filter((v): v is number => v !== null && !isNaN(v))
  const profsValidas = corposDeProva
    .map(cp => cp.profRuptura)
    .filter((v): v is number => v !== null && !isNaN(v))

  const raMedia = media(rasValidos)
  const profRupturaMedia = media(profsValidas)
  const dp = raMedia !== null ? desvioPadrao(rasValidos, raMedia) : null
  const cv = raMedia !== null && raMedia > 0 && dp !== null ? (dp / raMedia) * 100 : null

  return { raMedia, profRupturaMedia, dp, cv }
}
