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
  injetarFotoGeral,
  injetarCroqui,
  injetarMapa,
  buscarImagemMapa,
} from '@/lib/docx/esclerometria';

// App Router: route handlers não possuem limite artificial de body.
// O bodySizeLimit para server actions está configurado em next.config.ts.
export const maxDuration = 60;

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
  motivacao: string;
  coordenadas?: string;
  aparMarca: string; aparModelo: string; aparSerie: string;
  respNome: string; respCrea: string;
  respAssinaturaUrl: string;
  respAssinaturaBase64: string;
  respAssinaturaContentType: string;
  fotoGeralBase64?: string;
  fotoGeralContentType?: string;
  fotoGeralWidth?: number;
  fotoGeralHeight?: number;
  croquiBase64?:      string | null;
  croquiContentType?: string | null;
  croquiWidth?:       number | null;
  croquiHeight?:      number | null;
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

    // ── Foto geral ──────────────────────────────────────────────
    let fotoGeralBuffer: Buffer | null = null;
    const fotoGeralContentType = body.fotoGeralContentType || 'image/jpeg';
    const fotoGeralWidth = body.fotoGeralWidth ?? 800;
    const fotoGeralHeight = body.fotoGeralHeight ?? 600;
    if (body.fotoGeralBase64) {
      fotoGeralBuffer = Buffer.from(body.fotoGeralBase64, 'base64');
    }

    // ── Template ────────────────────────────────────────────────
    const templatePath = path.join(process.cwd(), 'public', 'modelo_resistividade.docx');
    const templateBuffer = fs.readFileSync(templatePath);
    const zip = new PizZip(templateBuffer);

    // Pré-processar XML: {{ }} → [[ ]] em document, header e footer
    for (const xmlPath of ['word/document.xml', 'word/header1.xml', 'word/footer1.xml']) {
      const file = zip.file(xmlPath);
      if (file) zip.file(xmlPath, prepararXml(file.asText()));
    }

    // ── Dados formatados ────────────────────────────────────────
    const rltOficial = formatarRlt(body.rlt);
    const { capa: dataCapa, corpo: dataCorpo } = formatarData(body.data);
    const obraTitle  = toTitleCase(body.obra);
    const endTitle   = toTitleCase(body.endereco);

    // ── Template data ────────────────────────────────────────────
    const templateData = {
      num_rlt:        rltOficial,
      data_capa:      dataCapa,
      data_corpo:     dataCorpo,
      cliente:        body.cliente,
      obra:           body.obra,
      obra_intro:     obraTitle,
      att:            body.att,
      endereco:       body.endereco,
      endereco_intro: endTitle,
      motivacao:      body.motivacao || '',
      foto_geral:     !!body.fotoGeralBase64,
      apar_marca:     body.aparMarca || 'Proceq',
      apar_modelo:    body.aparModelo || 'Resipod',
      apar_serie:     body.aparSerie || '—',
      resp_nome:      body.respNome,
      resp_crea:      body.respCrea,
      notas:          body.notas || '',
      tem_notas:      !!body.notas?.trim(),
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
      tem_fotos: body.medicoes.some(m => !!m.fotoBase64),
    };

    // ── Renderizar template ──────────────────────────────────────
    const doc = new Docxtemplater(zip, {
      delimiters: { start: '[[', end: ']]' },
      paragraphLoop: true,
      linebreaks: true,
    });

    doc.render(templateData);

    const zipResult = doc.getZip();

    // ── Injetar assinatura ───────────────────────────────────────
    if (assinaturaBuffer) {
      injetarAssinatura(zipResult, assinaturaBuffer, assinaturaContentType);
    }

    // ── Injetar foto geral ───────────────────────────────────────
    if (fotoGeralBuffer) {
      injetarFotoGeral(zipResult, fotoGeralBuffer, fotoGeralContentType, fotoGeralWidth, fotoGeralHeight);
    }

    // ── Injetar croqui ──────────────────────────────────────────
    if (body.croquiBase64) {
      const croquiBuffer = Buffer.from(body.croquiBase64, 'base64');
      const croquiContentType = body.croquiContentType ?? 'image/jpeg';
      const croquiWidth  = body.croquiWidth  ?? 800;
      const croquiHeight = body.croquiHeight ?? 600;
      injetarCroqui(zipResult, croquiBuffer, croquiContentType, croquiWidth, croquiHeight);
    }

    // ── Injetar mapa ─────────────────────────────────────────────
    const mapa = await buscarImagemMapa(body.endereco, body.coordenadas);
    if (mapa) {
      injetarMapa(zipResult, mapa.buffer, mapa.width, mapa.height);
    }

    // ── Injetar memorial fotográfico ─────────────────────────────
    const fotosParaMemorial = body.medicoes
      .filter(m => !!m.fotoBase64)
      .map(m => ({
        buffer:      Buffer.from(m.fotoBase64!, 'base64'),
        contentType: m.fotoContentType ?? 'image/jpeg',
        largura:     m.fotoWidth ?? 800,
        altura:      m.fotoHeight ?? 600,
        legenda:     `${m.elemento} ${m.posicao}`,
      }));

    if (fotosParaMemorial.length > 0) {
      injetarMemorial(zipResult, fotosParaMemorial);
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
