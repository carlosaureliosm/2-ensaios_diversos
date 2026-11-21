// src/lib/docx/pacometria.ts
//
// Helpers de geração do laudo DOCX do módulo Pacometria (modelo: public/modelo_pacometria.docx).
// Reaproveita registrarImagem, buildDrawingXml, cmParaEmu, formatarRlt e toTitleCase de esclerometria.

import PizZip from 'pizzip';
import {
  buildDrawingXml,
  cmParaEmu,
  formatarRlt,
  registrarImagem,
  toTitleCase,
} from '@/lib/docx/esclerometria';
import {
  AmostraRow,
  Cabecalho,
  FACE_LABELS,
  OPCOES_LAJE,
  OPCOES_PILAR,
  OPCOES_VIGA,
  OpcaoLaje,
  OpcaoPilar,
  OpcaoViga,
  TIPO_LABELS,
  calcularCobrimentos,
  calcularCobrimentosLaje,
  calcularEspacamentos,
  getFacesDaOpcao,
  ordenarBarras,
} from '@/modules/pacometria/types';

export const LIMITE_COBRIMENTO_ALERTA_MM = 20;

export type ImagemBase64Payload = {
  base64: string;
  contentType?: string;
  width: number;
  height: number;
};

export type AmostraPacometriaPayload = Omit<AmostraRow, 'fotoFile' | 'fotoPreview'> & {
  foto?: ImagemBase64Payload | null;
  esquema?: ImagemBase64Payload | null;
};

export type PacometriaDocxPayload = {
  cab: Cabecalho;
  amostras: AmostraPacometriaPayload[];
  rltOficial?: string;
  respNome?: string;
  respCrea?: string;
  assinaturaUrl?: string;
  outroRespBase64?: string;
  outroRespContentType?: string;
  usaMotivacao?: boolean;
  motivacao?: string;
  usaFotoGeral?: boolean;
  fotoGeral?: ImagemBase64Payload | null;
  usaCroquiGeral?: boolean;
  croqui?: ImagemBase64Payload | null;
};

export type ImagemPacometriaInjetar = {
  marcador: string;
  buffer: Buffer;
  contentType: string;
  width: number;
  height: number;
  maxLarguraCm: number;
  maxAlturaCm: number;
};

function fmtNum(n: number | null | undefined, casas = 1): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toFixed(casas).replace('.', ',');
}

function fmtValorBruto(v: string | undefined): string {
  const s = (v ?? '').trim();
  if (!s) return '';
  return s.replace('.', ',');
}

function bufferDeBase64(b64: string): Buffer {
  return Buffer.from(b64.replace(/^data:[^;]+;base64,/, ''), 'base64');
}

function imagemValida(img: ImagemBase64Payload | null | undefined): img is ImagemBase64Payload {
  return !!img && !!img.base64 && img.width > 0 && img.height > 0;
}

function resumoGeometriaElemento(a: AmostraPacometriaPayload): string {
  if (a.tipo === 'pilar') {
    const op = a.opcao as OpcaoPilar;
    const cfg = OPCOES_PILAR[op];
    if (op === 'E') return `Circular · Ø ${a.D || 0} cm`;
    if (op === 'B') return `${cfg?.label ?? '1 face'} · X = ${a.X || 0} cm`;
    return `${cfg?.label ?? `Opção ${op}`} · ${a.X || 0}×${a.Y || 0} cm`;
  }
  if (a.tipo === 'viga') {
    const op = a.opcao as OpcaoViga;
    const cfg = OPCOES_VIGA[op];
    return `${cfg?.label ?? op} · b=${a.X || 0} × h=${a.Y || 0} cm`;
  }
  const op = a.opcao as OpcaoLaje;
  const cfg = OPCOES_LAJE[op];
  const lx = a.lajeData?.larguraX ?? 100;
  const ly = a.lajeData?.alturaY ?? 100;
  return `${cfg?.label ?? 'Malha'} · ${lx}×${ly} cm`;
}

