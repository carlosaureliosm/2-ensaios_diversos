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
import { resolverModeloSituacao } from '@/modules/aderencia/modelosCamadas';
import type { AderenciaCabecalho, CorpoDeProva, FotoAnexo, SituacaoAderencia } from '@/modules/aderencia/types';

export const LIMITE_RA_MPA = 0.3;
const TOTAL_SUBCOLUNAS_RUPTURA = 10;

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

/** Número com vírgula decimal (padrão brasileiro). `null`/NaN → '-'. */
export function formatarNumero(n: number | null | undefined, casas = 2): string {
  if (n === null || n === undefined || isNaN(n)) return '-';
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

/** Cor hexadecimal (sem `#`) para cada camada na legenda ao lado do esquema, fiel à planilha RAAC. */
function corHexCamada(nome: string): string {
  const n = nome.toLowerCase();
  if (n.includes('cerâmic') || n.includes('ceramic') || n.includes('porcelanato')) return '8393A7';
  if (n.includes('colante')) return 'A69A7E';
  if (n.includes('gesso')) return 'F2EFE9';
  if (n.includes('emboço') || n.includes('emboco')) return 'C9BFA6';
  if (n.includes('chapisco')) return 'AB9F82';
  if (n.includes('contrapiso')) return 'D9D2C5';
  if (n.includes('alvenaria') || n.includes('bloco')) return 'E8B98A';
  if (n.includes('concreto') || n.includes('substrato')) return '92D050';
  return 'DCE1EA';
}

// ── Marcadores de imagem ─────────────────────────────────────────
// docxtemplater grava estas strings únicas; as funções de injeção as trocam por <w:drawing>.
// O sufixo `_END` evita que `..._1` case por engano com `..._10`.

export const marcadorEsquema = (s: number) => `ESQUEMA_PH_${s}_END`;
export const marcadorFoto = (s: number, cp: number, k: 1 | 2) => `FOTO_PH_${s}_${cp}_${k}_END`;
export const marcadorCorCamada = (hex: string) => `QUAD_COR_${hex}_END`;

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

  const situacoes = payload.situacoes.map((sit, sitIdx) => {
    const modelo = resolverModeloSituacao(sit);
    const colunasNomes = modelo?.colunasFormaRuptura ?? [];
    const camadasNomes = modelo?.camadas ?? [];
    const coresCamadas = modelo?.coresCamadas ?? [];
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
        maxLarguraCm: 4.4,
        maxAlturaCm: 3.4,
      });
    }

    // Legenda de camadas ao lado do esquema (camadas do modelo + adesivo epóxi + placa metálica)
    const legendaCamadas = [
      ...camadasNomes.map((nome, idx) => {
        const corCustom = coresCamadas[idx]?.replace(/^#/, '').toUpperCase();
        const hex = corCustom && /^[0-9A-F]{6}$/.test(corCustom) ? corCustom : corHexCamada(nome);
        return {
          quadradoCor: marcadorCorCamada(hex),
          nome: nome.toUpperCase(),
        };
      }),
      { quadradoCor: marcadorCorCamada('D0D3D9'), nome: 'ADESIVO (BASE EPÓXI)' },
      { quadradoCor: marcadorCorCamada('6B7280'), nome: 'PLACA METÁLICA' },
    ];

    // 10 subcolunas fixas de Forma de Ruptura (col1..col10) no cabeçalho da tabela
    const colsHeader: Record<string, string> = {};
    for (let k = 1; k <= TOTAL_SUBCOLUNAS_RUPTURA; k++) {
      colsHeader[`col${k}`] = colunasNomes[k - 1] ?? '';
    }

    // Fotos anexadas nos CPs desta situação (1 se tiver 1 foto, 2 se tiver 2 fotos)
    const fotosAnexoSit: Array<{ marcador: string; legenda: string }> = [];

    const corposDeProva = sit.corposDeProva.map(cp => {
      const numeroStr = String(cp.numero).padStart(3, '0');
      const pontoNome = (cp.localizacao ?? '').trim();

      // Valores v1..v10 para as 10 subcolunas fixas (mostra só se > 0, igual à planilha RAAC)
      const valoresCols: Record<string, string> = {};
      for (let k = 1; k <= TOTAL_SUBCOLUNAS_RUPTURA; k++) {
        const nomeCol = colunasNomes[k - 1];
        const val = nomeCol ? (cp.formaRuptura?.[nomeCol] ?? 0) : 0;
        valoresCols[`v${k}`] = val > 0 ? String(Math.round(val * 100) / 100).replace('.', ',') : '';
      }

      // Coleta fotos válidas do CP (1 ou 2) e monta a legenda com nº do CP + nome do ponto da amostra
      ([1, 2] as const).forEach(k => {
        const foto = cp.fotos?.[k - 1];
        if (!fotoValida(foto)) return;
        const marcador = marcadorFoto(sit.numero, cp.numero, k);
        imagens.push({
          marcador,
          buffer: bufferDeBase64(foto.base64),
          contentType: foto.contentType || 'image/jpeg',
          width: foto.width,
          height: foto.height,
          maxLarguraCm: 7.4,
          maxAlturaCm: 5.0,
        });
        const legenda = pontoNome ? `${numeroStr} - ${pontoNome}` : numeroStr;
        fotosAnexoSit.push({ marcador, legenda });
      });

      const raValido = cp.tensaoRa !== null && cp.tensaoRa !== undefined && !isNaN(cp.tensaoRa);
      const raBaixo = raValido && (cp.tensaoRa as number) < LIMITE_RA_MPA;
      const raOk = raValido && (cp.tensaoRa as number) >= LIMITE_RA_MPA;
      const raVazio = !raValido;

      return {
        numero: numeroStr,
        bloco: cp.bloco || '-',
        junta: cp.junta || '-',
        tensaoRa: formatarNumero(cp.tensaoRa, 2),
        raBaixo,
        raOk,
        raVazio,
        profRuptura: formatarNumero(cp.profRuptura, 1),
        ...valoresCols,
        localizacao: pontoNome || '-',
      };
    });

    // Agrupa as fotos da situação em pares (2 fotos por linha da grade do Anexo)
    const linhasFotos: Array<{
      fotoEsq: string;
      legendaEsq: string;
      temDir: boolean;
      fotoDir: string;
      legendaDir: string;
    }> = [];
    for (let i = 0; i < fotosAnexoSit.length; i += 2) {
      const esq = fotosAnexoSit[i];
      const dir = fotosAnexoSit[i + 1];
      linhasFotos.push({
        fotoEsq: esq.marcador,
        legendaEsq: esq.legenda,
        temDir: !!dir,
        fotoDir: dir?.marcador ?? '',
        legendaDir: dir?.legenda ?? '',
      });
    }

    const cvStr = stats.cv !== null && stats.cv !== undefined && !isNaN(stats.cv)
      ? `${Math.round(stats.cv)}%`
      : '-';

    return {
      numSit: String(sitIdx + 1),
      numeroRomano: numeroRomano(sit.numero),
      tipoRevestimento: sit.tipoRevestimento || '-',
      dataEnsaio: formatarDataBR(sit.dataEnsaio) || '-',
      numCPs: String(sit.numCPs ?? sit.corposDeProva.length),
      dataAplicacao: formatarDataBR(sit.dataAplicacao) || '-',
      substrato: sit.substrato || '-',
      idadeRupturaDias: sit.idadeRupturaDias || '-',
      chapisco: sit.chapisco || '-',
      chapiscoTraco: sit.chapiscoTraco || '-',
      emboco: sit.emboco || '-',
      embocoTraco: sit.embocoTraco || '-',
      argamassaColante: sit.argamassaColante || '-',
      revestimento: sit.revestimento || '-',
      dimensoesCm: sit.dimensoesCm || '-',
      esquemaImagem: esquemaMarcador,
      legendaCamadas,
      observacoesEsquema: sit.observacoesEsquema || '',
      ...colsHeader,
      corposDeProva,
      temFotos: linhasFotos.length > 0,
      linhasFotos,
      raMedia: formatarNumero(stats.raMedia, 2),
      profRupturaMedia: formatarNumero(stats.profRupturaMedia, 1),
      dp: formatarNumero(stats.dp, 2),
      cv: cvStr,
      umidadeMedia: formatarNumero(sit.umidadeMedia, 1),
      espessuraMediaRevestimento: formatarNumero(sit.espessuraMediaRevestimento, 2),
    };
  });

  const n = cabecalho.normas;
  const dados: Record<string, unknown> = {
    num_rlt: formatarRltAderencia(cabecalho.rltNumero),
    cliente: cabecalho.cliente || '-',
    obra: cabecalho.obra || '-',
    construtora: cabecalho.construtora || '-',
    endereco: cabecalho.endereco || '-',
    data_emissao: formatarDataBR(cabecalho.dataEmissao) || '-',
    // Checkboxes de norma (nomes dos campos = os usados em scripts/build-modelo-aderencia.js)
    nbr135281: !!n.nbr13528_1,
    parte2: !!n.nbr13528_1_parte2,
    parte3: !!n.nbr13528_1_parte3,
    nbr13749: !!n.nbr13749,
    nbr13753: !!n.nbr13753,
    nbr13754: !!n.nbr13754,
    nbr13755: !!n.nbr13755,
    situacoes,
    resp_nome: payload.respNome || '-',
    resp_crea: payload.respCrea || '-',
  };

  return { dados, imagens };
}

