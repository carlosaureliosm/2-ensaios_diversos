// scripts/build-modelo-aderencia.js
//
// Monta public/modelo_aderencia.docx a partir do modelo_esclerometria.docx,
// replicando fielmente o layout visual da aba "RAAC - SITUAÇÕES" da planilha oficial:
//   - Header com logo TECOMAT à esquerda e título + nº RLT à direita
//   - Footer com revisão "RAAC - REV. 09 (02-01-26)", endereço da TECOMAT e paginação X/Y
//   - Página 1 compacta (cabeçalho do cliente, quadro de normas com caixinhas, barra cinza,
//     1. Objetivo, 2. Equipamentos Utilizados, 3. Observações com Tabelas 01 e 02 mescladas)
//   - Capítulo 4 (Sistema de Revestimento): todas as situações primeiro (1 por página), com
//     rótulo ESQUEMA girado 90°, desenho + legenda de camadas coloridas + observações, e
//     tabela RESULTADO DO ENSAIO com 10 subcolunas verticais fixas de Forma de Ruptura,
//     destaque vermelho para Ra < 0,30 MPa e rodapé bipartido (Média/DP/CV + Umidade/Espessura).
//   - Capítulo 5 (Anexo - Sistema de Revestimento (Imagens)): no final do relatório, exibindo
//     1 ou 2 fotos por CP conforme anexadas no site, em grade 2 colunas com moldura e legenda
//     abaixo de cada foto contendo o nº e o nome do ponto da amostra, seguido do quadro NOTAS + Assinatura.

const path = require('path');
const PizZip = require(path.join(__dirname, '..', 'node_modules', 'pizzip'));
const fs = require('fs');

const BASE_DOCX = path.join(__dirname, '..', 'public', 'modelo_esclerometria.docx');
const OUT_DOCX = path.join(__dirname, '..', 'public', 'modelo_aderencia.docx');

const BLACK = '000000';
const RED = 'C00000';
const GRAY_BG = 'D9D9D9';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Runs / parágrafos ─────────────────────────────────────────
function rpr({ bold, color = BLACK, size = 16, italic, vertAlign } = {}) {
  let x = '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>';
  if (bold) x += '<w:b/><w:bCs/>';
  if (italic) x += '<w:i/><w:iCs/>';
  if (color) x += `<w:color w:val="${color}"/>`;
  if (size) x += `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`;
  if (vertAlign) x += `<w:vertAlign w:val="${vertAlign}"/>`;
  x += '<w:lang w:eastAsia="pt-BR"/></w:rPr>';
  return x;
}

