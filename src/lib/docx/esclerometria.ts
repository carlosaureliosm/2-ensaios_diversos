import PizZip from 'pizzip';

export function toTitleCase(str: string): string {
  if (!str) return str;
  const minusculas = new Set(['de','da','do','das','dos','e','em','na','no','nas','nos','a','o','as','os','com','por','para','um','uma']);
  return str
    .toLowerCase()
    .split(' ')
    .map((word, i) => (i === 0 || !minusculas.has(word)) ? word.charAt(0).toUpperCase() + word.slice(1) : word)
    .join(' ');
}

export function formatarData(ddmmaaaa: string): { capa: string; corpo: string } {
  const mesesCapa  = ['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
  const mesesCorpo = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const partes = ddmmaaaa.split('/');
  if (partes.length !== 3) return { capa: '', corpo: '' };
  const [dd, mm, aaaa] = partes;
  const idx = parseInt(mm, 10) - 1;
  return {
    capa:  `${mesesCapa[idx]}, ${aaaa}`,
    corpo: `Recife, ${dd} de ${mesesCorpo[idx]} de ${aaaa}`,
  };
}

export function formatarRlt(rlt: string): string {
  const n = rlt.trim();
  if (!n) return 'RLT.LAU-XXX.26-00';
  if (/^\d+$/.test(n)) return `RLT.LAU-${n.padStart(3, '0')}.26-00`;
  return `RLT.LAU-${n}.26-00`;
}

/**
 * Adapta o XML interno do DOCX para o docxtemplater usar colchetes como delimitadores
 * e marca campos de fórmula com `w:dirty="true"` para forçar recálculo ao abrir.
 * @param xml - String XML do `word/document.xml` original.
 * @returns XML transformado com delimitadores `[[...]]` e campos atualizados.
 */
export function prepararXml(xml: string): string {
  return xml
    .replace(/\{\{/g, '[[').replace(/\}\}/g, ']]')
    .replace(/\{#([^}]+)\}/g, '[#$1]').replace(/\{\/([^}]+)\}/g, '[/$1]')
    .replace(/<w:fldChar\s+w:fldCharType="begin"(?!\s+w:dirty)/g,
      '<w:fldChar w:fldCharType="begin" w:dirty="true"');
}

/** Converte cm para EMU (English Metric Units): 1 cm = 914400/2.54 EMU */
export function cmParaEmu(cm: number): number {
  return Math.round(cm * 914400 / 2.54);
}

/** Monta o XML <w:drawing> inline para uma imagem já registrada no ZIP */
export function buildDrawingXml(rId: string, docPrId: number, name: string, cx: number, cy: number): string {
  return (
    `<w:drawing>` +
    `<wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${docPrId}" name="${name}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="${docPrId}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>` +
    `<a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`
  );
}

/** Registra imagem no ZIP (media + relationship + content-type) */
export function registrarImagem(
  zip: PizZip,
  imgBuffer: Buffer,
  contentType: string,
  mediaName: string,
  rId: string,
): void {
  const ext = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/webp' ? 'webp' : 'png';
  const mediaPath = `word/media/${mediaName}.${ext}`;
  zip.file(mediaPath, imgBuffer);

  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (relsFile) {
    let xml = relsFile.asText();
    xml = xml.replace('</Relationships>',
      `  <Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}.${ext}"/>\n</Relationships>`);
    zip.file('word/_rels/document.xml.rels', xml);
  }

  const ctFile = zip.file('[Content_Types].xml');
  if (ctFile) {
    let xml = ctFile.asText();
    const mimes: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
    if (!xml.includes(`Extension="${ext}"`)) {
      xml = xml.replace('</Types>', `  <Default Extension="${ext}" ContentType="${mimes[ext]}"/>\n</Types>`);
      zip.file('[Content_Types].xml', xml);
    }
  }
}

/**
 * Injeta a imagem de assinatura (5 cm × 2 cm) no placeholder `ASSINATURA_PLACEHOLDER`.
 * @param zip - Arquivo DOCX aberto como PizZip.
 * @param imgBuffer - Buffer com os bytes da imagem.
 * @param contentType - MIME type da imagem (ex: `'image/png'`).
 */
export function injetarAssinatura(zip: PizZip, imgBuffer: Buffer, contentType: string): void {
  registrarImagem(zip, imgBuffer, contentType, 'assinatura_resp', 'rId901');
  const cx = cmParaEmu(5), cy = cmParaEmu(2);
  const drawing =
    `</w:t></w:r><w:r>` +
    buildDrawingXml('rId901', 901, 'AssinaturaResp', cx, cy) +
    `</w:r><w:r><w:t>`;
  const docFile = zip.file('word/document.xml');
  if (docFile) {
    zip.file('word/document.xml', docFile.asText().replace('ASSINATURA_PLACEHOLDER', drawing));
  }
}

/**
 * Injeta a imagem de mapa (10 cm de largura, altura proporcional) no placeholder `MAPA_PLACEHOLDER`.
 * @param zip - Arquivo DOCX aberto como PizZip.
 * @param imgBuffer - Buffer com os bytes da imagem PNG.
 * @param imgWidth - Largura original da imagem em pixels.
 * @param imgHeight - Altura original da imagem em pixels.
 */
export function injetarMapa(zip: PizZip, imgBuffer: Buffer, imgWidth: number, imgHeight: number): void {
  registrarImagem(zip, imgBuffer, 'image/png', 'mapa_localizacao', 'rId902');
  const cx = cmParaEmu(10);
  const cy = Math.round(cx * imgHeight / imgWidth);
  const drawing =
    `</w:t></w:r><w:r>` +
    buildDrawingXml('rId902', 902, 'MapaLocalizacao', cx, cy) +
    `</w:r><w:r><w:t>`;
  const docFile = zip.file('word/document.xml');
  if (docFile) {
    zip.file('word/document.xml', docFile.asText().replace('MAPA_PLACEHOLDER', drawing));
  }
}

/**
 * Injeta foto geral da estrutura (15 cm de largura, altura proporcional) no placeholder `FOTO_GERAL_PLACEHOLDER`.
 * @param zip - Arquivo DOCX aberto como PizZip.
 * @param imgBuffer - Buffer com os bytes da imagem.
 * @param contentType - MIME type da imagem.
 * @param imgWidth - Largura original da imagem em pixels.
 * @param imgHeight - Altura original da imagem em pixels.
 */
export function injetarFotoGeral(zip: PizZip, imgBuffer: Buffer, contentType: string, imgWidth: number, imgHeight: number): void {
  registrarImagem(zip, imgBuffer, contentType, 'foto_geral', 'rId903');
  const cx = cmParaEmu(15);
  const cy = Math.round(cx * imgHeight / imgWidth);
  const drawing =
    `</w:t></w:r><w:r>` +
    buildDrawingXml('rId903', 903, 'FotoGeral', cx, cy) +
    `</w:r><w:r><w:t>`;
  const docFile = zip.file('word/document.xml');
  if (docFile) {
    zip.file('word/document.xml', docFile.asText().replace('FOTO_GERAL_PLACEHOLDER', drawing));
  }
}

/**
 * Injeta croqui dos elementos inspecionados (15 cm de largura, altura proporcional) no placeholder `CROQUI_PLACEHOLDER`.
 * @param zip - Arquivo DOCX aberto como PizZip.
 * @param imgBuffer - Buffer com os bytes da imagem.
 * @param contentType - MIME type da imagem.
 * @param imgWidth - Largura original da imagem em pixels.
 * @param imgHeight - Altura original da imagem em pixels.
 */
export function injetarCroqui(zip: PizZip, imgBuffer: Buffer, contentType: string, imgWidth: number, imgHeight: number): void {
  registrarImagem(zip, imgBuffer, contentType, 'croqui_elementos', 'rId904');
  const cx = cmParaEmu(15);
  const cy = Math.round(cx * imgHeight / imgWidth);
  const drawing =
    `</w:t></w:r><w:r>` +
    buildDrawingXml('rId904', 904, 'CroquiElementos', cx, cy) +
    `</w:r><w:r><w:t>`;
  const docFile = zip.file('word/document.xml');
  if (docFile) {
    zip.file('word/document.xml', docFile.asText().replace('CROQUI_PLACEHOLDER', drawing));
  }
}

/** Escapa caracteres especiais de XML em texto livre. */
export function escapeXml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Injeta N imagens de croqui dos elementos inspecionados (15 cm de largura, altura
 * proporcional) no lugar do placeholder `CROQUI_PLACEHOLDER`, cada uma seguida da
 * sua própria legenda "Foto / Legenda", empilhadas uma abaixo da outra. A numeração
 * de cada legenda usa um campo `SEQ Figura` (auto-atualizado pelo Word), de forma
 * que o número acompanha automaticamente a quantidade de imagens inseridas.
 * @param zip - Arquivo DOCX aberto como PizZip.
 * @param imagens - Lista de imagens com buffer, contentType, largura, altura e legenda.
 */
export function injetarCroquiMultiplo(
  zip: PizZip,
  imagens: Array<{ buffer: Buffer; contentType: string; width: number; height: number; legenda: string }>,
): void {
  if (imagens.length === 0) return;

  imagens.forEach((img, i) => {
    registrarImagem(zip, img.buffer, img.contentType, `croqui_elementos_${i + 1}`, `rId${904 + i}`);
  });

  const cx = cmParaEmu(15);

  let blocos = '';
  imagens.forEach((img, i) => {
    const rId = `rId${904 + i}`;
    const docPrId = 904 + i;
    const cy = Math.round(cx * img.height / img.width);
    const drawing = buildDrawingXml(rId, docPrId, `CroquiElementos${i + 1}`, cx, cy);

    const paraImagem =
      `<w:p><w:pPr><w:keepNext/><w:jc w:val="center"/></w:pPr>` +
      `<w:r><w:rPr><w:noProof/></w:rPr>${drawing}</w:r></w:p>`;

    const rPrLegendaCroqui = `<w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/></w:rPr>`;
    const paraLegenda =
      `<w:p><w:pPr><w:pStyle w:val="Legenda"/><w:jc w:val="center"/><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/></w:rPr></w:pPr>` +
      `<w:r>${rPrLegendaCroqui}<w:t xml:space="preserve">Figura </w:t></w:r>` +
      `<w:r>${rPrLegendaCroqui}<w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r>` +
      `<w:r>${rPrLegendaCroqui}<w:instrText xml:space="preserve"> SEQ Figura \\* ARABIC </w:instrText></w:r>` +
      `<w:r>${rPrLegendaCroqui}<w:fldChar w:fldCharType="separate"/></w:r>` +
      `<w:r><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/><w:noProof/></w:rPr><w:t>${i + 1}</w:t></w:r>` +
      `<w:r>${rPrLegendaCroqui}<w:fldChar w:fldCharType="end"/></w:r>` +
      `<w:r>${rPrLegendaCroqui}<w:t xml:space="preserve"> – ${escapeXml(img.legenda)}</w:t></w:r>` +
      `</w:p>`;

    blocos += paraImagem + paraLegenda;
  });

  const docFile = zip.file('word/document.xml');
  if (!docFile) return;
  let docXml = docFile.asText();

  // Substitui o parágrafo com o placeholder de imagem + o parágrafo de legenda
  // estático original pelos N blocos (imagem + legenda) gerados acima.
  const blocoOriginalRegex = /<w:p\b(?:(?!<\/w:p>)[\s\S])*?CROQUI_PLACEHOLDER(?:(?!<\/w:p>)[\s\S])*?<\/w:p><w:p\b(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/;
  docXml = docXml.replace(blocoOriginalRegex, blocos);

  zip.file('word/document.xml', docXml);
}

/**
 * Injeta memorial fotográfico em grade 2×N substituindo a tabela que contém `MEMORIAL_PLACEHOLDER`.
 * Cada foto é renderizada com tamanho fixo de 8 cm de largura por 6 cm de altura.
 * @param zip - Arquivo DOCX aberto como PizZip.
 * @param fotos - Lista de fotos com buffer, contentType, largura, altura e legenda.
 */
export function injetarMemorial(
  zip: PizZip,
  fotos: Array<{ buffer: Buffer; contentType: string; largura: number; altura: number; legenda: string }>,
): void {
  if (fotos.length === 0) return;

  fotos.forEach((foto, i) => {
    registrarImagem(zip, foto.buffer, foto.contentType, `memorial_foto_${i + 1}`, `rId${910 + i}`);
  });

  const cxFixo = cmParaEmu(8);
  const cyFixo = cmParaEmu(6);
  const cxCelula = cmParaEmu(8);

  const rPrLegenda = `<w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>`;
  const pPrCentro = `<w:pPr><w:jc w:val="center"/></w:pPr>`;

  const tcBordersNone =
    `<w:tcBorders>` +
    `<w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>` +
    `<w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>` +
    `<w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>` +
    `<w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>` +
    `</w:tcBorders>`;

  const tcPr = (w: number) =>
    `<w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${tcBordersNone}<w:vAlign w:val="center"/></w:tcPr>`;

  let linhas = '';
  for (let i = 0; i < fotos.length; i += 2) {
    const esq = fotos[i];
    const dir = fotos[i + 1] ?? null;

    const drawEsq = buildDrawingXml(`rId${910 + i}`, 910 + i, `MemorialFoto${i + 1}`, cxFixo, cyFixo);
    const celulaEsq =
      `<w:tc>${tcPr(5027)}` +
      `<w:p>${pPrCentro}<w:r>${rPrLegenda}${drawEsq}</w:r></w:p>` +
      `<w:p>${pPrCentro}<w:r>${rPrLegenda}<w:t>Foto ${i + 1} — ${esq.legenda}</w:t></w:r></w:p>` +
      `</w:tc>`;

    let celulaDir = '';
    if (dir) {
      const drawDir = buildDrawingXml(`rId${910 + i + 1}`, 910 + i + 1, `MemorialFoto${i + 2}`, cxFixo, cyFixo);
      celulaDir =
        `<w:tc>${tcPr(5027)}` +
        `<w:p>${pPrCentro}<w:r>${rPrLegenda}${drawDir}</w:r></w:p>` +
        `<w:p>${pPrCentro}<w:r>${rPrLegenda}<w:t>Foto ${i + 2} — ${dir.legenda}</w:t></w:r></w:p>` +
        `</w:tc>`;
    } else {
      celulaDir = `<w:tc>${tcPr(5027)}<w:p><w:pPr><w:jc w:val="center"/></w:pPr></w:p></w:tc>`;
    }

    linhas += `<w:tr>${celulaEsq}${celulaDir}</w:tr>`;
  }

  const novaTabela =
    `<w:tbl>` +
    `<w:tblPr>` +
    `<w:tblW w:w="${cxCelula * 2}" w:type="dxa"/>` +
    `<w:jc w:val="center"/>` +
    `<w:tblBorders>` +
    `<w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>` +
    `<w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>` +
    `<w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>` +
    `<w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>` +
    `<w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>` +
    `<w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>` +
    `</w:tblBorders>` +
    `</w:tblPr>` +
    `<w:tblGrid><w:gridCol w:w="5027"/><w:gridCol w:w="5027"/></w:tblGrid>` +
    linhas +
    `</w:tbl>`;

  const docFile = zip.file('word/document.xml');
  if (!docFile) return;
  let docXml = docFile.asText();

  const tblRegex = /(<w:tbl>(?:(?!<w:tbl>|<\/w:tbl>)[\s\S])*MEMORIAL_PLACEHOLDER[\s\S]*?<\/w:tbl>)/;
  docXml = docXml.replace(tblRegex, novaTabela);
  zip.file('word/document.xml', docXml);
}

/**
 * Marca todos os campos de fórmula no documento com w:dirty="true"
 * para forçar o Word a recalcular sumários, numeração de páginas, etc. ao abrir.
 * @param zip - Arquivo DOCX aberto como PizZip.
 */
export function atualizarSumario(zip: PizZip): void {
  const arquivos = ['word/document.xml', 'word/header1.xml', 'word/footer1.xml'];

  for (const arqPath of arquivos) {
    const arq = zip.file(arqPath);
    if (!arq) continue;

    let xml = arq.asText();
    xml = xml.replace(
      /<w:fldChar\s+w:fldCharType="begin"(?!\s+w:dirty)/g,
      '<w:fldChar w:fldCharType="begin" w:dirty="true"'
    );

    zip.file(arqPath, xml);
  }
}

/**
 * Busca imagem do mapa via Google Maps Static API.
 * Se coordenadas fornecidas, usa-as como centro+pino.
 * Caso contrário, usa o endereço textual.
 * Retorna { buffer, width, height } ou null em caso de falha.
 */
export async function buscarImagemMapa(
  endereco: string,
  coordenadas?: string,
): Promise<{ buffer: Buffer; width: number; height: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn('[docx route] GOOGLE_MAPS_API_KEY não definida — mapa omitido.');
    return null;
  }

  const width = 600, height = 400;
  const zoom = 19;
  const maptype = 'satellite';

  const mapUrl = new URL('https://maps.googleapis.com/maps/api/staticmap');
  mapUrl.searchParams.set('zoom', String(zoom));
  mapUrl.searchParams.set('size', `${width}x${height}`);
  mapUrl.searchParams.set('maptype', maptype);
  mapUrl.searchParams.set('key', apiKey);

  if (coordenadas && coordenadas.trim()) {
    const coord = coordenadas.trim();
    mapUrl.searchParams.set('center', coord);
    mapUrl.searchParams.set('markers', `color:red|${coord}`);
  } else {
    mapUrl.searchParams.set('center', endereco);
    mapUrl.searchParams.set('markers', `color:red|${endereco}`);
  }

  try {
    const urlStr = mapUrl.toString();
    console.log('[buscarImagemMapa] URL:', urlStr);
    const res = await fetch(urlStr);
    console.log('[buscarImagemMapa] status:', res.status, res.statusText);
    console.log('[buscarImagemMapa] content-type:', res.headers.get('content-type'));
    if (!res.ok) {
      const body = await res.text();
      console.warn('[buscarImagemMapa] body erro:', body.slice(0, 500));
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    console.log('[buscarImagemMapa] buffer size:', buffer.length);
    return { buffer, width, height };
  } catch (err) {
    console.warn('[buscarImagemMapa] exceção:', err);
    return null;
  }
}
