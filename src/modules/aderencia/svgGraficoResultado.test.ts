// src/modules/aderencia/svgGraficoResultado.test.ts

import { describe, it, expect } from 'vitest';
import {
  calcularEscalaEixoX,
  extrairItensGrafico,
  svgGraficoResultado,
  tituloPadraoGrafico,
} from './svgGraficoResultado';
import { criarCorpoDeProva } from './calculos';

describe('svgGraficoResultado', () => {
  it('mantém escala 0,00 a 0,50 (passo 0,10) para valores até 0,50 MPa', () => {
    const e0 = calcularEscalaEixoX(0);
    expect(e0.max).toBe(0.5);
    expect(e0.step).toBe(0.1);
    expect(e0.ticks).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5]);

    const e1 = calcularEscalaEixoX(0.15);
    expect(e1.max).toBe(0.5);
    expect(e1.ticks).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5]);
  });

  it('ajusta teto e passo automaticamente para tensões acima de 0,50 MPa', () => {
    const e072 = calcularEscalaEixoX(0.72);
    expect(e072.max).toBe(0.8);
    expect(e072.step).toBe(0.1);

    const e11 = calcularEscalaEixoX(1.1);
    expect(e11.max).toBe(1.2);
    expect(e11.step).toBe(0.2);

    const e23 = calcularEscalaEixoX(2.3);
    expect(e23.max).toBe(2.5);
    expect(e23.step).toBe(0.5);
  });

  it('usa localização como rótulo e cai para CP 00X quando vazia', () => {
    const cp1 = criarCorpoDeProva(1, ['Vazios']);
    cp1.localizacao = 'D1 - P6 - A1';
    cp1.tensaoRa = 0.03;

    const cp2 = criarCorpoDeProva(2, ['Vazios']);
    cp2.localizacao = '';
    cp2.tensaoRa = null;

    const itens = extrairItensGrafico({ corposDeProva: [cp1, cp2] });
    expect(itens).toEqual([
      { label: 'D1 - P6 - A1', valor: 0.03 },
      { label: 'CP 002', valor: 0 },
    ]);
  });

  it('gera título padrão com algarismo romano e tipo de revestimento', () => {
    expect(tituloPadraoGrafico({ numero: 1, tipoRevestimento: 'Emboço' })).toBe('Situação I - Emboço');
    expect(tituloPadraoGrafico({ numero: 2, tipoRevestimento: '' })).toBe('Situação II');
  });

  it('gera SVG válido com rótulos, título personalizado, barras e escape XML', () => {
    const cp1 = criarCorpoDeProva(1, ['Vazios']);
    cp1.localizacao = 'D1 - P6 & <A1>';
    cp1.tensaoRa = 0.15;

    const cp2 = criarCorpoDeProva(2, ['Vazios']);
    cp2.localizacao = 'D1 - P5 - A2';
    cp2.tensaoRa = 0;

    const svg = svgGraficoResultado({
      numero: 1,
      tipoRevestimento: 'Emboço',
      tituloGrafico: 'Amostras do Emboço - Descida 1',
      corposDeProva: [cp1, cp2],
    });

    expect(svg).toContain('<svg ');
    expect(svg).toContain('Amostras do Emboço - Descida 1');
    expect(svg).toContain('IDENTIFICAÇÃO DAS AMOSTRAS');
    expect(svg).toContain('TENSÃO [MPa]');
    expect(svg).toContain('D1 - P6 &amp; &lt;A1&gt;');
    expect(svg).toContain('D1 - P5 - A2');
    expect(svg).toContain('0,00');
    expect(svg).toContain('0,50');
    // Apenas cp1 tem valor > 0 → 1 barra azul
    expect((svg.match(/fill="#5B9BD5"/g) ?? []).length).toBe(1);
  });
});
