// src/modules/pacometria/calculos.test.ts
import { describe, it, expect } from 'vitest';
import {
  calcularCobrimentos,
  calcularCobrimentosLaje,
  calcularEspacamentos,
  gerarMalhaRegular,
  getFacesDaOpcao,
  getResumoOpcao,
} from './types';

describe('Pacometria — opções e faces', () => {
  it('retorna faces corretas para pilar e viga', () => {
    expect(getFacesDaOpcao('pilar', 'A')).toEqual(['1X', '2X', '1Y', '2Y']);
    expect(getFacesDaOpcao('pilar', 'E')).toEqual(['circ']);
    expect(getFacesDaOpcao('viga', 'VA')).toEqual(['fundo', 'lat1', 'lat2']);
    expect(getFacesDaOpcao('viga', 'VB')).toEqual(['fundo', 'lat1']);
    expect(getFacesDaOpcao('viga', 'VE')).toEqual(['fundo', 'topo', 'lat1', 'lat2']);
    expect(getFacesDaOpcao('laje', 'LA')).toEqual([]);
  });

  it('gera resumo legível para cada tipo', () => {
    expect(getResumoOpcao({ tipo: 'pilar', opcao: 'C' })).toBe('Opção C');
    expect(getResumoOpcao({ tipo: 'viga', opcao: 'VA' })).toBe('3 faces vistas');
    expect(
      getResumoOpcao({
        tipo: 'laje',
        opcao: 'LA',
        lajeData: { larguraX: 120, alturaY: 100, passoGrid: 10, barrasH: [], barrasV: [] },
      }),
    ).toBe('Malha 120×100 cm');
  });
});

describe('Pacometria — malha quadrada (laje)', () => {
  it('gera malha regular bidirecional e unidirecional', () => {
    const bi = gerarMalhaRegular(100, 100, 25, true, true, 5);
    expect(bi.barrasH.map(b => b.pos)).toEqual([25, 50, 75]);
    expect(bi.barrasV.map(b => b.pos)).toEqual([25, 50, 75]);

    const soH = gerarMalhaRegular(100, 80, 20, true, false, 10);
    expect(soH.barrasH.map(b => b.pos)).toEqual([20, 40, 60]);
    expect(soH.barrasV).toEqual([]);
  });

  it('calcula espaçamentos ordenando barras pela posição', () => {
    const esp = calcularEspacamentos([
      { id: '3', pos: 60, cob: '' },
      { id: '1', pos: 15, cob: '' },
      { id: '2', pos: 35, cob: '' },
    ]);
    expect(esp).toEqual([20, 25]);
  });

  it('calcula estatísticas de cobrimento na laje considerando apenas a camada mais externa', () => {
    const statsH = calcularCobrimentosLaje({
      larguraX: 100,
      alturaY: 100,
      passoGrid: 10,
      camadaExterna: 'H',
      barrasH: [
        { id: 'h1', pos: 20, cob: '20' },
        { id: 'h2', pos: 40, cob: '20,0' },
        { id: 'h3', pos: 60, cob: '26' },
      ],
      barrasV: [
        { id: 'v1', pos: 30, cob: '99' }, // camada interna: deve ser ignorada
      ],
      cobPerpHSup: '15',
    });
    expect(statsH.cobMinimo).toBe(20);
    expect(statsH.cobMaximo).toBe(26);
    expect(statsH.cobMedio).toBeCloseTo(22, 2);
    expect(statsH.cobModa).toBe(20);

    const statsV = calcularCobrimentosLaje({
      larguraX: 100,
      alturaY: 100,
      passoGrid: 10,
      camadaExterna: 'V',
      barrasH: [{ id: 'h1', pos: 20, cob: '99' }], // interna: ignorada
      barrasV: [
        { id: 'v1', pos: 30, cob: '24' },
        { id: 'v2', pos: 60, cob: '28' },
      ],
    });
    expect(statsV.cobMinimo).toBe(24);
    expect(statsV.cobMaximo).toBe(28);
    expect(statsV.cobMedio).toBe(26);
  });

  it('calcula estatísticas de cobrimento em pilar/viga considerando exclusivamente os estribos', () => {
    const stats = calcularCobrimentos({
      fundo: {
        nEstribos: 2,
        cob: ['25', '27'],
        espV: ['15'],
        espH: ['10', '10'],
        cobPerpIni: '12',
        cobPerpFim: '13',
      },
      lat1: { nEstribos: 2, cob: ['25', '29'], espV: ['15'], espH: ['12'] },
    });
    expect(stats.cobMinimo).toBe(25);
    expect(stats.cobMaximo).toBe(29);
    expect(stats.cobModa).toBe(25);
    expect(stats.cobMedio).toBe(26.5);
  });
});
