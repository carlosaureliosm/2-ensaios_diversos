// src/lib/docx/aderencia.ts
//
// Helpers de geração do laudo DOCX do módulo Aderência (modelo: public/modelo_aderencia.docx).
// Reaproveita a infraestrutura de imagens do esclerometria (registrarImagem/buildDrawingXml).

import PizZip from 'pizzip';
import {
  buildDrawingXml,
  cmParaEmu,
  registrarImagem,
} from '@/lib/docx/esclerometria';
import { numeroRomano } from '@/modules/aderencia/utils';
import { calcularEstatisticasCPs } from '@/modules/aderencia/calculos';
import { obterModeloCamadas } from '@/modules/aderencia/modelosCamadas';
import type { AderenciaCabecalho, CorpoDeProva, FotoAnexo, SituacaoAderencia } from '@/modules/aderencia/types';

// ── Payload recebido pela rota ───────────────────────────────────

export type SituacaoPayload = Omit<SituacaoAderencia, 'corposDeProva'> & {
  /** Esquema (croqui) já rasterizado em PNG pelo navegador (SVG → canvas). Opcional. */
  esquema?: FotoAnexo | null;
  corposDeProva: CorpoDeProva[];
};

export type AderenciaDocxPayload = {
  cabecalho: AderenciaCabecalho;
  situacoes: SituacaoPayload[];
  respNome?: string;
  respCrea?: string;
};

// ── Formatação ───────────────────────────────────────────────────

/** Número com vírgula decimal (padrão brasileiro). `null`/NaN → '—'. */
export function formatarNumero(n: number | null | undefined, casas = 2): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toFixed(casas).replace('.', ',');
}

