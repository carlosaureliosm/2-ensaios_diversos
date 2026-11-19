// scripts/aplicar-pagina1-padrao.js
//
// Aplica o padrão visual do relatório de aderência (scripts/build-modelo-aderencia.js)
// nos modelos .docx dos demais módulos prontos (esclerometria e resistividade):
//
//   - Header (word/header1.xml): tabela 2 colunas com logo TECOMAT à esquerda e
//     título do ensaio + [[num_rlt]] à direita, com linha inferior encostando na página 1
//   - Margens (<w:pgMar>): top=1020, right=720, bottom=900, left=720, header=284, footer=227
//   - Página 1: tabela de identificação (CLIENTE / OBRA / ATT. + DATA DE EMISSÃO / ENDEREÇO),
//     quadro NORMA(S) DE REFERÊNCIA e faixa cinza ENSAIO DE [[nome_ensaio]] (sem capa e sem sumário)
//   - Esclerometria: atualiza NBR 7584:2012 -> NBR 7584:2026 em todo o documento
//   - Resistividade: mantém a Tabela 1 (valores indicativos de corrosão) inteira na mesma página
//   - Rodapé final: quadro em tabela com NOTAS (opcional, célula mesclada no topo) +
//     assinaturas duplas em células bordadas (João Ribeiro de Carvalho + Engenheiro do ensaio)
//
// O script é idempotente: pode ser rodado de novo depois de editar normas/layout.
//   node scripts/aplicar-pagina1-padrao.js

const path = require('path');
const fs = require('fs');
const PizZip = require(path.join(__dirname, '..', 'node_modules', 'pizzip'));

const BLACK = '000000';
const GRAY_BG = 'D9D9D9';

const MODELOS = [
  {
    arquivo: 'modelo_esclerometria.docx',
    tituloHeader: 'ENSAIO DE ESCLEROMETRIA',
    joaoRelId: 'rId13',
    atualizarNorma2026: true,
    normas: [
      'NBR 7584:2026 – Concreto endurecido – Avaliação da dureza superficial pelo esclerômetro de reflexão – Método de ensaio',
    ],
  },
  {
    arquivo: 'modelo_resistividade.docx',
    tituloHeader: 'ENSAIO DE RESISTIVIDADE ELÉTRICA DO CONCRETO',
    joaoRelId: 'rId11',
    manterTabela1Junta: true,
    normas: [
      'AASHTO T 358 – Standard Method of Test for Surface Resistivity Indication of Concrete’s Ability to Resist Chloride Ion Penetration',
      'RILEM TC 154-EMC (2003) – Electrochemical techniques for measuring corrosion in concrete',
      'CEB-192 (1989) – Bulletin D’Information – Diagnosis and Assessment of Concrete Structures',
      'COST 509 – Corrosion and protection of metals in contact with concrete',
    ],
  },
];

// ── Helpers XML (mesmos padrões do build-modelo-aderencia.js) ──
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function rpr({ bold, italic, size = 16, caps } = {}) {
  let x = '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>';
  if (bold) x += '<w:b/><w:bCs/>';
  if (italic) x += '<w:i/><w:iCs/>';
  if (caps) x += '<w:caps/>';
  x += `<w:color w:val="${BLACK}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`;
  x += '<w:lang w:eastAsia="pt-BR"/></w:rPr>';
  return x;
}

