import { describe, expect, it } from 'vitest';
import {
  sanitizarAmostrasObra,
  validarFotoPath,
  validarGrupoId,
} from './pacometriaObraStorage';
import type { AmostraObraSalva } from '@/modules/pacometria/types';

describe('pacometriaObraStorage', () => {
  const grupoValido = '123e4567-e89b-12d3-a456-426614174000';
  const outroGrupo = '987e6543-e21b-43d2-a654-123456789000';

  it('valida IDs de grupo seguros e rejeita path traversal', () => {
    expect(validarGrupoId(grupoValido)).toBe(true);
    expect(validarGrupoId('obra_2026_01')).toBe(true);
    expect(validarGrupoId('../etc/passwd')).toBe(false);
    expect(validarGrupoId('curto')).toBe(false);
    expect(validarGrupoId('id/com/barra')).toBe(false);
  });

  it('valida caminhos de foto pertencentes ao grupo correto', () => {
    const pathOk = `fotos/${grupoValido}/abcd1234-5678.jpg`;
    const pathPng = `fotos/${grupoValido}/abcd1234-5678.png`;
    const pathOutro = `fotos/${outroGrupo}/abcd1234-5678.jpg`;

    expect(validarFotoPath(pathOk)).toBe(true);
    expect(validarFotoPath(pathOk, grupoValido)).toBe(true);
    expect(validarFotoPath(pathPng, grupoValido)).toBe(true);
    expect(validarFotoPath(pathOutro, grupoValido)).toBe(false);
    expect(validarFotoPath(`fotos/${grupoValido}/../outro.jpg`, grupoValido)).toBe(false);
    expect(validarFotoPath(`fotos/${grupoValido}/arquivo.webp`, grupoValido)).toBe(false);
  });

  it('sanitiza amostras removendo campos transitórios e fotos de outro grupo', () => {
    const base: AmostraObraSalva = {
      id: 'a1',
      item: 99,
      elemento: 'P1',
      tipo: 'pilar',
      opcao: 'A',
      X: 30,
      Y: 50,
      C1: 20,
      C2: 20,
      D: 0,
      barras: { '1X': 3 },
      facesData: {},
      cobMedio: 25,
      cobMinimo: 22,
      cobMaximo: 28,
      cobDesvio: 2,
      cobCV: 8,
      cobModa: 25,
      fotoPath: `fotos/${grupoValido}/abcd1234-5678.jpg`,
      fotoUrl: 'https://signed.example/temp',
    };

    const segunda: AmostraObraSalva = {
      ...base,
      id: 'a2',
      elemento: 'P2',
      fotoPath: `fotos/${outroGrupo}/invasao-1234.jpg`,
    };

    const resultado = sanitizarAmostrasObra([base, segunda], grupoValido);
    expect(resultado).toHaveLength(2);
    expect(resultado[0].item).toBe(1);
    expect(resultado[0].fotoPath).toBe(`fotos/${grupoValido}/abcd1234-5678.jpg`);
    expect('fotoUrl' in resultado[0]).toBe(false);

    expect(resultado[1].item).toBe(2);
    expect(resultado[1].fotoPath).toBeNull();
  });
});
