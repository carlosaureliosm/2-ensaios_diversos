// src/modules/aderencia/modelosCamadas.ts
// Modelos pré-configurados de sistema de camadas — cada um define o esquema (croqui)
// e as colunas de "Forma de Ruptura (%)" correspondentes.
// Baseado nas situações reais observadas na planilha RAAC - Resistência de Aderência à Tração.

import type { ModeloSistemaCamadas } from './types'
import { corCamada } from './svgEsquema'

export const ID_MODELO_PERSONALIZADO = 'personalizado'
export const MAX_COLUNAS_FORMA_RUPTURA = 10

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

function abrevInterface(nome: string): string {
  const limpo = nome.trim()
  if (!limpo) return 'Cam'
  const n = limpo.toLowerCase()
  if (n === 'substrato') return 'Sub'
  if (n === 'concreto') return 'Conc'
  if (n === 'contrapiso') return 'Cont'
  if (n === 'chapisco') return 'Chap'
  if (n === 'emboço' || n === 'emboco') return 'Emb'
  if (n === 'reboco') return 'Reb'
  if (n.includes('argamassa') && n.includes('colante')) return 'Arg Col'
  if (n === 'argamassa') return 'Arg'
  if (n === 'cerâmica' || n === 'ceramica') return 'Cer'
  if (n === 'porcelanato') return 'Porc'
  if (n === 'gesso' || n === 'gesso liso') return 'Gesso'
  if (n === 'alvenaria') return 'Alv'
  if (n === 'regularização' || n === 'regularizacao') return 'Reg'
  if (n === 'impermeabilização' || n === 'impermeabilizacao') return 'Imp'
  if (n === 'pintura') return 'Pint'
  if (n === 'textura') return 'Text'

  const palavras = limpo.split(/\s+/).filter(Boolean)
  if (palavras.length === 1) {
    return limpo.length <= 6 ? limpo : limpo.slice(0, 4)
  }
  return `${palavras[0].slice(0, 3)} ${palavras[1].slice(0, 3)}`
}

function abrevColunaCamada(nome: string): string {
  const limpo = nome.trim()
  if (!limpo) return 'Camada'
  const n = limpo.toLowerCase()
  if (n === 'substrato') return 'Sub'
  if (n === 'chapisco') return 'Chap'
  if (n === 'emboço' || n === 'emboco') return 'Emb'
  if (n.includes('argamassa') && n.includes('colante')) return 'Arg Colante'
  return limpo.length <= 12 ? limpo : abrevInterface(limpo)
}

/**
 * Gera automaticamente as colunas da tabela "Forma de Ruptura (%)" a partir das camadas escolhidas
 * (camada + interface entre camadas adjacentes + "Vazios"), respeitando o limite de 10 subcolunas.
 */
export function gerarColunasFormaRuptura(camadas: string[]): string[] {
  const nomes = (camadas.length > 0 ? camadas : ['Substrato']).map((c, i) => c.trim() || `Camada ${i + 1}`)
  const cols: string[] = []

  nomes.forEach((nome, i) => {
    const ehUltima = i === nomes.length - 1
    const ehRevestimentoCeramico = /cer[aâ]mic|porcelanato/i.test(nome)
    // Na convenção da planilha RAAC, quando a última camada (acabamento) é cerâmica/porcelanato e há camadas anteriores,
    // a tabela encerra na interface anterior/cerâmica + Vazios. Para qualquer outra camada, inclui também a própria camada.
    if (!(ehUltima && nomes.length > 1 && ehRevestimentoCeramico)) {
      cols.push(abrevColunaCamada(nome))
    }
    if (i < nomes.length - 1) {
      cols.push(`${abrevInterface(nome)}/${abrevInterface(nomes[i + 1])}`)
    }
  })

  // Garante unicidade caso haja nomes repetidos e limita a 9 + 'Vazios' = 10 colunas
  const unicas: string[] = []
  for (const c of cols) {
    if (unicas.length >= MAX_COLUNAS_FORMA_RUPTURA - 1) break
    let candidato = c
    let sufixo = 2
    while (unicas.includes(candidato)) {
      candidato = `${c} (${sufixo++})`
    }
    unicas.push(candidato)
  }
  unicas.push('Vazios')
  return unicas
}

/** Cria um modelo personalizado inicial com camadas, cores e colunas de ruptura prontas para edição. */
export function criarModeloPersonalizadoPadrao(disposicao: 'piso' | 'parede' = 'parede'): ModeloSistemaCamadas {
  const camadas = disposicao === 'piso'
    ? ['Concreto', 'Contrapiso', 'Argamassa Colante', 'Cerâmica']
    : ['Substrato', 'Chapisco', 'Emboço']
  return {
    id: ID_MODELO_PERSONALIZADO,
    nome: 'Personalizado',
    disposicao,
    camadas,
    coresCamadas: camadas.map(c => corCamada(c)),
    colunasFormaRuptura: gerarColunasFormaRuptura(camadas),
  }
}

/** Resolve o modelo de camadas efetivo de uma Situação (personalizado da situação ou pré-configurado pelo id). */
export function resolverModeloSituacao(sit: {
  modeloCamadasId: string
  modeloPersonalizado?: ModeloSistemaCamadas
}): ModeloSistemaCamadas | undefined {
  if (sit.modeloPersonalizado && (sit.modeloCamadasId === ID_MODELO_PERSONALIZADO || !obterModeloCamadas(sit.modeloCamadasId))) {
    return sit.modeloPersonalizado
  }
  return obterModeloCamadas(sit.modeloCamadasId) ?? sit.modeloPersonalizado
}
