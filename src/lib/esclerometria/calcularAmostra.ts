export type Posicao = '0°' | '+90°' | '-90°';

export type AmostraRow = {
  id: string; item: number; amostra: string; posicao: Posicao;
  limInf: number | null; limSup: number | null; ieMedio: number | null;
  status: 'Amostra Válida' | 'Amostra Perdida';
  ieEfetivo: number | null; resistencia: number | null; dispersao: string; impactosRaw: string[];
  fotoFile?: File | null;
  fotoPreview?: string | null;
  fotoWidth?: number;
  fotoHeight?: number;
};

export function calcularAmostra(amostra: string, posicao: Posicao, impactosStr: string[], coefBigorna: number, item: number): AmostraRow {
  const id = typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Math.random());
  const validos = impactosStr.map(v => parseFloat(v.replace(',', '.'))).filter(v => !isNaN(v) && v > 0);
  if (validos.length === 0) return { id, item, amostra, posicao, limInf: null, limSup: null, ieMedio: null, status: 'Amostra Perdida', ieEfetivo: null, resistencia: null, dispersao: '-', impactosRaw: impactosStr };
  const mediaBruta = validos.reduce((a, b) => a + b, 0) / validos.length;
  const limInf = mediaBruta * 0.90, limSup = mediaBruta * 1.10;
  const filtrados = validos.filter(v => v >= limInf && v <= limSup);
  if (filtrados.length < 5) return { id, item, amostra, posicao, limInf, limSup, ieMedio: null, status: 'Amostra Perdida', ieEfetivo: null, resistencia: null, dispersao: '-', impactosRaw: impactosStr };
  const ieMedio = filtrados.reduce((a, b) => a + b, 0) / filtrados.length;
  const ieEfetivo = ieMedio * coefBigorna;
  let resistencia: number, dispersao: string;
  if (posicao === '0°') {
    resistencia = (0.0089 * ieEfetivo ** 2) + (1.111 * ieEfetivo) - 15.78;
    dispersao = ieEfetivo <= 26 ? '±4,5' : ieEfetivo <= 32 ? '±6,0' : ieEfetivo <= 38 ? '±6,5' : ieEfetivo <= 44 ? '±7,0' : '±7,5';
  } else if (posicao === '+90°') {
    resistencia = (0.0099 * ieEfetivo ** 2) + (1.063 * ieEfetivo) - 24.31;
    dispersao = ieEfetivo <= 29 ? '±4,5' : ieEfetivo <= 38 ? '±6,0' : ieEfetivo <= 43 ? '±6,5' : ieEfetivo <= 48 ? '±7,0' : '±7,5';
  } else {
    resistencia = (0.0133 * ieEfetivo ** 2) + (0.800 * ieEfetivo) - 5.33;
    dispersao = ieEfetivo <= 23 ? '±4,5' : ieEfetivo <= 29 ? '±6,0' : ieEfetivo <= 35 ? '±6,5' : ieEfetivo <= 41 ? '±7,0' : '±7,5';
  }
  return { id, item, amostra, posicao, limInf, limSup, ieMedio, status: 'Amostra Válida', ieEfetivo, resistencia, dispersao, impactosRaw: impactosStr };
}