function resumoTipoCurto(a: AmostraPacometriaPayload): string {
  const tipo = TIPO_LABELS[a.tipo] ?? a.tipo;
  if (a.tipo === 'pilar') {
    if (a.opcao === 'E') return `${tipo} Circular (Ø ${a.D || 0} cm)`;
    if (a.opcao === 'B') return `${tipo} (X=${a.X || 0} cm)`;
    return `${tipo} (${a.X || 0}×${a.Y || 0} cm)`;
  }
  if (a.tipo === 'viga') {
    return `${tipo} (${a.X || 0}×${a.Y || 0} cm)`;
  }
  const lx = a.lajeData?.larguraX ?? 100;
  const ly = a.lajeData?.alturaY ?? 100;
  return `${tipo} (${lx}×${ly} cm)`;
}

function formatarCobPerp(tipo: 'pilar' | 'viga', ini?: string, fim?: string): string {
  const a = fmtValorBruto(ini);
  const b = fmtValorBruto(fim);
  if (!a && !b) return '—';
  const [rotIni, rotFim] = tipo === 'viga' ? ['Sup', 'Inf'] : ['Esq', 'Dir'];
  const partes: string[] = [];
  if (a) partes.push(`${rotIni}: ${a}`);
  if (b) partes.push(`${rotFim}: ${b}`);
  return partes.join(' | ');
}

function formatarCobBordasLaje(ld: NonNullable<AmostraPacometriaPayload['lajeData']>): string {
  const partes: string[] = [];
  const sup = fmtValorBruto(ld.cobPerpHSup);
  const inf = fmtValorBruto(ld.cobPerpHInf);
  const esq = fmtValorBruto(ld.cobPerpVEsq);
  const dir = fmtValorBruto(ld.cobPerpVDir);
  if (sup) partes.push(`Sup: ${sup} mm`);
  if (inf) partes.push(`Inf: ${inf} mm`);
  if (esq) partes.push(`Esq: ${esq} mm`);
  if (dir) partes.push(`Dir: ${dir} mm`);
  return partes.length > 0 ? partes.join(' | ') : 'Não informado';
}

/**
 * Converte o payload de pacometria em:
 *   1) objeto `dados` para o Docxtemplater (`modelo_pacometria.docx`)
 *   2) lista `imagens` para injeção pós-render (`injetarImagensPacometria`).
 */
