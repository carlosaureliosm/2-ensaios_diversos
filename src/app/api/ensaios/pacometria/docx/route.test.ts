// Teste ponta a ponta da geração do laudo de Pacometria (rota real + template real).
// Define PACOMETRIA_SAIDA=<caminho.docx> para gravar o arquivo gerado e abri-lo no Word.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import PizZip from 'pizzip';
import fs from 'fs';
import { POST } from '@/app/api/ensaios/pacometria/docx/route';
import {
  gerarSvgEsquemaPacometria,
  gerarSvgsPerfisPacometria,
} from '@/modules/pacometria/svgRelatorio';
import type { AmostraRow } from '@/modules/pacometria/types';

let mockUser: { id: string; user_metadata?: Record<string, string> } | null = { id: 'user-1' };

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: mockUser } }),
    },
  }),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        download: async () => ({
          data: new Blob([Buffer.from(PNG_1X1, 'base64')]),
          error: null,
        }),
      }),
    },
  }),
}));

const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const imgMock = (w = 440, h = 220) => ({
  base64: PNG_1X1,
  contentType: 'image/png',
  width: w,
  height: h,
});

function validarXmlBemFormado(xml: string) {
  const pilha: string[] = [];
  for (const m of xml.matchAll(/<(\/?)([\w:.-]+)(?:\s[^>]*?)?(\/?)>/g)) {
    if (m[3] === '/') continue;
    if (m[1] === '/') expect(pilha.pop()).toBe(m[2]);
    else pilha.push(m[2]);
  }
  expect(pilha).toEqual([]);
}

const amostraPilar: AmostraRow = {
  id: 'p1',
  item: 1,
  elemento: 'Pilar P-01 (Térreo)',
  tipo: 'pilar',
  opcao: 'C',
  X: 30,
  Y: 50,
  C1: 0,
  C2: 0,
  D: 0,
  barras: { '1X': 3, '1Y': 4 },
  facesData: {
    '1X': {
      nEstribos: 3,
      cob: ['18', '22', '24'],
      espV: ['15', '15'],
      espH: ['11', '11'],
      cobPerpIni: '25',
      cobPerpFim: '26',
    },
    '1Y': {
      nEstribos: 3,
      cob: ['25', '25', '27'],
      espV: ['14', '16'],
      espH: ['12', '12', '12'],
      cobPerpIni: '24',
      cobPerpFim: '24',
    },
  },
  cobMedio: null,
  cobMinimo: null,
  cobMaximo: null,
  cobDesvio: null,
  cobCV: null,
  cobModa: null,
};

const amostraPilarCirc: AmostraRow = {
  id: 'p2',
  item: 2,
  elemento: 'Pilar Circular PC-02',
  tipo: 'pilar',
  opcao: 'E',
  X: 0,
  Y: 0,
  C1: 0,
  C2: 0,
  D: 40,
  barras: { circ: 8 },
  facesData: {
    circ: {
      nEstribos: 2,
      cob: ['30', '32'],
      espV: ['12'],
      espH: [],
      cobPerpIni: '',
      cobPerpFim: '',
    },
  },
  cobMedio: null,
  cobMinimo: null,
  cobMaximo: null,
  cobDesvio: null,
  cobCV: null,
  cobModa: null,
};

const amostraViga: AmostraRow = {
  id: 'v1',
  item: 3,
  elemento: 'Viga V-104 & Balanço',
  tipo: 'viga',
  opcao: 'VA',
  X: 20,
  Y: 55,
  C1: 0,
  C2: 0,
  D: 0,
  barras: { fundo: 3, lat1: 2, lat2: 2 },
  facesData: {
    fundo: { nEstribos: 3, cob: ['28', '30', '30'], espV: ['15', '15'], espH: ['6', '6'], cobPerpIni: '28', cobPerpFim: '29' },
    lat1: { nEstribos: 2, cob: ['26', '27'], espV: ['15'], espH: ['40'], cobPerpIni: '30', cobPerpFim: '30' },
    lat2: { nEstribos: 2, cob: ['29', '28'], espV: ['15'], espH: ['40'], cobPerpIni: '30', cobPerpFim: '30' },
  },
  cobMedio: null,
  cobMinimo: null,
  cobMaximo: null,
  cobDesvio: null,
  cobCV: null,
  cobModa: null,
};

