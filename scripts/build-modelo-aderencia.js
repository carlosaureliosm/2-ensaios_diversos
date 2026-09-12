// scripts/build-modelo-aderencia.js
//
// Monta public/modelo_aderencia.docx a partir do modelo_esclerometria.docx (reaproveita
// styles.xml, theme, header/footer com letterhead, fontTable, numbering, settings) —
// só o word/document.xml é substituído por conteúdo novo, fiel à planilha RAAC (Resistência
// de Aderência à Tração). Editar aqui e rodar `node scripts/build-modelo-aderencia.js`
// em vez de editar o .docx manualmente — o XML do Word é frágil para edição à mão.
//
// Loops de docxtemplater usados no template gerado (delimitadores [[ ]], igual esclerometria):
//   [[#situacoes]]...[[/situacoes]]       — repete todo o bloco "Sistema de Revestimento"
//   [[#corposDeProva]]...[[/corposDeProva]] — repete a linha da tabela de resultados (e o
//                                              par de fotos no anexo), por Situação
//   [[#colunas]]...[[/colunas]]           — dentro da célula "Forma de ruptura", uma linha
//                                              "[[nome]]: [[valor]]%" por camada/interface
//   [[#campo]]...[[/campo]] / [[^campo]]...[[/campo]] — checkbox ☒/☐ condicional (normas)
//
// Contrato de dados esperado pelo render (a ser montado em src/app/api/ensaios/aderencia/docx/route.ts):
//   situacoes[].corposDeProva[].colunas = [{ nome, valor }] — já achatado a partir de
//   modelo.colunasFormaRuptura (nomes) + corpoDeProva.formaRuptura (valores), na mesma ordem.
const path = require('path');
const PizZip = require(path.join(__dirname, '..', 'node_modules', 'pizzip'));
const fs = require('fs');

const BASE_DOCX = path.join(__dirname, '..', 'public', 'modelo_esclerometria.docx');
const OUT_DOCX = path.join(__dirname, '..', 'public', 'modelo_aderencia.docx');

const NAVY = '002060';
const TEXT_COLOR = '0F243E';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Runs / parágrafos ─────────────────────────────────────────
function rpr({ bold, color, size, italic } = {}) {
  let x = '<w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/>';
  if (bold) x += '<w:b/><w:bCs/>';
  if (italic) x += '<w:i/><w:iCs/>';
  if (color) x += `<w:color w:val="${color}"/>`;
  if (size) x += `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`;
  x += '<w:lang w:eastAsia="pt-BR"/></w:rPr>';
  return x;
}