function run(text, opts = {}) {
  return `<w:r>${rpr(opts)}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

function para(runs, { jc = 'left', before = 0, after = 0, line = 220, indentLeft, keepNext } = {}) {
  const content = Array.isArray(runs) ? runs.join('') : (runs || '');
  let ppr = '<w:pPr>';
  if (keepNext) ppr += '<w:keepNext/>';
  ppr += `<w:spacing w:before="${before}" w:after="${after}" w:line="${line}" w:lineRule="auto"/>`;
  if (indentLeft) ppr += `<w:ind w:left="${indentLeft}"/>`;
  ppr += `<w:jc w:val="${jc}"/></w:pPr>`;
  return `<w:p>${ppr}${content}</w:p>`;
}

const B_THIN = 'w:val="single" w:sz="4" w:space="0" w:color="000000"';
const B_MED = 'w:val="single" w:sz="8" w:space="0" w:color="000000"';
const NONE = 'w:val="none" w:sz="0" w:space="0" w:color="auto"';

function tc(pct, inner, { gridSpan, vMerge, borders, shade, vAlign = 'center' } = {}) {
  let p = `<w:tcPr><w:tcW w:w="${pct}" w:type="pct"/>`;
  if (gridSpan) p += `<w:gridSpan w:val="${gridSpan}"/>`;
  if (vMerge === 'restart') p += '<w:vMerge w:val="restart"/>';
  else if (vMerge === 'continue') p += '<w:vMerge/>';
  if (borders) {
    p += '<w:tcBorders>' + ['top', 'left', 'bottom', 'right']
      .map(k => `<w:${k} ${borders[k] || NONE}/>`).join('') + '</w:tcBorders>';
  }
  if (shade) p += `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>`;
  p += `<w:vAlign w:val="${vAlign}"/></w:tcPr>`;
  const body = Array.isArray(inner) ? inner.join('') : (inner || para(''));
  return `<w:tc>${p}${body}</w:tc>`;
}

function trow(cells, { cantSplit = true } = {}) {
  const trPr = cantSplit ? '<w:trPr><w:cantSplit/><w:jc w:val="center"/></w:trPr>' : '<w:trPr><w:jc w:val="center"/></w:trPr>';
  return `<w:tr>${trPr}${cells.join('')}</w:tr>`;
}

function tbl(cols, rows, { borders = 'none', mar = 14, marTop, marBottom, marLeft = 45, marRight = 45 } = {}) {
  const b = borders === 'outer'
    ? `<w:top ${B_MED}/><w:left ${B_MED}/><w:bottom ${B_MED}/><w:right ${B_MED}/><w:insideH ${NONE}/><w:insideV ${NONE}/>`
    : `<w:top ${NONE}/><w:left ${NONE}/><w:bottom ${NONE}/><w:right ${NONE}/><w:insideH ${NONE}/><w:insideV ${NONE}/>`;
  const mTop = marTop ?? mar;
  const mBot = marBottom ?? mar;
  return '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:jc w:val="center"/>' +
    `<w:tblBorders>${b}</w:tblBorders>` +
    `<w:tblCellMar><w:top w:w="${mTop}" w:type="dxa"/><w:left w:w="${marLeft}" w:type="dxa"/><w:bottom w:w="${mBot}" w:type="dxa"/><w:right w:w="${marRight}" w:type="dxa"/></w:tblCellMar>` +
    `</w:tblPr><w:tblGrid>${cols.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.join('')}</w:tbl>`;
}

function espaco(line = 80) {
  return para('', { before: 20, after: 20, line });
}

// ── Header padrão (idêntico ao de aderência) ──────────────────
function montarHeaderXml(tituloHeader) {
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

  const tituloPara =
    '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="000000"/></w:pBdr>' +
    `<w:spacing w:before="0" w:after="20"/><w:jc w:val="right"/></w:pPr>${run(tituloHeader, { bold: true, size: 21 })}</w:p>`;

  const rltPara = para(run('[[num_rlt]]', { size: 17 }), { jc: 'right', before: 10, after: 0 });
  const borderBottom = { top: NONE, bottom: B_MED, left: NONE, right: NONE };

  const headerTbl = tbl([1900, 3100], [
    trow([
      tc(1900, logoPara, { vAlign: 'center', borders: borderBottom }),
      tc(3100, [tituloPara, rltPara], { vAlign: 'bottom', borders: borderBottom }),
    ]),
  ], { borders: 'none', marTop: 0, marBottom: 20, marLeft: 0, marRight: 0 });

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:hdr xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">' +
    headerTbl +
    '</w:hdr>';
}

// ── Página 1 ───────────────────────────────────────────────────
function montarPagina1(normas) {
  const linha = { top: B_THIN, bottom: B_THIN };
  const pOpts = { before: 10, after: 10, line: 200 };
  const rot = t => para(run(t, { bold: true }), pOpts);
  const val = (t, jc = 'left') => para(run(t), { ...pOpts, jc });

  // 1. Identificação (mesmas proporções da aderência: 650 / 2450 / 950 / 950)
  const id = tbl([650, 2450, 950, 950], [
    trow([tc(650, rot('CLIENTE:'), { borders: linha }), tc(4350, val('[[cliente]]'), { gridSpan: 3, borders: linha })]),
    trow([tc(650, rot('OBRA:'), { borders: linha }), tc(4350, val('[[obra]]'), { gridSpan: 3, borders: linha })]),
    trow([
      tc(650, rot('ATT.:'), { borders: linha }),
      tc(2450, val('[[att]]'), { borders: linha }),
      tc(950, para(run('DATA DE EMISSÃO:', { bold: true }), { ...pOpts, jc: 'right' }), { borders: linha }),
      tc(950, val('[[data_emissao]]', 'center'), { borders: linha }),
    ]),
    trow([tc(650, rot('ENDEREÇO:'), { borders: linha }), tc(4350, val('[[endereco]]'), { gridSpan: 3, borders: linha })]),
  ]);

  // 2. Normas de referência (rótulo mesclado verticalmente à esquerda)
  const normasRows = normas.map((n, i) => trow([
    i === 0
      ? tc(1050, para(run('NORMA(S) DE REFERÊNCIA:', { bold: true, size: 15 }), { ...pOpts, jc: 'center' }), { vMerge: 'restart' })
      : tc(1050, '', { vMerge: 'continue' }),
    tc(3950, para(run(n, { size: 15 }), pOpts)),
  ]));
  const normasTbl = tbl([1050, 3950], normasRows, { mar: 10 });

  // 3. Faixa cinza com o título do ensaio
  const titulo = tbl([5000], [
    trow([tc(5000, para(run('ENSAIO DE [[nome_ensaio]]', { bold: true, size: 17, caps: true }), { ...pOpts, jc: 'center' }), {
      shade: GRAY_BG, borders: { top: B_MED, bottom: B_MED, left: B_MED, right: B_MED },
    })]),
  ], { borders: 'outer' });

  return id + espaco() + normasTbl + espaco(100) + titulo + espaco(100);
}

// ── Quadro final: NOTAS (opcional) + Assinaturas em células bordadas ──
function joaoAssinaturaDrawing(joaoRelId, docPrId) {
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
    `<pic:blipFill><a:blip r:embed="${joaoRelId}"/><a:srcRect/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    '<pic:spPr bwMode="auto"><a:xfrm><a:off x="0" y="0"/><a:ext cx="1362075" cy="619125"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></pic:spPr>' +
    '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
}

