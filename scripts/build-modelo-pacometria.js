// scripts/build-modelo-pacometria.js
//
// Monta public/modelo_pacometria.docx a partir do modelo_esclerometria.docx,
// seguindo o padrão visual oficial da TECOMAT para relatórios de concreto:
//   - Header com logo TECOMAT à esquerda e "ENSAIO DE PACOMETRIA" + [[num_rlt]] à direita
//   - Footer com endereço da TECOMAT e paginação X/Y
//   - Página 1 compacta (identificação do cliente, faixa cinza ENSAIO DE PACOMETRIA, sem capa/sumário/normas)
//   - Seção 1: Introdução (com motivação, mapa, foto geral e múltiplos croquis opcionais, figuras numeradas)
//   - Seção 2: Metodologia de Ensaio
//   - Seção 3: Resultados do Ensaio (Tabela 1 consolidada, sem destaque vermelho)
//   - Seção 4: Detalhamento por Elemento Ensaiado (injetado dinamicamente via BLOCO_ELEMENTOS_PAC_END:
//              paginação por elemento, esquema + foto integrados, perfis de elevação por face,
//              tabelas compactadas sem colunas vazias e numeração automática de figuras/tabelas)
//   - Seção 5: Resumo Executivo e Conclusão (opcional, com tabela síntese global + texto editável/automático)
//   - Quadro final NOTAS (opcional) + Assinatura Dupla (João Ribeiro de Carvalho + Engenheiro)
//
// Nunca editar public/modelo_pacometria.docx à mão no Word — editar este script e rodar:
//   node scripts/build-modelo-pacometria.js

const path = require('path');
const fs = require('fs');
const PizZip = require(path.join(__dirname, '..', 'node_modules', 'pizzip'));

const BASE_DOCX = path.join(__dirname, '..', 'public', 'modelo_esclerometria.docx');
const OUT_DOCX = path.join(__dirname, '..', 'public', 'modelo_pacometria.docx');

// Paleta oficial TECOMAT
const BLACK = '000000';
const WHITE = 'FFFFFF';
const NAVY_HEADER = '002060';   // Cabeçalho de tabelas de resultados
const NAVY_TITLE = '0F243E';    // Títulos de seções
const GRAY_BG = 'D9D9D9';       // Faixa principal e subcabeçalhos
const ROW_ALT = 'F2F4F8';       // Zebra suave / faixa de resumo
const BORDER_LIGHT = 'BFBFBF';  // Bordas internas discretas

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Runs / parágrafos ─────────────────────────────────────────
function rpr({ bold, italic, caps, color = BLACK, size = 22, vertAlign } = {}) {
  let x = '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>';
  if (bold) x += '<w:b/><w:bCs/>';
  if (italic) x += '<w:i/><w:iCs/>';
  if (caps) x += '<w:caps/>';
  if (color) x += `<w:color w:val="${color}"/>`;
  if (size) x += `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`;
  if (vertAlign) x += `<w:vertAlign w:val="${vertAlign}"/>`;
  x += '<w:lang w:eastAsia="pt-BR"/></w:rPr>';
  return x;
}

