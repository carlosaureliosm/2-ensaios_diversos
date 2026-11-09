// src/modules/aderencia/types.ts

export interface AderenciaNormas {
  nbr13528_1: boolean
  nbr13528_1_parte2: boolean // Parte 2 – Aderência ao substrato
  nbr13528_1_parte3: boolean // Parte 3 – Aderência superficial
  nbr13749: boolean
  nbr13753: boolean
  nbr13754: boolean
  nbr13755: boolean
}

export interface AderenciaCabecalho {
  rltNumero: string
  cliente: string
  obra: string
  construtora: string
  endereco: string
  dataEmissao: string
  normas: AderenciaNormas
}

export interface FotoAnexo {
  /** Pré-visualização/payload. Pode ser '' quando a foto já está no Storage (usar `path`). */
  base64: string
  /** Caminho no bucket Supabase `aderencia-fotos` (`<userId>/<uuid>.jpg`), quando já enviada. */
  path?: string
  contentType: string
  width: number
  height: number
}

export interface CorpoDeProva {
  numero: number
  bloco: string
  junta: string
  tensaoRa: number | null // MPa
  profRuptura: number | null // mm
  /** chave = uma das colunas de ModeloSistemaCamadas.colunasFormaRuptura, valor em % */
  formaRuptura: Record<string, number>
  localizacao: string
  /** memorial fotográfico: 2 fotos por corpo de prova, conforme layout do relatório */
  fotos: [FotoAnexo | null, FotoAnexo | null]
}

export interface SituacaoAderencia {
  numero: number // 1, 2, 3... (exibido em algarismo romano no relatório: I, II, III...)
  tipoRevestimento: string
  dataEnsaio: string
  numCPs: number
  dataAplicacao: string
  substrato: string
  idadeRupturaDias: string
  chapisco: string
  chapiscoTraco: string
  emboco: string
  embocoTraco: string
  argamassaColante: string
  revestimento: string
  dimensoesCm: string
  /** referencia a ModeloSistemaCamadas.id — define esquema SVG e colunas de forma de ruptura */
  modeloCamadasId: string
  /** quando modeloCamadasId === 'personalizado', armazena a definição completa criada pelo usuário */
  modeloPersonalizado?: ModeloSistemaCamadas
  observacoesEsquema: string
  corposDeProva: CorpoDeProva[]
  umidadeMedia: number | null // %
  espessuraMediaRevestimento: number | null // mm
}

export interface ModeloSistemaCamadas {
  id: string
  nome: string
  /**
   * 'piso': elemento horizontal (camadas empilhadas na vertical, disco de tração puxado para cima).
   * 'parede': elemento vertical (camadas lado a lado na horizontal, disco de tração puxado para o lado).
   */
  disposicao: 'piso' | 'parede'
  /** camadas do substrato até o acabamento, na ordem em que aparecem no esquema (croqui) */
  camadas: string[]
  /** cores hexadecimais (#RRGGBB) opcionais para cada camada (mesmo índice de `camadas`) */
  coresCamadas?: string[]
  /**
   * Colunas da tabela "Forma de Ruptura (%)", na ordem em que devem aparecer no relatório.
   * Lista explícita (não derivada automaticamente nos pré-definidos) porque inclui interfaces que pulam camadas
   * (ex.: "Sub/Emb" quando a ruptura salta o chapisco). Sempre termina em "Vazios".
   */
  colunasFormaRuptura: string[]
}

export interface AderenciaRelatorio {
  cabecalho: AderenciaCabecalho
  situacoes: SituacaoAderencia[]
}
