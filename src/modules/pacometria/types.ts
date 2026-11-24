// src/modules/pacometria/types.ts

export type TipoElemento = 'pilar' | 'viga' | 'laje';

export type OpcaoPilar = 'A' | 'B' | 'C' | 'D' | 'E';
export type OpcaoViga = 'VA' | 'VB' | 'VC' | 'VD' | 'VE';
export type OpcaoLaje = 'LA' | 'LB' | 'LC';
export type OpcaoAcessibilidade = OpcaoPilar | OpcaoViga | OpcaoLaje;

export type FaceData = {
  nEstribos: number;
  cob: string[];       // cobrimento por estribo na face exposta (mm) — único que define o cobrimento do elemento
  espV: string[];      // espaçamento entre estribos (cm) — length = max(0, nEstribos - 1)
  espH: string[];      // espaçamento entre barras longitudinais (cm) — length = max(0, nBarras - 1)
  cobPerpIni?: string; // cobrimento perpendicular da 1ª barra à borda inicial (Esq. no pilar / Sup. na viga) (mm)
  cobPerpFim?: string; // cobrimento perpendicular da última barra à borda final (Dir. no pilar / Inf. na viga) (mm)
};

export type BarraMalha = {
  id: string;
  pos: number;      // posição em cm a partir da borda (topo para H, esquerda para V)
  cob: string;      // cobrimento medido na face exposta (mm) — preenchido apenas na camada mais externa
};

export type LajeData = {
  larguraX: number;       // largura da área ensaiada (cm)
  alturaY: number;        // altura/comprimento da área ensaiada (cm)
  passoGrid: number;      // resolução da malha quadrada (cm)
  camadaExterna?: 'H' | 'V'; // qual direção está mais próxima da face exposta (define o cobrimento)
  barrasH: BarraMalha[];  // barras horizontais (correm em X, posicionadas ao longo de Y)
  barrasV: BarraMalha[];  // barras verticais (correm em Y, posicionadas ao longo de X)
  cobPerpHSup?: string;   // borda superior → H1 (mm)
  cobPerpHInf?: string;   // Hn → borda inferior (mm)
  cobPerpVEsq?: string;   // borda esquerda → V1 (mm)
  cobPerpVDir?: string;   // Vm → borda direita (mm)
};

export type EstatisticasCobrimento = {
  cobMedio: number | null;
  cobMinimo: number | null;
  cobMaximo: number | null;
  cobDesvio: number | null;
  cobCV: number | null;
  cobModa: number | null;
};

export type AmostraRow = {
  id: string;
  item: number;
  elemento: string;
  tipo: TipoElemento;
  opcao: OpcaoAcessibilidade;
  // Geometria (Pilar e Viga)
  X: number;
  Y: number;
  C1: number;
  C2: number;
  D: number;
  barras: Record<string, number>;
  facesData: Record<string, FaceData>;
  // Geometria e leituras (Laje / Área Livre)
  lajeData?: LajeData;
  // Calculados
  cobMedio: number | null;
  cobMinimo: number | null;
  cobMaximo: number | null;
  cobDesvio: number | null;
  cobCV: number | null;
  cobModa: number | null;
  // Foto
  fotoFile?: File | null;
  fotoPreview?: string | null;
  fotoPath?: string | null;
  fotoWidth?: number;
  fotoHeight?: number;
};

export type AmostraObraSalva = Omit<AmostraRow, 'fotoFile' | 'fotoPreview'> & {
  fotoPath?: string | null;
  fotoUrl?: string | null; // URL assinada (1h) hidratada pelo servidor na leitura
};

export type ObraGrupoPacometria = {
  id: string;
  nome: string;
  createdBy: string;
  createdByNome: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
  amostras: AmostraObraSalva[];
};

export type Cabecalho = {
  rlt: string;
  data: string;
  cliente: string;
  obra: string;
  att: string;
  endereco: string;
  notas: string;
};

export const FACE_COLORS: Record<string, string> = {
  // Pilar
  '1X': '#2563EB',
  '2X': '#DC2626',
  '1Y': '#16A34A',
  '2Y': '#9333EA',
  circ: '#2563EB',
  // Viga
  fundo: '#2563EB',
  topo: '#DC2626',
  lat1: '#16A34A',
  lat2: '#9333EA',
  // Laje
  dirH: '#2563EB',
  dirV: '#DC2626',
};

export const FACE_LABELS: Record<string, string> = {
  // Pilar
  '1X': 'Face Inferior',
  '2X': 'Face Superior',
  '1Y': 'Face Esquerda',
  '2Y': 'Face Direita',
  circ: 'Face Externa (Circular)',
  // Viga
  fundo: 'Face Inferior (Fundo)',
  topo: 'Face Superior (Topo)',
  lat1: 'Face Lateral Esquerda',
  lat2: 'Face Lateral Direita',
};

