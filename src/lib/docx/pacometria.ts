// src/lib/docx/pacometria.ts
//
// Helpers de geração do laudo DOCX do módulo Pacometria (modelo: public/modelo_pacometria.docx).
// Reaproveita registrarImagem, buildDrawingXml, cmParaEmu, formatarRlt e toTitleCase de esclerometria.

import PizZip from 'pizzip';
import {
  buildDrawingXml,
  cmParaEmu,
  formatarRlt,
  registrarImagem,
  toTitleCase,
} from '@/lib/docx/esclerometria';
import {
  AmostraRow,
  Cabecalho,
  OPCOES_LAJE,
  OPCOES_PILAR,
  OPCOES_VIGA,
  OpcaoLaje,
  OpcaoPilar,
  OpcaoViga,
  TIPO_LABELS,
  calcularCobrimentos,
  calcularCobrimentosLaje,
  calcularEspacamentos,
  ordenarBarras,
} from '@/modules/pacometria/types';

export type ImagemBase64Payload = {
  base64: string;
  contentType?: string;
  width: number;
  height: number;
};

export type PerfilFacePayload = {
  face: string;
  faceLabel: string;
  imagem: ImagemBase64Payload;
};

export type AmostraPacometriaPayload = Omit<AmostraRow, 'fotoFile' | 'fotoPreview'> & {
  foto?: ImagemBase64Payload | null;
  esquema?: ImagemBase64Payload | null;
  perfis?: PerfilFacePayload[] | null;
};

export type PacometriaDocxPayload = {
  cab: Cabecalho;
  amostras: AmostraPacometriaPayload[];
  rltOficial?: string;
  respNome?: string;
  respCrea?: string;
  assinaturaUrl?: string;
  outroRespBase64?: string;
  outroRespContentType?: string;
  usaMotivacao?: boolean;
  motivacao?: string;
  usaFotoGeral?: boolean;
  fotoGeral?: ImagemBase64Payload | null;
  usaCroquiGeral?: boolean;
  /** Compatibilidade legada: imagem única de croqui */
  croqui?: ImagemBase64Payload | null;
  /** Croqui com múltiplas imagens */
  croquis?: ImagemBase64Payload[] | null;
  /** Inicia cada elemento da Seção 4 (a partir do 2º) em nova página (padrão: true) */
  quebraPaginaPorElemento?: boolean;
  /** Inclui Seção 5 — Resumo Executivo e Conclusão */
  usaConclusao?: boolean;
  conclusao?: string;
};

export type ImagemPacometriaInjetar = {
  marcador: string;
  buffer: Buffer;
  contentType: string;
  width: number;
  height: number;
  maxLarguraCm: number;
  maxAlturaCm: number;
};

// ── Paleta e helpers OOXML para blocos dinâmicos da Seção 4 ──
const BLACK = '000000';
const WHITE = 'FFFFFF';
const NAVY_HEADER = '002060';
const NAVY_TITLE = '0F243E';
const GRAY_BG = 'D9D9D9';
const ROW_ALT = 'F2F4F8';
const BORDER_LIGHT = 'BFBFBF';
const NONE_ATTR = 'w:val="none" w:sz="0" w:space="0" w:color="auto"';

const B_LIGHT = `w:val="single" w:sz="4" w:space="0" w:color="${BORDER_LIGHT}"`;
const B_NAVY = `w:val="single" w:sz="6" w:space="0" w:color="${NAVY_HEADER}"`;
const B_NONE: string | null = null;

function escXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function xmlRpr({ bold = false, italic = false, color = BLACK, size = 22 } = {}): string {
  let x = '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>';
  if (bold) x += '<w:b/><w:bCs/>';
  if (italic) x += '<w:i/><w:iCs/>';
  if (color) x += `<w:color w:val="${color}"/>`;
  if (size) x += `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`;
  x += '<w:lang w:eastAsia="pt-BR"/></w:rPr>';
  return x;
}

function xmlRun(text: string, opts?: { bold?: boolean; italic?: boolean; color?: string; size?: number }): string {
  return `<w:r>${xmlRpr(opts)}<w:t xml:space="preserve">${escXml(text)}</w:t></w:r>`;
}

function xmlPara(
  content: string | string[],
  {
    jc = 'left',
    before = 0,
    after = 0,
    line = 210,
    pageBreakBefore = false,
    keepNext = false,
  } = {},
): string {
  const runs = Array.isArray(content) ? content.join('') : content;
  let ppr = '<w:pPr>';
  if (pageBreakBefore) ppr += '<w:pageBreakBefore/>';
  if (keepNext) ppr += '<w:keepNext/>';
  ppr += `<w:spacing w:before="${before}" w:after="${after}" w:line="${line}" w:lineRule="auto"/>`;
  if (jc) ppr += `<w:jc w:val="${jc}"/>`;
  ppr += '</w:pPr>';
  return `<w:p>${ppr}${runs}</w:p>`;
}

function xmlTcBorders(b: { top?: string | null; bottom?: string | null; left?: string | null; right?: string | null }): string {
  let x = '<w:tcBorders>';
  if (b.top !== undefined) x += `<w:top ${b.top || NONE_ATTR}/>`;
  if (b.left !== undefined) x += `<w:left ${b.left || NONE_ATTR}/>`;
  if (b.bottom !== undefined) x += `<w:bottom ${b.bottom || NONE_ATTR}/>`;
  if (b.right !== undefined) x += `<w:right ${b.right || NONE_ATTR}/>`;
  x += '</w:tcBorders>';
  return x;
}

