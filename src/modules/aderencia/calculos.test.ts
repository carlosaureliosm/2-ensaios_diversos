import { describe, it, expect } from 'vitest'
import { calcularTensaoRa } from './calculos'

describe('calcularTensaoRa', () => {
  it('placa circular Ø5 cm: 100 kgf ≈ 0,50 MPa', () => {
    expect(calcularTensaoRa(100, 'circular')).toBeCloseTo(0.4995, 3)
  })
  it('placa quadrada 10x10 cm: 100 kgf ≈ 0,098 MPa', () => {
    expect(calcularTensaoRa(100, 'quadrada')).toBeCloseTo(0.0981, 3)
  })
  it('sem carga retorna null', () => {
    expect(calcularTensaoRa(null)).toBeNull()
  })
})
