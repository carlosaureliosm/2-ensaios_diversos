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
import {
  prepararXml,
  formatarData,
  formatarRlt,
  toTitleCase,
  buscarImagemMapa,
  injetarAssinatura,
  injetarMapa,
  injetarFotoGeral,
  injetarCroquiMultiplo,
  injetarMemorial,
  atualizarSumario,
} from '@/lib/docx/esclerometria';

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
};

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
  // Croqui (opcional, checkbox no site) — N imagens, cada uma com legenda própria
  croquiImagens?: Array<{
    base64: string;
    contentType: string;
    width: number;
    height: number;
    legenda: string;
  }>;
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

    // ── Croqui (N imagens) ──────────────────────────────────────
    const croquiImagens = (body.croquiImagens ?? [])
      .filter(img => img.base64 && img.width && img.height)
      .map(img => ({
        buffer: Buffer.from(img.base64, 'base64'),
        contentType: img.contentType || 'image/jpeg',
        width: img.width,
        height: img.height,
        legenda: img.legenda || '',
      }));

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
      coef:         body.coefBigorna !== 1 ? body.coefBigorna.toFixed(3) : '1,000',
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
      croqui:           croquiImagens.length > 0,
      croqui_imagem:    croquiImagens.length > 0 ? 'CROQUI_PLACEHOLDER' : '',
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
    if (croquiImagens.length > 0) {
      injetarCroquiMultiplo(renderedZip, croquiImagens);
    }
    if (fotosMemorial.length > 0) {
      injetarMemorial(renderedZip, fotosMemorial);
    }

    // ── Atualiza campos de sumário/numeração ─────────────────────
    atualizarSumario(renderedZip);

    const output = renderedZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });

    return new NextResponse(output as unknown as BodyInit, {
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
