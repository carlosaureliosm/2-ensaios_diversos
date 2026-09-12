// src/modules/aderencia/utils.ts

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
