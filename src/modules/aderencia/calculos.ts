// src/modules/aderencia/calculos.ts

import type { CorpoDeProva } from './types'

/** Cria um corpo de prova vazio, com a coluna de forma de ruptura já inicializada para o modelo escolhido. */
export function criarCorpoDeProva(numero: number, colunasFormaRuptura: string[]): CorpoDeProva {
  const formaRuptura: Record<string, number> = {}
  colunasFormaRuptura.forEach(c => { formaRuptura[c] = 0 })
  return {
    numero,
    bloco: '',
    junta: '',
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
