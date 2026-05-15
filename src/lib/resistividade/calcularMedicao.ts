// src/lib/resistividade/calcularMedicao.ts

export type PosicaoResistividade = 'Superior' | 'Inferior' | string;

export type MedicaoRow = {
  id: string;
  item: number;
  elemento: string;
  posicao: PosicaoResistividade;
  leituras: string[]; // 5 leituras em kΩ·cm (string, aceita vírgula)
  media: number | null;
  desvioPadrao: number | null;
  classificacao: string;
  // Foto vinculada a este ponto (não armazenada, apenas em memória/base64)
  fotoFile?: File | null;
  fotoPreview?: string | null;
  fotoWidth?: number;
  fotoHeight?: number;
};

/**
 * Classifica a resistividade elétrica do concreto conforme COST 509 / RILEM TC 154-EMC.
 * @param media - Média das leituras em kΩ·cm
 * @returns string com a classificação do risco de corrosão
 */
export function classificarResistividade(media: number): string {
  if (media > 100) return 'Desprezível';
  if (media >= 50)  return 'Baixo';
  if (media >= 10)  return 'Moderado';
  return 'Alto';
}

/**
 * Calcula desvio padrão amostral (n-1) de um array de números.
 */
function desvioPadraoAmostral(valores: number[]): number {
  if (valores.length < 2) return 0;
  const media = valores.reduce((a, b) => a + b, 0) / valores.length;
  const soma = valores.reduce((acc, v) => acc + (v - media) ** 2, 0);
  return Math.sqrt(soma / (valores.length - 1));
}

/**
 * Processa uma medição de resistividade elétrica (método Wenner / Resipod):
 * aceita de 1 a 5 leituras em kΩ·cm, calcula média e desvio padrão amostral
 * e classifica o risco de corrosão conforme COST 509 / RILEM TC 154-EMC.
 *
 * @param elemento  - Identificador do elemento estrutural (ex: "P7 – 6º ANDAR").
 * @param posicao   - Posição da medição no elemento (ex: "Superior", "Inferior").
 * @param leituras  - Array de até 5 leituras como strings (aceita vírgula decimal).
 * @param item      - Número sequencial na tabela de resultados.
 * @returns MedicaoRow com média, desvio padrão, classificação e dados brutos.
 */
export function calcularMedicao(
  elemento: string,
  posicao: PosicaoResistividade,
  leituras: string[],
  item: number,
): MedicaoRow {
  const id = typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Math.random());

  const validos = leituras
    .map(v => parseFloat(v.replace(',', '.')))
    .filter(v => !isNaN(v) && v > 0);

  if (validos.length === 0) {
    return {
      id, item, elemento, posicao, leituras,
      media: null, desvioPadrao: null, classificacao: '—',
    };
  }

  const media = validos.reduce((a, b) => a + b, 0) / validos.length;
  const desvioPadrao = desvioPadraoAmostral(validos);
  const classificacao = classificarResistividade(media);

  return { id, item, elemento, posicao, leituras, media, desvioPadrao, classificacao };
}