export const OPCOES_PILAR: Record<OpcaoPilar, { codigo: string; label: string; desc: string; faces: string[] }> = {
  A: { codigo: 'A', label: 'Todas as faces', desc: '4 faces livres', faces: ['1X', '2X', '1Y', '2Y'] },
  B: { codigo: 'B', label: '1 face vista', desc: 'Apenas face inferior', faces: ['1X'] },
  C: { codigo: 'C', label: '2 faces em L', desc: 'Face inferior + esquerda', faces: ['1X', '1Y'] },
  D: { codigo: 'D', label: '3 faces vistas', desc: 'Inferior + esquerda + direita', faces: ['1X', '1Y', '2Y'] },
  E: { codigo: 'E', label: 'Circular', desc: 'Diâmetro D', faces: ['circ'] },
};

export const OPCOES_VIGA: Record<OpcaoViga, { codigo: string; label: string; desc: string; faces: string[] }> = {
  VA: { codigo: 'A', label: '3 faces vistas', desc: 'Fundo + 2 laterais (sob laje)', faces: ['fundo', 'lat1', 'lat2'] },
  VB: { codigo: 'B', label: '2 faces em L', desc: 'Fundo + 1 lateral', faces: ['fundo', 'lat1'] },
  VC: { codigo: 'C', label: '1 face (lateral)', desc: 'Apenas lateral 1', faces: ['lat1'] },
  VD: { codigo: 'D', label: '1 face (fundo)', desc: 'Apenas fundo', faces: ['fundo'] },
  VE: { codigo: 'E', label: '4 faces livres', desc: 'Viga isolada', faces: ['fundo', 'topo', 'lat1', 'lat2'] },
};

export const OPCOES_LAJE: Record<OpcaoLaje, { codigo: string; label: string; desc: string; permiteH: boolean; permiteV: boolean }> = {
  LA: { codigo: 'A', label: 'Malha bidirecional (X + Y)', desc: 'Barras horizontais e verticais', permiteH: true, permiteV: true },
  LB: { codigo: 'B', label: 'Direção única (Horizontal)', desc: 'Apenas barras horizontais (H)', permiteH: true, permiteV: false },
  LC: { codigo: 'C', label: 'Direção única (Vertical)', desc: 'Apenas barras verticais (V)', permiteH: false, permiteV: true },
};

export const TIPO_LABELS: Record<TipoElemento, string> = {
  pilar: 'Pilar',
  viga: 'Viga',
  laje: 'Área / Laje',
};

export function getFacesDaOpcao(tipo: TipoElemento, opcao: OpcaoAcessibilidade | null): string[] {
  if (!opcao) return [];
  if (tipo === 'pilar' && opcao in OPCOES_PILAR) return OPCOES_PILAR[opcao as OpcaoPilar].faces;
  if (tipo === 'viga' && opcao in OPCOES_VIGA) return OPCOES_VIGA[opcao as OpcaoViga].faces;
  return [];
}

export function getResumoOpcao(a: Pick<AmostraRow, 'tipo' | 'opcao' | 'lajeData'>): string {
  if (a.tipo === 'pilar' && a.opcao in OPCOES_PILAR) {
    return `Opção ${OPCOES_PILAR[a.opcao as OpcaoPilar].codigo}`;
  }
  if (a.tipo === 'viga' && a.opcao in OPCOES_VIGA) {
    return OPCOES_VIGA[a.opcao as OpcaoViga].label;
  }
  if (a.tipo === 'laje') {
    const lx = a.lajeData?.larguraX ?? 100;
    const ly = a.lajeData?.alturaY ?? 100;
    return `Malha ${lx}×${ly} cm`;
  }
  return String(a.opcao);
}

export function newId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function initFaceData(): FaceData {
  return { nEstribos: 3, cob: ['', '', ''], espV: ['', ''], espH: [], cobPerpIni: '', cobPerpFim: '' };
}

export function ensureFaceArrays(fd: FaceData, nBarras: number): FaceData {
  const ne = Math.max(1, fd.nEstribos);
  const nb = Math.max(1, nBarras);
  const cob = Array(ne).fill('').map((_, i) => fd.cob[i] ?? '');
  const espV = Math.max(0, ne - 1) > 0 ? Array(ne - 1).fill('').map((_, i) => fd.espV[i] ?? '') : [];
  const espH = Math.max(0, nb - 1) > 0 ? Array(nb - 1).fill('').map((_, i) => fd.espH[i] ?? '') : [];
  return {
    ...fd,
    cob,
    espV,
    espH,
    cobPerpIni: fd.cobPerpIni ?? '',
    cobPerpFim: fd.cobPerpFim ?? '',
  };
}

