// src/app/api/ensaios/esclerometria/docx/route.ts
//
// POST /api/ensaios/esclerometria/docx
// Gera o laudo DOCX preenchido a partir do modelo_esclerometria.docx
//
// Dependências (já devem estar no projeto):
//   npm install pizzip docxtemplater
//   Arquivo public/modelo_esclerometria.docx deve existir

import { NextRequest, NextResponse } from 'next/server';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import path from 'path';
import fs from 'fs';

// ── Tipos ──────────────────────────────────────────────────────
type AmostraPayload = {
  amostra: string;
  posicao: string;
  ie_medio: string;
  ie_efetivo: string;
  resistencia: string;
  dispersao: string;
};

type RequestBody = {
  rlt: string;
  data: string;         // DD/MM/AAAA
  cliente: string;
  obra: string;
  att: string;
  endereco: string;
  respNome: string;
  respCrea: string;
  notas: string;
  bigorna: string[];    // 10 valores
  mediaBigorna: number;
  coefBigorna: number;
  amostras: AmostraPayload[];
};

// ── Helpers ────────────────────────────────────────────────────
function formatarData(ddmmaaaa: string): { capa: string; corpo: string } {
  const mesesCapa = [
    'JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO',
    'JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO',
  ];
  const mesesCorpo = [
    'janeiro','fevereiro','março','abril','maio','junho',
    'julho','agosto','setembro','outubro','novembro','dezembro',
  ];
  const partes = ddmmaaaa.split('/');
  if (partes.length !== 3) return { capa: '', corpo: '' };
  const [dd, mm, aaaa] = partes;
  const idx = parseInt(mm, 10) - 1;
  return {
    capa: `${mesesCapa[idx]}, ${aaaa}`,
    corpo: `Recife, ${dd} de ${mesesCorpo[idx]} de ${aaaa}`,
  };
}

function formatarRlt(rlt: string): string {
  const n = rlt.trim();
  if (!n) return 'RLT.LAU-XXX.26-00';
  if (/^\d+$/.test(n)) return `RLT.LAU-${n.padStart(3, '0')}.26-00`;
  return `RLT.LAU-${n}.26-00`;
}

// Converte delimiters {{ }} → [[ ]] no XML para evitar conflito com
// os GUIDs das imagens ({28A0092B-...}) que o docxtemplater confunde
// com marcadores de template.
function prepararXml(xml: string): string {
  return xml
    .replace(/\{\{/g, '[[')
    .replace(/\}\}/g, ']]')
    .replace(/\{#([^}]+)\}/g, '[#$1]')
    .replace(/\{\/([^}]+)\}/g, '[/$1]');
}

// ── Handler ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();

    // Carrega o template do disco (public/)
    const templatePath = path.join(process.cwd(), 'public', 'modelo_esclerometria.docx');
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { error: 'Template modelo_esclerometria.docx não encontrado em public/.' },
        { status: 500 }
      );
    }
    const templateBuffer = fs.readFileSync(templatePath);

    // Abre o ZIP
    const zip = new PizZip(templateBuffer);

    // Pré-processa todos os XMLs relevantes (troca delimiters)
    const arquivosAlvo = ['word/document.xml', 'word/header1.xml', 'word/footer1.xml'];
    for (const arquivo of arquivosAlvo) {
      const file = zip.file(arquivo);
      if (file) {
        const xml = file.asText();
        zip.file(arquivo, prepararXml(xml));
      }
    }

    // Monta os dados
    const datas = formatarData(body.data);
    const rltOficial = formatarRlt(body.rlt);

    const dados = {
      nome_ensaio: 'ESCLEROMETRIA',
      num_rlt: rltOficial,
      cliente: body.cliente || '—',
      obra: body.obra || '—',
      att: body.att || '—',
      data: datas.capa,
      segunda_data: datas.corpo,
      b1:  body.bigorna[0] ?? '',
      b2:  body.bigorna[1] ?? '',
      b3:  body.bigorna[2] ?? '',
      b4:  body.bigorna[3] ?? '',
      b5:  body.bigorna[4] ?? '',
      b6:  body.bigorna[5] ?? '',
      b7:  body.bigorna[6] ?? '',
      b8:  body.bigorna[7] ?? '',
      b9:  body.bigorna[8] ?? '',
      b10: body.bigorna[9] ?? '',
      media: body.mediaBigorna > 0 ? body.mediaBigorna.toFixed(2) : '—',
      coef:  body.coefBigorna !== 1 ? body.coefBigorna.toFixed(6) : '1,0000',
      amostras: body.amostras,
      notas: body.notas || '',
      resp_nome: body.respNome || '—',
      resp_crea: body.respCrea || '—',
    };

    // Renderiza
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '[[', end: ']]' },
    });

    doc.render(dados);

    const output = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    // Retorna o arquivo como download
    const nomeArquivo = `${rltOficial}.docx`;
    return new NextResponse(output, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
      },
    });
  } catch (err: unknown) {
    console.error('[docx route] Erro:', err);
    const msg = err instanceof Error ? err.message : 'Erro desconhecido.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
