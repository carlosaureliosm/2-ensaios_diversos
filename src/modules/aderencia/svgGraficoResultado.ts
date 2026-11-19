// src/modules/aderencia/svgGraficoResultado.ts
//
// Gera o gráfico de resultado por situação em SVG puro (barras horizontais de Tensão Ra [MPa]
// por identificação de amostra), usado tanto na pré-visualização da tela quanto na rasterização
// em PNG (via svgParaPng) para inserção no laudo DOCX após o anexo de fotos.

import type { SituacaoAderencia } from './types';
import { numeroRomano } from './utils';

export interface ItemGraficoResultado {
  label: string;
  valor: number;
}

export interface EscalaEixoX {
  max: number;
  step: number;
  ticks: number[];
}

function escXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatarTickBR(v: number): string {
  return v.toFixed(2).replace('.', ',');
}

/** Título padrão do gráfico quando o usuário não define um título personalizado. */
export function tituloPadraoGrafico(situacao: Pick<SituacaoAderencia, 'numero' | 'tipoRevestimento'>): string {
  const rom = numeroRomano(situacao.numero);
  const tipo = (situacao.tipoRevestimento ?? '').trim();
  return tipo ? `Situação ${rom} - ${tipo}` : `Situação ${rom}`;
}

/**
 * Calcula teto e passo limpos para o eixo X (MPa).
 * - Para valores até 0,50 MPa mantém a escala de referência 0,00 a 0,50 (passo 0,10).
 * - Para valores maiores escolhe um passo limpo (0,10 / 0,20 / 0,25 / 0,50 / 1,00 / ...)
 *   gerando entre 5 e 8 linhas de grade.
 */
export function calcularEscalaEixoX(maxValor: number): EscalaEixoX {
  const m = Number.isFinite(maxValor) && maxValor > 0 ? maxValor : 0;

  let step: number;
  let max: number;

  if (m <= 0.5) {
    step = 0.1;
    max = 0.5;
  } else if (m <= 0.8) {
    step = 0.1;
    max = Math.ceil(m / step) * step;
  } else if (m <= 1.2) {
    step = 0.2;
    max = Math.ceil(m / step) * step;
  } else if (m <= 1.5) {
    step = 0.25;
    max = Math.ceil(m / step) * step;
  } else if (m <= 3.0) {
    step = 0.5;
    max = Math.ceil(m / step) * step;
  } else {
    const bruto = m / 5;
    const pot = Math.pow(10, Math.floor(Math.log10(bruto)));
    const norm = bruto / pot;
    const fator = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    step = fator * pot;
    max = Math.ceil(m / step) * step;
  }

  // Evita imprecisão binária (ex: 0.30000000000000004)
  const round = (n: number) => Math.round(n * 1000) / 1000;
  max = round(max);
  step = round(step);

  const count = Math.round(max / step);
  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) {
    ticks.push(round(i * step));
  }

  return { max, step, ticks };
}

/** Extrai os pares (identificação da amostra, tensão Ra em MPa) na ordem dos CPs. */
export function extrairItensGrafico(situacao: Pick<SituacaoAderencia, 'corposDeProva'>): ItemGraficoResultado[] {
  return (situacao.corposDeProva ?? []).map(cp => {
    const loc = (cp.localizacao ?? '').trim();
    const label = loc || `CP ${String(cp.numero).padStart(3, '0')}`;
    const valor = cp.tensaoRa !== null && cp.tensaoRa !== undefined && Number.isFinite(cp.tensaoRa) && cp.tensaoRa > 0
      ? cp.tensaoRa
      : 0;
    return { label, valor };
  });
}

function truncarLabel(texto: string, maxChars: number): string {
  if (texto.length <= maxChars) return texto;
  return texto.slice(0, maxChars - 1).trimEnd() + '…';
}

/**
 * Gera a string SVG do gráfico de barras horizontais de uma situação.
 * Layout fiel à referência: moldura cinza clara, título centralizado, eixo Y vertical
 * "IDENTIFICAÇÃO DAS AMOSTRAS", eixo X "TENSÃO [MPa]" com grade vertical e barras azuis (#5B9BD5).
 */