export function gerarMalhaRegular(
  larguraX: number,
  alturaY: number,
  espacamentoCm: number,
  permiteH: boolean,
  permiteV: boolean,
  passoGrid = 10,
  camadaExterna?: 'H' | 'V',
): LajeData {
  const step = Math.max(5, espacamentoCm);
  const barrasH: BarraMalha[] = [];
  const barrasV: BarraMalha[] = [];

  if (permiteH) {
    for (let y = step; y < alturaY; y += step) {
      barrasH.push({ id: newId(), pos: Math.round(y * 10) / 10, cob: '' });
    }
    if (barrasH.length === 0 && alturaY > 0) {
      barrasH.push({ id: newId(), pos: Math.round((alturaY / 2) * 10) / 10, cob: '' });
    }
  }

  if (permiteV) {
    for (let x = step; x < larguraX; x += step) {
      barrasV.push({ id: newId(), pos: Math.round(x * 10) / 10, cob: '' });
    }
    if (barrasV.length === 0 && larguraX > 0) {
      barrasV.push({ id: newId(), pos: Math.round((larguraX / 2) * 10) / 10, cob: '' });
    }
  }

  const ext: 'H' | 'V' = camadaExterna ?? (permiteH ? 'H' : 'V');
  return { larguraX, alturaY, passoGrid, camadaExterna: ext, barrasH, barrasV };
}

export function initLajeData(opcao: OpcaoLaje = 'LA'): LajeData {
  const cfg = OPCOES_LAJE[opcao];
  return gerarMalhaRegular(100, 100, 20, cfg.permiteH, cfg.permiteV, 10, cfg.permiteH ? 'H' : 'V');
}

export function ordenarBarras(barras: BarraMalha[]): BarraMalha[] {
  return [...barras].sort((a, b) => a.pos - b.pos);
}

export function calcularEspacamentos(barras: BarraMalha[]): number[] {
  const ord = ordenarBarras(barras);
  const res: number[] = [];
  for (let i = 0; i < ord.length - 1; i++) {
    res.push(Math.round((ord[i + 1].pos - ord[i].pos) * 10) / 10);
  }
  return res;
}

export function calcularEstatisticasLista(valores: number[]): EstatisticasCobrimento {
  const nil: EstatisticasCobrimento = {
    cobMedio: null,
    cobMinimo: null,
    cobMaximo: null,
    cobDesvio: null,
    cobCV: null,
    cobModa: null,
  };
  if (valores.length === 0) return nil;
  const cobMedio = valores.reduce((a, b) => a + b, 0) / valores.length;
  const cobMinimo = Math.min(...valores);
  const cobMaximo = Math.max(...valores);
  const cobDesvio = valores.length < 2
    ? 0
    : Math.sqrt(valores.reduce((acc, v) => acc + (v - cobMedio) ** 2, 0) / (valores.length - 1));
  const cobCV = cobMedio > 0 ? (cobDesvio / cobMedio) * 100 : 0;

  const freq: Record<number, number> = {};
  valores.forEach(v => {
    const r = Math.round(v);
    freq[r] = (freq[r] || 0) + 1;
  });
  const maxFreq = Math.max(...Object.values(freq));
  const modas = Object.entries(freq)
    .filter(([, f]) => f === maxFreq)
    .map(([v]) => Number(v));
  const cobModa = maxFreq > 1 ? modas[0] : null;

  return { cobMedio, cobMinimo, cobMaximo, cobDesvio, cobCV, cobModa };
}

/**
 * Em pilares e vigas, o cobrimento da estrutura é definido exclusivamente
 * pela armadura transversal externa (estribos), pois as barras longitudinais
 * ficam atrás dos estribos (NBR 6118).
 */
export function calcularCobrimentos(facesData: Record<string, FaceData>): EstatisticasCobrimento {
  const todos: number[] = [];
  Object.values(facesData).forEach(fd => {
    fd.cob.forEach(v => {
      const n = parseFloat(v.replace(',', '.'));
      if (!isNaN(n) && n > 0) todos.push(n);
    });
  });
  return calcularEstatisticasLista(todos);
}

/**
 * Em lajes / áreas livres, o cobrimento é definido exclusivamente pela
 * camada de armadura mais externa (H ou V, conforme configurado na malha).
 */
export function calcularCobrimentosLaje(lajeData: LajeData): EstatisticasCobrimento {
  const externa: 'H' | 'V' = lajeData.camadaExterna
    ?? (lajeData.barrasH.length > 0 ? 'H' : 'V');
  const barrasExternas = externa === 'V' ? lajeData.barrasV : lajeData.barrasH;
  const todos: number[] = [];
  barrasExternas.forEach(b => {
    const n = parseFloat(b.cob.replace(',', '.'));
    if (!isNaN(n) && n > 0) todos.push(n);
  });
  return calcularEstatisticasLista(todos);
}