function run(text, opts = {}) {
  return `<w:r>${rpr(opts)}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

function para(content, { jc, spacingBefore = 0, spacingAfter = 0, line = 220, indentLeft, pageBreakBefore, keepNext } = {}) {
  const runs = Array.isArray(content) ? content.join('') : (content || '');
  let ppr = '<w:pPr>';
  if (pageBreakBefore) ppr += '<w:pageBreakBefore/>';
  if (keepNext) ppr += '<w:keepNext/>';
  ppr += `<w:spacing w:before="${spacingBefore}" w:after="${spacingAfter}" w:line="${line}" w:lineRule="auto"/>`;
  if (indentLeft) ppr += `<w:ind w:left="${indentLeft}"/>`;
  if (jc) ppr += `<w:jc w:val="${jc}"/>`;
  ppr += '</w:pPr>';
  return `<w:p>${ppr}${runs}</w:p>`;
}

// ── Bordas e Células de Tabela ────────────────────────────────
function bdr(val = 'single', sz = 4, color = BLACK) {
  if (val === 'none' || !val) return '<w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>';
  return `w:val="${val}" w:sz="${sz}" w:space="0" w:color="${color}"`;
}

function tcBorders({ top, bottom, left, right } = {}) {
  let x = '<w:tcBorders>';
  if (top !== undefined) x += top ? `<w:top ${top}/>` : '<w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>';
  if (left !== undefined) x += left ? `<w:left ${left}/>` : '<w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>';
  if (bottom !== undefined) x += bottom ? `<w:bottom ${bottom}/>` : '<w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>';
  if (right !== undefined) x += right ? `<w:right ${right}/>` : '<w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>';
  x += '</w:tcBorders>';
  return x;
}

const B_THIN = bdr('single', 4, BLACK);
const B_MED = bdr('single', 8, BLACK);
const B_DOUBLE = bdr('double', 4, BLACK);
const B_NONE = null;

function tc(pctWidth, content, {
  align = 'center',
  vAlign = 'center',
  shade,
  gridSpan,
  vMerge, // 'restart' | 'continue'
  textDirection, // 'btLr'
  borders,
  margins,
  bold = false,
  italic = false,
  size = 15,
  color = BLACK,
} = {}) {
  let tcPr = `<w:tcPr><w:tcW w:w="${pctWidth}" w:type="pct"/>`;
  if (gridSpan && gridSpan > 1) tcPr += `<w:gridSpan w:val="${gridSpan}"/>`;
  if (vMerge === 'restart') tcPr += '<w:vMerge w:val="restart"/>';
  else if (vMerge === 'continue') tcPr += '<w:vMerge/>';
  if (borders) tcPr += tcBorders(borders);
  if (shade) tcPr += `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>`;
  if (textDirection) tcPr += `<w:textDirection w:val="${textDirection}"/>`;
  if (margins) {
    tcPr += `<w:tcMar><w:top w:w="${margins.top ?? 20}" w:type="dxa"/><w:left w:w="${margins.left ?? 40}" w:type="dxa"/><w:bottom w:w="${margins.bottom ?? 20}" w:type="dxa"/><w:right w:w="${margins.right ?? 40}" w:type="dxa"/></w:tcMar>`;
  }
  tcPr += `<w:vAlign w:val="${vAlign}"/></w:tcPr>`;

  if (vMerge === 'continue' && !content) {
    return `<w:tc>${tcPr}<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="200" w:lineRule="auto"/></w:pPr></w:p></w:tc>`;
  }

  let inner;
  if (Array.isArray(content)) {
    inner = content.join('');
  } else if (typeof content === 'string' && /^<w:(r|p|tbl)[ >]/.test(content)) {
    inner = content;
  } else {
    inner = run(String(content ?? ''), { bold, italic, size, color });
  }

  const wrapInPara = !/^<w:(p|tbl)[ >]/.test(inner);
  const body = wrapInPara
    ? para(inner, { jc: align, spacingBefore: 10, spacingAfter: 10, line: 200 })
    : inner;
  return `<w:tc>${tcPr}${body}</w:tc>`;
}

function trow(cells, { height, header, cantSplit = true } = {}) {
  let trPr = '<w:trPr>';
  if (cantSplit) trPr += '<w:cantSplit/>';
  if (header) trPr += '<w:tblHeader/>';
  if (height) trPr += `<w:trHeight w:val="${height}" w:hRule="atLeast"/>`;
  trPr += '<w:jc w:val="center"/></w:trPr>';
  const cellsXml = Array.isArray(cells) ? cells.join('') : cells;
  return `<w:tr>${trPr}${cellsXml}</w:tr>`;
}

function tbl(colWidths, rowsXml, { borders = 'box', cellMarginTop = 18, cellMarginBottom = 18, cellMarginLeft = 45, cellMarginRight = 45 } = {}) {
  const grid = colWidths.map(w => `<w:gridCol w:w="${w}"/>`).join('');
  let tblBorders = '<w:tblBorders>';
  if (borders === 'none') {
    tblBorders += '<w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>';
  } else if (borders === 'grid') {
    tblBorders += `<w:top ${B_THIN}/><w:left ${B_THIN}/><w:bottom ${B_THIN}/><w:right ${B_THIN}/><w:insideH ${B_THIN}/><w:insideV ${B_THIN}/>`;
  } else if (borders === 'outer') {
    tblBorders += `<w:top ${B_MED}/><w:left ${B_MED}/><w:bottom ${B_MED}/><w:right ${B_MED}/><w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>`;
  } else {
    tblBorders += `<w:top ${B_MED}/><w:left ${B_MED}/><w:bottom ${B_MED}/><w:right ${B_MED}/><w:insideH ${B_THIN}/><w:insideV ${B_THIN}/>`;
  }
  tblBorders += '</w:tblBorders>';
  const tblCellMar = `<w:tblCellMar><w:top w:w="${cellMarginTop}" w:type="dxa"/><w:left w:w="${cellMarginLeft}" w:type="dxa"/><w:bottom w:w="${cellMarginBottom}" w:type="dxa"/><w:right w:w="${cellMarginRight}" w:type="dxa"/></w:tblCellMar>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:jc w:val="center"/>${tblBorders}${tblCellMar}</w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rowsXml.join('')}</w:tbl>`;
}

// ══════════════════════════════════════════════════════════════
// 1. PÁGINA 1 — CABEÇALHO DO CLIENTE + NORMAS + SEÇÕES 1, 2, 3
// ══════════════════════════════════════════════════════════════
const parts = [];

// 1.1 Identificação (CLIENTE / OBRA / CONSTRUTORA + DATA / ENDEREÇO)
const idCols = [650, 2450, 950, 950];
const bRowLine = { top: B_THIN, bottom: B_THIN, left: B_NONE, right: B_NONE };
parts.push(tbl(idCols, [
  trow([
    tc(idCols[0], 'CLIENTE:', { bold: true, align: 'left', size: 16, borders: bRowLine }),
    tc(idCols[1] + idCols[2] + idCols[3], '[[cliente]]', { align: 'left', size: 16, gridSpan: 3, borders: bRowLine }),
  ]),
  trow([
    tc(idCols[0], 'OBRA:', { bold: true, align: 'left', size: 16, borders: bRowLine }),
    tc(idCols[1] + idCols[2] + idCols[3], '[[obra]]', { align: 'left', size: 16, gridSpan: 3, borders: bRowLine }),
  ]),
  trow([
    tc(idCols[0], 'CONSTRUTORA:', { bold: true, align: 'left', size: 16, borders: bRowLine }),
    tc(idCols[1], '[[construtora]]', { align: 'left', size: 16, borders: bRowLine }),
    tc(idCols[2], 'DATA DE EMISSÃO:', { bold: true, align: 'right', size: 16, borders: bRowLine }),
    tc(idCols[3], '[[data_emissao]]', { align: 'center', size: 16, borders: bRowLine }),
  ]),
  trow([
    tc(idCols[0], 'ENDEREÇO:', { bold: true, align: 'left', size: 16, borders: bRowLine }),
    tc(idCols[1] + idCols[2] + idCols[3], '[[endereco]]', { align: 'left', size: 16, gridSpan: 3, borders: bRowLine }),
  ]),
], { borders: 'none', cellMarginTop: 14, cellMarginBottom: 14 }));

parts.push(para('', { spacingBefore: 20, spacingAfter: 20, line: 80 }));

// 1.2 Bloco NORMA(S) DE REFERÊNCIA (rótulo à esquerda + checkboxes à direita)
function chkRuns(campo) {
  return [
    run('[[#' + campo + ']]☒[[/' + campo + ']]', { bold: true, size: 18 }),
    run('[[^' + campo + ']]☐[[/' + campo + ']]', { size: 18 }),
  ];
}

function normaRow(firstRow, campo, texto) {
  const leftCell = firstRow
    ? tc(1050, [
        para(run('NORMA(S) DE REFERÊNCIA:', { bold: true, size: 15 }), { jc: 'center', spacingAfter: 20 }),
        para(run('(Marcar a Norma Utilizada)', { size: 14 }), { jc: 'center' }),
      ], { vMerge: 'restart', vAlign: 'center' })
    : tc(1050, '', { vMerge: 'continue' });
  return trow([
    leftCell,
    tc(170, chkRuns(campo), { align: 'center', vAlign: 'top' }),
    tc(3780, texto, { align: 'left', vAlign: 'center', size: 15 }),
  ]);
}

const normasCols = [1050, 170, 3780];
parts.push(tbl(normasCols, [
  normaRow(true, 'nbr135281', 'NBR 13528-1:2019 – Revestimento de paredes de argamassas inorgânicas – Determinação da resistência de aderência à tração – parte 1: Requisitos gerais'),
  trow([
    tc(1050, '', { vMerge: 'continue' }),
    tc(170, ''),
    tc(3780, [
      para([
        run('        '),
        ...chkRuns('parte2'),
        run(' Parte 2 – Aderência ao substrato          ', { size: 15 }),
        ...chkRuns('parte3'),
        run(' Parte 3 – Aderência superficial', { size: 15 }),
      ], { jc: 'left' }),
    ], { align: 'left' }),
  ]),
  normaRow(false, 'nbr13749', 'NBR 13749:2013 – Revestimento de paredes e tetos de argamassas inorgânicas – Especificação'),
  normaRow(false, 'nbr13753', 'NBR 13753:1996 – Revestimento de piso interno ou externo com placas cerâmicas e com utilização de argamassa colante - Procedimento - Anexo A – Determinação da resistência de aderência de revestimentos cerâmicos assentados com argamassa colante'),
  normaRow(false, 'nbr13754', 'NBR 13754:1996 – Revestimento de paredes internas com placas cerâmicas e com utilização de argamassa colante - Procedimento - Anexo A – Determinação da resistência de aderência de revestimentos cerâmicos assentados com argamassa colante'),
  normaRow(false, 'nbr13755', 'NBR 13755:2017 – Revestimento cerâmico de fachadas e paredes externas com utilização de argamassa colante – Projeto, execução, inspeção e aceitação – Procedimento'),
], { borders: 'none', cellMarginTop: 10, cellMarginBottom: 10 }));

parts.push(para('', { spacingBefore: 30, spacingAfter: 30, line: 100 }));

// 1.3 Quadro Principal da Página 1 (Objetivo + Equipamentos + Observações + Tabelas 01 e 02)
const t1cols = [500, 650, 2950, 900];
const bHeaderDouble = { top: B_THIN, bottom: B_DOUBLE, left: B_THIN, right: B_THIN };
const tabela01Xml = tbl(t1cols, [
  trow([
    tc(1150, 'LOCAL', { bold: true, size: 15, gridSpan: 2, borders: bHeaderDouble }),
    tc(2950, 'ACABAMENTO', { bold: true, size: 15, borders: bHeaderDouble }),
    tc(900, 'Ra (MPa)', { bold: true, size: 15, borders: bHeaderDouble }),
  ], { header: true }),
  trow([
    tc(500, 'PAREDE', { size: 15, vMerge: 'restart' }),
    tc(650, 'INTERNA', { size: 15, vMerge: 'restart' }),
    tc(2950, 'PINTURA OU BASE PARA REBOCO', { align: 'left', size: 15 }),
    tc(900, '≥ 0,20', { size: 15 }),
  ]),
  trow([
    tc(500, '', { vMerge: 'continue' }),
    tc(650, '', { vMerge: 'continue' }),
    tc(2950, 'CERÂMICA OU LAMINADO', { align: 'left', size: 15 }),
    tc(900, '≥ 0,30', { size: 15 }),
  ]),
  trow([
    tc(500, '', { vMerge: 'continue' }),
    tc(650, 'EXTERNA', { size: 15, vMerge: 'restart' }),
    tc(2950, 'PINTURA OU BASE PARA REBOCO', { align: 'left', size: 15 }),
    tc(900, '≥ 0,30', { size: 15 }),
  ]),
  trow([
    tc(500, '', { vMerge: 'continue' }),
    tc(650, '', { vMerge: 'continue' }),
    tc(2950, 'CERÂMICA', { align: 'left', size: 15 }),
    tc(900, '≥ 0,30', { size: 15 }),
  ]),
  trow([
    tc(1150, 'TETO', { size: 15, gridSpan: 2 }),
    tc(2950, '--', { align: 'left', size: 15 }),
    tc(900, '≥ 0,20', { size: 15 }),
  ]),
  trow([
    tc(1150, 'PISO (INTERNO/EXTERNO)', { size: 15, gridSpan: 2 }),
    tc(2950, 'CERÂMICA', { align: 'left', size: 15 }),
    tc(900, '≥ 0,30', { size: 15 }),
  ]),
], { borders: 'grid', cellMarginTop: 14, cellMarginBottom: 14 });

const t2cols = [1250, 1050, 1450, 1250];
const tabela02Xml = tbl(t2cols, [
  trow([
    tc(1250, 'ENSAIO', { bold: true, size: 15, borders: bHeaderDouble }),
    tc(1050, 'AMOSTRAGEM MÍNIMA', { bold: true, size: 15, borders: bHeaderDouble }),
    tc(1450, 'RESULTADO DO ENSAIO (MPa)', { bold: true, size: 15, borders: bHeaderDouble }),
    tc(1250, 'COMENTÁRIOS', { bold: true, size: 15, borders: bHeaderDouble }),
  ], { header: true }),
  trow([
    tc(1250, 'RESISTÊNCIA SUPERFICIAL', { size: 14, vMerge: 'restart' }),
    tc(1050, '12 CP A CADA 2.000 m²', { size: 14, vMerge: 'restart' }),
    tc(1450, 'PELO MENOS OITO CP ≥ 0,5', { size: 14 }),
    tc(1250, 'APROVADO', { size: 14 }),
  ]),
  trow([
    tc(1250, '', { vMerge: 'continue' }),
    tc(1050, '', { vMerge: 'continue' }),
    tc(1450, '0,3 ≤ OITO CP < 0,5', { size: 14 }),
    tc(1250, 'CONSULTAR RESPONSÁVEL PELO PROJETO', { size: 13 }),
  ]),
  trow([
    tc(1250, '', { vMerge: 'continue' }),
    tc(1050, '', { vMerge: 'continue' }),
    tc(1450, 'MENOS DE OITO CP ≥ 0,3', { size: 14 }),
    tc(1250, 'REPROVADO', { size: 14 }),
  ]),
  trow([
    tc(1250, 'ADERÊNCIA DAS PLACAS AO EMBOÇO', { size: 14, vMerge: 'restart' }),
    tc(1050, '12 CP A CADA 2.000 m²', { size: 14, vMerge: 'restart' }),
    tc(1450, 'PELO MENOS OITO CP ≥ 0,5', { size: 14 }),
    tc(1250, 'APROVADO', { size: 14 }),
  ]),
  trow([
    tc(1250, '', { vMerge: 'continue' }),
    tc(1050, '', { vMerge: 'continue' }),
    tc(1450, '0,3 ≤ OITO CP < 0,5', { size: 14 }),
    tc(1250, 'CONSULTAR RESPONSÁVEL PELO PROJETO', { size: 13 }),
  ]),
  trow([
    tc(1250, '', { vMerge: 'continue' }),
    tc(1050, '', { vMerge: 'continue' }),
    tc(1450, 'MENOS DE OITO CP ≥ 0,3', { size: 14 }),
    tc(1250, 'REPROVADO', { size: 14 }),
  ]),
], { borders: 'grid', cellMarginTop: 14, cellMarginBottom: 14 });

const quadroPag1Body = [
  para(run('1. OBJETIVO', { bold: true, size: 16 }), { spacingBefore: 40, spacingAfter: 40 }),
  para(run('Determinação da resistência de aderência à tração de revestimentos cerâmicos assentados com argamassa colante e de revestimento de argamassa aplicadas sobre substratos inorgânicos não metálicos.', { size: 16 }), { jc: 'both', indentLeft: 140, spacingAfter: 80 }),
  para(run('2. EQUIPAMENTOS UTILIZADOS', { bold: true, size: 16 }), { spacingBefore: 40, spacingAfter: 40 }),
  para(run('Ensaio realizado com Transdutor de força marca Alfa Instrumentos, modelo Z2T, faixa nominal de 2000 kgf; e instrumentação eletrônica associada digital marca Alfa Instrumentos, modelo 3105C, faixa nominal de cinco dígitos e 1 ponto.', { size: 16 }), { jc: 'both', indentLeft: 140, spacingAfter: 40 }),
  para(run('Equipamentos de corte utilizados furadeira de impacto marca Bosch para corte, modelo GSB-13RE acoplada a uma serra copo de 53 mm de diâmetro interno, ou serra maquita marca Bosch, modelo GDC-14 com disco diamantado de 100 mm.', { size: 16 }), { jc: 'both', indentLeft: 140, spacingAfter: 80 }),
  para(run('3. OBSERVAÇÕES', { bold: true, size: 16 }), { spacingBefore: 40, spacingAfter: 40 }),
  para(run('TABELA 01 - LIMITES DE RESISTÊNCIA DE ADERÊNCIA À TRAÇÃO (Ra) PARA EMBOÇO E CAMADA ÚMIDA CONFORME NBR 13749:2013 E PISO CONFORME NBR 13753:1996', { bold: true, italic: true, size: 14 }), { spacingBefore: 20, spacingAfter: 30, indentLeft: 80 }),
  tabela01Xml,
  para(run('O pano estudado deve ser composto por 12 (doze) corpos de prova.', { size: 15 }), { spacingBefore: 40, indentLeft: 80 }),
  para(run('Para aprovação do pano 2/3 dos corpos de prova devem apresentar resultados iguais ou superiores ao estabelecido na Tabela 01.', { size: 15 }), { spacingAfter: 80, indentLeft: 80 }),
  para(run('TABELA 02 – REQUISITOS E CRITÉRIOS DE ACEITAÇÃO DO SISTEMA DE REVESTIMENTO CONFORME NBR 13755:2017', { bold: true, italic: true, size: 14 }), { spacingBefore: 40, spacingAfter: 30, indentLeft: 80 }),
  tabela02Xml,
  para(run('NOTA: PARA REALIZAÇÃO DO ENSAIO DE RESISTÊNCIA DE ADERÊNCIA À TRAÇÃO, O CORTE ATINGE UMA PROFUNDIDADE DE ATÉ 40mm, PODENDO ATINGIR O SUBSTRATO.', { size: 15 }), { spacingBefore: 80, spacingAfter: 60, indentLeft: 80 }),
];

parts.push(tbl([5000], [
  trow([
    tc(5000, 'ENSAIO DE RESISTÊNCIA DE ADERÊNCIA À TRAÇÃO EM REVESTIMENTO', {
      bold: true, size: 17, shade: GRAY_BG,
      borders: { top: B_MED, bottom: B_DOUBLE, left: B_MED, right: B_MED },
    }),
  ]),
  trow([
    tc(5000, quadroPag1Body, {
      align: 'left', vAlign: 'top',
      borders: { top: B_DOUBLE, bottom: B_MED, left: B_MED, right: B_MED },
      margins: { top: 60, bottom: 60, left: 90, right: 90 },
    }),
  ]),
], { borders: 'outer' }));

// ══════════════════════════════════════════════════════════════
// 2. CAPÍTULO 4 — TODAS AS SITUAÇÕES (FICHAS + RESULTADOS)
// ══════════════════════════════════════════════════════════════
parts.push(para(run('[[#situacoes]]', { size: 2 }), { spacingBefore: 0, spacingAfter: 0, line: 20 }));
parts.push(para('', { pageBreakBefore: true, spacingBefore: 0, spacingAfter: 0, line: 20 }));

// 2.1 Quadro Superior da Situação (Título + Campos + Faixa Tripla + Esquema/Legenda/Observações + Faixa RESULTADO DO ENSAIO)
// Usamos uma grade única de 6 colunas para o quadro superior: [220, 880, 1600, 300, 1000, 1000] = 5000
const sitTopCols = [220, 880, 1600, 300, 1000, 1000];

function sitCampoRow(label1, campo1, label2, campo2) {
  return trow([
    tc(1100, label1, { bold: true, align: 'left', size: 15, gridSpan: 2, borders: { top: B_NONE, bottom: B_THIN, left: B_MED, right: B_NONE } }),
    tc(1900, '[[' + campo1 + ']]', { align: 'left', size: 15, gridSpan: 2, borders: { top: B_NONE, bottom: B_THIN, left: B_NONE, right: B_NONE } }),
    tc(1000, label2, { bold: true, align: 'left', size: 15, borders: { top: B_NONE, bottom: B_THIN, left: B_NONE, right: B_NONE } }),
    tc(1000, '[[' + campo2 + ']]', { align: 'center', size: 15, borders: { top: B_NONE, bottom: B_THIN, left: B_NONE, right: B_MED } }),
  ]);
}

const legendaParas = [
  para(run('[[#legendaCamadas]]', { size: 2 }), { jc: 'left', line: 40 }),
  para([
    run('[[quadradoCor]]', { size: 14 }),
    run(' [[nome]]', { bold: true, size: 13 }),
  ], { jc: 'left', spacingBefore: 16, spacingAfter: 16, line: 200 }),
  para(run('[[/legendaCamadas]]', { size: 2 }), { jc: 'left', line: 40 }),
];

const obsParas = [
  para(run('OBSERVAÇÕES:', { bold: true, size: 15 }), { jc: 'center', spacingAfter: 40 }),
  para(run('[[observacoesEsquema]]', { size: 15 }), { jc: 'left' }),
];

const sitTopRows = [
  // Título da situação (4. SISTEMA DE REVESTIMENTO / 4.X SITUAÇÃO I)
  trow([
    tc(5000, [
      para(run('4. SISTEMA DE REVESTIMENTO', { bold: true, size: 16 }), { jc: 'left', spacingAfter: 20 }),
      para(run('4.[[numSit]] SITUAÇÃO [[numeroRomano]] — Situação [[numeroRomano]]', { bold: true, size: 15 }), { jc: 'left' }),
    ], {
      align: 'left', gridSpan: 6,
      borders: { top: B_MED, bottom: B_THIN, left: B_MED, right: B_MED },
    }),
  ]),
  sitCampoRow('TIPO DE REVESTIMENTO:', 'tipoRevestimento', 'DATA DO ENSAIO:', 'dataEnsaio'),
  sitCampoRow('Nº DE CORPOS DE PROVA:', 'numCPs', 'DATA DE APLICAÇÃO:', 'dataAplicacao'),
  sitCampoRow('SUBSTRATO:', 'substrato', 'IDADE DE RUPTURA (DIAS):', 'idadeRupturaDias'),
  sitCampoRow('CHAPISCO:', 'chapisco', 'TRAÇO:', 'chapiscoTraco'),
  sitCampoRow('EMBOÇO:', 'emboco', 'TRAÇO:', 'embocoTraco'),
  // Faixa tripla: ARGAMASSA COLANTE | REVESTIMENTO | DIMENSÕES (cm)
  trow([
    tc(2700, 'ARGAMASSA COLANTE', { bold: true, size: 15, gridSpan: 3, borders: { top: B_DOUBLE, bottom: B_THIN, left: B_MED, right: B_THIN } }),
    tc(1300, 'REVESTIMENTO', { bold: true, size: 15, gridSpan: 2, borders: { top: B_DOUBLE, bottom: B_THIN, left: B_THIN, right: B_THIN } }),
    tc(1000, 'DIMENSÕES (cm)', { bold: true, size: 15, borders: { top: B_DOUBLE, bottom: B_THIN, left: B_THIN, right: B_MED } }),
  ]),
  trow([
    tc(2700, '[[argamassaColante]]', { size: 15, gridSpan: 3, borders: { top: B_THIN, bottom: B_DOUBLE, left: B_MED, right: B_THIN } }),
    tc(1300, '[[revestimento]]', { size: 15, gridSpan: 2, borders: { top: B_THIN, bottom: B_DOUBLE, left: B_THIN, right: B_THIN } }),
    tc(1000, '[[dimensoesCm]]', { size: 15, borders: { top: B_THIN, bottom: B_DOUBLE, left: B_THIN, right: B_MED } }),
  ]),
  // Quadro ESQUEMA (vertical) + Desenho + Legenda de Camadas + Observações
  trow([
    tc(220, 'ESQUEMA', {
      bold: true, size: 15, textDirection: 'btLr',
      borders: { top: B_DOUBLE, bottom: B_DOUBLE, left: B_MED, right: B_THIN },
    }),
    tc(1500, run('[[esquemaImagem]]'), {
      align: 'center', vAlign: 'center', gridSpan: 1,
      borders: { top: B_DOUBLE, bottom: B_DOUBLE, left: B_THIN, right: B_NONE },
    }),
    tc(1280, legendaParas, {
      align: 'left', vAlign: 'center', gridSpan: 2,
      borders: { top: B_DOUBLE, bottom: B_DOUBLE, left: B_NONE, right: B_THIN },
    }),
    tc(2000, obsParas, {
      align: 'left', vAlign: 'top', gridSpan: 2,
      borders: { top: B_DOUBLE, bottom: B_DOUBLE, left: B_THIN, right: B_MED },
    }),
  ], { height: 1500 }),
  // Faixa RESULTADO DO ENSAIO
  trow([
    tc(5000, 'RESULTADO DO ENSAIO', {
      bold: true, size: 16, gridSpan: 6,
      borders: { top: B_DOUBLE, bottom: B_DOUBLE, left: B_MED, right: B_MED },
    }),
  ]),
];

// Na linha do Esquema acima, precisamos que as larguras batam com sitTopCols = [220, 880, 1600, 300, 1000, 1000]:
// Col 1 = 220 (gridSpan 1)
// Col 2+3 = 880 + 1600 = 2480 -> vamos ajustar sitTopCols para [220, 1480, 1000, 300, 1000, 1000] = 5000!
sitTopCols[1] = 1480;
sitTopCols[2] = 1000;
// Assim:
// - Em sitCampoRow: gridSpan 2 = 220+1480 = 1700 (mas 1100 era melhor).
// Vamos usar sitTopCols = [220, 880, 500, 1100, 1300, 1000] (soma = 5000):
// - sitCampoRow:
//   - label1: cols 1..2 (gridSpan 2, w=1100)
//   - campo1: cols 3..4 (gridSpan 2, w=1600)
//   - label2: col 5 (gridSpan 1, w=1300)
//   - campo2: col 6 (gridSpan 1, w=1000)
// - Faixa tripla:
//   - ARGAMASSA COLANTE: cols 1..3 (gridSpan 3, w=1600)
//   - REVESTIMENTO: cols 4..5 (gridSpan 2, w=2400) -> ou cols 1..4 (2700), col 5 (1300), col 6 (1000)!
// - Linha ESQUEMA:
//   - ESQUEMA vertical: col 1 (gridSpan 1, w=220)
//   - Desenho [[esquemaImagem]]: cols 2..3 (gridSpan 2, w=1380)
//   - Legenda [[#legendaCamadas]]: col 4 (gridSpan 1, w=1100)
//   - Observações: cols 5..6 (gridSpan 2, w=2300)
const sitGrid = [220, 880, 500, 1100, 1300, 1000];
function sitCampoRowAligned(label1, campo1, label2, campo2) {
  return trow([
    tc(1100, label1, { bold: true, align: 'left', size: 15, gridSpan: 2, borders: { top: B_NONE, bottom: B_THIN, left: B_MED, right: B_NONE } }),
    tc(1600, '[[' + campo1 + ']]', { align: 'left', size: 15, gridSpan: 2, borders: { top: B_NONE, bottom: B_THIN, left: B_NONE, right: B_NONE } }),
    tc(1300, label2, { bold: true, align: 'left', size: 15, borders: { top: B_NONE, bottom: B_THIN, left: B_NONE, right: B_NONE } }),
    tc(1000, '[[' + campo2 + ']]', { align: 'center', size: 15, borders: { top: B_NONE, bottom: B_THIN, left: B_NONE, right: B_MED } }),
  ]);
}

const sitTopRowsAligned = [
  trow([
    tc(5000, [
      para(run('4. SISTEMA DE REVESTIMENTO', { bold: true, size: 16 }), { jc: 'left', spacingAfter: 15 }),
      para(run('4.[[numSit]] SITUAÇÃO [[numeroRomano]]', { bold: true, size: 15 }), { jc: 'left' }),
    ], {
      align: 'left', gridSpan: 6,
      borders: { top: B_MED, bottom: B_THIN, left: B_MED, right: B_MED },
    }),
  ]),
  sitCampoRowAligned('TIPO DE REVESTIMENTO:', 'tipoRevestimento', 'DATA DO ENSAIO:', 'dataEnsaio'),
  sitCampoRowAligned('Nº DE CORPOS DE PROVA:', 'numCPs', 'DATA DE APLICAÇÃO:', 'dataAplicacao'),
  sitCampoRowAligned('SUBSTRATO:', 'substrato', 'IDADE DE RUPTURA (DIAS):', 'idadeRupturaDias'),
  sitCampoRowAligned('CHAPISCO:', 'chapisco', 'TRAÇO:', 'chapiscoTraco'),
  sitCampoRowAligned('EMBOÇO:', 'emboco', 'TRAÇO:', 'embocoTraco'),
  trow([
    tc(2700, 'ARGAMASSA COLANTE', { bold: true, size: 15, gridSpan: 4, borders: { top: B_DOUBLE, bottom: B_THIN, left: B_MED, right: B_THIN } }),
    tc(1300, 'REVESTIMENTO', { bold: true, size: 15, borders: { top: B_DOUBLE, bottom: B_THIN, left: B_THIN, right: B_THIN } }),
    tc(1000, 'DIMENSÕES (cm)', { bold: true, size: 15, borders: { top: B_DOUBLE, bottom: B_THIN, left: B_THIN, right: B_MED } }),
  ]),
  trow([
    tc(2700, '[[argamassaColante]]', { size: 15, gridSpan: 4, borders: { top: B_THIN, bottom: B_DOUBLE, left: B_MED, right: B_THIN } }),
    tc(1300, '[[revestimento]]', { size: 15, borders: { top: B_THIN, bottom: B_DOUBLE, left: B_THIN, right: B_THIN } }),
    tc(1000, '[[dimensoesCm]]', { size: 15, borders: { top: B_THIN, bottom: B_DOUBLE, left: B_THIN, right: B_MED } }),
  ]),
  trow([
    tc(220, 'ESQUEMA', {
      bold: true, size: 15, textDirection: 'btLr',
      borders: { top: B_DOUBLE, bottom: B_DOUBLE, left: B_MED, right: B_THIN },
    }),
    tc(1380, run('[[esquemaImagem]]'), {
      align: 'center', vAlign: 'center', gridSpan: 2,
      borders: { top: B_DOUBLE, bottom: B_DOUBLE, left: B_THIN, right: B_NONE },
    }),
    tc(1100, legendaParas, {
      align: 'left', vAlign: 'center',
      borders: { top: B_DOUBLE, bottom: B_DOUBLE, left: B_NONE, right: B_THIN },
    }),
    tc(2300, obsParas, {
      align: 'left', vAlign: 'top', gridSpan: 2,
      borders: { top: B_DOUBLE, bottom: B_DOUBLE, left: B_THIN, right: B_MED },
    }),
  ], { height: 1500 }),
  trow([
    tc(5000, 'RESULTADO DO ENSAIO', {
      bold: true, size: 16, gridSpan: 6,
      borders: { top: B_DOUBLE, bottom: B_DOUBLE, left: B_MED, right: B_MED },
    }),
  ]),
];

parts.push(tbl(sitGrid, sitTopRowsAligned, { borders: 'outer', cellMarginTop: 14, cellMarginBottom: 14 }));

// 2.2 Tabela RESULTADO DO ENSAIO (18 colunas: 320 + 270 + 270 + 100 + 340 + 450 + 10*200 + 950 + 300 = 5000)
const resGrid = [320, 270, 270, 100, 340, 450, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 950, 300];
const IDX_COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const resHeaderRow1 = trow([
  tc(320, 'Nº DO CORPO DE PROVA', { bold: true, size: 13, vMerge: 'restart' }),
  tc(540, 'LOCAL DA BASE - (%)', { bold: true, size: 13, gridSpan: 2, vMerge: 'restart' }),
  tc(440, 'TENSÃO', { bold: true, size: 13, gridSpan: 2, borders: { top: B_THIN, bottom: B_NONE, left: B_THIN, right: B_THIN } }),
  tc(450, 'PROF. DE RUPTURA', { bold: true, size: 13, vMerge: 'restart' }),
  tc(2000, 'FORMA DE RUPTURA - (%)', { bold: true, size: 13, gridSpan: 10 }),
  tc(1250, 'LOCALIZAÇÃO', { bold: true, size: 14, gridSpan: 2, vMerge: 'restart' }),
], { header: true });

const resHeaderRow2 = trow([
  tc(320, '', { vMerge: 'continue' }),
  tc(540, '', { gridSpan: 2, vMerge: 'continue' }),
  tc(440, 'Ra', { bold: true, italic: true, size: 14, gridSpan: 2, borders: { top: B_NONE, bottom: B_NONE, left: B_THIN, right: B_THIN } }),
  tc(450, '', { vMerge: 'continue' }),
  ...IDX_COLS.map(k =>
    tc(200, `[[col${k}]]`, {
      size: 13, textDirection: 'btLr', vMerge: 'restart',
      borders: { top: B_THIN, bottom: B_DOUBLE, left: B_THIN, right: B_THIN },
    }),
  ),
  tc(1250, '', { gridSpan: 2, vMerge: 'continue' }),
], { header: true, height: 860 });

const resHeaderRow3 = trow([
  tc(320, '', { vMerge: 'continue', borders: { top: B_NONE, bottom: B_DOUBLE, left: B_MED, right: B_THIN } }),
  tc(270, 'BLOCO', { size: 12, borders: { top: B_THIN, bottom: B_DOUBLE, left: B_THIN, right: B_THIN } }),
  tc(270, 'JUNTA', { size: 12, borders: { top: B_THIN, bottom: B_DOUBLE, left: B_THIN, right: B_THIN } }),
  tc(440, '(MPa)', { size: 13, gridSpan: 2, borders: { top: B_NONE, bottom: B_DOUBLE, left: B_THIN, right: B_THIN } }),
  tc(450, '(mm)', { size: 13, borders: { top: B_NONE, bottom: B_DOUBLE, left: B_THIN, right: B_THIN } }),
  ...IDX_COLS.map(() =>
    tc(200, '', { vMerge: 'continue', borders: { top: B_NONE, bottom: B_DOUBLE, left: B_THIN, right: B_THIN } }),
  ),
  tc(1250, '', { gridSpan: 2, vMerge: 'continue', borders: { top: B_NONE, bottom: B_DOUBLE, left: B_THIN, right: B_MED } }),
], { header: true });

// Linha de dados por CP (com condicional de cor para Ra < 0,30 MPa em vermelho e >= 0,30 MPa em negrito preto)
const sinalRuns = [
  run('[[#raBaixo]]>[[/raBaixo]]', { color: RED, bold: true, size: 15 }),
  run('[[#raOk]]>[[/raOk]]', { color: BLACK, size: 15 }),
  run('[[#raVazio]]>[[/raVazio]]', { color: BLACK, size: 15 }),
];
const valorRaRuns = [
  run('[[#raBaixo]][[tensaoRa]][[/raBaixo]]', { color: RED, bold: true, size: 15 }),
  run('[[#raOk]][[tensaoRa]][[/raOk]]', { color: BLACK, bold: true, size: 15 }),
  run('[[#raVazio]][[tensaoRa]][[/raVazio]]', { color: BLACK, size: 15 }),
];

const resDataRow = trow([
  tc(320, [run('[[#corposDeProva]]', { size: 2 }), run('[[numero]]', { bold: true, size: 15 })]),
  tc(270, '[[bloco]]', { size: 15 }),
  tc(270, '[[junta]]', { size: 15 }),
  tc(100, sinalRuns, { align: 'center', borders: { top: B_THIN, bottom: B_THIN, left: B_THIN, right: B_NONE } }),
  tc(340, valorRaRuns, { align: 'center', borders: { top: B_THIN, bottom: B_THIN, left: B_NONE, right: B_THIN } }),
  tc(450, '[[profRuptura]]', { size: 15 }),
  ...IDX_COLS.map(k => tc(200, `[[v${k}]]`, { size: 14 })),
  tc(1250, [run('[[localizacao]]', { size: 14 }), run('[[/corposDeProva]]', { size: 2 })], { gridSpan: 2 }),
]);

// Rodapé da tabela: MÉDIA / DP [1] / CV [1] + Umidade Média / Espessura Média / Término
const bDoubleRow = { top: B_DOUBLE, bottom: B_DOUBLE, left: B_THIN, right: B_THIN };
const resMediaRow = trow([
  tc(320, 'MÉDIA', { bold: true, size: 13, borders: { ...bDoubleRow, left: B_MED } }),
  tc(270, '-', { size: 15, borders: bDoubleRow }),
  tc(270, '-', { size: 15, borders: bDoubleRow }),
  tc(440, '[[raMedia]]', { bold: true, size: 15, gridSpan: 2, borders: bDoubleRow }),
  tc(450, '[[profRupturaMedia]]', { size: 15, borders: bDoubleRow }),
  ...IDX_COLS.map(() => tc(200, '', { borders: bDoubleRow })),
  tc(950, 'UMIDADE MÉDIA (%)', { bold: true, size: 13, borders: bDoubleRow }),
  tc(300, '[[umidadeMedia]]', { size: 14, borders: { ...bDoubleRow, right: B_MED } }),
]);

const resDpRow = trow([
  tc(590, [run('DP ', { bold: true, size: 14 }), run('[1]', { size: 13, vertAlign: 'superscript' })], {
    gridSpan: 2, borders: { top: B_DOUBLE, bottom: B_THIN, left: B_MED, right: B_THIN },
  }),
  tc(270, '(MPa)', { size: 14, borders: { top: B_DOUBLE, bottom: B_THIN, left: B_THIN, right: B_THIN } }),
  tc(440, '[[dp]]', { bold: true, size: 15, gridSpan: 2, borders: { top: B_DOUBLE, bottom: B_THIN, left: B_THIN, right: B_MED } }),
  tc(2450, '', { gridSpan: 11, borders: { top: B_DOUBLE, bottom: B_NONE, left: B_MED, right: B_THIN } }),
  tc(950, 'ESPESSURA MÉDIA DO REVESTIMENTO - (mm)', { bold: true, size: 11, borders: { top: B_DOUBLE, bottom: B_THIN, left: B_THIN, right: B_THIN } }),
  tc(300, '[[espessuraMediaRevestimento]]', { size: 14, borders: { top: B_DOUBLE, bottom: B_THIN, left: B_THIN, right: B_MED } }),
]);

const resCvRow = trow([
  tc(590, [run('CV ', { bold: true, size: 14 }), run('[1]', { size: 13, vertAlign: 'superscript' })], {
    gridSpan: 2, borders: { top: B_THIN, bottom: B_DOUBLE, left: B_MED, right: B_THIN },
  }),
  tc(270, '(%)', { size: 14, borders: { top: B_THIN, bottom: B_DOUBLE, left: B_THIN, right: B_THIN } }),
  tc(440, '[[cv]]', { bold: true, size: 15, gridSpan: 2, borders: { top: B_THIN, bottom: B_DOUBLE, left: B_THIN, right: B_MED } }),
  tc(3700, 'TÉRMINO DO SISTEMA DE REVESTIMENTO - SITUAÇÃO [[numeroRomano]].', {
    bold: true, size: 13, align: 'right', vAlign: 'bottom', gridSpan: 13,
    borders: { top: B_NONE, bottom: B_DOUBLE, left: B_MED, right: B_MED },
  }),
]);

parts.push(tbl(resGrid, [
  resHeaderRow1,
  resHeaderRow2,
  resHeaderRow3,
  resDataRow,
  resMediaRow,
  resDpRow,
  resCvRow,
], { borders: 'box', cellMarginTop: 12, cellMarginBottom: 12, cellMarginLeft: 25, cellMarginRight: 25 }));

parts.push(para('', { spacingBefore: 20, spacingAfter: 20, line: 60 }));

// 2.3 Quadro NOTAS REFERENTE AO ENSAIO
parts.push(tbl([5000], [
  trow([
    tc(5000, [
      para(run('NOTAS REFERENTE AO ENSAIO:', { bold: true, size: 15 }), { jc: 'left', spacingAfter: 20 }),
      para(run('[1] Adotar o código DP para Desvio Padrão e CV para Coeficiente de Variação.', { size: 15 }), { jc: 'left', indentLeft: 80, spacingAfter: 15 }),
      para(run('As informações do ensaio foram fornecidas pelo cliente, bem como a amostragem e distribuição dos pontos ensaiados.', { size: 15 }), { jc: 'left', indentLeft: 80 }),
    ], { align: 'left' }),
  ]),
], { borders: 'outer', cellMarginTop: 30, cellMarginBottom: 30, cellMarginLeft: 70, cellMarginRight: 70 }));

parts.push(para(run('[[/situacoes]]', { size: 2 }), { spacingBefore: 0, spacingAfter: 0, line: 20 }));

// ══════════════════════════════════════════════════════════════
// 3. CAPÍTULO 5 — ANEXO DE IMAGENS (NO FINAL, APÓS TODAS AS SITUAÇÕES)
// ══════════════════════════════════════════════════════════════
parts.push(para(run('[[#situacoes]]', { size: 2 }), { spacingBefore: 0, spacingAfter: 0, line: 20 }));
parts.push(para(run('[[#temFotos]]', { size: 2 }), { spacingBefore: 0, spacingAfter: 0, line: 20 }));
parts.push(para('', { pageBreakBefore: true, spacingBefore: 0, spacingAfter: 0, line: 20 }));

// Cabeçalho do Anexo da Situação
parts.push(tbl([5000], [
  trow([
    tc(5000, [
      para(run('5. ANEXO - SISTEMA DE REVESTIMENTO (IMAGENS)', { bold: true, size: 16 }), { jc: 'left', spacingAfter: 15 }),
      para(run('5.[[numSit]] SITUAÇÃO [[numeroRomano]]', { bold: true, size: 15 }), { jc: 'left' }),
    ], {
      align: 'left',
      borders: { top: B_MED, bottom: B_THIN, left: B_MED, right: B_MED },
    }),
  ]),
], { borders: 'outer', cellMarginTop: 20, cellMarginBottom: 20, cellMarginLeft: 70, cellMarginRight: 70 }));

// Grade de fotos (2 por linha, cada uma com moldura e caixinha de legenda centralizada abaixo contendo nº e ponto da amostra)
const anexoCols = [2420, 160, 2420];
const bFotoBox = { top: B_THIN, bottom: B_THIN, left: B_THIN, right: B_THIN };
const bNoBox = { top: B_NONE, bottom: B_NONE, left: B_NONE, right: B_NONE };

function runLegendaBox(texto) {
  return `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:bCs/><w:color w:val="000000"/><w:sz w:val="15"/><w:szCs w:val="15"/><w:bdr w:val="single" w:sz="4" w:space="3" w:color="000000"/></w:rPr><w:t xml:space="preserve">  ${esc(texto)}  </w:t></w:r>`;
}

parts.push(para(run('[[#linhasFotos]]', { size: 2 }), { spacingBefore: 20, spacingAfter: 0, line: 20 }));
parts.push(tbl(anexoCols, [
  trow([
    tc(2420, run('[[fotoEsq]]'), { align: 'center', vAlign: 'center', borders: bFotoBox }),
    tc(160, '', { borders: bNoBox }),
    tc(2420, [
      run('[[#temDir]]', { size: 2 }),
      run('[[fotoDir]]'),
      run('[[/temDir]]', { size: 2 }),
    ], { align: 'center', vAlign: 'center', borders: bFotoBox }),
  ], { height: 2600 }),
  trow([
    tc(2420, runLegendaBox('[[legendaEsq]]'), { align: 'center', borders: bNoBox, margins: { top: 40, bottom: 40, left: 20, right: 20 } }),
    tc(160, '', { borders: bNoBox }),
    tc(2420, [
      run('[[#temDir]]', { size: 2 }),
      runLegendaBox('[[legendaDir]]'),
      run('[[/temDir]]', { size: 2 }),
    ], { align: 'center', borders: bNoBox, margins: { top: 40, bottom: 40, left: 20, right: 20 } }),
  ]),
], { borders: 'none', cellMarginTop: 20, cellMarginBottom: 10 }));
parts.push(para(run('[[/linhasFotos]]', { size: 2 }), { spacingBefore: 0, spacingAfter: 10, line: 20 }));

parts.push(para(run('[[/temFotos]]', { size: 2 }), { spacingBefore: 0, spacingAfter: 0, line: 20 }));
parts.push(para(run('[[/situacoes]]', { size: 2 }), { spacingBefore: 0, spacingAfter: 0, line: 20 }));

// ══════════════════════════════════════════════════════════════
// 4. RODAPÉ FINAL — QUADRO NOTAS + ASSINATURA (LADO A LADO, IGUAL À PLANILHA)
// ══════════════════════════════════════════════════════════════
parts.push(para('', { spacingBefore: 40, spacingAfter: 20, line: 80 }));
parts.push(tbl([3150, 1850], [
  trow([
    tc(3150, [
      para(run('NOTAS:', { bold: true, size: 15 }), { jc: 'left', spacingAfter: 20 }),
      para(run('1. Este relatório tem resultados restritos, aplicam-se apenas aos corpos de prova ensaiados.', { size: 14 }), { jc: 'left', indentLeft: 60, spacingAfter: 15 }),
      para(run('2. Este relatório só deverá ser reproduzido por completo, e mediante expressa autorização do laboratório.', { size: 14 }), { jc: 'left', indentLeft: 60, spacingAfter: 15 }),
      para(run('3. Este relatório atende aos requisitos de acreditação da Cgcre (Coordenação Geral de Acreditação do Inmetro), que avaliou a competência do laboratório.', { size: 14 }), { jc: 'left', indentLeft: 60 }),
    ], {
      align: 'left', vAlign: 'top',
      borders: { top: B_MED, bottom: B_MED, left: B_NONE, right: B_MED },
    }),
    tc(1850, [
      para(run('[[resp_assinatura]]', { size: 14 }), { jc: 'center', spacingBefore: 20 }),
      para(run('___________________________________', { size: 14 }), { jc: 'center' }),
      para(run('[[resp_nome]]', { bold: true, size: 15 }), { jc: 'center' }),
      para(run('CREA: [[resp_crea]]', { size: 14 }), { jc: 'center' }),
    ], {
      align: 'center', vAlign: 'bottom',
      borders: { top: B_MED, bottom: B_MED, left: B_MED, right: B_NONE },
    }),
  ]),
], { borders: 'none', cellMarginTop: 30, cellMarginBottom: 30, cellMarginLeft: 60, cellMarginRight: 60 }));

// ── sectPr final (margens ajustadas para aproveitamento de página idêntico à planilha) ──────
const sectPr = '<w:sectPr><w:headerReference w:type="default" r:id="rId14"/><w:footerReference w:type="default" r:id="rId15"/><w:pgSz w:w="11907" w:h="16840" w:code="9"/><w:pgMar w:top="1020" w:right="720" w:bottom="900" w:left="720" w:header="284" w:footer="227" w:gutter="0"/><w:cols w:space="720"/><w:docGrid w:linePitch="326"/></w:sectPr>';

const documentXml =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">' +
  '<w:body>' + parts.join('') + sectPr + '</w:body></w:document>';

// ── Header e Footer fiéis à planilha RAAC ──────────────────────
const headerXml =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:hdr xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas.microsoft.com/office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">' +
  tbl([1900, 3100], [
    trow([
      tc(1900, '<w:p><w:pPr><w:jc w:val="left"/><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="1914525" cy="531697"/><wp:effectExtent l="0" t="0" r="0" b="1905"/><wp:docPr id="156397638" name="LogoTecomat"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="909002630" name="LogoTecomat"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1974663" cy="548398"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>', {
        align: 'left', vAlign: 'center',
        borders: { top: B_NONE, bottom: B_MED, left: B_NONE, right: B_NONE },
      }),
      tc(3100, [
        para(run('ENSAIO DE RESISTÊNCIA DE ADERÊNCIA À TRAÇÃO EM', { bold: true, size: 21 }), { jc: 'right', spacingAfter: 10 }),
        `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="000000"/></w:pBdr><w:spacing w:before="0" w:after="20"/><w:jc w:val="right"/></w:pPr>${run('REVESTIMENTO', { bold: true, size: 21 })}</w:p>`,
        para(run('[[num_rlt]]', { size: 17 }), { jc: 'right', spacingBefore: 10 }),
      ], {
        align: 'right', vAlign: 'bottom',
        borders: { top: B_NONE, bottom: B_MED, left: B_NONE, right: B_NONE },
      }),
    ]),
  ], { borders: 'none', cellMarginTop: 0, cellMarginBottom: 20, cellMarginLeft: 0, cellMarginRight: 0 }) +
  '</w:hdr>';

const footerXml =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:ftr xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas.microsoft.com/office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">' +
  tbl([4400, 600], [
    trow([
      tc(5000, 'RAAC - REV. 09 (02-01-26)', { align: 'left', size: 14, gridSpan: 2, borders: bNoBox }),
    ]),
    trow([
      tc(4400, 'Rua Serra da Canastra, 391 Cordeiro CEP 50.640-310 Recife PE PABX 55 81 3366 6444 tecomat@tecomat.com.br www.tecomat.com.br', { align: 'left', size: 14, borders: bNoBox }),
      tc(600, '<w:p><w:pPr><w:jc w:val="right"/><w:spacing w:before="0" w:after="0"/></w:pPr>' +
        `<w:r>${rpr({ size: 14 })}<w:fldChar w:fldCharType="begin"/></w:r>` +
        `<w:r>${rpr({ size: 14 })}<w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>` +
        `<w:r>${rpr({ size: 14 })}<w:fldChar w:fldCharType="separate"/></w:r>` +
        `<w:r>${rpr({ size: 14 })}<w:t>1</w:t></w:r>` +
        `<w:r>${rpr({ size: 14 })}<w:fldChar w:fldCharType="end"/></w:r>` +
        `<w:r>${rpr({ size: 14 })}<w:t>/</w:t></w:r>` +
        `<w:r>${rpr({ size: 14 })}<w:fldChar w:fldCharType="begin"/></w:r>` +
        `<w:r>${rpr({ size: 14 })}<w:instrText xml:space="preserve"> NUMPAGES </w:instrText></w:r>` +
        `<w:r>${rpr({ size: 14 })}<w:fldChar w:fldCharType="separate"/></w:r>` +
        `<w:r>${rpr({ size: 14 })}<w:t>1</w:t></w:r>` +
        `<w:r>${rpr({ size: 14 })}<w:fldChar w:fldCharType="end"/></w:r>` +
        '</w:p>', { align: 'right', borders: bNoBox }),
    ]),
  ], { borders: 'none', cellMarginTop: 4, cellMarginBottom: 4, cellMarginLeft: 0, cellMarginRight: 0 }) +
  '</w:ftr>';

const zip = new PizZip(fs.readFileSync(BASE_DOCX));
zip.file('word/document.xml', documentXml);
zip.file('word/header1.xml', headerXml);
zip.file('word/footer1.xml', footerXml);

const UNUSED_MEDIA = ['image1.jpeg', 'image2.png', 'image3.png', 'image4.png', 'image5.png', 'image6.jpeg'];
UNUSED_MEDIA.forEach(m => zip.remove(`word/media/${m}`));
let relsXml = zip.file('word/_rels/document.xml.rels').asText();
relsXml = relsXml.replace(/<Relationship[^>]*Target="media\/(image1\.jpeg|image2\.png|image3\.png|image4\.png|image5\.png|image6\.jpeg)"[^>]*\/>/g, '');
zip.file('word/_rels/document.xml.rels', relsXml);

const out = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
fs.writeFileSync(OUT_DOCX, out);
console.log('OK ->', OUT_DOCX, out.length, 'bytes');