const amostraLaje: AmostraRow = {
  id: 'l1',
  item: 4,
  elemento: 'Laje L-05 <Garagem>',
  tipo: 'laje',
  opcao: 'LA',
  X: 0,
  Y: 0,
  C1: 0,
  C2: 0,
  D: 0,
  barras: {},
  facesData: {},
  lajeData: {
    larguraX: 100,
    alturaY: 100,
    passoGrid: 10,
    camadaExterna: 'H',
    barrasH: [
      { id: 'h1', pos: 20, cob: '22' },
      { id: 'h2', pos: 40, cob: '24' },
      { id: 'h3', pos: 60, cob: '22' },
    ],
    barrasV: [
      { id: 'v1', pos: 25, cob: '' },
      { id: 'v2', pos: 50, cob: '' },
    ],
    cobPerpHSup: '25',
    cobPerpHInf: '26',
    cobPerpVEsq: '24',
    cobPerpVDir: '24',
  },
  cobMedio: null,
  cobMinimo: null,
  cobMaximo: null,
  cobDesvio: null,
  cobCV: null,
  cobModa: null,
};

describe('geração DOCX de pacometria (ponta a ponta)', () => {
  beforeEach(() => {
    mockUser = { id: 'user-1' };
  });

  it('retorna 401 quando não autenticado e 400 quando sem amostras', async () => {
    mockUser = null;
    const res401 = await POST(new NextRequest('http://localhost/api/ensaios/pacometria/docx', {
      method: 'POST',
      body: JSON.stringify({ cab: {}, amostras: [] }),
    }));
    expect(res401.status).toBe(401);

    mockUser = { id: 'user-1' };
    const res400 = await POST(new NextRequest('http://localhost/api/ensaios/pacometria/docx', {
      method: 'POST',
      body: JSON.stringify({ cab: { rlt: '1' }, amostras: [] }),
    }));
    expect(res400.status).toBe(400);
  });

  it('gera laudo completo com perfis, foto integrada, múltiplos croquis, paginação, numeração e conclusão', async () => {
    const body = {
      cab: {
        rlt: '42',
        data: '21/11/2026',
        cliente: 'Construtora Alpha & Beta',
        obra: 'Edifício Horizonte <Torre A>',
        att: 'Eng. Roberto',
        endereco: '', // vazio para não disparar Google Maps no teste
        notas: 'Ensaio realizado com pacômetro digital calibrado.',
      },
      rltOficial: 'RLT.LAU-042.26-00',
      respNome: 'Eng. Maria Silva',
      respCrea: '54321-PE',
      outroRespBase64: PNG_1X1,
      outroRespContentType: 'image/png',
      usaMotivacao: true,
      motivacao: 'Verificação dos cobrimentos antes da reforma estrutural.',
      usaFotoGeral: true,
      fotoGeral: imgMock(800, 600),
      usaCroquiGeral: true,
      croquis: [imgMock(800, 600), imgMock(800, 600)],
      quebraPaginaPorElemento: true,
      usaConclusao: true,
      conclusao: '', // vazio -> gera texto executivo automático
      amostras: [
        {
          ...amostraPilar,
          esquema: imgMock(),
          foto: imgMock(800, 600),
          perfis: [
            { face: '1X', faceLabel: 'Face Inferior', imagem: imgMock(320, 260) },
            { face: '1Y', faceLabel: 'Face Esquerda', imagem: imgMock(320, 260) },
          ],
        },
        {
          ...amostraPilarCirc,
          esquema: imgMock(),
          foto: imgMock(800, 600),
          perfis: [
            { face: 'circ', faceLabel: 'Face Externa (Circular)', imagem: imgMock(320, 260) },
          ],
        },
        {
          ...amostraViga,
          esquema: imgMock(),
          foto: imgMock(800, 600),
          perfis: [
            { face: 'fundo', faceLabel: 'Face Inferior (Fundo)', imagem: imgMock(360, 220) },
            { face: 'lat1', faceLabel: 'Face Lateral Esquerda', imagem: imgMock(360, 220) },
            { face: 'lat2', faceLabel: 'Face Lateral Direita', imagem: imgMock(360, 220) },
          ],
        },
        { ...amostraLaje, esquema: imgMock() },
      ],
    };

    const res = await POST(new NextRequest('http://localhost/api/ensaios/pacometria/docx', {
      method: 'POST',
      body: JSON.stringify(body),
    }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('RLT.LAU-042.26-00.docx');

    const buf = Buffer.from(await res.arrayBuffer());
    if (process.env.PACOMETRIA_SAIDA) fs.writeFileSync(process.env.PACOMETRIA_SAIDA, buf);

    const zip = new PizZip(buf);
    const xml = zip.file('word/document.xml')!.asText();
    const hdr = zip.file('word/header1.xml')!.asText();
    const rels = zip.file('word/_rels/document.xml.rels')!.asText();

    // Sem marcadores/tags sobrando
    expect(xml).not.toMatch(/\[\[|\]\]/);
    expect(xml).not.toMatch(/_PH_|PLACEHOLDER|BLOCO_ELEMENTOS_PAC_END/);
    expect(xml).not.toContain('undefined');
    expect(hdr).toContain('ENSAIO DE PACOMETRIA');
    expect(hdr).toContain('RLT.LAU-042.26-00');

    // XML bem-formado e sem <w:r> fora de <w:tc>
    validarXmlBemFormado(xml);
    expect(xml).not.toMatch(/<w:tr(?:\s[^>]*)?>(?:<w:trPr>.*?<\/w:trPr>)?<w:r[ >]/);
    expect(xml).not.toMatch(/<\/w:tc><w:r[ >]/);

    // Paleta oficial TECOMAT SEM destaque vermelho (não existe limite normativo)
    expect(xml).toContain('w:fill="002060"');
    expect(xml).toContain('w:fill="D9D9D9"');
    expect(xml).not.toContain('w:val="C00000"');
    expect(xml).not.toContain('inferiores a 20 mm');
    expect(xml).toContain('w:val="0F243E"');

    // Sem normas/tabela de cobrimentos normativos
    expect(xml).not.toContain('NORMA(S) DE REFERÊNCIA');
    expect(xml).not.toContain('CAA I');

    // Conteúdo dos 4 elementos + escape XML
    expect(xml).toContain('Construtora Alpha &amp; Beta');
    expect(xml).toContain('Edifício Horizonte &lt;Torre A&gt;');
    expect(xml).toContain('Pilar P-01 (Térreo)');
    expect(xml).toContain('Pilar Circular PC-02');
    expect(xml).toContain('Viga V-104 &amp; Balanço');
    expect(xml).toContain('Laje L-05 &lt;Garagem&gt;');
    expect(xml).toContain('Verificação dos cobrimentos antes da reforma estrutural.');

    // Foto integrada à ficha (sem Seção 5 Memorial Fotográfico separado)
    expect(xml).not.toContain('MEMORIAL FOTOGRÁFICO');
    expect(xml).toContain('Registro fotográfico');

    // Múltiplos croquis + numeração sequencial de figuras e tabelas (sem tabela Leituras por face)
    expect(xml).toContain('Figura 1 — Vista geral da estrutura ensaiada.');
    expect(xml).toContain('Figura 2 — Croqui de localização dos elementos ensaiados (1/2).');
    expect(xml).toContain('Figura 3 — Croqui de localização dos elementos ensaiados (2/2).');
    expect(xml).toContain('Tabela 1 — Resumo estatístico');
    expect(xml).not.toContain('Leituras por face');
    expect(xml).toContain('Tabela 2 — Leituras da malha — Laje L-05 &lt;Garagem&gt;.');
    expect(xml).toContain('Tabela 3 — Síntese global dos resultados de pacometria.');

    // Corpo de texto, tabela de cabeçalho, tabelas e legendas em 11 pt (w:sz="22"); títulos de seção em 12 pt (w:sz="24")
    expect(xml).toContain('<w:sz w:val="22"/>');
    expect(xml).toContain('<w:sz w:val="24"/>');
    expect(xml).not.toContain('<w:sz w:val="19"/>');
    expect(xml).not.toContain('<w:sz w:val="16"/>');

    // Ordem da ficha do elemento: Esquema da seção transversal -> Perfis -> Foto do elemento
    const idxEsquemaP1 = xml.indexOf('Esquema da seção transversal — Pilar P-01');
    const idxPerfilP1 = xml.indexOf('Perfil — Face Inferior.');
    const idxFotoP1 = xml.indexOf('Registro fotográfico — Pilar P-01');
    expect(idxEsquemaP1).toBeGreaterThan(-1);
    expect(idxPerfilP1).toBeGreaterThan(idxEsquemaP1);
    expect(idxFotoP1).toBeGreaterThan(idxPerfilP1);

    // Controle de paginação por elemento (3 quebras para os 3 elementos após o 1º)
    expect((xml.match(/<w:pageBreakBefore\/>/g) ?? []).length).toBe(3);

    // Seção 5 — Resumo Executivo e Conclusão com texto automático
    expect(xml).toContain('5. RESUMO EXECUTIVO E CONCLUSÃO');
    expect(xml).toContain('Foram inspecionados 4 elemento(s) estrutural(is)');

    // Nomenclatura correta (nunca códigos internos 1X/2X/1Y/2Y)
    expect(xml).toContain('Face Inferior');
    expect(xml).toContain('Face Esquerda');
    expect(xml).toContain('Face Externa (Circular)');
    expect(xml).toContain('Face Inferior (Fundo)');
    expect(xml).toContain('Horizontal (Externa)');
    expect(xml).toContain('— (camada interna)');
    const textoVisivel = xml.replace(/<[^>]+>/g, ' ');
    expect(textoVisivel).not.toMatch(/\b(1X|2X|1Y|2Y)\b/);

    // Assinatura dupla (João fixo + Engenheiro dinâmico)
    expect(xml).toContain('João Ribeiro de Carvalho');
    expect(xml).toContain('CREA Nº49780 – PE');
    expect(xml).toContain('Eng. Maria Silva');
    expect(xml).toContain('CREA Nº 54321-PE');
    expect(rels).toContain('Id="rId13"');
    expect(rels).toContain('media/image6.jpeg');
    expect(rels).toContain('media/assinatura_resp.png');

    // Imagens: 1 fotoGeral + 2 croquis + 4 esquemas + 3 fotos integradas + 6 perfis + 1 João + 1 eng = 18 drawings
    expect((xml.match(/<w:drawing>/g) ?? []).length).toBe(18);
  });

  it('compacta colunas vazias em Laje e omite seções opcionais quando vazias', async () => {
    const lajeSemEspECob: AmostraRow = {
      ...amostraLaje,
      lajeData: {
        larguraX: 100,
        alturaY: 100,
        passoGrid: 10,
        camadaExterna: 'H',
        barrasH: [{ id: 'h1', pos: 30, cob: '' }],
        barrasV: [],
      },
    };
    const body = {
      cab: {
        rlt: '7',
        data: '21/11/2026',
        cliente: 'Cliente Simples',
        obra: 'Obra Simples',
        att: '',
        endereco: '',
        notas: '',
      },
      amostras: [lajeSemEspECob],
      quebraPaginaPorElemento: false,
      usaConclusao: false,
      respNome: 'Eng. Carlos',
      respCrea: '11111',
    };

    const res = await POST(new NextRequest('http://localhost/api/ensaios/pacometria/docx', {
      method: 'POST',
      body: JSON.stringify(body),
    }));
    expect(res.status).toBe(200);
    const xml = new PizZip(Buffer.from(await res.arrayBuffer())).file('word/document.xml')!.asText();

    expect(xml).not.toMatch(/\[\[|\]\]/);
    expect(xml).not.toContain('5. RESUMO EXECUTIVO E CONCLUSÃO');
    expect(xml).not.toContain('NOTAS:');
    expect(xml).not.toContain('<w:pageBreakBefore/>');
    // Colunas vazias omitidas na tabela da laje
    expect(xml).toContain('POSIÇÃO (cm)');
    expect(xml).not.toContain('ESPAÇAMENTO (cm)');
    expect(xml).not.toContain('COBRIMENTO (mm)');
    expect(xml).not.toContain('Cobrimentos às bordas');
    expect(xml).toContain('João Ribeiro de Carvalho');
    expect(xml).toContain('Eng. Carlos');
    validarXmlBemFormado(xml);
  });

  it('gera SVGs de seção com Mín/Máx e perfis com cores padronizadas (azul/vermelho sóbrio/amarelo) + legenda', () => {
    for (const a of [amostraPilar, amostraPilarCirc, amostraViga, amostraLaje]) {
      const svg = gerarSvgEsquemaPacometria(a);
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('Mín');
      expect(svg).toContain('Máx');
      expect(svg).not.toContain('#C00000');
      expect(svg).not.toMatch(/\b(1X|2X|1Y|2Y)\b/);
    }

    const perfisPilar = gerarSvgsPerfisPacometria(amostraPilar);
    expect(perfisPilar).toHaveLength(2);
    expect(perfisPilar[0].faceLabel).toBe('Face Inferior');
    expect(perfisPilar[0].svg).toContain('18mm');
    expect(perfisPilar[0].svg).toContain('#2563EB'); // barras + B1..Bn em azul
    expect(perfisPilar[0].svg).toContain('#A8383B'); // estribos + E1..En em vermelho sóbrio
    expect(perfisPilar[0].svg).toContain('#B8890E'); // todas as cotas (espaçamentos e cobrimentos de borda) em amarelo
    expect(perfisPilar[0].svg).not.toContain('#0F766E'); // sem verde-azulado antigo nas cotas de borda
    expect(perfisPilar[0].svg).toContain('Barras (B)');
    expect(perfisPilar[0].svg).toContain('Estribos / Cob. (E)');

    const perfisViga = gerarSvgsPerfisPacometria(amostraViga);
    expect(perfisViga).toHaveLength(3);
    expect(perfisViga[0].faceLabel).toBe('Face Inferior (Fundo)');
    expect(perfisViga[0].svg).toContain('28mm');
    expect(perfisViga[0].svg).toContain('#2563EB');
    expect(perfisViga[0].svg).toContain('#A8383B');
    expect(perfisViga[0].svg).not.toContain('#0F766E');

    expect(gerarSvgsPerfisPacometria(amostraLaje)).toHaveLength(0);
  });
});
