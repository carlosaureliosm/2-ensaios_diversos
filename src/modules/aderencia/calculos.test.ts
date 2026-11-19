import { describe, it, expect } from 'vitest'
import { calcularTensaoRa } from './calculos'

describe('calcularTensaoRa', () => {
  it('placa circular Ø5 cm: 100 kgf = 0,50 MPa', () => {
    expect(calcularTensaoRa(100, 'circular')).toBe(0.5)
  })
  it('placa circular: 60 kgf arredonda para 0,30 (não fica abaixo do limite)', () => {
    expect(calcularTensaoRa(60, 'circular')).toBe(0.3)
  })
  it('placa quadrada 10x10 cm: 300 kgf = 0,29 MPa', () => {
    expect(calcularTensaoRa(300, 'quadrada')).toBe(0.29)
  })
  it('sem carga retorna null', () => {
    expect(calcularTensaoRa(null)).toBeNull()
  })
})