export function montarDadosPacometria(
  payload: PacometriaDocxPayload,
  mapaResult?: { buffer: Buffer; width: number; height: number } | null,
): {
  dados: Record<string, unknown>;
  imagens: ImagemPacometriaInjetar[];
} {
  const { cab } = payload;
  const imagens: ImagemPacometriaInjetar[] = [];

  // Mapa de localização (opcional)
  let temMapa = false;
  let mapaMarcador = '';
  if (mapaResult && mapaResult.width > 0 && mapaResult.height > 0) {
    temMapa = true;
    mapaMarcador = 'MAPA_PAC_PH_END';
    imagens.push({
      marcador: mapaMarcador,
      buffer: mapaResult.buffer,
      contentType: 'image/png',
      width: mapaResult.width,
      height: mapaResult.height,
      maxLarguraCm: 11.5,
      maxAlturaCm: 8.0,
    });
  }

  // Foto geral (opcional)
  let temFotoGeral = false;
  let fotoGeralMarcador = '';
  if (payload.usaFotoGeral && imagemValida(payload.fotoGeral)) {
    temFotoGeral = true;
    fotoGeralMarcador = 'FOTO_GERAL_PAC_PH_END';
    imagens.push({
      marcador: fotoGeralMarcador,
      buffer: bufferDeBase64(payload.fotoGeral.base64),
      contentType: payload.fotoGeral.contentType || 'image/jpeg',
      width: payload.fotoGeral.width,
      height: payload.fotoGeral.height,
      maxLarguraCm: 14.5,
      maxAlturaCm: 9.5,
    });
  }

  // Croqui geral (opcional)
  let temCroqui = false;
  let croquiMarcador = '';
  if (payload.usaCroquiGeral && imagemValida(payload.croqui)) {
    temCroqui = true;
    croquiMarcador = 'CROQUI_PAC_PH_END';
    imagens.push({
      marcador: croquiMarcador,
      buffer: bufferDeBase64(payload.croqui.base64),
      contentType: payload.croqui.contentType || 'image/jpeg',
      width: payload.croqui.width,
      height: payload.croqui.height,
      maxLarguraCm: 15.0,
      maxAlturaCm: 10.5,
    });
  }

  const fotosMemorial: Array<{ marcador: string; legenda: string }> = [];

  const elementos = payload.amostras.map((a, idx) => {
    const itemNum = a.item || idx + 1;

    // Recalcula estatísticas a partir dos dados brutos (fallback para os campos da amostra)
    const statsCalc = a.tipo === 'laje' && a.lajeData
      ? calcularCobrimentosLaje(a.lajeData)
      : calcularCobrimentos(a.facesData ?? {});

    const cobMedio = statsCalc.cobMedio ?? a.cobMedio ?? null;
    const cobMinimo = statsCalc.cobMinimo ?? a.cobMinimo ?? null;
    const cobMaximo = statsCalc.cobMaximo ?? a.cobMaximo ?? null;
    const cobDesvio = statsCalc.cobDesvio ?? a.cobDesvio ?? null;
    const cobCV = statsCalc.cobCV ?? a.cobCV ?? null;
    const cobModa = statsCalc.cobModa ?? a.cobModa ?? null;

    const cobMinBaixo = cobMinimo !== null && cobMinimo < LIMITE_COBRIMENTO_ALERTA_MM;

    // Esquema ilustrativo da amostra (opcional)
    let temEsquema = false;
    let esquemaMarcador = '';
    if (imagemValida(a.esquema)) {
      temEsquema = true;
      esquemaMarcador = `ESQUEMA_PAC_${itemNum}_END`;
      imagens.push({
        marcador: esquemaMarcador,
        buffer: bufferDeBase64(a.esquema.base64),
        contentType: a.esquema.contentType || 'image/png',
        width: a.esquema.width,
        height: a.esquema.height,
        maxLarguraCm: 13.5,
        maxAlturaCm: 7.0,
      });
    }

    // Foto do elemento para o Memorial Fotográfico (opcional)
    if (imagemValida(a.foto)) {
      const fotoIdx = fotosMemorial.length + 1;
      const marcador = `FOTO_PAC_${fotoIdx}_END`;
      imagens.push({
        marcador,
        buffer: bufferDeBase64(a.foto.base64),
        contentType: a.foto.contentType || 'image/jpeg',
        width: a.foto.width,
        height: a.foto.height,
        maxLarguraCm: 7.6,
        maxAlturaCm: 5.7,
      });
      fotosMemorial.push({
        marcador,
        legenda: `Foto ${fotoIdx} — ${a.elemento || `Elemento ${itemNum}`}`,
      });
    }

    // Detalhamento por face (Pilar / Viga)
    const ehLaje = a.tipo === 'laje';
    const ehPilarOuViga = !ehLaje;

    let faces: Array<{
      faceNome: string;
      armaduraResumo: string;
      cobrimentosStr: string;
      espEstribosStr: string;
      espBarrasStr: string;
      cobPerpStr: string;
    }> = [];

    if (ehPilarOuViga) {
      const chaves = getFacesDaOpcao(a.tipo, a.opcao);
      const chavesEfetivas = chaves.length > 0 ? chaves : Object.keys(a.facesData ?? {});
      faces = chavesEfetivas.map(f => {
        const fd = a.facesData?.[f];
        const nBarras = a.barras?.[f] ?? 0;
        const nEstribos = fd?.nEstribos ?? fd?.cob?.length ?? 0;

        const cobs = (fd?.cob ?? [])
          .map((v, i) => {
            const s = fmtValorBruto(v);
            return s ? `E${i + 1}: ${s}` : null;
          })
          .filter(Boolean);

        const espV = (fd?.espV ?? [])
          .map((v, i) => {
            const s = fmtValorBruto(v);
            return s ? `E${i + 1}–E${i + 2}: ${s}` : null;
          })
          .filter(Boolean);

        const espH = (fd?.espH ?? [])
          .map((v, i) => {
            const s = fmtValorBruto(v);
            return s ? `B${i + 1}–B${i + 2}: ${s}` : null;
          })
          .filter(Boolean);

        return {
          faceNome: FACE_LABELS[f] ?? f,
          armaduraResumo: `${nBarras}B / ${nEstribos}E`,
          cobrimentosStr: cobs.length > 0 ? cobs.join('  |  ') : '—',
          espEstribosStr: espV.length > 0 ? espV.join('; ') : '—',
          espBarrasStr: espH.length > 0 ? espH.join('; ') : '—',
          cobPerpStr: formatarCobPerp(a.tipo === 'viga' ? 'viga' : 'pilar', fd?.cobPerpIni, fd?.cobPerpFim),
        };
      });

      if (faces.length === 0) {
        faces.push({
          faceNome: '—',
          armaduraResumo: '—',
          cobrimentosStr: '—',
          espEstribosStr: '—',
          espBarrasStr: '—',
          cobPerpStr: '—',
        });
      }
    }

    // Detalhamento de malha (Laje / Área Livre)
    let camadaExternaLabel = '';
    let dimLaje = '';
    let cobBordasLaje = '';
    const barrasLaje: Array<{
      direcaoLabel: string;
      barraNome: string;
      posicaoCm: string;
      espacamentoCm: string;
      cobrimentoMm: string;
    }> = [];

    if (ehLaje && a.lajeData) {
      const ld = a.lajeData;
      const ext: 'H' | 'V' = ld.camadaExterna ?? (ld.barrasH.length > 0 ? 'H' : 'V');
      camadaExternaLabel = ext === 'H' ? 'Horizontal (H)' : 'Vertical (V)';
      dimLaje = `${ld.larguraX} × ${ld.alturaY} cm (grade ${ld.passoGrid} cm)`;
      cobBordasLaje = formatarCobBordasLaje(ld);

      const bh = ordenarBarras(ld.barrasH ?? []);
      const espH = calcularEspacamentos(bh);
      bh.forEach((b, i) => {
        const cobStr = ext === 'H'
          ? (fmtValorBruto(b.cob) || '—')
          : '— (camada interna)';
        barrasLaje.push({
          direcaoLabel: ext === 'H' ? 'Horizontal (Externa)' : 'Horizontal (Interna)',
          barraNome: `H${i + 1}`,
          posicaoCm: fmtNum(b.pos, 1),
          espacamentoCm: i === 0 ? '—' : fmtNum(espH[i - 1], 1),
          cobrimentoMm: cobStr,
        });
      });

      const bv = ordenarBarras(ld.barrasV ?? []);
      const espV = calcularEspacamentos(bv);
      bv.forEach((b, i) => {
        const cobStr = ext === 'V'
          ? (fmtValorBruto(b.cob) || '—')
          : '— (camada interna)';
        barrasLaje.push({
          direcaoLabel: ext === 'V' ? 'Vertical (Externa)' : 'Vertical (Interna)',
          barraNome: `V${i + 1}`,
          posicaoCm: fmtNum(b.pos, 1),
          espacamentoCm: i === 0 ? '—' : fmtNum(espV[i - 1], 1),
          cobrimentoMm: cobStr,
        });
      });

      if (barrasLaje.length === 0) {
        barrasLaje.push({
          direcaoLabel: '—',
          barraNome: '—',
          posicaoCm: '—',
          espacamentoCm: '—',
          cobrimentoMm: '—',
        });
      }
    }

    return {
      item: String(itemNum),
      elemento: a.elemento || `Elemento ${itemNum}`,
      tipoLabel: TIPO_LABELS[a.tipo] ?? a.tipo,
      tipoResumo: resumoTipoCurto(a),
      resumoGeometria: resumoGeometriaElemento(a),
      cobMedio: fmtNum(cobMedio, 1),
      cobMinimo: fmtNum(cobMinimo, 0),
      cobMinBaixo,
      cobMaximo: fmtNum(cobMaximo, 0),
      cobDesvio: fmtNum(cobDesvio, 1),
      cobCV: fmtNum(cobCV, 1),
      cobModa: cobModa !== null ? `${cobModa} mm` : '—',
      cobModaNum: cobModa !== null ? String(cobModa) : '—',
      temEsquema,
      esquemaImg: esquemaMarcador,
      ehPilarOuViga,
      ehLaje,
      faces,
      camadaExternaLabel,
      dimLaje,
      cobBordasLaje,
      barrasLaje,
    };
  });

  // Agrupa fotos do memorial em pares (grade 2 colunas)
  const linhasFotos: Array<{
    fotoEsq: string;
    legendaEsq: string;
    temDir: boolean;
    fotoDir: string;
    legendaDir: string;
  }> = [];
  for (let i = 0; i < fotosMemorial.length; i += 2) {
    const esq = fotosMemorial[i];
    const dir = fotosMemorial[i + 1];
    linhasFotos.push({
      fotoEsq: esq.marcador,
      legendaEsq: esq.legenda,
      temDir: !!dir,
      fotoDir: dir?.marcador ?? '',
      legendaDir: dir?.legenda ?? '',
    });
  }

  const rltOficial = payload.rltOficial?.trim() || formatarRlt(cab.rlt || '');
  const motivacaoTexto = (payload.motivacao ?? '').trim();
  const notasTexto = (cab.notas ?? '').trim();

  const dados: Record<string, unknown> = {
    nome_ensaio: 'PACOMETRIA',
    num_rlt: rltOficial,
    cliente: cab.cliente?.trim() || '—',
    obra: cab.obra?.trim() || '—',
    obra_intro: toTitleCase(cab.obra?.trim() || '') || '—',
    att: cab.att?.trim() || '—',
    endereco: cab.endereco?.trim() || '—',
    endereco_intro: toTitleCase(cab.endereco?.trim() || '') || '—',
    data_emissao: cab.data?.trim() || '—',
    total_elementos: String(elementos.length),
    temMotivacao: Boolean(payload.usaMotivacao && motivacaoTexto),
    motivacao: motivacaoTexto,
    temMapa,
    mapa_img: mapaMarcador,
    temFotoGeral,
    foto_geral_img: fotoGeralMarcador,
    temCroqui,
    croqui_img: croquiMarcador,
    resumo: elementos.map(e => ({
      item: e.item,
      elemento: e.elemento,
      tipoResumo: e.tipoResumo,
      cobMedio: e.cobMedio,
      cobMinimo: e.cobMinimo,
      cobMinBaixo: e.cobMinBaixo,
      cobMaximo: e.cobMaximo,
      cobDesvio: e.cobDesvio,
      cobCV: e.cobCV,
      cobModa: e.cobModaNum,
    })),
    elementos,
    temFotos: linhasFotos.length > 0,
    linhasFotos,
    notas: notasTexto,
    resp_nome: payload.respNome?.trim() || '—',
    resp_crea: payload.respCrea?.trim() || '—',
  };

  return { dados, imagens };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Injeta todas as imagens de pacometria (mapa, foto geral, croqui, esquemas e fotos do memorial)
 * substituindo `<w:t>MARCADOR</w:t>` por `<w:drawing>` inline proporcional.
 * rId e docPrId começam em 2000 para não colidir com rId13 (João) nem rId901 (assinatura dinâmica).
 */
export function injetarImagensPacometria(zip: PizZip, imagens: ImagemPacometriaInjetar[]): void {
  const docFile = zip.file('word/document.xml');
  if (!docFile || imagens.length === 0) return;
  let xml = docFile.asText();

  imagens.forEach((img, i) => {
    const id = 2000 + i;
    const rId = `rId${id}`;

    const maxCx = cmParaEmu(img.maxLarguraCm);
    const maxCy = cmParaEmu(img.maxAlturaCm);
    const escala = Math.min(maxCx / img.width, maxCy / img.height);
    const cx = Math.round(img.width * escala);
    const cy = Math.round(img.height * escala);

    registrarImagem(zip, img.buffer, img.contentType, `pacometria_img_${i + 1}`, rId);
    const drawing = buildDrawingXml(rId, id, `PacometriaImg${i + 1}`, cx, cy);

    const re = new RegExp(`<w:t(?:\\s[^>]*)?>${escapeRegex(img.marcador)}</w:t>`);
    if (re.test(xml)) {
      xml = xml.replace(re, () => drawing);
    } else {
      console.warn(`[pacometria docx] marcador ${img.marcador} não encontrado no documento.`);
    }
  });

  zip.file('word/document.xml', xml);
}
