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
  /** Carga de ruptura lida no equipamento, em kgf (entrada do usuário). */
  cargaKgf?: number | null
  /** Tensão de aderência Ra em MPa — calculada a partir de `cargaKgf` e do formato da placa (ver calculos.ts). */
  tensaoRa: number | null // MPa
  profRuptura: number | null // mm
  /** chave = uma das colunas de ModeloSistemaCamadas.colunasFormaRuptura, valor em % */
  formaRuptura: Record<string, number>
  localizacao: string
  /** memorial fotográfico: 2 fotos por corpo de prova, conforme layout do relatório */
  fotos: [FotoAnexo | null, FotoAnexo | null]
}

/** circular = Ø 5 cm; quadrada = 10 x 10 cm */
export type FormatoPlaca = 'circular' | 'quadrada'

export type CriterioRa = '0.20' | '0.30' | 'nbr13755'

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
  /** Critério normativo para avaliação de Ra nesta situação (Tabela 01: 0,20/0,30 ou Tabela 02: NBR 13755). */
  criterioRa?: CriterioRa
  /** Formato da placa de tração (padrão: circular). Define a área usada no cálculo de Ra. */
  formatoPlaca?: FormatoPlaca
  observacoesEsquema: string
  /** Título opcional exibido no topo do gráfico de resultado desta situação (padrão automático se vazio). */
  tituloGrafico?: string
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
   * Quantidade de camadas atravessadas pelo corte ao redor da placa (0 = superficial sem corte,
   * 1 = apenas acabamento, 2 = até o fundo da argamassa colante). Quando omitido, usa a regra automática.
   */
  profundidadeCorte?: number
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
