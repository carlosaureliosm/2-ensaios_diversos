// src/modules/aderencia/svgGraficoResultado.ts
//
// Gera o gráfico de resultado por situação em SVG puro (barras horizontais de Tensão Ra [MPa]
// por identificação de amostra), usado tanto na pré-visualização da tela quanto na rasterização
// em PNG (via svgParaPng) para inserção no laudo DOCX após o anexo de fotos.

import type { AderenciaNormas, CriterioRa, SituacaoAderencia } from './types';
import { numeroRomano, obterLimitesCriterioRa, sugerirCriterioRa } from './utils';

export interface ItemGraficoResultado {
  label: string;
  valor: number;
}

export interface LinhaReferenciaGrafico {
  valor: number;
  label: string;
  tracejado: boolean;
}

export interface OpcoesGraficoResultado {
  criterioRa?: CriterioRa;
  normas?: AderenciaNormas;
  /** Layout mais alto e compacto (width 360) para leitura confortável em telas de celular. */
  compacto?: boolean;
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

/** Resolve as linhas verticais de referência normativa (em MPa) para a situação. */
export function obterLinhasReferenciaGrafico(
  situacao: Pick<SituacaoAderencia, 'criterioRa' | 'modeloCamadasId' | 'tipoRevestimento'>,
  opcoes?: OpcoesGraficoResultado,
): LinhaReferenciaGrafico[] {
  const criterio: CriterioRa =
    opcoes?.criterioRa ??
    situacao.criterioRa ??
    (opcoes?.normas
      ? sugerirCriterioRa(opcoes.normas, situacao.modeloCamadasId ?? '', situacao.tipoRevestimento)
      : '0.30');

  const limites = obterLimitesCriterioRa(criterio);
  if (limites.recomendado !== null) {
    return [
      { valor: limites.minimo, label: `Mín. ${formatarTickBR(limites.minimo)} MPa`, tracejado: false },
      { valor: limites.recomendado, label: `Aprov. ${formatarTickBR(limites.recomendado)} MPa`, tracejado: true },
    ];
  }
  return [
    { valor: limites.minimo, label: `Limite ${formatarTickBR(limites.minimo)} MPa`, tracejado: false },
  ];
}

/**
 * Gera a string SVG do gráfico de barras horizontais de uma situação.
 * Layout fiel à referência: moldura cinza clara, título centralizado, eixo Y vertical
 * "IDENTIFICAÇÃO DAS AMOSTRAS", eixo X "TENSÃO [MPa]" com grade vertical, barras azuis (#5B9BD5)
 * e linha(s) vertical(is) vermelha(s) de limite conforme a norma/critério da situação.
 */
export function svgGraficoResultado(
  situacao: Pick<
    SituacaoAderencia,
    'numero' | 'tipoRevestimento' | 'tituloGrafico' | 'corposDeProva' | 'criterioRa' | 'modeloCamadasId'
  >,
  opcoes?: OpcoesGraficoResultado,
): string {
  const itens = extrairItensGrafico(situacao);
  const titulo = (situacao.tituloGrafico ?? '').trim() || tituloPadraoGrafico(situacao);
  const linhasRef = obterLinhasReferenciaGrafico(situacao, opcoes);

  const maxBarra = itens.reduce((acc, it) => (it.valor > acc ? it.valor : acc), 0);
  const maxRef = linhasRef.reduce((acc, l) => (l.valor > acc ? l.valor : acc), 0);
  const escala = calcularEscalaEixoX(Math.max(maxBarra, maxRef));

  const compacto = !!opcoes?.compacto;
  const MAX_LABEL_CHARS = compacto ? 14 : 28;
  const labelsExibidos = itens.map(it => truncarLabel(it.label, MAX_LABEL_CHARS));
  const maiorLabelLen = labelsExibidos.reduce((acc, l) => Math.max(acc, l.length), 6);

  const W = compacto ? 360 : 720;
  const padTop = compacto ? 56 : 62;
  const padBottom = compacto ? 48 : 56;
  const padRight = compacto ? 16 : 28;
  // Espaço para o rótulo vertical do eixo Y + nomes das amostras
  const padLeft = compacto
    ? Math.min(130, Math.max(76, Math.round(maiorLabelLen * 6.4 + 34)))
    : Math.min(230, Math.max(115, Math.round(maiorLabelLen * 6.6 + 48)));

  const rowHeight = compacto
    ? (itens.length > 10 ? 28 : 34)
    : (itens.length > 12 ? 24 : 28);
  const barHeight = compacto
    ? (itens.length > 10 ? 12 : 15)
    : (itens.length > 12 ? 10 : 12);
  const numRows = Math.max(1, itens.length);
  const plotH = numRows * rowHeight;
  const plotW = W - padLeft - padRight;
  const H = padTop + plotH + padBottom;

  const font = "Calibri, 'Segoe UI', Arial, sans-serif";
  const corTexto = '#595959';
  const corGrade = '#D9D9D9';
  const corBarra = '#5B9BD5';
  const corLimite = '#C00000';

  const fsTitulo = compacto ? 13.5 : 16;
  const fsLabel = compacto ? 10.5 : 11;
  const fsTick = compacto ? 10 : 11;
  const fsEixoY = compacto ? 9.5 : 10.5;
  const fsEixoX = compacto ? 10.5 : 11;
  const textoEixoY = compacto && plotH < 170 ? 'AMOSTRAS' : 'IDENTIFICAÇÃO DAS AMOSTRAS';
  const xEixoY = compacto ? 14 : 18;

  const linhasGrade = escala.ticks
    .map(t => {
      const x = padLeft + (t / escala.max) * plotW;
      const xStr = x.toFixed(2);
      return (
        `<line x1="${xStr}" y1="${padTop}" x2="${xStr}" y2="${padTop + plotH}" stroke="${corGrade}" stroke-width="1"/>` +
        `<text x="${xStr}" y="${padTop + plotH + (compacto ? 16 : 18)}" text-anchor="middle" font-family="${font}" font-size="${fsTick}" fill="${corTexto}">${formatarTickBR(t)}</text>`
      );
    })
    .join('');

  const barrasELabels = itens
    .map((it, idx) => {
      const cy = padTop + idx * rowHeight + rowHeight / 2;
      const barY = (cy - barHeight / 2).toFixed(2);
      const barW = it.valor > 0 ? Math.max(1, (it.valor / escala.max) * plotW) : 0;
      const labelXml = `<text x="${padLeft - (compacto ? 7 : 10)}" y="${(cy + 3.5).toFixed(2)}" text-anchor="end" font-family="${font}" font-size="${fsLabel}" fill="${corTexto}">${escXml(labelsExibidos[idx])}</text>`;
      const barXml = barW > 0
        ? `<rect x="${padLeft}" y="${barY}" width="${barW.toFixed(2)}" height="${barHeight}" fill="${corBarra}"/>`
        : '';
      return labelXml + barXml;
    })
    .join('');

  const limitesXml = linhasRef
    .map(ref => {
      const x = padLeft + (ref.valor / escala.max) * plotW;
      const xStr = x.toFixed(2);
      const pertoDaBordaDir = x > padLeft + plotW - 44;
      const anchor = pertoDaBordaDir ? 'end' : 'middle';
      const labelX = pertoDaBordaDir ? (x - 4).toFixed(2) : xStr;
      const dashAttr = ref.tracejado ? ' stroke-dasharray="5,3"' : '';
      return (
        `<line x1="${xStr}" y1="${padTop}" x2="${xStr}" y2="${padTop + plotH}" stroke="${corLimite}" stroke-width="1.8"${dashAttr}/>` +
        `<text x="${labelX}" y="${padTop - 6}" text-anchor="${anchor}" font-family="${font}" font-size="9.5" font-weight="700" fill="${corLimite}">${escXml(ref.label)}</text>`
      );
    })
    .join('');

  const yCentroPlot = (padTop + plotH / 2).toFixed(2);
  const xCentroPlot = (padLeft + plotW / 2).toFixed(2);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;height:auto;display:block">` +
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="#FFFFFF" stroke="${corGrade}" stroke-width="1"/>` +
    `<text x="${(W / 2).toFixed(2)}" y="${compacto ? 24 : 28}" text-anchor="middle" font-family="${font}" font-size="${fsTitulo}" font-weight="400" fill="${corTexto}">${escXml(titulo)}</text>` +
    `<text x="${xEixoY}" y="${yCentroPlot}" transform="rotate(-90 ${xEixoY} ${yCentroPlot})" text-anchor="middle" font-family="${font}" font-size="${fsEixoY}" fill="${corTexto}">${textoEixoY}</text>` +
    linhasGrade +
    barrasELabels +
    limitesXml +
    `<text x="${xCentroPlot}" y="${padTop + plotH + (compacto ? 36 : 40)}" text-anchor="middle" font-family="${font}" font-size="${fsEixoX}" fill="${corTexto}">TENSÃO [MPa]</text>` +
    `</svg>`
  );
}