function xmlTc(
  pctWidth: number,
  content: string | string[],
  {
    align = 'center',
    vAlign = 'center',
    shade,
    gridSpan,
    borders,
    bold = false,
    italic = false,
    size = 22,
    color = BLACK,
    keepNext = false,
    pageBreakBefore = false,
  }: {
    align?: string;
    vAlign?: string;
    shade?: string;
    gridSpan?: number;
    borders?: { top?: string | null; bottom?: string | null; left?: string | null; right?: string | null };
    bold?: boolean;
    italic?: boolean;
    size?: number;
    color?: string;
    keepNext?: boolean;
    pageBreakBefore?: boolean;
  } = {},
): string {
  let tcPr = `<w:tcPr><w:tcW w:w="${pctWidth}" w:type="pct"/>`;
  if (gridSpan && gridSpan > 1) tcPr += `<w:gridSpan w:val="${gridSpan}"/>`;
  if (borders) tcPr += xmlTcBorders(borders);
  if (shade) tcPr += `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>`;
  tcPr += `<w:vAlign w:val="${vAlign}"/></w:tcPr>`;

  let inner: string;
  if (Array.isArray(content)) {
    inner = content.join('');
  } else if (/^<w:(r|p|tbl)[ >]/.test(content)) {
    inner = content;
  } else {
    inner = xmlRun(content, { bold, italic, size, color });
  }

  const wrapInPara = !/^<w:(p|tbl)[ >]/.test(inner);
  const body = wrapInPara
    ? xmlPara(inner, { jc: align, before: 14, after: 14, line: 205, keepNext, pageBreakBefore })
    : inner;
  return `<w:tc>${tcPr}${body}</w:tc>`;
}

function xmlTrow(cells: string[], { header = false, cantSplit = true } = {}): string {
  let trPr = '<w:trPr>';
  if (cantSplit) trPr += '<w:cantSplit/>';
  if (header) trPr += '<w:tblHeader/>';
  trPr += '<w:jc w:val="center"/></w:trPr>';
  return `<w:tr>${trPr}${cells.join('')}</w:tr>`;
}

function xmlTbl(
  colWidths: number[],
  rows: string[],
  { borders = 'navy', marTop = 20, marBottom = 20, marLeft = 36, marRight = 36 } = {},
): string {
  const grid = colWidths.map(w => `<w:gridCol w:w="${w}"/>`).join('');
  let tblBorders = '<w:tblBorders>';
  if (borders === 'none') {
    tblBorders += `<w:top ${NONE_ATTR}/><w:left ${NONE_ATTR}/><w:bottom ${NONE_ATTR}/><w:right ${NONE_ATTR}/><w:insideH ${NONE_ATTR}/><w:insideV ${NONE_ATTR}/>`;
  } else {
    tblBorders += `<w:top ${B_NAVY}/><w:left ${B_NAVY}/><w:bottom ${B_NAVY}/><w:right ${B_NAVY}/><w:insideH ${B_LIGHT}/><w:insideV ${B_LIGHT}/>`;
  }
  tblBorders += '</w:tblBorders>';
  const tblCellMar = `<w:tblCellMar><w:top w:w="${marTop}" w:type="dxa"/><w:left w:w="${marLeft}" w:type="dxa"/><w:bottom w:w="${marBottom}" w:type="dxa"/><w:right w:w="${marRight}" w:type="dxa"/></w:tblCellMar>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:jc w:val="center"/>${tblBorders}${tblCellMar}</w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rows.join('')}</w:tbl>`;
}

function distribuirLargurasPct(pesos: number[], total = 5000, idxAjuste = 0): number[] {
  const soma = pesos.reduce((a, b) => a + b, 0) || 1;
  const larguras = pesos.map(p => Math.round((p / soma) * total));
  const diff = total - larguras.reduce((a, b) => a + b, 0);
  larguras[Math.min(idxAjuste, larguras.length - 1)] += diff;
  return larguras;
}

// ── Formatação de valores ─────────────────────────────────────
function fmtNum(n: number | null | undefined, casas = 1): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toFixed(casas).replace('.', ',');
}

function fmtValorBruto(v: string | undefined): string {
  const s = (v ?? '').trim();
  if (!s) return '';
  return s.replace('.', ',');
}

function bufferDeBase64(b64: string): Buffer {
  return Buffer.from(b64.replace(/^data:[^;]+;base64,/, ''), 'base64');
}

function imagemValida(img: ImagemBase64Payload | null | undefined): img is ImagemBase64Payload {
  return !!img && !!img.base64 && img.width > 0 && img.height > 0;
}

function resumoGeometriaElemento(a: AmostraPacometriaPayload): string {
  if (a.tipo === 'pilar') {
    const op = a.opcao as OpcaoPilar;
    const cfg = OPCOES_PILAR[op];
    if (op === 'E') return `Circular · Ø ${a.D || 0} cm`;
    if (op === 'B') return `${cfg?.label ?? '1 face'} · X = ${a.X || 0} cm`;
    return `${cfg?.label ?? `Opção ${op}`} · ${a.X || 0}×${a.Y || 0} cm`;
  }
  if (a.tipo === 'viga') {
    const op = a.opcao as OpcaoViga;
    const cfg = OPCOES_VIGA[op];
    return `${cfg?.label ?? op} · b=${a.X || 0} × h=${a.Y || 0} cm`;
  }
  const op = a.opcao as OpcaoLaje;
  const cfg = OPCOES_LAJE[op];
  const lx = a.lajeData?.larguraX ?? 100;
  const ly = a.lajeData?.alturaY ?? 100;
  return `${cfg?.label ?? 'Malha'} · ${lx}×${ly} cm`;
}