function run(text, opts = {}) {
  return `<w:r>${rpr(opts)}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

function para(content, { jc = 'left', before = 0, after = 0, line = 220, indentLeft, pageBreakBefore, keepNext } = {}) {
  const runs = Array.isArray(content) ? content.join('') : (content || '');
  let ppr = '<w:pPr>';
  if (pageBreakBefore) ppr += '<w:pageBreakBefore/>';
  if (keepNext) ppr += '<w:keepNext/>';
  ppr += `<w:spacing w:before="${before}" w:after="${after}" w:line="${line}" w:lineRule="auto"/>`;
  if (indentLeft) ppr += `<w:ind w:left="${indentLeft}"/>`;
  if (jc) ppr += `<w:jc w:val="${jc}"/>`;
  ppr += '</w:pPr>';
  return `<w:p>${ppr}${runs}</w:p>`;
}

function espaco(line = 80, before = 20, after = 20) {
  return para('', { before, after, line });
}

function tituloSecao(texto, { pageBreakBefore = false } = {}) {
  return para(run(texto, { bold: true, size: 24, color: NAVY_TITLE }), {
    jc: 'left',
    before: pageBreakBefore ? 0 : 140,
    after: 70,
    line: 240,
    pageBreakBefore,
    keepNext: true,
  });
}

function paragrafoCorpo(content, { after = 80 } = {}) {
  return para(content, { jc: 'both', before: 0, after, line: 240 });
}

function tagLinha(tag) {
  return para(run(tag, { size: 2 }), { before: 0, after: 0, line: 20 });
}

// ── Bordas e Células de Tabela ────────────────────────────────
function bdr(val = 'single', sz = 4, color = BLACK) {
  return `w:val="${val}" w:sz="${sz}" w:space="0" w:color="${color}"`;
}

const B_THIN = bdr('single', 4, BLACK);
const B_LIGHT = bdr('single', 4, BORDER_LIGHT);
const B_MED = bdr('single', 8, BLACK);
const B_NAVY = bdr('single', 6, NAVY_HEADER);
const B_NONE = null;
const NONE_ATTR = 'w:val="none" w:sz="0" w:space="0" w:color="auto"';

function tcBorders({ top, bottom, left, right } = {}) {
  let x = '<w:tcBorders>';
  if (top !== undefined) x += `<w:top ${top || NONE_ATTR}/>`;
  if (left !== undefined) x += `<w:left ${left || NONE_ATTR}/>`;
  if (bottom !== undefined) x += `<w:bottom ${bottom || NONE_ATTR}/>`;
  if (right !== undefined) x += `<w:right ${right || NONE_ATTR}/>`;
  x += '</w:tcBorders>';
  return x;
}

function tc(pctWidth, content, {
  align = 'center',
  vAlign = 'center',
  shade,
  gridSpan,
  vMerge,
  borders,
  margins,
  bold = false,
  italic = false,
  size = 16,
  color = BLACK,
  keepNext = false,
} = {}) {
  let tcPr = `<w:tcPr><w:tcW w:w="${pctWidth}" w:type="pct"/>`;
  if (gridSpan && gridSpan > 1) tcPr += `<w:gridSpan w:val="${gridSpan}"/>`;
  if (vMerge === 'restart') tcPr += '<w:vMerge w:val="restart"/>';
  else if (vMerge === 'continue') tcPr += '<w:vMerge/>';
  if (borders) tcPr += tcBorders(borders);
  if (shade) tcPr += `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>`;
  if (margins) {
    tcPr += `<w:tcMar><w:top w:w="${margins.top ?? 24}" w:type="dxa"/><w:left w:w="${margins.left ?? 50}" w:type="dxa"/><w:bottom w:w="${margins.bottom ?? 24}" w:type="dxa"/><w:right w:w="${margins.right ?? 50}" w:type="dxa"/></w:tcMar>`;
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
    ? para(inner, { jc: align, before: 14, after: 14, line: 210, keepNext })
    : inner;
  return `<w:tc>${tcPr}${body}</w:tc>`;
}

function trow(cells, { height, header = false, cantSplit = true } = {}) {
  let trPr = '<w:trPr>';
  if (cantSplit) trPr += '<w:cantSplit/>';
  if (header) trPr += '<w:tblHeader/>';
  if (height) trPr += `<w:trHeight w:val="${height}" w:hRule="atLeast"/>`;
  trPr += '<w:jc w:val="center"/></w:trPr>';
  const cellsXml = Array.isArray(cells) ? cells.join('') : cells;
  return `<w:tr>${trPr}${cellsXml}</w:tr>`;
}

function tbl(colWidths, rowsXml, { borders = 'grid', marTop = 24, marBottom = 24, marLeft = 50, marRight = 50 } = {}) {
  const grid = colWidths.map(w => `<w:gridCol w:w="${w}"/>`).join('');
  let tblBorders = '<w:tblBorders>';
  if (borders === 'none') {
    tblBorders += `<w:top ${NONE_ATTR}/><w:left ${NONE_ATTR}/><w:bottom ${NONE_ATTR}/><w:right ${NONE_ATTR}/><w:insideH ${NONE_ATTR}/><w:insideV ${NONE_ATTR}/>`;
  } else if (borders === 'outer') {
    tblBorders += `<w:top ${B_MED}/><w:left ${B_MED}/><w:bottom ${B_MED}/><w:right ${B_MED}/><w:insideH ${NONE_ATTR}/><w:insideV ${NONE_ATTR}/>`;
  } else if (borders === 'navy') {
    tblBorders += `<w:top ${B_NAVY}/><w:left ${B_NAVY}/><w:bottom ${B_NAVY}/><w:right ${B_NAVY}/><w:insideH ${B_LIGHT}/><w:insideV ${B_LIGHT}/>`;
  } else {
    tblBorders += `<w:top ${B_THIN}/><w:left ${B_THIN}/><w:bottom ${B_THIN}/><w:right ${B_THIN}/><w:insideH ${B_LIGHT}/><w:insideV ${B_LIGHT}/>`;
  }
  tblBorders += '</w:tblBorders>';
  const tblCellMar = `<w:tblCellMar><w:top w:w="${marTop}" w:type="dxa"/><w:left w:w="${marLeft}" w:type="dxa"/><w:bottom w:w="${marBottom}" w:type="dxa"/><w:right w:w="${marRight}" w:type="dxa"/></w:tblCellMar>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:jc w:val="center"/>${tblBorders}${tblCellMar}</w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rowsXml.join('')}</w:tbl>`;
}

// ══════════════════════════════════════════════════════════════
// CONSTRUÇÃO DO CORPO DO DOCUMENTO
// ══════════════════════════════════════════════════════════════
const parts = [];

// ── 0. PÁGINA 1 PADRÃO (IDENTIFICAÇÃO + FAIXA CINZA) ──────────
const bRowLine = { top: B_THIN, bottom: B_THIN, left: B_NONE, right: B_NONE };
const pIdOpts = { before: 12, after: 12, line: 220 };
const rot = t => para(run(t, { bold: true, size: 22 }), pIdOpts);
const val = (t, jc = 'left') => para(run(t, { size: 22 }), { ...pIdOpts, jc });

parts.push(tbl([950, 2000, 1200, 850], [
  trow([
    tc(950, rot('CLIENTE:'), { borders: bRowLine }),
    tc(4050, val('[[cliente]]'), { gridSpan: 3, borders: bRowLine }),
  ]),
  trow([
    tc(950, rot('OBRA:'), { borders: bRowLine }),
    tc(4050, val('[[obra]]'), { gridSpan: 3, borders: bRowLine }),
  ]),
  trow([
    tc(950, rot('ATT.:'), { borders: bRowLine }),
    tc(2000, val('[[att]]'), { borders: bRowLine }),
    tc(1200, para(run('DATA DE EMISSÃO:', { bold: true, size: 22 }), { ...pIdOpts, jc: 'right' }), { borders: bRowLine }),
    tc(850, val('[[data_emissao]]', 'center'), { borders: bRowLine }),
  ]),
  trow([
    tc(950, rot('ENDEREÇO:'), { borders: bRowLine }),
    tc(4050, val('[[endereco]]'), { gridSpan: 3, borders: bRowLine }),
  ]),
], { borders: 'none', marTop: 14, marBottom: 14, marLeft: 40, marRight: 40 }));

parts.push(espaco(100));

parts.push(tbl([5000], [
  trow([
    tc(5000, para(run('ENSAIO DE [[nome_ensaio]]', { bold: true, size: 22, caps: true }), { ...pIdOpts, jc: 'center' }), {
      shade: GRAY_BG,
      borders: { top: B_MED, bottom: B_MED, left: B_MED, right: B_MED },
    }),
  ]),
], { borders: 'outer', marTop: 16, marBottom: 16, marLeft: 45, marRight: 45 }));

// ── 1. INTRODUÇÃO ─────────────────────────────────────────────
parts.push(tituloSecao('1. INTRODUÇÃO'));

parts.push(paragrafoCorpo([
  run('O presente relatório apresenta os resultados do ensaio não destrutivo de pacometria realizado em elementos estruturais de concreto armado da obra ', { size: 22 }),
  run('[[obra_intro]]', { bold: true, size: 22 }),
  run(', localizada em ', { size: 22 }),
  run('[[endereco_intro]]', { size: 22 }),
  run('. O ensaio tem por objetivo localizar a posição das armaduras, estimar os espaçamentos entre barras e determinar a espessura do cobrimento de concreto existente.', { size: 22 }),
]));

// Motivação (opcional)
parts.push(tagLinha('[[#temMotivacao]]'));
parts.push(paragrafoCorpo(run('[[motivacao]]', { size: 22 })));
parts.push(tagLinha('[[/temMotivacao]]'));

// Mapa de localização (opcional)
parts.push(tagLinha('[[#temMapa]]'));
parts.push(para(run('[[mapa_img]]'), { jc: 'center', before: 40, after: 20, keepNext: true }));
parts.push(para(run('Figura [[figMapaNum]] — Localização do empreendimento.', { italic: true, size: 22, color: NAVY_TITLE }), { jc: 'center', after: 80 }));
parts.push(tagLinha('[[/temMapa]]'));

// Foto geral da estrutura (opcional)
parts.push(tagLinha('[[#temFotoGeral]]'));
parts.push(para(run('[[foto_geral_img]]'), { jc: 'center', before: 40, after: 20, keepNext: true }));
parts.push(para(run('Figura [[figFotoGeralNum]] — Vista geral da estrutura ensaiada.', { italic: true, size: 22, color: NAVY_TITLE }), { jc: 'center', after: 80 }));
parts.push(tagLinha('[[/temFotoGeral]]'));

// Croquis gerais (múltiplas imagens, opcional)
parts.push(tagLinha('[[#temCroquis]]'));
parts.push(tagLinha('[[#croquis]]'));
parts.push(para(run('[[marcador]]'), { jc: 'center', before: 40, after: 20, keepNext: true }));
parts.push(para(run('Figura [[figNum]] — Croqui de localização dos elementos ensaiados[[sufixo]].', { italic: true, size: 22, color: NAVY_TITLE }), { jc: 'center', after: 80 }));
parts.push(tagLinha('[[/croquis]]'));
parts.push(tagLinha('[[/temCroquis]]'));

// ── 2. METODOLOGIA DE ENSAIO ──────────────────────────────────
parts.push(tituloSecao('2. METODOLOGIA DE ENSAIO'));

parts.push(paragrafoCorpo([
  run('O ensaio de pacometria consiste na detecção eletromagnética de armaduras de aço imersas no concreto por meio de pacômetro digital calibrado, permitindo identificar de forma não destrutiva o posicionamento das barras, seus espaçamentos e a espessura de cobrimento de concreto.', { size: 22 }),
]));

parts.push(paragrafoCorpo([
  run('O cobrimento de concreto de um elemento estrutural é definido pela armadura mais próxima da face exposta: os ', { size: 22 }),
  run('estribos', { bold: true, size: 22 }),
  run(' em pilares e vigas, e a ', { size: 22 }),
  run('camada externa de armadura', { bold: true, size: 22 }),
  run(' em lajes e áreas livres.', { size: 22 }),
]));

// ── 3. RESULTADOS DO ENSAIO (TABELA CONSOLIDADA) ──────────────
parts.push(tituloSecao('3. RESULTADOS DO ENSAIO'));

parts.push(paragrafoCorpo([
  run('A Tabela 1 apresenta o resumo estatístico dos cobrimentos medidos nos ', { size: 22 }),
  run('[[total_elementos]]', { bold: true, size: 22 }),
  run(' elemento(s) estrutural(is) inspecionado(s).', { size: 22 }),
]));

// Colunas: Item(380) | Elemento(1000) | Tipo/Seção(1020) | Médio(450) | Mín(430) | Máx(430) | DP(430) | CV(430) | Moda(430) = 5000
const resCols = [380, 1000, 1020, 450, 430, 430, 430, 430, 430];

parts.push(para(run('Tabela 1 — Resumo estatístico dos cobrimentos de concreto medidos por pacometria.', { bold: true, size: 22, color: NAVY_TITLE }), { jc: 'center', before: 30, after: 30, keepNext: true }));
parts.push(tbl(resCols, [
  trow([
    tc(380, 'ITEM', { bold: true, size: 22, color: WHITE, shade: NAVY_HEADER }),
    tc(1000, 'ELEMENTO', { bold: true, size: 22, color: WHITE, shade: NAVY_HEADER }),
    tc(1020, 'TIPO / SEÇÃO', { bold: true, size: 22, color: WHITE, shade: NAVY_HEADER }),
    tc(450, 'MÉDIO\n(mm)', { bold: true, size: 22, color: WHITE, shade: NAVY_HEADER }),
    tc(430, 'MÍN.\n(mm)', { bold: true, size: 22, color: WHITE, shade: NAVY_HEADER }),
    tc(430, 'MÁX.\n(mm)', { bold: true, size: 22, color: WHITE, shade: NAVY_HEADER }),
    tc(430, 'DP\n(mm)', { bold: true, size: 22, color: WHITE, shade: NAVY_HEADER }),
    tc(430, 'CV\n(%)', { bold: true, size: 22, color: WHITE, shade: NAVY_HEADER }),
    tc(430, 'MODA\n(mm)', { bold: true, size: 22, color: WHITE, shade: NAVY_HEADER }),
  ], { header: true }),
  trow([
    tc(380, [run('[[#resumo]]', { size: 2 }), run('[[item]]', { bold: true, size: 22 })]),
    tc(1000, '[[elemento]]', { align: 'left', bold: true, size: 22 }),
    tc(1020, '[[tipoResumo]]', { align: 'left', size: 22 }),
    tc(450, '[[cobMedio]]', { bold: true, size: 22 }),
    tc(430, '[[cobMinimo]]', { size: 22 }),
    tc(430, '[[cobMaximo]]', { size: 22 }),
    tc(430, '[[cobDesvio]]', { size: 22 }),
    tc(430, '[[cobCV]]', { size: 22 }),
    tc(430, [run('[[cobModa]]', { size: 22 }), run('[[/resumo]]', { size: 2 })]),
  ]),
], { borders: 'navy', marTop: 22, marBottom: 22, marLeft: 24, marRight: 24 }));

parts.push(para(
  run('Legenda: DP = Desvio Padrão; CV = Coeficiente de Variação. Cobrimentos obtidos exclusivamente na armadura mais externa (estribos em pilares/vigas; camada externa em lajes/áreas livres).', { italic: true, size: 22, color: '444444' }),
  { jc: 'left', before: 30, after: 80, line: 220 },
));

// ── 4. DETALHAMENTO POR ELEMENTO ENSAIADO (INJEÇÃO DINÂMICA) ──
parts.push(tituloSecao('4. DETALHAMENTO POR ELEMENTO ENSAIADO'));
parts.push(para(run('BLOCO_ELEMENTOS_PAC_END', { size: 22 }), { before: 0, after: 0 }));

// ── 5. RESUMO EXECUTIVO E CONCLUSÃO (OPCIONAL) ────────────────
parts.push(tagLinha('[[#temConclusao]]'));
parts.push(tituloSecao('5. RESUMO EXECUTIVO E CONCLUSÃO'));

parts.push(para(run('Tabela [[tabResumoGlobalNum]] — Síntese global dos resultados de pacometria.', { bold: true, size: 22, color: NAVY_TITLE }), { jc: 'center', before: 20, after: 30, keepNext: true }));
parts.push(tbl([1250, 1250, 1250, 1250], [
  trow([
    tc(1250, 'ELEMENTOS ENSAIADOS', { bold: true, size: 22, color: WHITE, shade: NAVY_HEADER }),
    tc(1250, 'TOTAL DE LEITURAS', { bold: true, size: 22, color: WHITE, shade: NAVY_HEADER }),
    tc(1250, 'COBRIMENTO MÉDIO GLOBAL', { bold: true, size: 22, color: WHITE, shade: NAVY_HEADER }),
    tc(1250, 'FAIXA GLOBAL (MÍN – MÁX)', { bold: true, size: 22, color: WHITE, shade: NAVY_HEADER }),
  ], { header: true }),
  trow([
    tc(1250, '[[resumoTiposGlobal]]', { bold: true, size: 22, shade: ROW_ALT }),
    tc(1250, '[[totalLeiturasGlobal]]', { bold: true, size: 22, shade: ROW_ALT }),
    tc(1250, '[[cobMedioGlobal]]', { bold: true, size: 22, shade: ROW_ALT }),
    tc(1250, '[[faixaGlobal]]', { bold: true, size: 22, shade: ROW_ALT }),
  ]),
], { borders: 'navy', marTop: 22, marBottom: 22, marLeft: 32, marRight: 32 }));

parts.push(espaco(80, 30, 20));
parts.push(paragrafoCorpo(run('[[conclusao]]', { size: 22 })));
parts.push(tagLinha('[[/temConclusao]]'));

// ── 6. QUADRO FINAL: NOTAS (OPCIONAL) + ASSINATURA DUPLA ──────
function joaoAssinaturaDrawing(docPrId) {
  return '<w:r><w:rPr><w:noProof/></w:rPr><w:drawing>' +
    '<wp:inline distT="0" distB="0" distL="0" distR="0">' +
    '<wp:extent cx="1362075" cy="619125"/>' +
    '<wp:effectExtent l="0" t="0" r="9525" b="9525"/>' +
    `<wp:docPr id="${docPrId}" name="AssinaturaJoao"/>` +
    '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
    '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    `<pic:nvPicPr><pic:cNvPr id="${docPrId}" name="AssinaturaJoao"/><pic:cNvPicPr><a:picLocks noChangeAspect="1" noChangeArrowheads="1"/></pic:cNvPicPr></pic:nvPicPr>` +
    '<pic:blipFill><a:blip r:embed="rId13"/><a:srcRect/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
    '<pic:spPr bwMode="auto"><a:xfrm><a:off x="0" y="0"/><a:ext cx="1362075" cy="619125"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></pic:spPr>' +
    '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
}

function celulasAssinatura(docPrId, topBorder) {
  return [
    tc(2500, [
      para(joaoAssinaturaDrawing(docPrId), { jc: 'center', before: 20, after: 10 }),
      para(run('___________________________________', { size: 14 }), { jc: 'center' }),
      para(run('João Ribeiro de Carvalho', { bold: true, italic: true, size: 15 }), { jc: 'center' }),
      para(run('Engenheiro Civil', { size: 14 }), { jc: 'center' }),
      para(run('CREA Nº49780 – PE', { size: 14 }), { jc: 'center' }),
    ], {
      vAlign: 'bottom',
      borders: { top: topBorder, bottom: B_MED, left: B_MED, right: B_THIN },
    }),
    tc(2500, [
      para(run('[[resp_assinatura]]', { size: 14 }), { jc: 'center', before: 20, after: 10 }),
      para(run('___________________________________', { size: 14 }), { jc: 'center' }),
      para(run('[[resp_nome]]', { bold: true, italic: true, size: 15 }), { jc: 'center' }),
      para(run('Engenheiro Civil', { size: 14 }), { jc: 'center' }),
      para(run('CREA Nº [[resp_crea]]', { size: 14 }), { jc: 'center' }),
    ], {
      vAlign: 'bottom',
      borders: { top: topBorder, bottom: B_MED, left: B_THIN, right: B_MED },
    }),
  ];
}

const quadroOpts = { borders: 'none', marTop: 30, marBottom: 30, marLeft: 60, marRight: 60 };
const comNotas = tbl([2500, 2500], [
  trow([
    tc(5000, [
      para(run('NOTAS:', { bold: true, size: 22 }), { jc: 'left', after: 20, keepNext: true }),
      para(run('[[notas]]', { size: 22 }), { jc: 'left', indentLeft: 60, keepNext: true }),
    ], {
      gridSpan: 2,
      vAlign: 'top',
      borders: { top: B_MED, bottom: B_THIN, left: B_MED, right: B_MED },
    }),
  ]),
  trow(celulasAssinatura(612, B_THIN)),
], quadroOpts);

const semNotas = tbl([2500, 2500], [
  trow(celulasAssinatura(613, B_MED)),
], quadroOpts);

parts.push(espaco(80, 40, 20));
parts.push(tagLinha('[[#notas]]'));
parts.push(comNotas);
parts.push(tagLinha('[[/notas]]'));
parts.push(tagLinha('[[^notas]]'));
parts.push(semNotas);
parts.push(tagLinha('[[/notas]]'));

// ── sectPr (margens padrão oficiais) ──────────────────────────
const sectPr = '<w:sectPr><w:headerReference w:type="default" r:id="rId14"/><w:footerReference w:type="default" r:id="rId15"/><w:pgSz w:w="11907" w:h="16840" w:code="9"/><w:pgMar w:top="1020" w:right="720" w:bottom="900" w:left="720" w:header="284" w:footer="227" w:gutter="0"/><w:cols w:space="720"/><w:docGrid w:linePitch="326"/></w:sectPr>';

const NS = 'xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14"';

const documentXml =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<w:document ${NS}><w:body>${parts.join('')}${sectPr}</w:body></w:document>`;

