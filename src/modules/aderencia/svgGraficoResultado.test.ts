// src/modules/aderencia/svgGraficoResultado.test.ts

import { describe, it, expect } from 'vitest';
import {
  calcularEscalaEixoX,
  extrairItensGrafico,
  obterLinhasReferenciaGrafico,
  svgGraficoResultado,
  tituloPadraoGrafico,
} from './svgGraficoResultado';
import { criarCorpoDeProva } from './calculos';
import type { AderenciaNormas } from './types';

const NORMAS_VAZIAS: AderenciaNormas = {
  nbr13528_1: false,
  nbr13528_1_parte2: false,
  nbr13528_1_parte3: false,
  nbr13749: false,
  nbr13753: false,
  nbr13754: false,
  nbr13755: false,
};

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
      modeloCamadasId: 'parede-reboco',
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
    // Linha de limite padrão 0,30 MPa em vermelho
    expect(svg).toContain('stroke="#C00000"');
    expect(svg).toContain('Limite 0,30 MPa');
  });

  it('varia a linha de limite vermelha conforme a norma/critério da situação', () => {
    const cp = criarCorpoDeProva(1, ['Vazios']);
    cp.localizacao = 'A1';
    cp.tensaoRa = 0.25;

    // NBR 13749 (parede interna com reboco) → limite 0,20 MPa
    const refs13749 = obterLinhasReferenciaGrafico(
      { modeloCamadasId: 'parede-reboco', tipoRevestimento: 'Parede interna' },
      { normas: { ...NORMAS_VAZIAS, nbr13749: true } },
    );
    expect(refs13749).toEqual([{ valor: 0.2, label: 'Limite 0,20 MPa', tracejado: false }]);

    const svg020 = svgGraficoResultado(
      { numero: 1, tipoRevestimento: 'Parede interna', modeloCamadasId: 'parede-reboco', corposDeProva: [cp] },
      { normas: { ...NORMAS_VAZIAS, nbr13749: true } },
    );
    expect(svg020).toContain('Limite 0,20 MPa');
    expect((svg020.match(/stroke="#C00000"/g) ?? []).length).toBe(1);

    // NBR 13755 (fachada/cerâmica externa) → 2 linhas vermelhas: 0,30 MPa e 0,50 MPa
    const svg13755 = svgGraficoResultado(
      { numero: 1, tipoRevestimento: 'Fachada externa', modeloCamadasId: 'parede-ceramica', corposDeProva: [cp] },
      { normas: { ...NORMAS_VAZIAS, nbr13755: true } },
    );
    expect(svg13755).toContain('Mín. 0,30 MPa');
    expect(svg13755).toContain('Aprov. 0,50 MPa');
    expect((svg13755.match(/stroke="#C00000"/g) ?? []).length).toBe(2);
    expect(svg13755).toContain('stroke-dasharray="5,3"');

    // Critério explícito na situação sobrepõe a sugestão das normas
    const svgExplicito = svgGraficoResultado(
      { numero: 1, tipoRevestimento: 'Fachada externa', modeloCamadasId: 'parede-ceramica', criterioRa: '0.20', corposDeProva: [cp] },
      { normas: { ...NORMAS_VAZIAS, nbr13755: true } },
    );
    expect(svgExplicito).toContain('Limite 0,20 MPa');
    expect(svgExplicito).not.toContain('Aprov. 0,50 MPa');
  });
});