function resumoTipoCurto(a: AmostraPacometriaPayload): string {
  const tipo = TIPO_LABELS[a.tipo] ?? a.tipo;
  if (a.tipo === 'pilar') {
    if (a.opcao === 'E') return `${tipo} Circular (Ø ${a.D || 0} cm)`;
    if (a.opcao === 'B') return `${tipo} (X=${a.X || 0} cm)`;
    return `${tipo} (${a.X || 0}×${a.Y || 0} cm)`;
  }
  if (a.tipo === 'viga') {
    return `${tipo} (${a.X || 0}×${a.Y || 0} cm)`;
  }
  const lx = a.lajeData?.larguraX ?? 100;
  const ly = a.lajeData?.alturaY ?? 100;
  return `${tipo} (${lx}×${ly} cm)`;
}

function formatarCobBordasLaje(ld: NonNullable<AmostraPacometriaPayload['lajeData']>): string {
  const partes: string[] = [];
  const sup = fmtValorBruto(ld.cobPerpHSup);
  const inf = fmtValorBruto(ld.cobPerpHInf);
  const esq = fmtValorBruto(ld.cobPerpVEsq);
  const dir = fmtValorBruto(ld.cobPerpVDir);
  if (sup) partes.push(`Sup: ${sup} mm`);
  if (inf) partes.push(`Inf: ${inf} mm`);
  if (esq) partes.push(`Esq: ${esq} mm`);
  if (dir) partes.push(`Dir: ${dir} mm`);
  return partes.join(' | ');
}

function extrairLeiturasCobrimentoAmostra(a: AmostraPacometriaPayload): number[] {
  const vals: number[] = [];
  if (a.tipo === 'laje' && a.lajeData) {
    const ext = a.lajeData.camadaExterna ?? (a.lajeData.barrasH.length > 0 ? 'H' : 'V');
    const barras = ext === 'H' ? a.lajeData.barrasH : a.lajeData.barrasV;
    for (const b of barras ?? []) {
      const n = parseFloat((b.cob ?? '').replace(',', '.'));
      if (!isNaN(n) && n > 0) vals.push(n);
    }
  } else {
    for (const fd of Object.values(a.facesData ?? {})) {
      for (const c of fd?.cob ?? []) {
        const n = parseFloat((c ?? '').replace(',', '.'));
        if (!isNaN(n) && n > 0) vals.push(n);
      }
    }
  }
  return vals;
}

export function gerarResumoExecutivoAutomatico(amostras: AmostraPacometriaPayload[]): {
  resumoTiposGlobal: string;
  totalLeiturasGlobal: string;
  cobMedioGlobal: string;
  faixaGlobal: string;
  textoPadrao: string;
} {
  let nPilar = 0;
  let nViga = 0;
  let nLaje = 0;
  const todasLeituras: number[] = [];
  let minVal: number | null = null;
  let minElem = '';
  let maxVal: number | null = null;
  let maxElem = '';

  amostras.forEach((a, idx) => {
    if (a.tipo === 'pilar') nPilar++;
    else if (a.tipo === 'viga') nViga++;
    else nLaje++;

    const nome = a.elemento || `Elemento ${a.item || idx + 1}`;
    const leituras = extrairLeiturasCobrimentoAmostra(a);
    leituras.forEach(v => {
      todasLeituras.push(v);
      if (minVal === null || v < minVal) { minVal = v; minElem = nome; }
      if (maxVal === null || v > maxVal) { maxVal = v; maxElem = nome; }
    });
  });

  const partesTipo: string[] = [];
  if (nPilar > 0) partesTipo.push(`${nPilar} ${nPilar === 1 ? 'pilar' : 'pilares'}`);
  if (nViga > 0) partesTipo.push(`${nViga} ${nViga === 1 ? 'viga' : 'vigas'}`);
  if (nLaje > 0) partesTipo.push(`${nLaje} ${nLaje === 1 ? 'laje/área livre' : 'lajes/áreas livres'}`);
  const resumoTiposGlobal = partesTipo.length > 0
    ? `${amostras.length} (${partesTipo.join(', ')})`
    : String(amostras.length);

  const totalLeituras = todasLeituras.length;
  const mediaGlobal = totalLeituras > 0
    ? todasLeituras.reduce((s, v) => s + v, 0) / totalLeituras
    : null;

  const cobMedioGlobal = mediaGlobal !== null ? `${fmtNum(mediaGlobal, 1)} mm` : '—';
  const faixaGlobal = minVal !== null && maxVal !== null
    ? `${fmtNum(minVal, 0)} a ${fmtNum(maxVal, 0)} mm`
    : '—';

  const textoPadrao = totalLeituras > 0
    ? `Foram inspecionados ${amostras.length} elemento(s) estrutural(is) (${partesTipo.join(', ')}), totalizando ${totalLeituras} leitura(s) de cobrimento na armadura mais externa. O cobrimento médio global obtido foi de ${fmtNum(mediaGlobal, 1)} mm, com valores variando entre ${fmtNum(minVal, 0)} mm (${minElem}) e ${fmtNum(maxVal, 0)} mm (${maxElem}). Os levantamentos individuais de posicionamento, espaçamentos e cobrimentos por face constam detalhados na Seção 4 deste relatório.`
    : `Foram inspecionados ${amostras.length} elemento(s) estrutural(is) (${partesTipo.join(', ')}), com levantamento da geometria e posicionamento das armaduras detalhado na Seção 4 deste relatório.`;

  return {
    resumoTiposGlobal,
    totalLeiturasGlobal: String(totalLeituras),
    cobMedioGlobal,
    faixaGlobal,
    textoPadrao,
  };
}

/**
 * Converte o payload de pacometria em:
 *   1) objeto `dados` para o Docxtemplater (`modelo_pacometria.docx`)
 *   2) string `blocoElementosXml` para injeção dinâmica da Seção 4
 *   3) lista `imagens` para injeção pós-render (`injetarImagensPacometria`).
 */
