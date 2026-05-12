// src/app/api/ensaios/esclerometria/docx/route.ts
//
// POST /api/ensaios/esclerometria/docx
// Gera o laudo DOCX preenchido a partir do modelo_esclerometria.docx
//
// Dependências: npm install pizzip docxtemplater
// Variáveis de ambiente: GOOGLE_MAPS_API_KEY

import { NextRequest, NextResponse } from 'next/server';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import path from 'path';
import fs from 'fs';

// ── Tipos ──────────────────────────────────────────────────────
type AmostraPayload = {
  item: number; amostra: string; posicao: string;
  ie_medio: string; ie_efetivo: string; resistencia: string; dispersao: string;
  // Memorial fotográfico: base64 puro sem prefixo data:, ou vazio
  fotoBase64?: string;
  fotoContentType?: string;
  // Largura e altura originais da foto em pixels (para calcular proporção)
  fotoWidth?: number;
  fotoHeight?: number;
};

type RequestBody = {
  rlt: string; data: string; cliente: string; obra: string; att: string; endereco: string;
  // Coordenadas opcionais para mapa (prioridade sobre endereço no geocoding)
  coordenadas?: string; // formato "lat,lng" ex: "-8.0522,-34.9286"
  respNome: string; respCrea: string;
  respAssinaturaUrl: string;
  respAssinaturaBase64: string;
  respAssinaturaContentType: string;
  notas: string; bigorna: string[];
  mediaBigorna: number; coefBigorna: number;
  amostras: AmostraPayload[];
  // Motivação (opcional, checkbox no site)
  motivacao?: string;
  // Foto geral (opcional, checkbox no site)
  fotoGeralBase64?: string;
  fotoGeralContentType?: string;
  fotoGeralWidth?: number;
  fotoGeralHeight?: number;
  // Croqui (opcional, checkbox no site)
  croquiBase64?: string;
  croquiContentType?: string;
  croquiWidth?: number;
  croquiHeight?: number;
};

// ── Helpers ────────────────────────────────────────────────────
function toTitleCase(str: string): string {
  if (!str) return str;
  // Palavras que não devem ser capitalizadas (preposições/artigos PT-BR)
  const minusculas = new Set(['de','da','do','das','dos','e','em','na','no','nas','nos','a','o','as','os','com','por','para','um','uma']);
  return str
    .toLowerCase()
    .split(' ')
    .map((word, i) => (i === 0 || !minusculas.has(word)) ? word.charAt(0).toUpperCase() + word.slice(1) : word)
    .join(' ');
}