// ── Injeção de imagens e quadrados coloridos pós-render ──────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Troca cada marcador de imagem (`<w:t>MARCADOR</w:t>`) por um `<w:drawing>` inline real
 * e cada marcador de cor (`QUAD_COR_HEX_END`) pelo quadradinho colorido da legenda do esquema.
 * Deve ser chamada DEPOIS de `doc.render()`. Cada imagem recebe rId/docPrId próprios (a partir de 2000).
 */
export function injetarImagensAderencia(zip: PizZip, imagens: ImagemInjetar[]): void {
  const docFile = zip.file('word/document.xml');
  if (!docFile) return;
  let xml = docFile.asText();

  // 1. Substitui os marcadores de quadradinhos coloridos da legenda de camadas
  xml = xml.replace(
    /<w:r>(?:(?!<\/w:r>)[\s\S])*?<w:t(?:\s[^>]*)?>QUAD_COR_([0-9A-Fa-f]{6})_END<\/w:t><\/w:r>/g,
    (_m, hex) =>
      `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="14"/><w:szCs w:val="14"/><w:bdr w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:shd w:val="clear" w:color="auto" w:fill="${hex}"/></w:rPr><w:t xml:space="preserve">   </w:t></w:r>`,
  );

  // 2. Injeta as imagens (esquemas e fotos de CPs)
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