function celulasAssinatura(joaoRelId, docPrId, topBorder) {
  return [
    tc(2500, [
      para(joaoAssinaturaDrawing(joaoRelId, docPrId), { jc: 'center', before: 20, after: 10 }),
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

function montarQuadroNotasAssinaturas(joaoRelId) {
  const tblOpts = { borders: 'none', marTop: 30, marBottom: 30, marLeft: 60, marRight: 60 };

  const comNotas = tbl([2500, 2500], [
    trow([
      tc(5000, [
        para(run('NOTAS:', { bold: true, size: 15 }), { jc: 'left', after: 20, keepNext: true }),
        para(run('[[notas]]', { size: 14 }), { jc: 'left', indentLeft: 60, keepNext: true }),
      ], {
        gridSpan: 2, vAlign: 'top',
        borders: { top: B_MED, bottom: B_THIN, left: B_MED, right: B_MED },
      }),
    ]),
    trow(celulasAssinatura(joaoRelId, 612, B_THIN)),
  ], tblOpts);

  const semNotas = tbl([2500, 2500], [
    trow(celulasAssinatura(joaoRelId, 613, B_MED)),
  ], tblOpts);

  return para('', { before: 40, after: 20, line: 80 }) +
    para(run('[[#notas]]', { size: 2 }), { line: 20 }) +
    comNotas +
    para(run('[[/notas]]', { size: 2 }), { line: 20 }) +
    para(run('[[^notas]]', { size: 2 }), { line: 20 }) +
    semNotas +
    para(run('[[/notas]]', { size: 2 }), { line: 20 });
}

// ── Mantém todas as linhas de uma tabela unidas na mesma página ──
function manterTabelaJunta(xml, marcadorTexto) {
  const mIdx = xml.indexOf(marcadorTexto);
  if (mIdx < 0) throw new Error(`Tabela com "${marcadorTexto}" não encontrada`);
  const tStart = xml.lastIndexOf('<w:tbl>', mIdx);
  const tEnd = xml.indexOf('</w:tbl>', mIdx) + '</w:tbl>'.length;
  if (tStart < 0 || tEnd < tStart) throw new Error(`Limites da tabela "${marcadorTexto}" inválidos`);

  const tblXml = xml.slice(tStart, tEnd);
  const rows = tblXml.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
  let rowIdx = 0;

  const novaTbl = tblXml.replace(/<w:tr\b[\s\S]*?<\/w:tr>/g, tr => {
    const isLast = rowIdx++ === rows.length - 1;
    if (!tr.includes('<w:cantSplit/>')) {
      tr = tr.includes('<w:trPr>')
        ? tr.replace('<w:trPr>', '<w:trPr><w:cantSplit/>')
        : tr.replace(/(<w:tr\b[^>]*>)/, '$1<w:trPr><w:cantSplit/></w:trPr>');
    }
    if (isLast) return tr;
    return tr.replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/g, (m, inner) => {
      if (inner.includes('<w:keepNext/>')) return m;
      const styleMatch = inner.match(/^<w:pStyle\b[^>]*\/>/);
      return styleMatch
        ? `<w:pPr>${styleMatch[0]}<w:keepNext/>${inner.slice(styleMatch[0].length)}</w:pPr>`
        : `<w:pPr><w:keepNext/>${inner}</w:pPr>`;
    });
  });

  return xml.slice(0, tStart) + novaTbl + xml.slice(tEnd);
}

// ── Remove imagens que ficaram sem uso (fundo da capa antiga) ──
function limparImagensOrfas(zip, docXml) {
  const relsPath = 'word/_rels/document.xml.rels';
  let rels = zip.file(relsPath).asText();
  const removidas = [];
  rels = rels.replace(/<Relationship [^>]*\/>/g, rel => {
    if (!/relationships\/image"/.test(rel)) return rel;
    const id = rel.match(/Id="([^"]+)"/)[1];
    if (docXml.includes(`"${id}"`)) return rel;
    removidas.push(rel.match(/Target="([^"]+)"/)[1]);
    return '';
  });
  zip.file(relsPath, rels);

  const outrosRels = Object.keys(zip.files)
    .filter(k => k.endsWith('.rels') && k !== relsPath)
    .map(k => zip.file(k).asText()).join('\n') + rels;
  for (const alvo of removidas) {
    const nome = alvo.split('/').pop();
    if (!outrosRels.includes(nome)) zip.remove('word/' + alvo.replace(/^\/?word\//, ''));
  }
  return removidas.length;
}

for (const { arquivo, tituloHeader, joaoRelId, atualizarNorma2026, manterTabela1Junta, normas } of MODELOS) {
  const file = path.join(__dirname, '..', 'public', arquivo);
  const zip = new PizZip(fs.readFileSync(file));
  let xml = zip.file('word/document.xml').asText();

  // 1. Página 1 padrão (substitui início do body até INTRODUÇÃO)
  const bodyIni = xml.indexOf('<w:body>') + '<w:body>'.length;
  const marcadorIntro = xml.indexOf('INTRODUÇÃO</w:t>');
  if (marcadorIntro < 0) throw new Error(`${arquivo}: título INTRODUÇÃO não encontrado`);
  const corteIntro = xml.lastIndexOf('<w:p ', marcadorIntro);
  xml = xml.slice(0, bodyIni) + montarPagina1(normas) + xml.slice(corteIntro);

  // 2. Atualiza norma 2012 -> 2026 na esclerometria
  if (atualizarNorma2026) {
    xml = xml.replace(/NBR 7584:2012/g, 'NBR 7584:2026');
  }

  // 3. Mantém Tabela 1 da resistividade junta em uma página
  if (manterTabela1Junta) {
    xml = manterTabelaJunta(xml, 'Resistividade (KΩcm)');
  }

  // 4. Quadro final de NOTAS + Assinaturas (depois de [[/fotos_memorial]] até <w:sectPr)
  const fmIdx = xml.indexOf('[[/fotos_memorial]]');
  if (fmIdx < 0) throw new Error(`${arquivo}: marcador [[/fotos_memorial]] não encontrado`);
  const fmEnd = xml.indexOf('</w:p>', fmIdx) + '</w:p>'.length;
  const sectIdx = xml.indexOf('<w:sectPr', fmEnd);
  if (sectIdx < 0) throw new Error(`${arquivo}: <w:sectPr não encontrado`);
  xml = xml.slice(0, fmEnd) + montarQuadroNotasAssinaturas(joaoRelId) + xml.slice(sectIdx);

  // 5. Margens idênticas ao modelo de aderência
  xml = xml.replace(
    /<w:pgMar\b[^>]*\/>/,
    '<w:pgMar w:top="1020" w:right="720" w:bottom="900" w:left="720" w:header="284" w:footer="227" w:gutter="0"/>'
  );

  zip.file('word/document.xml', xml);
  zip.file('word/header1.xml', montarHeaderXml(tituloHeader));

  const n = limparImagensOrfas(zip, xml);
  fs.writeFileSync(file, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log(`✔ ${arquivo}: padrão aplicado (${n} imagem(ns) órfã(s) removida(s))`);
}
