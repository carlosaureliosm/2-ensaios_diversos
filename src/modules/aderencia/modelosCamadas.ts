// src/modules/aderencia/modelosCamadas.ts
// Modelos pré-configurados de sistema de camadas — cada um define o esquema (croqui)
// e as colunas de "Forma de Ruptura (%)" correspondentes.
// Baseado nas situações reais observadas na planilha RAAC - Resistência de Aderência à Tração.

import type { ModeloSistemaCamadas } from './types'

export const MODELOS_SISTEMA_CAMADAS: ModeloSistemaCamadas[] = [
  // ── PISO (elemento horizontal, disco puxado para cima) ──────────────────────
  {
    id: 'piso-contrapiso',
    nome: 'Piso sobre contrapiso (sem revestimento cerâmico)',
    disposicao: 'piso',
    camadas: ['Concreto', 'Contrapiso'],
    colunasFormaRuptura: ['Concreto', 'Conc/Cont', 'Contrapiso', 'Vazios'],
  },
  {
    id: 'piso-ceramico-contrapiso',
    nome: 'Piso com porcelanato/cerâmica sobre contrapiso',
    disposicao: 'piso',
    camadas: ['Concreto', 'Contrapiso', 'Argamassa Colante', 'Cerâmica'],
    colunasFormaRuptura: [
      'Concreto',
      'Conc/Cont',
      'Contrapiso',
      'Cont/Arg Col',
      'Arg Colante',
      'Arg Col/Cer',
      'Vazios',
    ],
  },
  {
    id: 'piso-ceramico-direto',
    nome: 'Piso cerâmico assentado direto sobre o concreto (sem contrapiso)',
    disposicao: 'piso',
    camadas: ['Concreto', 'Argamassa Colante', 'Cerâmica'],
    colunasFormaRuptura: ['Concreto', 'Conc/Arg Col', 'Arg Colante', 'Arg Col/Cer', 'Vazios'],
  },

  // ── PAREDE (elemento vertical, disco puxado para o lado) ────────────────────
  {
    id: 'parede-reboco',
    nome: 'Parede com chapisco e emboço (pintura ou base para reboco)',
    disposicao: 'parede',
    camadas: ['Substrato', 'Chapisco', 'Emboço'],
    colunasFormaRuptura: ['Sub', 'Sub/Chap', 'Chap', 'Chap/Emb', 'Emb', 'Vazios'],
  },
  {
    id: 'parede-ceramica',
    nome: 'Parede externa com cerâmica (chapisco + emboço + argamassa colante)',
    disposicao: 'parede',
    camadas: ['Substrato', 'Chapisco', 'Emboço', 'Argamassa Colante', 'Cerâmica'],
    colunasFormaRuptura: [
      'Sub',
      'Sub/Chap',
      'Chap',
      'Chap/Emb',
      'Sub/Emb',
      'Emb',
      'Emb/Arg Col',
      'Arg Col',
      'Arg Col/Cer',
      'Vazios',
    ],
  },
  {
    id: 'parede-gesso',
    nome: 'Parede com gesso liso',
    disposicao: 'parede',
    camadas: ['Substrato', 'Gesso'],
    colunasFormaRuptura: ['Sub', 'Sub/Gesso', 'Gesso', 'Vazios'],
  },
]

export function obterModeloCamadas(id: string): ModeloSistemaCamadas | undefined {
  return MODELOS_SISTEMA_CAMADAS.find(m => m.id === id)
}