// ── Header padrão oficial ─────────────────────────────────────
const logoPara =
  '<w:p><w:pPr><w:jc w:val="left"/><w:spacing w:before="0" w:after="0"/></w:pPr>' +
  '<w:r><w:rPr><w:noProof/></w:rPr><w:drawing>' +
  '<wp:inline distT="0" distB="0" distL="0" distR="0">' +
  '<wp:extent cx="1914525" cy="531697"/><wp:effectExtent l="0" t="0" r="0" b="1905"/>' +
  '<wp:docPr id="156397638" name="LogoTecomat"/>' +
  '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
  '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
  '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
  '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
  '<pic:nvPicPr><pic:cNvPr id="909002630" name="LogoTecomat"/><pic:cNvPicPr/></pic:nvPicPr>' +
  '<pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
  '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1974663" cy="548398"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
  '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';

const tituloHeaderPara =
  '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="000000"/></w:pBdr>' +
  `<w:spacing w:before="0" w:after="20"/><w:jc w:val="right"/></w:pPr>${run('ENSAIO DE PACOMETRIA', { bold: true, size: 21 })}</w:p>`;

const rltHeaderPara = para(run('[[num_rlt]]', { size: 17 }), { jc: 'right', before: 10, after: 0 });
const headerBottom = { top: B_NONE, bottom: B_MED, left: B_NONE, right: B_NONE };