function formatarData(ddmmaaaa: string): { capa: string; corpo: string } {
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

function formatarRlt(rlt: string): string {
  const n = rlt.trim();
  if (!n) return 'RLT.LAU-XXX.26-00';
  if (/^\d+$/.test(n)) return `RLT.LAU-${n.padStart(3, '0')}.26-00`;
  return `RLT.LAU-${n}.26-00`;
}

function prepararXml(xml: string): string {
  return xml
    .replace(/\{\{/g, '[[').replace(/\}\}/g, ']]')
    .replace(/\{#([^}]+)\}/g, '[#$1]').replace(/\{\/([^}]+)\}/g, '[/$1]');
}

/** Converte cm para EMU (English Metric Units): 1 cm = 914400/2.54 EMU */
function cmParaEmu(cm: number): number {
  return Math.round(cm * 914400 / 2.54);
}

/** Monta o XML <w:drawing> inline para uma imagem já registrada no ZIP */
function buildDrawingXml(rId: string, docPrId: number, name: string, cx: number, cy: number): string {
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
function registrarImagem(
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

// ── Injetores de imagem ────────────────────────────────────────

/**
 * Injeta assinatura (5 cm × 2 cm fixo).
 * Placeholder no template: ASSINATURA_PLACEHOLDER
 */
function injetarAssinatura(zip: PizZip, imgBuffer: Buffer, contentType: string): void {
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
 * Injeta imagem do mapa (10 cm largura, altura proporcional).
 * Placeholder no template: MAPA_PLACEHOLDER
 */
function injetarMapa(zip: PizZip, imgBuffer: Buffer, imgWidth: number, imgHeight: number): void {
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
 * Injeta foto geral da estrutura (15 cm largura, altura proporcional).
 * Placeholder no template: FOTO_GERAL_PLACEHOLDER
 */
function injetarFotoGeral(zip: PizZip, imgBuffer: Buffer, contentType: string, imgWidth: number, imgHeight: number): void {
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
 * Injeta croqui com indicação dos elementos (15 cm largura, altura proporcional).
 * Placeholder no template: CROQUI_PLACEHOLDER
 */
function injetarCroqui(zip: PizZip, imgBuffer: Buffer, contentType: string, imgWidth: number, imgHeight: number): void {
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

/**
 * Injeta memorial fotográfico como tabela 2 colunas.
 * Cada foto: 5 cm de altura, largura proporcional.
 * Placeholder no template: MEMORIAL_PLACEHOLDER (dentro de [[#fotos_memorial]]..[[/fotos_memorial]])
 *
 * Estrutura gerada: substitui a <w:tbl> inteira que contém MEMORIAL_PLACEHOLDER
 * por uma nova tabela com todas as fotos em grid 2×N.
 */
function injetarMemorial(
  zip: PizZip,
  fotos: Array<{ buffer: Buffer; contentType: string; largura: number; altura: number; legenda: string }>,
): void {
  if (fotos.length === 0) return;

  // Registrar todas as imagens no ZIP
  fotos.forEach((foto, i) => {
    registrarImagem(zip, foto.buffer, foto.contentType, `memorial_foto_${i + 1}`, `rId${910 + i}`);
  });

  // Altura fixa 5 cm, largura proporcional
  const cyFixo = cmParaEmu(5);

  // Largura de cada célula: metade da área útil (A4 com margens 2,5cm cada lado)
  // Área útil ≈ 21 - 5 = 16 cm → célula = 8 cm
  const cxCelula = cmParaEmu(8);

  // Font run padrão para legendas
  const rPrLegenda = `<w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>`;
  const pPrCentro = `<w:pPr><w:jc w:val="center"/></w:pPr>`;

  // Propriedades de célula compartilhadas
  const tcPr = (w: number) =>
    `<w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>`;

  // Monta linhas da tabela (pares de fotos)
  let linhas = '';
  for (let i = 0; i < fotos.length; i += 2) {
    const esq = fotos[i];
    const dir = fotos[i + 1] ?? null;

    const cxEsq = Math.round(cyFixo * esq.largura / esq.altura);
    const drawEsq = buildDrawingXml(`rId${910 + i}`, 910 + i, `MemorialFoto${i + 1}`, cxEsq, cyFixo);
    const celulaEsq =
      `<w:tc>${tcPr(5027)}` +
      `<w:p>${pPrCentro}<w:r>${rPrLegenda}${drawEsq}</w:r></w:p>` +
      `<w:p>${pPrCentro}<w:r>${rPrLegenda}<w:t>Foto ${i + 1} \u2014 ${esq.legenda}</w:t></w:r></w:p>` +
      `</w:tc>`;

    let celulaDir = '';
    if (dir) {
      const cxDir = Math.round(cyFixo * dir.largura / dir.altura);
      const drawDir = buildDrawingXml(`rId${910 + i + 1}`, 910 + i + 1, `MemorialFoto${i + 2}`, cxDir, cyFixo);
      celulaDir =
        `<w:tc>${tcPr(5027)}` +
        `<w:p>${pPrCentro}<w:r>${rPrLegenda}${drawDir}</w:r></w:p>` +
        `<w:p>${pPrCentro}<w:r>${rPrLegenda}<w:t>Foto ${i + 2} \u2014 ${dir.legenda}</w:t></w:r></w:p>` +
        `</w:tc>`;
    } else {
      // Célula vazia para completar a linha
      celulaDir = `<w:tc>${tcPr(5027)}<w:p><w:pPr><w:jc w:val="center"/></w:pPr></w:p></w:tc>`;
    }

    linhas += `<w:tr>${celulaEsq}${celulaDir}</w:tr>`;
  }

  // Tabela completa
  const novaTabela =
    `<w:tbl>` +
    `<w:tblPr>` +
    `<w:tblW w:w="${cxCelula * 2}" w:type="dxa"/>` +
    `<w:jc w:val="center"/>` +
    `<w:tblBorders>` +
    `<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>` +
    `<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>` +
    `<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>` +
    `<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>` +
    `<w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>` +
    `<w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>` +
    `</w:tblBorders>` +
    `</w:tblPr>` +
    `<w:tblGrid><w:gridCol w:w="5027"/><w:gridCol w:w="5027"/></w:tblGrid>` +
    linhas +
    `</w:tbl>`;

  // Substitui a tabela inteira que contém MEMORIAL_PLACEHOLDER
  const docFile = zip.file('word/document.xml');
  if (!docFile) return;
  let docXml = docFile.asText();

  // Regex para capturar a <w:tbl>...</w:tbl> que contém MEMORIAL_PLACEHOLDER
  const tblRegex = /(<w:tbl>(?:(?!<w:tbl>|<\/w:tbl>)[\s\S])*MEMORIAL_PLACEHOLDER[\s\S]*?<\/w:tbl>)/;
  docXml = docXml.replace(tblRegex, novaTabela);
  zip.file('word/document.xml', docXml);
}

// ── Mapa via Google Maps Static API ───────────────────────────

/**
 * Busca imagem do mapa via Google Maps Static API.
 * Se coordenadas fornecidas, usa-as como centro+pino.
 * Caso contrário, usa o endereço textual.
 * Retorna { buffer, width, height } ou null em caso de falha.
 */
async function buscarImagemMapa(
  endereco: string,
  coordenadas?: string,
): Promise<{ buffer: Buffer; width: number; height: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn('[docx route] GOOGLE_MAPS_API_KEY não definida — mapa omitido.');
    return null;
  }

  // Dimensões da imagem: 600×400 px (proporção usada para calcular EMU)
  const width = 600, height = 400;
  const size = `${width}x${height}`;
  const zoom = 16;
  const maptype = 'satellite';

  let center: string;
  let markers: string;

  if (coordenadas && coordenadas.trim()) {
    // Prioridade: coordenadas
    center = coordenadas.trim();
    markers = `color:red|${coordenadas.trim()}`;
  } else {
    // Fallback: endereço textual
    center = encodeURIComponent(endereco);
    markers = `color:red|${encodeURIComponent(endereco)}`;
  }

  const url =
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${center}&zoom=${zoom}&size=${size}&maptype=${maptype}` +
    `&markers=${markers}&key=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[docx route] Maps Static API retornou ${res.status} — mapa omitido.`);
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, width, height };
  } catch (err) {
    console.warn('[docx route] Falha ao buscar mapa:', err);
    return null;
  }
}

// ── Handler ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();

    // ── Assinatura ──────────────────────────────────────────────
    let assinaturaBuffer: Buffer | null = null;
    let assinaturaContentType = body.respAssinaturaContentType || 'image/png';

    if (body.respAssinaturaBase64) {
      assinaturaBuffer = Buffer.from(body.respAssinaturaBase64, 'base64');
    } else if (body.respAssinaturaUrl) {
      try {
        const r = await fetch(body.respAssinaturaUrl);
        if (r.ok) {
          assinaturaContentType = r.headers.get('content-type') ?? 'image/png';
          assinaturaBuffer = Buffer.from(await r.arrayBuffer());
        }
      } catch {
        console.warn('[docx route] Falha ao baixar assinatura — omitindo.');
      }
    }

    // ── Mapa ────────────────────────────────────────────────────
    const mapaResult = await buscarImagemMapa(body.endereco, body.coordenadas);

    // ── Foto geral ──────────────────────────────────────────────
    const fotoGeralBuffer = body.fotoGeralBase64
      ? Buffer.from(body.fotoGeralBase64, 'base64')
      : null;

    // ── Croqui ──────────────────────────────────────────────────
    const croquiBuffer = body.croquiBase64
      ? Buffer.from(body.croquiBase64, 'base64')
      : null;

    // ── Fotos do memorial ───────────────────────────────────────
    const fotosMemorial = (body.amostras ?? [])
      .filter(a => a.fotoBase64 && a.fotoWidth && a.fotoHeight)
      .map(a => ({
        buffer: Buffer.from(a.fotoBase64!, 'base64'),
        contentType: a.fotoContentType || 'image/jpeg',
        largura: a.fotoWidth!,
        altura: a.fotoHeight!,
        legenda: a.amostra,
      }));

    // ── Carrega template ────────────────────────────────────────
    const templatePath = path.join(process.cwd(), 'public', 'modelo_esclerometria.docx');
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { error: 'Template modelo_esclerometria.docx não encontrado em public/.' },
        { status: 500 },
      );
    }
    const zip = new PizZip(fs.readFileSync(templatePath));

    // Pré-processa XMLs
    for (const arq of ['word/document.xml', 'word/header1.xml', 'word/footer1.xml']) {
      const f = zip.file(arq);
      if (f) zip.file(arq, prepararXml(f.asText()));
    }

    const datas      = formatarData(body.data);
    const rltOficial = formatarRlt(body.rlt);

    const dados = {
      nome_ensaio:  'ESCLEROMETRIA',
      num_rlt:      rltOficial,
      cliente:      body.cliente  || '—',
      // Capa: original; Introdução: title case (campos separados)
      obra:         body.obra     || '—',
      obra_intro:   toTitleCase(body.obra || ''),
      att:          body.att      || '—',
      endereco:     body.endereco || '—',
      endereco_intro: toTitleCase(body.endereco || ''),
      data:         datas.capa,
      segunda_data: datas.corpo,
      b1: body.bigorna[0] ?? '', b2: body.bigorna[1] ?? '',
      b3: body.bigorna[2] ?? '', b4: body.bigorna[3] ?? '',
      b5: body.bigorna[4] ?? '', b6: body.bigorna[5] ?? '',
      b7: body.bigorna[6] ?? '', b8: body.bigorna[7] ?? '',
      b9: body.bigorna[8] ?? '', b10: body.bigorna[9] ?? '',
      media:        body.mediaBigorna > 0 ? body.mediaBigorna.toFixed(2) : '—',
      coef:         body.coefBigorna !== 1 ? body.coefBigorna.toFixed(6) : '1,0000',
      amostras:     body.amostras,
      notas:        body.notas || '',
      resp_nome:    body.respNome || '—',
      resp_crea:    body.respCrea || '—',
      resp_assinatura: assinaturaBuffer ? 'ASSINATURA_PLACEHOLDER' : '',
      // Campos condicionais
      mapa:             mapaResult ? 'MAPA_PLACEHOLDER' : '',
      motivacao:        body.motivacao || '',
      foto_geral:       fotoGeralBuffer ? true : false,
      foto_geral_imagem: fotoGeralBuffer ? 'FOTO_GERAL_PLACEHOLDER' : '',
      croqui:           croquiBuffer ? true : false,
      croqui_imagem:    croquiBuffer ? 'CROQUI_PLACEHOLDER' : '',
      fotos_memorial:   fotosMemorial.length > 0 ? true : false,
    };

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '[[', end: ']]' },
    });
    doc.render(dados);

    const renderedZip = doc.getZip() as PizZip;

    // ── Injeções pós-render ─────────────────────────────────────
    if (assinaturaBuffer) {
      injetarAssinatura(renderedZip, assinaturaBuffer, assinaturaContentType);
    }
    if (mapaResult) {
      injetarMapa(renderedZip, mapaResult.buffer, mapaResult.width, mapaResult.height);
    }
    if (fotoGeralBuffer && body.fotoGeralWidth && body.fotoGeralHeight) {
      injetarFotoGeral(
        renderedZip,
        fotoGeralBuffer,
        body.fotoGeralContentType || 'image/jpeg',
        body.fotoGeralWidth,
        body.fotoGeralHeight,
      );
    }
    if (croquiBuffer && body.croquiWidth && body.croquiHeight) {
      injetarCroqui(
        renderedZip,
        croquiBuffer,
        body.croquiContentType || 'image/jpeg',
        body.croquiWidth,
        body.croquiHeight,
      );
    }
    if (fotosMemorial.length > 0) {
      injetarMemorial(renderedZip, fotosMemorial);
    }

    const output = renderedZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });

    return new NextResponse(output, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${rltOficial}.docx"`,
      },
    });
  } catch (err: unknown) {
    console.error('[docx route] Erro:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro desconhecido.' },
      { status: 500 },
    );
  }
}