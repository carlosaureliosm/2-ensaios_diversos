// src/app/api/ensaios/aderencia/docx/route.ts
//
// POST /api/ensaios/aderencia/docx
// Gera o laudo DOCX de Resistência de Aderência à Tração a partir de public/modelo_aderencia.docx

import { NextRequest, NextResponse } from 'next/server';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import path from 'path';
import fs from 'fs';
import { injetarAssinatura, atualizarSumario } from '@/lib/docx/esclerometria';
import {
  montarDadosAderencia,
  injetarImagensAderencia,
  formatarRltAderencia,
  type AderenciaDocxPayload,
} from '@/lib/docx/aderencia';

type RequestBody = AderenciaDocxPayload & {
  respAssinaturaUrl?: string;
  respAssinaturaBase64?: string;
  respAssinaturaContentType?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();

    if (!body.cabecalho || !Array.isArray(body.situacoes) || body.situacoes.length === 0) {
      return NextResponse.json({ error: 'Payload inválido: cabecalho e situacoes são obrigatórios.' }, { status: 400 });
    }

    // ── Assinatura (opcional) ───────────────────────────────────
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
        console.warn('[aderencia docx] Falha ao baixar assinatura — omitindo.');
      }
    }

    // ── Template ────────────────────────────────────────────────
    const templatePath = path.join(process.cwd(), 'public', 'modelo_aderencia.docx');
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ error: 'Template modelo_aderencia.docx não encontrado em public/.' }, { status: 500 });
    }
    const zip = new PizZip(fs.readFileSync(templatePath));

    const { dados, imagens } = montarDadosAderencia(body);
    dados.resp_assinatura = assinaturaBuffer ? 'ASSINATURA_PLACEHOLDER' : '';

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '[[', end: ']]' },
      nullGetter: () => '',
    });
    doc.render(dados);

    const renderedZip = doc.getZip() as PizZip;

    // ── Injeções pós-render ─────────────────────────────────────
    if (assinaturaBuffer) injetarAssinatura(renderedZip, assinaturaBuffer, assinaturaContentType);
    injetarImagensAderencia(renderedZip, imagens);
    atualizarSumario(renderedZip);

    const output = renderedZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    const nomeArquivo = formatarRltAderencia(body.cabecalho.rltNumero);

    return new NextResponse(output as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${nomeArquivo}.docx"`,
      },
    });
  } catch (err: unknown) {
    console.error('[aderencia docx] Erro:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro desconhecido.' }, { status: 500 });
  }
}