const headerXml =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<w:hdr ${NS}>` +
  tbl([1900, 3100], [
    trow([
      tc(1900, logoPara, { align: 'left', vAlign: 'center', borders: headerBottom }),
      tc(3100, [tituloHeaderPara, rltHeaderPara], { align: 'right', vAlign: 'bottom', borders: headerBottom }),
    ]),
  ], { borders: 'none', marTop: 0, marBottom: 20, marLeft: 0, marRight: 0 }) +
  '</w:hdr>';

// ── Footer padrão oficial (endereço + paginação X/Y) ──────────
const bNoBox = { top: B_NONE, bottom: B_NONE, left: B_NONE, right: B_NONE };
const footerXml =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<w:ftr ${NS}>` +
  tbl([4400, 600], [
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
  ], { borders: 'none', marTop: 4, marBottom: 4, marLeft: 0, marRight: 0 }) +
  '</w:ftr>';

// ── Empacota a partir do modelo base ──────────────────────────
const zip = new PizZip(fs.readFileSync(BASE_DOCX));
zip.file('word/document.xml', documentXml);
zip.file('word/header1.xml', headerXml);
zip.file('word/footer1.xml', footerXml);

// Mantém image6.jpeg (rId13 = assinatura fixa de João Ribeiro de Carvalho) e remove mídias não usadas
const UNUSED_MEDIA = ['image1.jpeg', 'image2.png', 'image3.png', 'image4.png', 'image5.png'];
UNUSED_MEDIA.forEach(m => zip.remove(`word/media/${m}`));
let relsXml = zip.file('word/_rels/document.xml.rels').asText();
relsXml = relsXml.replace(/<Relationship[^>]*Target="media\/(image1\.jpeg|image2\.png|image3\.png|image4\.png|image5\.png)"[^>]*\/>/g, '');
if (!relsXml.includes('Id="rId13"') || !zip.file('word/media/image6.jpeg')) {
  throw new Error('Assinatura fixa (rId13 -> word/media/image6.jpeg) não encontrada no modelo base.');
}
zip.file('word/_rels/document.xml.rels', relsXml);

const out = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
fs.writeFileSync(OUT_DOCX, out);
console.log('OK ->', OUT_DOCX, out.length, 'bytes');