function run(text, opts = {}) {
  return `<w:r>${rpr(opts)}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

function para(content, { jc, spacingBefore, spacingAfter, style } = {}) {
  const runs = Array.isArray(content) ? content.join('') : content;
  let ppr = '<w:pPr>';
  if (style) ppr += `<w:pStyle w:val="${style}"/>`;
  if (spacingBefore !== undefined || spacingAfter !== undefined) {
    ppr += `<w:spacing${spacingBefore !== undefined ? ` w:before="${spacingBefore}"` : ''}${spacingAfter !== undefined ? ` w:after="${spacingAfter}"` : ''}/>`;
  }
  if (jc) ppr += `<w:jc w:val="${jc}"/>`;
  ppr += '</w:pPr>';
  return `<w:p>${ppr}${runs}</w:p>`;
}

function heading(text) {
  return `<w:p><w:pPr><w:pStyle w:val="Ttulo1"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:before="240" w:after="240" w:line="360" w:lineRule="auto"/><w:jc w:val="both"/><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi"/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

function label(texto) {
  return para(run(texto, { color: TEXT_COLOR }), { spacingBefore: 120 });
}

function checkbox(campo, texto) {
  const marcado = run('[[#' + campo + ']]☒[[/' + campo + ']]', { bold: true });
  const desmarcado = run('[[^' + campo + ']]☐[[/' + campo + ']]');
  const rest = run(' ' + texto);
  return para([marcado, desmarcado, rest], { spacingBefore: 80, jc: 'both' });
}

// ── Tabelas ────────────────────────────────────────────────────
// cols: [{ w: pct*50 }] widths somando 5000 (=100%)
function tbl(colWidths, rowsXml) {
  const grid = colWidths.map(w => `<w:gridCol w:w="${w}"/>`).join('');
  return `<w:tbl><w:tblPr><w:tblStyle w:val="Tabelacomgrade"/><w:tblW w:w="5000" w:type="pct"/><w:jc w:val="center"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rowsXml.join('')}</w:tbl>`;
}

// `content`: string de TEXTO PURO (será escapado e embrulhado num run), array de
// strings XML já prontas (runs/parágrafos — usadas como estão, sem novo escape), ou uma
// string XML já pronta (começando com '<w:r' ou '<w:p') — nunca uma string de texto puro
// que por acaso comece com '<', então o guard abaixo é seguro para os casos reais de uso.
function tc(pctWidth, content, { header, align = 'center', shade } = {}) {
  const opts = header ? { bold: true, color: 'FFFFFF', size: 18 } : { size: 18, color: TEXT_COLOR };
  let inner;
  if (Array.isArray(content)) {
    inner = content.join('');
  } else if (typeof content === 'string' && /^<w:(r|p)[ >]/.test(content)) {
    inner = content;
  } else {
    inner = run(String(content), opts);
  }
  const fill = header ? NAVY : shade;
  const shd = fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : '';
  const wrapInPara = !/^<w:p[ >]/.test(inner);
  const body = wrapInPara ? `<w:p><w:pPr><w:jc w:val="${align}"/></w:pPr>${inner}</w:p>` : inner;
  return `<w:tc><w:tcPr><w:tcW w:w="${pctWidth}" w:type="pct"/>${shd}<w:vAlign w:val="center"/></w:tcPr>${body}</w:tc>`;
}

function trow(cells, { header } = {}) {
  const trPr = header ? '<w:trPr><w:tblHeader/><w:jc w:val="center"/></w:trPr>' : '<w:trPr><w:jc w:val="center"/></w:trPr>';
  const cellsXml = Array.isArray(cells) ? cells.join('') : cells;
  return `<w:tr>${trPr}${cellsXml}</w:tr>`;
}

// ── Conteúdo estático ──────────────────────────────────────────
const parts = [];

parts.push(para(run('ENSAIO DE RESISTÊNCIA DE ADERÊNCIA À TRAÇÃO EM REVESTIMENTO', { bold: true, size: 28 }), { jc: 'center', spacingAfter: 240 }));
parts.push(para(run('[[num_rlt]]', { bold: true, size: 22 }), { jc: 'center', spacingAfter: 240 }));

parts.push(label('CLIENTE: [[cliente]]'));
parts.push(label('OBRA: [[obra]]'));
parts.push(label('CONSTRUTORA: [[construtora]]'));
parts.push(label('ENDEREÇO: [[endereco]]'));
parts.push(label('DATA DE EMISSÃO: [[data_emissao]]'));

parts.push(para(run('NORMA(S) DE REFERÊNCIA: (Marcar a Norma Utilizada)', { bold: true, color: TEXT_COLOR }), { spacingBefore: 240 }));
parts.push(checkbox('nbr135281', 'NBR 13528-1:2019 – Revestimento de paredes de argamassas inorgânicas – Determinação da resistência de aderência à tração – parte 1: Requisitos gerais'));
parts.push(para([run('        '), run('[[#parte2]]☒[[/parte2]]', { bold: true }), run('[[^parte2]]☐[[/parte2]]'), run(' Parte 2 – Aderência ao substrato      '), run('[[#parte3]]☒[[/parte3]]', { bold: true }), run('[[^parte3]]☐[[/parte3]]'), run(' Parte 3 – Aderência superficial')]));
parts.push(checkbox('nbr13749', 'NBR 13749:2013 – Revestimento de paredes e tetos de argamassas inorgânicas – Especificação'));
parts.push(checkbox('nbr13753', 'NBR 13753:1996 – Revestimento de piso interno ou externo com placas cerâmicas e com utilização de argamassa colante - Procedimento - Anexo A – Determinação da resistência de aderência de revestimentos cerâmicos assentados com argamassa colante'));
parts.push(checkbox('nbr13754', 'NBR 13754:1996 – Revestimento de paredes internas com placas cerâmicas e com utilização de argamassa colante - Procedimento - Anexo A – Determinação da resistência de aderência de revestimentos cerâmicos assentados com argamassa colante'));
parts.push(checkbox('nbr13755', 'NBR 13755:2017 – Revestimento cerâmico de fachadas e paredes externas com utilização de argamassa colante – Projeto, execução, inspeção e aceitação – Procedimento'));

parts.push(heading('Objetivo'));
parts.push(para(run('Determinação da resistência de aderência à tração de revestimentos cerâmicos assentados com argamassa colante e de revestimento de argamassa aplicadas sobre substratos inorgânicos não metálicos.'), { jc: 'both' }));

parts.push(heading('Equipamentos Utilizados'));
parts.push(para(run('Ensaio realizado com Transdutor de força marca Alfa Instrumentos, modelo Z2T, faixa nominal de 2000 kgf; e instrumentação eletrônica associada digital marca Alfa Instrumentos, modelo 3105C, faixa nominal de cinco dígitos e 1 ponto.'), { jc: 'both' }));
parts.push(para(run('Equipamentos de corte utilizados furadeira de impacto marca Bosch para corte, modelo GSB-13RE acoplada a uma serra copo de 53 mm de diâmetro interno, ou serra maquita marca Bosch, modelo GDC-14 com disco diamantado de 100 mm.'), { jc: 'both' }));

parts.push(heading('Observações'));
parts.push(para(run('TABELA 01 - LIMITES DE RESISTÊNCIA DE ADERÊNCIA À TRAÇÃO (Ra) PARA EMBOÇO E CAMADA ÚMIDA CONFORME NBR 13749:2013 E PISO CONFORME NBR 13753:1996', { bold: true }), { spacingBefore: 120, spacingAfter: 120 }));

const t1cols = [1200, 1200, 1800, 800];
const t1rows = [
  trow([tc(t1cols[0], 'LOCAL', { header: true }), tc(t1cols[1], 'SITUAÇÃO', { header: true }), tc(t1cols[2], 'ACABAMENTO', { header: true }), tc(t1cols[3], 'Ra (MPa)', { header: true })], { header: true }),
  trow([tc(t1cols[0], 'PAREDE'), tc(t1cols[1], 'INTERNA'), tc(t1cols[2], 'PINTURA OU BASE PARA REBOCO', { align: 'left' }), tc(t1cols[3], '≥ 0,20')]),
  trow([tc(t1cols[0], 'PAREDE'), tc(t1cols[1], 'INTERNA'), tc(t1cols[2], 'CERÂMICA OU LAMINADO', { align: 'left' }), tc(t1cols[3], '≥ 0,30')]),
  trow([tc(t1cols[0], 'PAREDE'), tc(t1cols[1], 'EXTERNA'), tc(t1cols[2], 'PINTURA OU BASE PARA REBOCO', { align: 'left' }), tc(t1cols[3], '≥ 0,30')]),
  trow([tc(t1cols[0], 'PAREDE'), tc(t1cols[1], 'EXTERNA'), tc(t1cols[2], 'CERÂMICA', { align: 'left' }), tc(t1cols[3], '≥ 0,30')]),
  trow([tc(t1cols[0], 'TETO'), tc(t1cols[1], '--'), tc(t1cols[2], '--'), tc(t1cols[3], '≥ 0,20')]),
  trow([tc(t1cols[0], 'PISO (INT./EXT.)'), tc(t1cols[1], '--'), tc(t1cols[2], 'CERÂMICA', { align: 'left' }), tc(t1cols[3], '≥ 0,30')]),
];
parts.push(tbl(t1cols, t1rows));
parts.push(para(run('O pano estudado deve ser composto por 12 (doze) corpos de prova.'), { spacingBefore: 120, jc: 'both' }));
parts.push(para(run('Para aprovação do pano 2/3 dos corpos de prova devem apresentar resultados iguais ou superiores ao estabelecido na Tabela 01.'), { jc: 'both' }));

parts.push(para(run('TABELA 02 – REQUISITOS E CRITÉRIOS DE ACEITAÇÃO DO SISTEMA DE REVESTIMENTO CONFORME NBR 13755:2017', { bold: true }), { spacingBefore: 240, spacingAfter: 120 }));
const t2cols = [1400, 1100, 1500, 1000];
const t2rows = [
  trow([tc(t2cols[0], 'ENSAIO', { header: true }), tc(t2cols[1], 'AMOSTRAGEM MÍNIMA', { header: true }), tc(t2cols[2], 'RESULTADO DO ENSAIO (MPa)', { header: true }), tc(t2cols[3], 'COMENTÁRIOS', { header: true })], { header: true }),
  trow([tc(t2cols[0], 'RESISTÊNCIA SUPERFICIAL', { align: 'left' }), tc(t2cols[1], '12 CP A CADA 2.000 m²'), tc(t2cols[2], 'PELO MENOS OITO CP ≥ 0,5'), tc(t2cols[3], 'APROVADO')]),
  trow([tc(t2cols[0], 'RESISTÊNCIA SUPERFICIAL', { align: 'left' }), tc(t2cols[1], '12 CP A CADA 2.000 m²'), tc(t2cols[2], '0,3 ≤ OITO CP < 0,5'), tc(t2cols[3], 'CONSULTAR RESPONSÁVEL PELO PROJETO')]),
  trow([tc(t2cols[0], 'RESISTÊNCIA SUPERFICIAL', { align: 'left' }), tc(t2cols[1], '12 CP A CADA 2.000 m²'), tc(t2cols[2], 'MENOS DE OITO CP ≥ 0,3'), tc(t2cols[3], 'REPROVADO')]),
  trow([tc(t2cols[0], 'ADERÊNCIA DAS PLACAS AO EMBOÇO', { align: 'left' }), tc(t2cols[1], '12 CP A CADA 2.000 m²'), tc(t2cols[2], 'PELO MENOS OITO CP ≥ 0,5'), tc(t2cols[3], 'APROVADO')]),
  trow([tc(t2cols[0], 'ADERÊNCIA DAS PLACAS AO EMBOÇO', { align: 'left' }), tc(t2cols[1], '12 CP A CADA 2.000 m²'), tc(t2cols[2], '0,3 ≤ OITO CP < 0,5'), tc(t2cols[3], 'CONSULTAR RESPONSÁVEL PELO PROJETO')]),
  trow([tc(t2cols[0], 'ADERÊNCIA DAS PLACAS AO EMBOÇO', { align: 'left' }), tc(t2cols[1], '12 CP A CADA 2.000 m²'), tc(t2cols[2], 'MENOS DE OITO CP ≥ 0,3'), tc(t2cols[3], 'REPROVADO')]),
];
parts.push(tbl(t2cols, t2rows));
parts.push(para(run('NOTA: PARA REALIZAÇÃO DO ENSAIO DE RESISTÊNCIA DE ADERÊNCIA À TRAÇÃO, O CORTE ATINGE UMA PROFUNDIDADE DE ATÉ 40mm, PODENDO ATINGIR O SUBSTRATO.', { italic: true }), { spacingBefore: 120, jc: 'both' }));

// ── Bloco repetido por Situação ──────────────────────────────────
parts.push(para(run('[[#situacoes]]')));
parts.push(heading('Sistema de Revestimento — Situação [[numeroRomano]]'));

const hcols = [1250, 1250, 1250, 1250];
function campoRow(label1, campo1, label2, campo2) {
  return trow([
    tc(hcols[0], run(label1, { bold: true, color: TEXT_COLOR, size: 18 }), { align: 'left' }),
    tc(hcols[1], run('[[' + campo1 + ']]', { size: 18 }), { align: 'left' }),
    tc(hcols[2], run(label2, { bold: true, color: TEXT_COLOR, size: 18 }), { align: 'left' }),
    tc(hcols[3], run('[[' + campo2 + ']]', { size: 18 }), { align: 'left' }),
  ]);
}
const situacaoHeaderRows = [
  campoRow('Tipo de revestimento:', 'tipoRevestimento', 'Data do ensaio:', 'dataEnsaio'),
  campoRow('Nº de corpos de prova:', 'numCPs', 'Data de aplicação:', 'dataAplicacao'),
  campoRow('Substrato:', 'substrato', 'Idade de ruptura (dias):', 'idadeRupturaDias'),
  campoRow('Chapisco:', 'chapisco', 'Traço:', 'chapiscoTraco'),
  campoRow('Emboço:', 'emboco', 'Traço:', 'embocoTraco'),
  trow([
    tc(hcols[0], run('Argamassa colante:', { bold: true, color: TEXT_COLOR, size: 18 }), { align: 'left' }),
    tc(hcols[1], run('[[argamassaColante]]', { size: 18 }), { align: 'left' }),
    tc(hcols[2], run('Revestimento:', { bold: true, color: TEXT_COLOR, size: 18 }), { align: 'left' }),
    tc(hcols[3], [run('[[revestimento]]  ', { size: 18 }), run('Dimensões: ', { bold: true, color: TEXT_COLOR, size: 18 }), run('[[dimensoesCm]] cm', { size: 18 })], { align: 'left' }),
  ]),
];
parts.push(tbl(hcols, situacaoHeaderRows));

// Esquema + observações (tabela 2 colunas, sem borda pesada — usa mesmo estilo com grade fina)
const esqCols = [1500, 3500];
parts.push(tbl(esqCols, [
  trow([tc(esqCols[0], run('ESQUEMA', { bold: true, color: 'FFFFFF' }), { header: true }), tc(esqCols[1], run('OBSERVAÇÕES', { bold: true, color: 'FFFFFF' }), { header: true })], { header: true }),
  trow([tc(esqCols[0], run('[[esquemaImagem]]')), tc(esqCols[1], run('[[observacoesEsquema]]'), { align: 'left' })]),
]));

parts.push(para(run('RESULTADO DO ENSAIO', { bold: true }), { spacingBefore: 240, spacingAfter: 120 }));

// Tabela de resultados — "Forma de ruptura" varia de colunas por modelo de camadas (ex:
// Sub/Chap/Emb/Arg Col/Cer/Vazios vs Concreto/Contrapiso/Vazios), então em vez de tentar
// multiplicar colunas de tabela dinamicamente (frágil em docxtemplater sem verificação
// visual disponível), cada corpo de prova lista "camada: valor%" em linhas dentro da
// própria célula, via loop de parágrafo (mesma técnica comprovada do bloco de Situação).
const rcols = { num: 500, bloco: 500, junta: 500, ra: 700, prof: 700, forma: 1600, loc: 1500 };
const resHeaderCells =
  tc(rcols.num, 'Nº CP', { header: true }) +
  tc(rcols.bloco, 'Bloco', { header: true }) +
  tc(rcols.junta, 'Junta', { header: true }) +
  tc(rcols.ra, 'Tensão Ra (MPa)', { header: true }) +
  tc(rcols.prof, 'Prof. ruptura (mm)', { header: true }) +
  tc(rcols.forma, 'Forma de ruptura (%)', { header: true }) +
  tc(rcols.loc, 'Localização', { header: true });

const formaRupturaCellParas = [
  para(run('[[#colunas]]', { size: 16 }), { jc: 'left' }),
  para(run('[[nome]]: [[valor]]%', { size: 16 }), { jc: 'left' }),
  para(run('[[/colunas]]', { size: 16 }), { jc: 'left' }),
];

// A tag de loop [[#corposDeProva]]/[[/corposDeProva]] tem que ficar DENTRO do texto da
// primeira/última célula da linha (nunca como <w:r> solto direto sob <w:tr>, que viola o
// schema do OOXML e o Word recusa abrir) — mesmo padrão comprovado do [[#amostras]] do
// esclerometria, onde a tag de abertura é o início do <w:t> da 1ª célula e a de fechamento
// é o fim do <w:t> da última célula.
const resDataCells =
  tc(rcols.num, [run('[[#corposDeProva]]'), run('[[numero]]')]) +
  tc(rcols.bloco, '[[bloco]]') +
  tc(rcols.junta, '[[junta]]') +
  tc(rcols.ra, '[[tensaoRa]]') +
  tc(rcols.prof, '[[profRuptura]]') +
  tc(rcols.forma, formaRupturaCellParas, { align: 'left' }) +
  tc(rcols.loc, [run('[[localizacao]]'), run('[[/corposDeProva]]')], { align: 'left' });

const resWidths = [rcols.num, rcols.bloco, rcols.junta, rcols.ra, rcols.prof, rcols.forma, rcols.loc];
parts.push(tbl(resWidths, [
  trow([resHeaderCells], { header: true }),
  trow([resDataCells]),
  trow([
    tc(rcols.num, 'MÉDIA', { header: false }) + tc(rcols.bloco, '-') + tc(rcols.junta, '-') +
    tc(rcols.ra, '[[raMedia]]') + tc(rcols.prof, '[[profRupturaMedia]]') +
    tc(rcols.forma, '') + tc(rcols.loc, run('Umidade média (%): [[umidadeMedia]]', {size:16}), { align: 'left' }),
  ]),
  trow([
    tc(rcols.num, 'DP') + tc(rcols.bloco, '(MPa)') + tc(rcols.junta, '') +
    tc(rcols.ra, '[[dp]]') + tc(rcols.prof, '') +
    tc(rcols.forma, '') + tc(rcols.loc, run('Espessura média do revestimento (mm): [[espessuraMediaRevestimento]]', {size:16}), { align: 'left' }),
  ]),
  trow([
    tc(rcols.num, 'CV') + tc(rcols.bloco, '(%)') + tc(rcols.junta, '') +
    tc(rcols.ra, '[[cv]]') + tc(rcols.prof, '') +
    tc(rcols.forma, '') + tc(rcols.loc, ''),
  ]),
]));

parts.push(para(run('Término do sistema de revestimento — Situação [[numeroRomano]].', { bold: true, italic: true }), { jc: 'right', spacingBefore: 120 }));

parts.push(para(run('NOTAS REFERENTE AO ENSAIO:', { bold: true }), { spacingBefore: 240 }));
parts.push(para(run('[1] Adotar o código DP para Desvio Padrão e CV para Coeficiente de Variação.')));
parts.push(para(run('As informações do ensaio foram fornecidas pelo cliente, bem como a amostragem e distribuição dos pontos ensaiados.')));

parts.push(heading('Anexo — Sistema de Revestimento (Imagens) — Situação [[numeroRomano]]'));
parts.push(para(run('[[#corposDeProva]]')));
parts.push(para(run('CP [[numero]]', { bold: true }), { spacingBefore: 120 }));
const fotoCols = [2500, 2500];
parts.push(tbl(fotoCols, [
  trow([tc(fotoCols[0], run('[[foto1]]')), tc(fotoCols[1], run('[[foto2]]'))]),
]));
parts.push(para(run('[[/corposDeProva]]')));

parts.push(para(run('[[/situacoes]]')));

// ── Notas finais (fixas, uma vez) ──────────────────────────────
parts.push(heading('Notas'));
parts.push(para(run('1. Este relatório tem resultados restritos, aplicam-se apenas aos corpos de prova ensaiados.')));
parts.push(para(run('2. Este relatório só deverá ser reproduzido por completo, e mediante expressa autorização do laboratório.')));
parts.push(para(run('3. Este relatório atende aos requisitos de acreditação da Cgcre (Coordenação Geral de Acreditação do Inmetro), que avaliou a competência do laboratório.')));

parts.push(para(run(''), { spacingBefore: 480 }));
parts.push(para(run('_______________________________________', { }), { jc: 'center' }));
parts.push(para(run('[[resp_assinatura]]')));
parts.push(para(run('[[resp_nome]]', { bold: true }), { jc: 'center' }));
parts.push(para(run('CREA: [[resp_crea]]'), { jc: 'center' }));

// ── sectPr final (mantém header/footer/margens do modelo original) ──────
const sectPr = '<w:sectPr><w:headerReference w:type="default" r:id="rId14"/><w:footerReference w:type="default" r:id="rId15"/><w:pgSz w:w="11907" w:h="16840" w:code="9"/><w:pgMar w:top="1134" w:right="992" w:bottom="1134" w:left="851" w:header="284" w:footer="227" w:gutter="0"/><w:cols w:space="720"/><w:docGrid w:linePitch="326"/></w:sectPr>';

const documentXml =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">' +
  '<w:body>' + parts.join('') + sectPr + '</w:body></w:document>';

const zip = new PizZip(fs.readFileSync(BASE_DOCX));
zip.file('word/document.xml', documentXml);

// Remove mídia/relações do document.xml antigo (assinatura/croqui/mapa da esclerometria)
// que não são mais referenciadas pelo novo conteúdo — mantém apenas o logo do header/footer
// (image7.png, referenciado só por header1.xml.rels, intocado).
const UNUSED_MEDIA = ['image1.jpeg', 'image2.png', 'image3.png', 'image4.png', 'image5.png', 'image6.jpeg'];
UNUSED_MEDIA.forEach(m => zip.remove(`word/media/${m}`));
let relsXml = zip.file('word/_rels/document.xml.rels').asText();
relsXml = relsXml.replace(/<Relationship[^>]*Target="media\/(image1\.jpeg|image2\.png|image3\.png|image4\.png|image5\.png|image6\.jpeg)"[^>]*\/>/g, '');
zip.file('word/_rels/document.xml.rels', relsXml);

const out = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
fs.writeFileSync(OUT_DOCX, out);
console.log('OK ->', OUT_DOCX, out.length, 'bytes');