/** Converte `aaaa-mm-dd` (input type=date) em `dd/mm/aaaa`; qualquer outro texto passa como está. */
export function formatarDataBR(valor: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((valor ?? '').trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (valor ?? '');
}

/** Número do relatório no padrão oficial; se o usuário já digitou "RLT...." completo, mantém. */
export function formatarRltAderencia(rlt: string): string {
  const n = (rlt ?? '').trim();
  if (!n) return 'RLT.LAU-XXX.26-00';
  if (/^RLT/i.test(n)) return n;
  if (/^\d+$/.test(n)) return `RLT.LAU-${n.padStart(3, '0')}.26-00`;
  return `RLT.LAU-${n}.26-00`;
}

// ── Marcadores de imagem ─────────────────────────────────────────
// docxtemplater grava estas strings únicas; as funções de injeção as trocam por <w:drawing>.
// O sufixo `_END` evita que `..._1` case por engano com `..._10`.

export const marcadorEsquema = (s: number) => `ESQUEMA_PH_${s}_END`;
export const marcadorFoto = (s: number, cp: number, k: 1 | 2) => `FOTO_PH_${s}_${cp}_${k}_END`;

export type ImagemInjetar = {
  marcador: string;
  buffer: Buffer;
  contentType: string;
  width: number;
  height: number;
  /** caixa máxima em cm — a imagem é reduzida para caber mantendo a proporção */
  maxLarguraCm: number;
  maxAlturaCm: number;
};

function bufferDeBase64(b64: string): Buffer {
  return Buffer.from(b64.replace(/^data:[^;]+;base64,/, ''), 'base64');
}

function fotoValida(f: FotoAnexo | null | undefined): f is FotoAnexo {
  return !!f && !!f.base64 && f.width > 0 && f.height > 0;
}

/**
 * Converte o payload em: (1) objeto de dados para o docxtemplater e (2) lista de imagens
 * a injetar depois do `render()`.
 */
export function montarDadosAderencia(payload: AderenciaDocxPayload): {
  dados: Record<string, unknown>;
  imagens: ImagemInjetar[];
} {
  const { cabecalho } = payload;
  const imagens: ImagemInjetar[] = [];

  const situacoes = payload.situacoes.map(sit => {
    const modelo = obterModeloCamadas(sit.modeloCamadasId);
    const colunasNomes = modelo?.colunasFormaRuptura ?? [];
    const stats = calcularEstatisticasCPs(sit.corposDeProva);

    let esquemaMarcador = '';
    if (fotoValida(sit.esquema)) {
      esquemaMarcador = marcadorEsquema(sit.numero);
      imagens.push({
        marcador: esquemaMarcador,
        buffer: bufferDeBase64(sit.esquema.base64),
        contentType: sit.esquema.contentType || 'image/png',
        width: sit.esquema.width,
        height: sit.esquema.height,
        maxLarguraCm: 4.6,
        maxAlturaCm: 6,
      });
    }

    const corposDeProva = sit.corposDeProva.map(cp => {
      // Contrato: array achatado [{ nome, valor }] na ordem das colunas do modelo.
      const colunas = colunasNomes.map(nome => ({
        nome,
        valor: String(Math.round((cp.formaRuptura?.[nome] ?? 0) * 100) / 100).replace('.', ','),
      }));

      const fotoMarcadores: [string, string] = ['', ''];
      ([1, 2] as const).forEach(k => {
        const foto = cp.fotos?.[k - 1];
        if (!fotoValida(foto)) return;
        const marcador = marcadorFoto(sit.numero, cp.numero, k);
        fotoMarcadores[k - 1] = marcador;
        imagens.push({
          marcador,
          buffer: bufferDeBase64(foto.base64),
          contentType: foto.contentType || 'image/jpeg',
          width: foto.width,
          height: foto.height,
          maxLarguraCm: 8,
          maxAlturaCm: 6,
        });
      });

      return {
        numero: String(cp.numero),
        bloco: cp.bloco || '—',
        junta: cp.junta || '—',
        tensaoRa: formatarNumero(cp.tensaoRa, 2),
        profRuptura: formatarNumero(cp.profRuptura, 1),
        colunas,
        localizacao: cp.localizacao || '—',
        foto1: fotoMarcadores[0],
        foto2: fotoMarcadores[1],
      };
    });

    return {
      numeroRomano: numeroRomano(sit.numero),
      tipoRevestimento: sit.tipoRevestimento || '—',
      dataEnsaio: formatarDataBR(sit.dataEnsaio) || '—',
      numCPs: String(sit.numCPs ?? sit.corposDeProva.length),
      dataAplicacao: formatarDataBR(sit.dataAplicacao) || '—',
      substrato: sit.substrato || '—',
      idadeRupturaDias: sit.idadeRupturaDias || '—',
      chapisco: sit.chapisco || '—',
      chapiscoTraco: sit.chapiscoTraco || '—',
      emboco: sit.emboco || '—',
      embocoTraco: sit.embocoTraco || '—',
      argamassaColante: sit.argamassaColante || '—',
      revestimento: sit.revestimento || '—',
      dimensoesCm: sit.dimensoesCm || '—',
      esquemaImagem: esquemaMarcador,
      observacoesEsquema: sit.observacoesEsquema || '',
      corposDeProva,
      raMedia: formatarNumero(stats.raMedia, 2),
      profRupturaMedia: formatarNumero(stats.profRupturaMedia, 1),
      dp: formatarNumero(stats.dp, 2),
      cv: formatarNumero(stats.cv, 1),
      umidadeMedia: formatarNumero(sit.umidadeMedia, 1),
      espessuraMediaRevestimento: formatarNumero(sit.espessuraMediaRevestimento, 1),
    };
  });

  const n = cabecalho.normas;
  const dados: Record<string, unknown> = {
    num_rlt: formatarRltAderencia(cabecalho.rltNumero),
    cliente: cabecalho.cliente || '—',
    obra: cabecalho.obra || '—',
    construtora: cabecalho.construtora || '—',
    endereco: cabecalho.endereco || '—',
    data_emissao: formatarDataBR(cabecalho.dataEmissao) || '—',
    // Checkboxes de norma (nomes dos campos = os usados em scripts/build-modelo-aderencia.js)
    nbr135281: !!n.nbr13528_1,
    parte2: !!n.nbr13528_1_parte2,
    parte3: !!n.nbr13528_1_parte3,
    nbr13749: !!n.nbr13749,
    nbr13753: !!n.nbr13753,
    nbr13754: !!n.nbr13754,
    nbr13755: !!n.nbr13755,
    situacoes,
    resp_nome: payload.respNome || '—',
    resp_crea: payload.respCrea || '—',
  };

  return { dados, imagens };
}

// ── Injeção de imagens ───────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Troca cada marcador de imagem (`<w:t>MARCADOR</w:t>`) por um `<w:drawing>` inline real.
 * Deve ser chamada DEPOIS de `doc.render()`. Cada imagem recebe rId/docPrId próprios (a partir de 2000).
 */
export function injetarImagensAderencia(zip: PizZip, imagens: ImagemInjetar[]): void {
  if (imagens.length === 0) return;
  const docFile = zip.file('word/document.xml');
  if (!docFile) return;
  let xml = docFile.asText();

  imagens.forEach((img, i) => {
    const id = 2000 + i;
    const rId = `rId${id}`;

    const maxCx = cmParaEmu(img.maxLarguraCm);
    const maxCy = cmParaEmu(img.maxAlturaCm);
    const escala = Math.min(maxCx / img.width, maxCy / img.height);
    const cx = Math.round(img.width * escala);
    const cy = Math.round(img.height * escala);

    registrarImagem(zip, img.buffer, img.contentType, `aderencia_img_${i + 1}`, rId);
    const drawing = buildDrawingXml(rId, id, `AderenciaImg${i + 1}`, cx, cy);

    const re = new RegExp(`<w:t(?:\\s[^>]*)?>${escapeRegex(img.marcador)}</w:t>`);
    if (re.test(xml)) {
      xml = xml.replace(re, () => drawing);
    } else {
      console.warn(`[aderencia docx] marcador ${img.marcador} não encontrado no documento.`);
    }
  });

  zip.file('word/document.xml', xml);
}
