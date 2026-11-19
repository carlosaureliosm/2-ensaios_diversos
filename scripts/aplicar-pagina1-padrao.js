// scripts/aplicar-pagina1-padrao.js
//
// Aplica a "página 1 padrão" (mesmo modelo visual da 1ª página do relatório de
// aderência — ver scripts/build-modelo-aderencia.js) nos modelos .docx dos demais
// módulos prontos (esclerometria e resistividade):
//
//   1. Tabela de identificação: CLIENTE / OBRA / ATT. + DATA DE EMISSÃO / ENDEREÇO
//   2. Quadro NORMA(S) DE REFERÊNCIA (rótulo à esquerda, normas à direita)
//   3. Faixa cinza com o título do ensaio
//
// Substitui a antiga capa (imagem de fundo + "RELATÓRIO TÉCNICO") e o SUMÁRIO.
// Todo o conteúdo que vinha depois do sumário (a partir do título INTRODUÇÃO,
// seguido de METODOLOGIA, ...) é mantido como está; a linha [[segunda_data]] ("Recife, dd de ...") é removida.
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
    normas: [
      'NBR 7584:2012 – Concreto endurecido – Avaliação da dureza superficial pelo esclerômetro de reflexão – Método de ensaio',
    ],
  },
  {
    arquivo: 'modelo_resistividade.docx',
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

function rpr({ bold, size = 16, caps } = {}) {
  let x = '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>';
  if (bold) x += '<w:b/><w:bCs/>';
  if (caps) x += '<w:caps/>';
  x += `<w:color w:val="${BLACK}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`;
  x += '<w:lang w:eastAsia="pt-BR"/></w:rPr>';
  return x;
}

function run(text, opts = {}) {
  return `<w:r>${rpr(opts)}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

function para(runs, { jc = 'left', before = 10, after = 10, line = 200 } = {}) {
  return `<w:p><w:pPr><w:spacing w:before="${before}" w:after="${after}" w:line="${line}" w:lineRule="auto"/><w:jc w:val="${jc}"/></w:pPr>${runs}</w:p>`;
}

const B_THIN = 'w:val="single" w:sz="4" w:space="0" w:color="000000"';
const B_MED = 'w:val="single" w:sz="8" w:space="0" w:color="000000"';
const B_DOUBLE = 'w:val="double" w:sz="4" w:space="0" w:color="000000"';
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
  return `<w:tc>${p}${inner || para('')}</w:tc>`;
}

function trow(cells) {
  return `<w:tr><w:trPr><w:cantSplit/><w:jc w:val="center"/></w:trPr>${cells.join('')}</w:tr>`;
}

function tbl(cols, rows, { borders = 'none', mar = 14 } = {}) {
  const b = borders === 'outer'
    ? `<w:top ${B_MED}/><w:left ${B_MED}/><w:bottom ${B_MED}/><w:right ${B_MED}/><w:insideH ${NONE}/><w:insideV ${NONE}/>`
    : `<w:top ${NONE}/><w:left ${NONE}/><w:bottom ${NONE}/><w:right ${NONE}/><w:insideH ${NONE}/><w:insideV ${NONE}/>`;
  return '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:jc w:val="center"/>' +
    `<w:tblBorders>${b}</w:tblBorders>` +
    `<w:tblCellMar><w:top w:w="${mar}" w:type="dxa"/><w:left w:w="45" w:type="dxa"/><w:bottom w:w="${mar}" w:type="dxa"/><w:right w:w="45" w:type="dxa"/></w:tblCellMar>` +
    `</w:tblPr><w:tblGrid>${cols.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.join('')}</w:tbl>`;
}

function espaco(line = 80) {
  return para('', { before: 20, after: 20, line });
}

// ── Página 1 ───────────────────────────────────────────────────
function montarPagina1(normas) {
  const linha = { top: B_THIN, bottom: B_THIN };
  const rot = t => para(run(t, { bold: true }));
  const val = (t, jc = 'left') => para(run(t), { jc });

  // 1. Identificação (mesmas proporções da aderência: 650 / 2450 / 950 / 950)
  const id = tbl([650, 2450, 950, 950], [
    trow([tc(650, rot('CLIENTE:'), { borders: linha }), tc(4350, val('[[cliente]]'), { gridSpan: 3, borders: linha })]),
    trow([tc(650, rot('OBRA:'), { borders: linha }), tc(4350, val('[[obra]]'), { gridSpan: 3, borders: linha })]),
    trow([
      tc(650, rot('ATT.:'), { borders: linha }),
      tc(2450, val('[[att]]'), { borders: linha }),
      tc(950, para(run('DATA DE EMISSÃO:', { bold: true }), { jc: 'right' }), { borders: linha }),
      tc(950, val('[[data_emissao]]', 'center'), { borders: linha }),
    ]),
    trow([tc(650, rot('ENDEREÇO:'), { borders: linha }), tc(4350, val('[[endereco]]'), { gridSpan: 3, borders: linha })]),
  ]);

  // 2. Normas de referência (rótulo mesclado verticalmente à esquerda)
  const normasRows = normas.map((n, i) => trow([
    i === 0
      ? tc(1050, para(run('NORMA(S) DE REFERÊNCIA:', { bold: true, size: 15 }), { jc: 'center' }), { vMerge: 'restart' })
      : tc(1050, '', { vMerge: 'continue' }),
    tc(3950, para(run(n, { size: 15 }))),
  ]));
  const normasTbl = tbl([1050, 3950], normasRows, { mar: 10 });

  // 3. Faixa cinza com o título do ensaio
  const titulo = tbl([5000], [
    trow([tc(5000, para(run('ENSAIO DE [[nome_ensaio]]', { bold: true, size: 17, caps: true }), { jc: 'center' }), {
      shade: GRAY_BG, borders: { top: B_MED, bottom: B_DOUBLE, left: B_MED, right: B_MED },
    })]),
  ], { borders: 'outer' });

  return id + espaco() + normasTbl + espaco(100) + titulo + espaco(100);
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

for (const { arquivo, normas } of MODELOS) {
  const file = path.join(__dirname, '..', 'public', arquivo);
  const zip = new PizZip(fs.readFileSync(file));
  let xml = zip.file('word/document.xml').asText();

  const bodyIni = xml.indexOf('<w:body>') + '<w:body>'.length;
  // Corta até o início do título "INTRODUÇÃO" — a linha "Recife, dd de mês de aaaa"
  // ([[segunda_data]]) também sai, já que a data de emissão está na tabela da página 1.
  const marcador = xml.indexOf('INTRODUÇÃO</w:t>');
  if (marcador < 0) throw new Error(`${arquivo}: título INTRODUÇÃO não encontrado`);
  const corte = xml.lastIndexOf('<w:p ', marcador);

  xml = xml.slice(0, bodyIni) + montarPagina1(normas) + xml.slice(corte);
  zip.file('word/document.xml', xml);

  const n = limparImagensOrfas(zip, xml);
  fs.writeFileSync(file, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log(`✔ ${arquivo}: página 1 padrão aplicada (${n} imagem(ns) órfã(s) removida(s))`);
}