export function svgGraficoResultado(
  situacao: Pick<SituacaoAderencia, 'numero' | 'tipoRevestimento' | 'tituloGrafico' | 'corposDeProva'>,
): string {
  const itens = extrairItensGrafico(situacao);
  const titulo = (situacao.tituloGrafico ?? '').trim() || tituloPadraoGrafico(situacao);

  const maxValor = itens.reduce((acc, it) => (it.valor > acc ? it.valor : acc), 0);
  const escala = calcularEscalaEixoX(maxValor);

  const MAX_LABEL_CHARS = 28;
  const labelsExibidos = itens.map(it => truncarLabel(it.label, MAX_LABEL_CHARS));
  const maiorLabelLen = labelsExibidos.reduce((acc, l) => Math.max(acc, l.length), 6);

  const W = 720;
  const padTop = 52;
  const padBottom = 56;
  const padRight = 28;
  // ~6.6px por caractere em Calibri 11px + 42px para o título vertical do eixo Y e respiro
  const padLeft = Math.min(230, Math.max(115, Math.round(maiorLabelLen * 6.6 + 48)));

  const rowHeight = itens.length > 12 ? 24 : 28;
  const barHeight = itens.length > 12 ? 10 : 12;
  const numRows = Math.max(1, itens.length);
  const plotH = numRows * rowHeight;
  const plotW = W - padLeft - padRight;
  const H = padTop + plotH + padBottom;

  const font = "Calibri, 'Segoe UI', Arial, sans-serif";
  const corTexto = '#595959';
  const corGrade = '#D9D9D9';
  const corBarra = '#5B9BD5';

  const linhasGrade = escala.ticks
    .map(t => {
      const x = padLeft + (t / escala.max) * plotW;
      const xStr = x.toFixed(2);
      return (
        `<line x1="${xStr}" y1="${padTop}" x2="${xStr}" y2="${padTop + plotH}" stroke="${corGrade}" stroke-width="1"/>` +
        `<text x="${xStr}" y="${padTop + plotH + 18}" text-anchor="middle" font-family="${font}" font-size="11" fill="${corTexto}">${formatarTickBR(t)}</text>`
      );
    })
    .join('');

  const barrasELabels = itens
    .map((it, idx) => {
      const cy = padTop + idx * rowHeight + rowHeight / 2;
      const barY = (cy - barHeight / 2).toFixed(2);
      const barW = it.valor > 0 ? Math.max(1, (it.valor / escala.max) * plotW) : 0;
      const labelXml = `<text x="${padLeft - 10}" y="${(cy + 4).toFixed(2)}" text-anchor="end" font-family="${font}" font-size="11" fill="${corTexto}">${escXml(labelsExibidos[idx])}</text>`;
      const barXml = barW > 0
        ? `<rect x="${padLeft}" y="${barY}" width="${barW.toFixed(2)}" height="${barHeight}" fill="${corBarra}"/>`
        : '';
      return labelXml + barXml;
    })
    .join('');

  const yCentroPlot = (padTop + plotH / 2).toFixed(2);
  const xCentroPlot = (padLeft + plotW / 2).toFixed(2);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;height:auto;display:block">` +
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="#FFFFFF" stroke="${corGrade}" stroke-width="1"/>` +
    `<text x="${(W / 2).toFixed(2)}" y="30" text-anchor="middle" font-family="${font}" font-size="16" font-weight="400" fill="${corTexto}">${escXml(titulo)}</text>` +
    `<text x="18" y="${yCentroPlot}" transform="rotate(-90 18 ${yCentroPlot})" text-anchor="middle" font-family="${font}" font-size="10.5" fill="${corTexto}">IDENTIFICAÇÃO DAS AMOSTRAS</text>` +
    linhasGrade +
    barrasELabels +
    `<text x="${xCentroPlot}" y="${padTop + plotH + 40}" text-anchor="middle" font-family="${font}" font-size="11" fill="${corTexto}">TENSÃO [MPa]</text>` +
    `</svg>`
  );
}
