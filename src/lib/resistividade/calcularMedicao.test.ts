import { describe, it, expect } from 'vitest';
import { calcularMedicao, classificarResistividade } from './calcularMedicao';

describe('classificarResistividade', () => {
  it('classifica faixas conforme COST 509 / RILEM TC 154-EMC', () => {
    expect(classificarResistividade(120)).toBe('Desprezível');
    expect(classificarResistividade(100)).toBe('Baixo');
    expect(classificarResistividade(50)).toBe('Baixo');
    expect(classificarResistividade(49.9)).toBe('Moderado');
    expect(classificarResistividade(10)).toBe('Moderado');
    expect(classificarResistividade(9.9)).toBe('Alto');
  });
});

describe('calcularMedicao', () => {
  it('calcula média, desvio padrão amostral e classificação aceitando vírgula decimal', () => {
    const res = calcularMedicao('P7 - 6º ANDAR', 'Superior', ['20,0', '30,0', '40,0', '', ''], 1);
    expect(res.item).toBe(1);
    expect(res.media).toBeCloseTo(30, 5);
    expect(res.desvioPadrao).toBeCloseTo(10, 5);
    expect(res.classificacao).toBe('Moderado');
  });

  it('retorna nulos quando não há leituras válidas', () => {
    const res = calcularMedicao('P1', 'Inferior', ['', 'abc', '0', '-5'], 2);
    expect(res.media).toBeNull();
    expect(res.desvioPadrao).toBeNull();
    expect(res.classificacao).toBe('—');
  });

  it('retorna desvio padrão zero quando há apenas uma leitura válida', () => {
    const res = calcularMedicao('V2', 'Inferior', ['110,5'], 3);
    expect(res.media).toBeCloseTo(110.5, 5);
    expect(res.desvioPadrao).toBe(0);
    expect(res.classificacao).toBe('Desprezível');
  });
});
