// src/app/api/ensaios/resistividade/docx/route.ts
//
// POST /api/ensaios/resistividade/docx
// Gera o laudo DOCX preenchido a partir do modelo_resistividade.docx
//
// Dependências: pizzip + docxtemplater (já instaladas)
// Template: public/modelo_resistividade.docx

import { NextRequest, NextResponse } from 'next/server';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import path from 'path';
import fs from 'fs';
import {
  prepararXml,
  formatarData,
  formatarRlt,
  toTitleCase,
  injetarAssinatura,
  injetarMemorial,
  registrarImagem,
  buildDrawingXml,
  cmParaEmu,
} from '@/lib/docx/esclerometria';

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
};

// ── Tipos ──────────────────────────────────────────────────────
type MedicaoPayload = {
  item: number;
  elemento: string;
  posicao: string;
  l1: string; l2: string; l3: string; l4: string; l5: string;
  media: string;
  desvio: string;
  classificacao: string;
  // Memorial fotográfico
  fotoBase64?: string;
  fotoContentType?: string;
  fotoWidth?: number;
  fotoHeight?: number;
};

type RequestBody = {
  rlt: string; data: string; cliente: string; obra: string;
  att: string; endereco: string; notas: string;
  aparMarca: string; aparModelo: string; aparSerie: string;
  respNome: string; respCrea: string;
  respAssinaturaUrl: string;
  respAssinaturaBase64: string;
  respAssinaturaContentType: string;
  medicoes: MedicaoPayload[];
};

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
        const resp = await fetch(body.respAssinaturaUrl);
        if (resp.ok) {
          const ct = resp.headers.get('content-type') ?? 'image/png';
          assinaturaContentType = ct;
          assinaturaBuffer = Buffer.from(await resp.arrayBuffer());
        }
      } catch { /* assinatura opcional */ }
    }

    // ── Template ────────────────────────────────────────────────
    const templatePath = path.join(process.cwd(), 'public', 'modelo_resistividade.docx');
    const templateBuffer = fs.readFileSync(templatePath);

    const zip = new PizZip(templateBuffer);

    // Pré-processar XML: {{ }} → [[ ]]
    const docXmlPath = 'word/document.xml';
    const xmlOriginal = zip.file(docXmlPath)!.asText();
    zip.file(docXmlPath, prepararXml(xmlOriginal));

    // ── Dados formatados ────────────────────────────────────────
    const rltOficial = formatarRlt(body.rlt);
    const { capa: dataCapa, corpo: dataCorpo } = formatarData(body.data);
    const obraTitle  = toTitleCase(body.obra);
    const endTitle   = toTitleCase(body.endereco);

    // ── Template data ────────────────────────────────────────────
    const templateData = {
      num_rlt:      rltOficial,
      data_capa:    dataCapa,
      data_corpo:   dataCorpo,
      cliente:      body.cliente,
      obra:         body.obra,
      obra_intro:   obraTitle,
      att:          body.att,
      endereco:     body.endereco,
      endereco_intro: endTitle,
      apar_marca:   body.aparMarca || 'Proceq',
      apar_modelo:  body.aparModelo || 'Resipod',
      apar_serie:   body.aparSerie || '—',
      resp_nome:    body.respNome,
      resp_crea:    body.respCrea,
      notas:        body.notas || '',
      tem_notas:    !!body.notas?.trim(),
      medicoes: body.medicoes.map(m => ({
        item:          String(m.item),
        elemento:      m.elemento,
        posicao:       m.posicao,
        l1:            m.l1,
        l2:            m.l2,
        l3:            m.l3,
        l4:            m.l4,
        l5:            m.l5,
        media:         m.media,
        desvio:        m.desvio,
        classificacao: m.classificacao,
      })),
      // Seção memorial fotográfico (condicional)
      tem_fotos: body.medicoes.some(m => !!m.fotoBase64),
    };

    // ── Renderizar template ──────────────────────────────────────
    const doc = new Docxtemplater(zip, {
      delimiters: { start: '[[', end: ']]' },
      paragraphLoop: true,
      linebreaks: true,
    });

    doc.render(templateData);

    let zipResult = doc.getZip();

    // ── Injetar assinatura ───────────────────────────────────────
    if (assinaturaBuffer) {
      zipResult = injetarAssinatura(zipResult, assinaturaBuffer, assinaturaContentType);
    }

    // ── Injetar memorial fotográfico ─────────────────────────────
    const fotosParaMemorial = body.medicoes
      .filter(m => !!m.fotoBase64)
      .map((m, i) => ({
        base64:      m.fotoBase64!,
        contentType: m.fotoContentType ?? 'image/jpeg',
        width:       m.fotoWidth ?? 800,
        height:      m.fotoHeight ?? 600,
        legenda:     `Foto ${i + 1} — ${m.elemento} ${m.posicao}`,
      }));

    if (fotosParaMemorial.length > 0) {
      zipResult = injetarMemorial(zipResult, fotosParaMemorial);
    }

    // ── Gerar buffer final ───────────────────────────────────────
    const outputBuffer = zipResult.generate({ type: 'nodebuffer', compression: 'DEFLATE' });

    return new NextResponse(outputBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${rltOficial}.docx"`,
      },
    });

  } catch (err) {
    console.error('[resistividade/docx]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno ao gerar DOCX' },
      { status: 500 }
    );
  }
}