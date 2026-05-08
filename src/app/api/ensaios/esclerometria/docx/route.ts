// src/app/api/ensaios/esclerometria/docx/route.ts
//
// POST /api/ensaios/esclerometria/docx
// Gera o laudo DOCX preenchido a partir do modelo_esclerometria.docx
//
// Dependências: npm install pizzip docxtemplater

import { NextRequest, NextResponse } from 'next/server';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import path from 'path';
import fs from 'fs';

// ── Tipos ──────────────────────────────────────────────────────
type AmostraPayload = {
  item: number; amostra: string; posicao: string;
  ie_medio: string; ie_efetivo: string; resistencia: string; dispersao: string;
};

type RequestBody = {
  rlt: string; data: string; cliente: string; obra: string; att: string; endereco: string;
  respNome: string; respCrea: string;
  respAssinaturaUrl: string;        // URL pública/assinada (responsável padrão do perfil)
  respAssinaturaBase64: string;     // base64 puro sem prefixo data: (outro responsável)
  respAssinaturaContentType: string;
  notas: string; bigorna: string[];
  mediaBigorna: number; coefBigorna: number;
  amostras: AmostraPayload[];
};

// ── Helpers ────────────────────────────────────────────────────
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

/**
 * Injeta imagem de assinatura no ZIP pós-render.
 * O template deve conter [[resp_assinatura]] na célula da tabela de assinatura.
 * O docxtemplater renderiza esse marcador como texto "ASSINATURA_PLACEHOLDER",
 * que esta função substitui pelo XML <w:drawing> inline.
 */
function injetarAssinatura(zip: PizZip, imgBuffer: Buffer, contentType: string): void {
  const ext       = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/webp' ? 'webp' : 'png';
  const mediaPath = `word/media/assinatura_resp.${ext}`;
  const rId       = 'rId901';

  zip.file(mediaPath, imgBuffer);

  // Relationship
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (relsFile) {
    let xml = relsFile.asText();
    xml = xml.replace('</Relationships>',
      `  <Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/assinatura_resp.${ext}"/>\n</Relationships>`);
    zip.file('word/_rels/document.xml.rels', xml);
  }

  // ContentType
  const ctFile = zip.file('[Content_Types].xml');
  if (ctFile) {
    let xml = ctFile.asText();
    const mimes: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
    if (!xml.includes(`Extension="${ext}"`)) {
      xml = xml.replace('</Types>', `  <Default Extension="${ext}" ContentType="${mimes[ext]}"/>\n</Types>`);
      zip.file('[Content_Types].xml', xml);
    }
  }

  // Substitui placeholder por imagem inline (5 cm × 2 cm)
  const cx = 1800000, cy = 720000;
  const drawing =
    `</w:t></w:r><w:r>` +
    `<w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="901" name="AssinaturaResp"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="901" name="AssinaturaResp"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>` +
    `<a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>` +
    `</w:r><w:r><w:t>`;

  const docFile = zip.file('word/document.xml');
  if (docFile) {
    const docXml = docFile.asText().replace('ASSINATURA_PLACEHOLDER', drawing);
    zip.file('word/document.xml', docXml);
  }
}

// ── Handler ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();

    // Resolve buffer de assinatura
    let assinaturaBuffer: Buffer | null = null;
    let assinaturaContentType = body.respAssinaturaContentType || 'image/png';

    if (body.respAssinaturaBase64) {
      // Outro responsável: base64 enviado pelo frontend
      assinaturaBuffer = Buffer.from(body.respAssinaturaBase64, 'base64');
    } else if (body.respAssinaturaUrl) {
      // Responsável padrão: baixa da URL do Supabase Storage
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

    // Carrega template
    const templatePath = path.join(process.cwd(), 'public', 'modelo_esclerometria.docx');
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ error: 'Template modelo_esclerometria.docx não encontrado em public/.' }, { status: 500 });
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
      obra:         body.obra     || '—',
      att:          body.att      || '—',
      endereco:     body.endereco || '—',
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
      notas:        body.notas    || '',
      resp_nome:    body.respNome || '—',
      resp_crea:    body.respCrea || '—',
      // Placeholder trocado por imagem abaixo; string vazia = sem imagem
      resp_assinatura: assinaturaBuffer ? 'ASSINATURA_PLACEHOLDER' : '',
    };

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '[[', end: ']]' },
    });
    doc.render(dados);

    const renderedZip = doc.getZip() as PizZip;
    if (assinaturaBuffer) {
      injetarAssinatura(renderedZip, assinaturaBuffer, assinaturaContentType);
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
      { status: 500 }
    );
  }
}