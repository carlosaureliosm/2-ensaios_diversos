import { describe, it, expect } from 'vitest';
import { calcularAmostra } from './calcularAmostra';

const impactos16x40 = Array(16).fill('40');

describe('calcularAmostra', () => {
  it('amostra válida posição 0° com 16 impactos iguais e coef 1.0', () => {
    const result = calcularAmostra('A1', '0°', impactos16x40, 1.0, 1);
    expect(result.status).toBe('Amostra Válida');
    expect(result.ieEfetivo).toBeGreaterThan(0);
    expect(result.resistencia).toBeGreaterThan(0);
  });

  it('amostra perdida com menos de 5 impactos dentro dos limites', () => {
    // 4 valores iguais + 1 bem diferente → apenas 4 ficam dentro dos limites
    const impactos = ['40', '40', '40', '40', '100', '', '', '', '', '', '', '', '', '', '', ''];
    const result = calcularAmostra('A2', '0°', impactos, 1.0, 2);
    expect(result.status).toBe('Amostra Perdida');
  });

  it('coeficiente bigorna 0.95 reduz ieEfetivo em relação ao coef 1.0', () => {
    const r1 = calcularAmostra('A3', '0°', impactos16x40, 1.0, 3);
    const r2 = calcularAmostra('A3', '0°', impactos16x40, 0.95, 3);
    expect(r2.ieEfetivo!).toBeLessThan(r1.ieEfetivo!);
  });

  it('posição +90° gera resistencia diferente da posição 0° para mesmos impactos', () => {
    const r0 = calcularAmostra('A4', '0°', impactos16x40, 1.0, 4);
    const r90 = calcularAmostra('A4', '+90°', impactos16x40, 1.0, 4);
    expect(r90.resistencia).not.toBeCloseTo(r0.resistencia!, 5);
  });

  it('posição -90° gera resistencia diferente da posição 0° para mesmos impactos', () => {
    const r0 = calcularAmostra('A5', '0°', impactos16x40, 1.0, 5);
    const rNeg90 = calcularAmostra('A5', '-90°', impactos16x40, 1.0, 5);
    expect(rNeg90.resistencia).not.toBeCloseTo(r0.resistencia!, 5);
  });

  it('array de strings vazias retorna Amostra Perdida', () => {
    const impactosVazios = Array(16).fill('');
    const result = calcularAmostra('A6', '0°', impactosVazios, 1.0, 6);
    expect(result.status).toBe('Amostra Perdida');
    expect(result.ieEfetivo).toBeNull();
    expect(result.resistencia).toBeNull();
  });
});