export function montarDadosPacometria(
  payload: PacometriaDocxPayload,
  mapaResult?: { buffer: Buffer; width: number; height: number } | null,
): {
  dados: Record<string, unknown>;
  blocoElementosXml: string;
  imagens: ImagemPacometriaInjetar[];
} {
  const { cab } = payload;
  const imagens: ImagemPacometriaInjetar[] = [];
  let figNum = 0;
  let tabNum = 1; // Tabela 1 = Resumo estatístico da Seção 3

  // ── Imagens da Seção 1 (com numeração automática sequencial) ─
  let temMapa = false;
  let mapaMarcador = '';
  let figMapaNum = '';
  if (mapaResult && mapaResult.width > 0 && mapaResult.height > 0) {
    temMapa = true;
    figNum += 1;
    figMapaNum = String(figNum);
    mapaMarcador = 'MAPA_PAC_PH_END';
    imagens.push({
      marcador: mapaMarcador,
      buffer: mapaResult.buffer,
      contentType: 'image/png',
      width: mapaResult.width,
      height: mapaResult.height,
      maxLarguraCm: 11.5,
      maxAlturaCm: 8.0,
    });
  }

  let temFotoGeral = false;
  let fotoGeralMarcador = '';
  let figFotoGeralNum = '';
  if (payload.usaFotoGeral && imagemValida(payload.fotoGeral)) {
    temFotoGeral = true;
    figNum += 1;
    figFotoGeralNum = String(figNum);
    fotoGeralMarcador = 'FOTO_GERAL_PAC_PH_END';
    imagens.push({
      marcador: fotoGeralMarcador,
      buffer: bufferDeBase64(payload.fotoGeral.base64),
      contentType: payload.fotoGeral.contentType || 'image/jpeg',
      width: payload.fotoGeral.width,
      height: payload.fotoGeral.height,
      maxLarguraCm: 14.5,
      maxAlturaCm: 9.5,
    });
  }

  // Croquis múltiplos (aceita array `croquis` ou legado `croqui`)
  const croquisBrutos: ImagemBase64Payload[] = [];
  if (payload.usaCroquiGeral) {
    if (Array.isArray(payload.croquis) && payload.croquis.length > 0) {
      payload.croquis.forEach(c => { if (imagemValida(c)) croquisBrutos.push(c); });
    } else if (imagemValida(payload.croqui)) {
      croquisBrutos.push(payload.croqui);
    }
  }
  const croquisLista = croquisBrutos.map((c, idx) => {
    figNum += 1;
    const marcador = `CROQUI_PAC_${idx + 1}_PH_END`;
    imagens.push({
      marcador,
      buffer: bufferDeBase64(c.base64),
      contentType: c.contentType || 'image/jpeg',
      width: c.width,
      height: c.height,
      maxLarguraCm: 15.0,
      maxAlturaCm: 10.5,
    });
    return {
      marcador,
      figNum: String(figNum),
      sufixo: croquisBrutos.length > 1 ? ` (${idx + 1}/${croquisBrutos.length})` : '',
    };
  });

  // ── Seção 3 (Resumo) + Seção 4 (Detalhamento dinâmico) ───────
  const quebraPagina = payload.quebraPaginaPorElemento !== false; // padrão true
  const blocosElementos: string[] = [];
  const resumo: Array<Record<string, string>> = [];

  // Título da Seção 4 inicia em nova página quando controle de paginação está ativo,
  // mantendo-se sempre colado (keepNext) à ficha do 1º elemento (4.1).
  blocosElementos.push(
    xmlPara(
      xmlRun('4. DETALHAMENTO POR ELEMENTO ENSAIADO', { bold: true, size: 24, color: NAVY_TITLE }),
      { jc: 'left', before: quebraPagina ? 0 : 140, after: 70, line: 240, pageBreakBefore: quebraPagina, keepNext: true },
    ),
  );

  payload.amostras.forEach((a, idx) => {
    const itemNum = a.item || idx + 1;
    const elemNome = a.elemento || `Elemento ${itemNum}`;
    const tipoLabel = TIPO_LABELS[a.tipo] ?? a.tipo;
    const tipoResumo = resumoTipoCurto(a);
    const resumoGeometria = resumoGeometriaElemento(a);

    const statsCalc = a.tipo === 'laje' && a.lajeData
      ? calcularCobrimentosLaje(a.lajeData)
      : calcularCobrimentos(a.facesData ?? {});

    const cobMedio = statsCalc.cobMedio ?? a.cobMedio ?? null;
    const cobMinimo = statsCalc.cobMinimo ?? a.cobMinimo ?? null;
    const cobMaximo = statsCalc.cobMaximo ?? a.cobMaximo ?? null;
    const cobDesvio = statsCalc.cobDesvio ?? a.cobDesvio ?? null;
    const cobCV = statsCalc.cobCV ?? a.cobCV ?? null;
    const cobModa = statsCalc.cobModa ?? a.cobModa ?? null;

    const cobMedioStr = fmtNum(cobMedio, 1);
    const cobMinStr = fmtNum(cobMinimo, 0);
    const cobMaxStr = fmtNum(cobMaximo, 0);
    const cobDpStr = fmtNum(cobDesvio, 1);
    const cobCvStr = fmtNum(cobCV, 1);
    const cobModaStr = cobModa !== null ? `${cobModa} mm` : '—';
    const cobModaNum = cobModa !== null ? String(cobModa) : '—';

    resumo.push({
      item: String(itemNum),
      elemento: elemNome,
      tipoResumo,
      cobMedio: cobMedioStr,
      cobMinimo: cobMinStr,
      cobMaximo: cobMaxStr,
      cobDesvio: cobDpStr,
      cobCV: cobCvStr,
      cobModa: cobModaNum,
    });

    // Controle de paginação por elemento (quebra limpa a partir do 2º elemento; o 1º já fica junto ao título da Seção 4)
    const usarQuebra = quebraPagina && idx > 0;

    const temEsquema = imagemValida(a.esquema);
    const perfisValidos = (a.perfis ?? []).filter(p => imagemValida(p?.imagem));
    const nPerfis = perfisValidos.length;
    const temFoto = imagemValida(a.foto);

    // Ficha unificada em 1 única tabela [2500, 2500] com gridSpan=2 nas linhas de largura total:
    //   - Evita bordas duplicadas e facilita manter cabeçalho + 1ª linha visual colados
    //   - Layout adaptativo para N perfis (0, 1, 2, 3, 4+):
    //       * N=1 com esquema: [Esquema | Perfil 1] lado a lado + Foto abaixo (cabe em 1 página, inclusive no 4.1!)
    //       * N=3 com esquema: grade 2×2 [Esquema | Perfil 1] + [Perfil 2 | Perfil 3] + Foto abaixo (cabe em 1 página!)
    //       * N=2: Esquema largura total + [Perfil 1 | Perfil 2] + Foto abaixo (cabe em 1 página!)
    //       * N=4+: Esquema largura total + pares [Perfil i | Perfil i+1] + Foto abaixo
    //       * N=0 (Laje / sem perfil): Esquema largura total + Foto abaixo
    const cardRows: string[] = [];

    // Linha 1: Cabeçalho do elemento
    cardRows.push(
      xmlTrow([
        xmlTc(5000, [
          xmlRun(`4.${itemNum}  ${elemNome}`, { bold: true, size: 22, color: WHITE }),
          xmlRun(`   —   ${tipoLabel} (${resumoGeometria})`, { size: 22, color: WHITE }),
        ], {
          align: 'left',
          shade: NAVY_HEADER,
          gridSpan: 2,
          borders: { top: B_NAVY, bottom: B_NAVY, left: B_NAVY, right: B_NAVY },
          keepNext: true,
          pageBreakBefore: usarQuebra,
        }),
      ]),
    );

    // Linha 2: Faixa de estatísticas
    cardRows.push(
      xmlTrow([
        xmlTc(5000, [
          xmlRun('Médio: ', { bold: true, size: 22, color: NAVY_TITLE }),
          xmlRun(`${cobMedioStr} mm   |   `, { size: 22 }),
          xmlRun('Mínimo: ', { bold: true, size: 22, color: NAVY_TITLE }),
          xmlRun(`${cobMinStr} mm   |   `, { size: 22 }),
          xmlRun('Máximo: ', { bold: true, size: 22, color: NAVY_TITLE }),
          xmlRun(`${cobMaxStr} mm   |   `, { size: 22 }),
          xmlRun('DP: ', { bold: true, size: 22, color: NAVY_TITLE }),
          xmlRun(`${cobDpStr} mm   |   `, { size: 22 }),
          xmlRun('CV: ', { bold: true, size: 22, color: NAVY_TITLE }),
          xmlRun(`${cobCvStr}%   |   `, { size: 22 }),
          xmlRun('Moda: ', { bold: true, size: 22, color: NAVY_TITLE }),
          xmlRun(cobModaStr, { size: 22 }),
        ], {
          align: 'left',
          shade: ROW_ALT,
          gridSpan: 2,
          borders: { top: B_LIGHT, bottom: B_NAVY, left: B_NAVY, right: B_NAVY },
          keepNext: temEsquema || nPerfis > 0 || temFoto,
        }),
      ]),
    );

    const descEsquema = a.tipo === 'laje' ? 'Malha ensaiada' : 'Esquema da seção transversal';

    // Helper para célula de perfil
    const criarCelulaPerfil = (
      p: PerfilFacePayload,
      perfilIdx: number,
      maxLarguraCm: number,
      maxAlturaCm: number,
      borders: { top?: string | null; bottom?: string | null; left?: string | null; right?: string | null },
      gridSpan?: number,
    ): string => {
      figNum += 1;
      const figP = figNum;
      const marc = `PERFIL_PAC_${itemNum}_${perfilIdx}_END`;
      imagens.push({
        marcador: marc,
        buffer: bufferDeBase64(p.imagem.base64),
        contentType: p.imagem.contentType || 'image/png',
        width: p.imagem.width,
        height: p.imagem.height,
        maxLarguraCm,
        maxAlturaCm,
      });
      const legenda = gridSpan === 2
        ? `Figura ${figP} — Perfil de elevação — ${p.faceLabel} (${elemNome}).`
        : `Figura ${figP} — Perfil — ${p.faceLabel}.`;
      return xmlTc(gridSpan === 2 ? 5000 : 2500, [
        xmlPara(xmlRun(marc), { jc: 'center', before: 16, after: 10, keepNext: true }),
        xmlPara(xmlRun(legenda, { italic: true, size: 22, color: NAVY_TITLE }), { jc: 'center', after: 10 }),
      ], { gridSpan, borders });
    };

    // Linhas de Esquema + Perfis (ordem: Esquema -> Perfis -> Foto)
    if (temEsquema && (nPerfis === 1 || nPerfis === 3)) {
      // N=1 -> [Esquema | Perfil 1] em 1 linha
      // N=3 -> [Esquema | Perfil 1] + [Perfil 2 | Perfil 3] em grade 2×2 perfeita
      const maxH = nPerfis === 1 ? 6.8 : 5.4;
      const maxW = nPerfis === 1 ? 8.6 : 8.4;

      figNum += 1;
      const figEsq = figNum;
      const esqMarc = `ESQUEMA_PAC_${itemNum}_END`;
      imagens.push({
        marcador: esqMarc,
        buffer: bufferDeBase64(a.esquema!.base64),
        contentType: a.esquema!.contentType || 'image/png',
        width: a.esquema!.width,
        height: a.esquema!.height,
        maxLarguraCm: maxW,
        maxAlturaCm: maxH,
      });

      const bBotLinha1 = nPerfis === 1 && !temFoto ? B_NAVY : B_LIGHT;
      const cellEsq = xmlTc(2500, [
        xmlPara(xmlRun(esqMarc), { jc: 'center', before: 16, after: 10, keepNext: true }),
        xmlPara(xmlRun(`Figura ${figEsq} — ${descEsquema} — ${elemNome}.`, { italic: true, size: 22, color: NAVY_TITLE }), { jc: 'center', after: 10 }),
      ], {
        borders: { top: B_NONE, bottom: bBotLinha1, left: B_NAVY, right: B_LIGHT },
      });

      const cellP1 = criarCelulaPerfil(
        perfisValidos[0],
        1,
        maxW,
        maxH,
        { top: B_NONE, bottom: bBotLinha1, left: B_LIGHT, right: B_NAVY },
      );

      cardRows.push(xmlTrow([cellEsq, cellP1]));

      if (nPerfis === 3) {
        const bBotLinha2 = temFoto ? B_LIGHT : B_NAVY;
        const cellP2 = criarCelulaPerfil(
          perfisValidos[1],
          2,
          maxW,
          maxH,
          { top: B_NONE, bottom: bBotLinha2, left: B_NAVY, right: B_LIGHT },
        );
        const cellP3 = criarCelulaPerfil(
          perfisValidos[2],
          3,
          maxW,
          maxH,
          { top: B_NONE, bottom: bBotLinha2, left: B_LIGHT, right: B_NAVY },
        );
        cardRows.push(xmlTrow([cellP2, cellP3]));
      }
    } else {
      // N=0, N=2, N=4+ ou sem esquema
      if (temEsquema) {
        figNum += 1;
        const figEsq = figNum;
        const esqMarc = `ESQUEMA_PAC_${itemNum}_END`;
        const maxHEsq = nPerfis >= 4 ? 5.0 : nPerfis === 2 ? 5.4 : 7.0;
        const maxWEsq = nPerfis >= 2 ? 13.5 : 14.5;
        imagens.push({
          marcador: esqMarc,
          buffer: bufferDeBase64(a.esquema!.base64),
          contentType: a.esquema!.contentType || 'image/png',
          width: a.esquema!.width,
          height: a.esquema!.height,
          maxLarguraCm: maxWEsq,
          maxAlturaCm: maxHEsq,
        });
        const bBotEsq = nPerfis === 0 && !temFoto && a.tipo !== 'laje' ? B_NAVY : B_LIGHT;
        cardRows.push(
          xmlTrow([
            xmlTc(5000, [
              xmlPara(xmlRun(esqMarc), { jc: 'center', before: 16, after: 10, keepNext: true }),
              xmlPara(xmlRun(`Figura ${figEsq} — ${descEsquema} — ${elemNome} (${resumoGeometria}).`, { italic: true, size: 22, color: NAVY_TITLE }), { jc: 'center', after: 10 }),
            ], {
              gridSpan: 2,
              borders: { top: B_NONE, bottom: bBotEsq, left: B_NAVY, right: B_NAVY },
            }),
          ]),
        );
      }

      if (nPerfis === 1) {
        const bBot = temFoto ? B_LIGHT : B_NAVY;
        cardRows.push(
          xmlTrow([
            criarCelulaPerfil(
              perfisValidos[0],
              1,
              14.0,
              7.5,
              { top: B_NONE, bottom: bBot, left: B_NAVY, right: B_NAVY },
              2,
            ),
          ]),
        );
      } else if (nPerfis >= 2) {
        const maxHPerfil = nPerfis >= 4 ? 5.2 : 5.6;
        for (let pi = 0; pi < nPerfis; pi += 2) {
          const pEsq = perfisValidos[pi];
          const pDir = perfisValidos[pi + 1];
          const ultimaLinha = pi + 2 >= nPerfis;
          const bBot = ultimaLinha && !temFoto ? B_NAVY : B_LIGHT;

          const cellEsq = criarCelulaPerfil(
            pEsq,
            pi + 1,
            8.4,
            maxHPerfil,
            { top: B_NONE, bottom: bBot, left: B_NAVY, right: B_LIGHT },
          );

          const cellDir = pDir
            ? criarCelulaPerfil(
                pDir,
                pi + 2,
                8.4,
                maxHPerfil,
                { top: B_NONE, bottom: bBot, left: B_LIGHT, right: B_NAVY },
              )
            : xmlTc(2500, '', { borders: { top: B_NONE, bottom: bBot, left: B_LIGHT, right: B_NAVY } });

          cardRows.push(xmlTrow([cellEsq, cellDir]));
        }
      }
    }

    // Última linha da ficha: Foto do elemento (quando presente)
    if (temFoto) {
      figNum += 1;
      const figFoto = figNum;
      const fotoMarc = `FOTO_ELEM_PAC_${itemNum}_END`;
      const maxHFoto = nPerfis === 2 || nPerfis === 3 ? 5.4 : nPerfis >= 4 ? 6.0 : 6.8;
      const maxWFoto = nPerfis === 2 || nPerfis === 3 ? 10.0 : 11.0;
      imagens.push({
        marcador: fotoMarc,
        buffer: bufferDeBase64(a.foto!.base64),
        contentType: a.foto!.contentType || 'image/jpeg',
        width: a.foto!.width,
        height: a.foto!.height,
        maxLarguraCm: maxWFoto,
        maxAlturaCm: maxHFoto,
      });
      const bBotFoto = a.tipo === 'laje' ? B_LIGHT : B_NAVY;
      cardRows.push(
        xmlTrow([
          xmlTc(5000, [
            xmlPara(xmlRun(fotoMarc), { jc: 'center', before: 16, after: 10, keepNext: true }),
            xmlPara(xmlRun(`Figura ${figFoto} — Registro fotográfico — ${elemNome}.`, { italic: true, size: 22, color: NAVY_TITLE }), { jc: 'center', after: 10 }),
          ], {
            gridSpan: 2,
            borders: { top: B_NONE, bottom: bBotFoto, left: B_NAVY, right: B_NAVY },
          }),
        ]),
      );
    }

    blocosElementos.push(
      xmlTbl([2500, 2500], cardRows, { borders: 'none', marTop: 14, marBottom: 14, marLeft: 32, marRight: 32 }),
    );

    // 5) Tabela de leituras compactada apenas para LAJE (Pilar/Viga já apresentam os dados nos perfis visuais)
    if (a.tipo === 'laje' && a.lajeData) {
      tabNum += 1;
      const tabAtual = tabNum;
      const ld = a.lajeData;
      const ext: 'H' | 'V' = ld.camadaExterna ?? (ld.barrasH.length > 0 ? 'H' : 'V');
      const camadaExternaLabel = ext === 'H' ? 'Horizontal (H)' : 'Vertical (V)';
      const dimLaje = `${ld.larguraX} × ${ld.alturaY} cm (grade ${ld.passoGrid} cm)`;
      const cobBordas = formatarCobBordasLaje(ld);

      const faixaRuns = [
        xmlRun('Camada mais externa: ', { bold: true, size: 22, color: NAVY_TITLE }),
        xmlRun(`${camadaExternaLabel}   |   `, { size: 22 }),
        xmlRun('Malha: ', { bold: true, size: 22, color: NAVY_TITLE }),
        xmlRun(dimLaje, { size: 22 }),
      ];
      if (cobBordas) {
        faixaRuns.push(
          xmlRun('   |   Cobrimentos às bordas: ', { bold: true, size: 22, color: NAVY_TITLE }),
          xmlRun(cobBordas, { size: 22 }),
        );
      }

      blocosElementos.push(xmlTbl([5000], [
        xmlTrow([
          xmlTc(5000, faixaRuns, {
            align: 'left',
            shade: GRAY_BG,
            borders: { top: B_LIGHT, bottom: B_LIGHT, left: B_NAVY, right: B_NAVY },
            keepNext: true,
          }),
        ]),
      ], { borders: 'none', marTop: 16, marBottom: 16, marLeft: 50, marRight: 50 }));

      type LajeRow = {
        direcaoLabel: string;
        barraNome: string;
        posicaoCm: string;
        espacamentoCm: string;
        cobrimentoMm: string;
      };
      const barrasLaje: LajeRow[] = [];

      const bh = ordenarBarras(ld.barrasH ?? []);
      const espH = calcularEspacamentos(bh);
      bh.forEach((b, i) => {
        barrasLaje.push({
          direcaoLabel: ext === 'H' ? 'Horizontal (Externa)' : 'Horizontal (Interna)',
          barraNome: `H${i + 1}`,
          posicaoCm: fmtNum(b.pos, 1),
          espacamentoCm: i === 0 ? '—' : fmtNum(espH[i - 1], 1),
          cobrimentoMm: ext === 'H' ? (fmtValorBruto(b.cob) || '—') : '— (camada interna)',
        });
      });

      const bv = ordenarBarras(ld.barrasV ?? []);
      const espV = calcularEspacamentos(bv);
      bv.forEach((b, i) => {
        barrasLaje.push({
          direcaoLabel: ext === 'V' ? 'Vertical (Externa)' : 'Vertical (Interna)',
          barraNome: `V${i + 1}`,
          posicaoCm: fmtNum(b.pos, 1),
          espacamentoCm: i === 0 ? '—' : fmtNum(espV[i - 1], 1),
          cobrimentoMm: ext === 'V' ? (fmtValorBruto(b.cob) || '—') : '— (camada interna)',
        });
      });

      if (barrasLaje.length === 0) {
        barrasLaje.push({
          direcaoLabel: '—',
          barraNome: '—',
          posicaoCm: '—',
          espacamentoCm: '—',
          cobrimentoMm: '—',
        });
      }

      const temEsp = barrasLaje.some(r => r.espacamentoCm !== '—');
      const temCob = barrasLaje.some(r => r.cobrimentoMm !== '—' && r.cobrimentoMm !== '— (camada interna)');

      type LajeColDef = {
        titulo: string;
        peso: number;
        align: 'left' | 'center';
        bold?: boolean;
        val: (r: LajeRow) => string;
      };
      const cols: LajeColDef[] = [
        { titulo: 'DIREÇÃO / CAMADA', peso: 26, align: 'left', bold: true, val: r => r.direcaoLabel },
        { titulo: 'BARRA', peso: 14, align: 'center', bold: true, val: r => r.barraNome },
        { titulo: 'POSIÇÃO (cm)', peso: 18, align: 'center', val: r => r.posicaoCm },
      ];
      if (temEsp) cols.push({ titulo: 'ESPAÇAMENTO (cm)', peso: 20, align: 'center', val: r => r.espacamentoCm });
      if (temCob) cols.push({ titulo: 'COBRIMENTO (mm)', peso: 22, align: 'center', val: r => r.cobrimentoMm });

      const larguras = distribuirLargurasPct(cols.map(c => c.peso), 5000, 0);

      blocosElementos.push(
        xmlPara(
          xmlRun(`Tabela ${tabAtual} — Leituras da malha — ${elemNome}.`, { bold: true, size: 22, color: NAVY_TITLE }),
          { jc: 'left', before: 50, after: 20, keepNext: true },
        ),
      );

      const headerRow = xmlTrow(
        cols.map((c, ci) => xmlTc(larguras[ci], c.titulo, { bold: true, size: 22, color: NAVY_TITLE, shade: GRAY_BG })),
        { header: true },
      );
      const dataRows = barrasLaje.map((r, ri) =>
        xmlTrow(
          cols.map((c, ci) =>
            xmlTc(larguras[ci], c.val(r), {
              align: c.align,
              bold: c.bold,
              size: 22,
              shade: ri % 2 === 1 ? ROW_ALT : undefined,
            }),
          ),
        ),
      );

      blocosElementos.push(xmlTbl(larguras, [headerRow, ...dataRows], { borders: 'navy', marTop: 18, marBottom: 18, marLeft: 34, marRight: 34 }));
    }

    // Espaçamento após cada elemento (quando não há quebra de página forçada)
    blocosElementos.push(xmlPara('', { before: 40, after: 40, line: 100 }));
  });

  // ── Seção 5: Resumo Executivo e Conclusão (opcional) ─────────
  const resumoGlobal = gerarResumoExecutivoAutomatico(payload.amostras);
  const conclusaoInformada = (payload.conclusao ?? '').trim();
  const temConclusao = Boolean(payload.usaConclusao || conclusaoInformada);
  const tabResumoGlobalNum = temConclusao ? String(tabNum + 1) : '';
  const conclusaoFinal = conclusaoInformada || resumoGlobal.textoPadrao;

  const rltOficial = payload.rltOficial?.trim() || formatarRlt(cab.rlt || '');
  const motivacaoTexto = (payload.motivacao ?? '').trim();
  const notasTexto = (cab.notas ?? '').trim();

  const dados: Record<string, unknown> = {
    nome_ensaio: 'PACOMETRIA',
    num_rlt: rltOficial,
    cliente: cab.cliente?.trim() || '—',
    obra: cab.obra?.trim() || '—',
    obra_intro: toTitleCase(cab.obra?.trim() || '') || '—',
    att: cab.att?.trim() || '—',
    endereco: cab.endereco?.trim() || '—',
    endereco_intro: toTitleCase(cab.endereco?.trim() || '') || '—',
    data_emissao: cab.data?.trim() || '—',
    total_elementos: String(payload.amostras.length),
    temMotivacao: Boolean(payload.usaMotivacao && motivacaoTexto),
    motivacao: motivacaoTexto,
    temMapa,
    mapa_img: mapaMarcador,
    figMapaNum,
    temFotoGeral,
    foto_geral_img: fotoGeralMarcador,
    figFotoGeralNum,
    temCroquis: croquisLista.length > 0,
    croquis: croquisLista,
    resumo,
    temConclusao,
    tabResumoGlobalNum,
    resumoTiposGlobal: resumoGlobal.resumoTiposGlobal,
    totalLeiturasGlobal: resumoGlobal.totalLeiturasGlobal,
    cobMedioGlobal: resumoGlobal.cobMedioGlobal,
    faixaGlobal: resumoGlobal.faixaGlobal,
    conclusao: conclusaoFinal,
    notas: notasTexto,
    resp_nome: payload.respNome?.trim() || '—',
    resp_crea: payload.respCrea?.trim() || '—',
  };

  return {
    dados,
    blocoElementosXml: blocosElementos.join(''),
    imagens,
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Substitui o parágrafo marcador `BLOCO_ELEMENTOS_PAC_END` pelo XML dinâmico dos elementos
 * da Seção 4 (paginação por elemento, esquema+foto integrados, perfis por face e tabelas compactadas).
 */
export function injetarBlocoElementosPacometria(zip: PizZip, blocoElementosXml: string): void {
  const docFile = zip.file('word/document.xml');
  if (!docFile) return;
  const xml = docFile.asText();
  const re = /<w:p\b[^>]*>(?:(?!<\/w:p>).)*?BLOCO_ELEMENTOS_PAC_END(?:(?!<\/w:p>).)*?<\/w:p>/;
  if (re.test(xml)) {
    zip.file('word/document.xml', xml.replace(re, () => blocoElementosXml));
  } else {
    console.warn('[pacometria docx] marcador BLOCO_ELEMENTOS_PAC_END não encontrado no documento.');
  }
}

/**
 * Injeta todas as imagens de pacometria (mapa, foto geral, croquis, esquemas, fotos e perfis)
 * substituindo `<w:t>MARCADOR</w:t>` por `<w:drawing>` inline proporcional.
 * rId e docPrId começam em 2000 para não colidir com rId13 (João) nem rId901 (assinatura dinâmica).
 */
export function injetarImagensPacometria(zip: PizZip, imagens: ImagemPacometriaInjetar[]): void {
  const docFile = zip.file('word/document.xml');
  if (!docFile || imagens.length === 0) return;
  let xml = docFile.asText();

  imagens.forEach((img, i) => {
    const id = 2000 + i;
    const rId = `rId${id}`;

    const maxCx = cmParaEmu(img.maxLarguraCm);
    const maxCy = cmParaEmu(img.maxAlturaCm);
    const escala = Math.min(maxCx / img.width, maxCy / img.height);
    const cx = Math.round(img.width * escala);
    const cy = Math.round(img.height * escala);

    registrarImagem(zip, img.buffer, img.contentType, `pacometria_img_${i + 1}`, rId);
    const drawing = buildDrawingXml(rId, id, `PacometriaImg${i + 1}`, cx, cy);

    const re = new RegExp(`<w:t(?:\\s[^>]*)?>${escapeRegex(img.marcador)}</w:t>`);
    if (re.test(xml)) {
      xml = xml.replace(re, () => drawing);
    } else {
      console.warn(`[pacometria docx] marcador ${img.marcador} não encontrado no documento.`);
    }
  });

  zip.file('word/document.xml', xml);
}
