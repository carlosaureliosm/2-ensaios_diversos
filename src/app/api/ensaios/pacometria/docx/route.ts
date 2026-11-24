// src/app/api/ensaios/pacometria/docx/route.ts
//
// POST /api/ensaios/pacometria/docx
// Gera o laudo DOCX de Pacometria a partir de public/modelo_pacometria.docx

import { NextRequest, NextResponse } from 'next/server';
import { baixarAssinaturaDoUsuario, usuarioAtual } from '@/lib/auth';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import path from 'path';
import fs from 'fs';
import {
  atualizarSumario,
  buscarImagemMapa,
  formatarRlt,
  injetarAssinatura,
  sanitizarNomeArquivoDocx,
} from '@/lib/docx/esclerometria';
import {
  injetarBlocoElementosPacometria,
  injetarImagensPacometria,
  montarDadosPacometria,
  type PacometriaDocxPayload,
} from '@/lib/docx/pacometria';
import { baixarFotoObra } from '@/lib/pacometriaObraStorage';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await usuarioAtual();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  try {
    const body: PacometriaDocxPayload = await req.json();

    if (!body.cab || !Array.isArray(body.amostras) || body.amostras.length === 0) {
      return NextResponse.json(
        { error: 'Payload inválido: cab e ao menos uma amostra são obrigatórios.' },
        { status: 400 },
      );
    }

    // ── Assinatura (opcional) ───────────────────────────────────
    let assinaturaBuffer: Buffer | null = null;
    let assinaturaContentType = body.outroRespContentType || 'image/png';
    if (body.outroRespBase64) {
      assinaturaBuffer = Buffer.from(body.outroRespBase64, 'base64');
    } else if (body.assinaturaUrl) {
      // assinaturaUrl apenas sinaliza usar a assinatura do usuário logado (nunca fazer fetch da URL do cliente — SSRF)
      const assinatura = await baixarAssinaturaDoUsuario(user);
      if (assinatura) {
        assinaturaBuffer = assinatura.buffer;
        assinaturaContentType = assinatura.contentType;
      }
    }

    // ── Mapa de localização (opcional, só se endereço preenchido) ─
    const enderecoLimpo = body.cab.endereco?.trim() ?? '';
    const mapaResult = enderecoLimpo ? await buscarImagemMapa(enderecoLimpo) : null;

    // ── Hidratar fotos vindas do Modo Obra (Storage privado, sem SSRF) ──
    const amostrasHidratadas = await Promise.all(
      body.amostras.map(async a => {
        if (a.foto?.base64 || !a.fotoPath) return a;
        const baixada = await baixarFotoObra(a.fotoPath);
        if (!baixada) return a;
        return {
          ...a,
          foto: {
            base64: baixada.base64,
            contentType: baixada.contentType,
            width: a.fotoWidth || 800,
            height: a.fotoHeight || 600,
          },
        };
      }),
    );
    const bodyHidratado: PacometriaDocxPayload = { ...body, amostras: amostrasHidratadas };

    // ── Template ────────────────────────────────────────────────
    const templatePath = path.join(process.cwd(), 'public', 'modelo_pacometria.docx');
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { error: 'Template modelo_pacometria.docx não encontrado em public/.' },
        { status: 500 },
      );
    }
    const zip = new PizZip(fs.readFileSync(templatePath));

    const { dados, blocoElementosXml, imagens } = montarDadosPacometria(bodyHidratado, mapaResult);
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
    injetarBlocoElementosPacometria(renderedZip, blocoElementosXml);
    if (assinaturaBuffer) {
      injetarAssinatura(renderedZip, assinaturaBuffer, assinaturaContentType);
    }
    injetarImagensPacometria(renderedZip, imagens);
    atualizarSumario(renderedZip);

    const output = renderedZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    const nomeArquivo = sanitizarNomeArquivoDocx(body.rltOficial?.trim() || formatarRlt(body.cab.rlt || ''));

    return new NextResponse(output as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${nomeArquivo}.docx"`,
      },
    });
  } catch (err: unknown) {
    console.error('[pacometria docx] Erro:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro desconhecido ao gerar relatório.' },
      { status: 500 },
    );
  }
}
