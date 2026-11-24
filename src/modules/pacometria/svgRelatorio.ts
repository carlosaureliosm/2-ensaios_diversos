// src/modules/pacometria/svgRelatorio.ts
//
// Gera SVGs técnicos puros (string SVG, sem React) para rasterização em PNG e inclusão
// no relatório DOCX de pacometria:
//   - Seção transversal / malha: Pilar (retangular A..D ou circular E), Viga (VA..VE), Laje (LA..LC)
//     com estatísticas Méd / Mín / Máx por face (sem destaque vermelho, pois não há limite normativo)
//   - Perfis de elevação por face: vertical (Pilar) e horizontal (Viga), com estribos, barras,
//     cobrimentos e cotas de espaçamento / cobrimento perpendicular às bordas.

import {
  AmostraRow,
  FACE_COLORS,
  FACE_LABELS,
  FaceData,
  OpcaoPilar,
  OpcaoViga,
  calcularCobrimentosLaje,
  getFacesDaOpcao,
  ordenarBarras,
} from './types';

const PRIMARY = '#0F243E';
const NAVY = '#002060';
const GOLD = '#B8890E';
const SUBTEXT = '#475569';
const PERP_COLOR = '#0F766E';

function escSvg(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtComma(n: number, casas = 1): string {
  return n.toFixed(casas).replace('.', ',');
}

function statsCobrimentosFace(cob: string[]): { media: string; min: string; max: string; count: number } | null {
  const nums = cob
    .map(v => parseFloat(v.replace(',', '.')))
    .filter(n => !isNaN(n) && n > 0);
  if (nums.length === 0) return null;
  const media = nums.reduce((a, b) => a + b, 0) / nums.length;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return {
    media: fmtComma(media, 1),
    min: fmtComma(min, Number.isInteger(min) ? 0 : 1),
    max: fmtComma(max, Number.isInteger(max) ? 0 : 1),
    count: nums.length,
  };
}

function gerarSvgPilar(a: AmostraRow): string {
  const W = 460;
  const H = 236;
  const op = a.opcao as OpcaoPilar;
  const faces = getFacesDaOpcao('pilar', op);
  const hatch =
    `<defs><pattern id="hp" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
    `<line x1="0" y1="0" x2="0" y2="7" stroke="#94A3B8" stroke-width="1.4"/></pattern></defs>`;

  if (op === 'E') {
    const cx = 148, cy = 112, r = 64, rb = 49;
    const nb = Math.max(4, a.barras?.circ ?? 8);
    let barras = '';
    for (let i = 0; i < nb; i++) {
      const ang = (2 * Math.PI / nb) * i - Math.PI / 2;
      const bx = (cx + rb * Math.cos(ang)).toFixed(1);
      const by = (cy + rb * Math.sin(ang)).toFixed(1);
      barras += `<circle cx="${bx}" cy="${by}" r="4.2" fill="${PRIMARY}"/>`;
    }
    const st = statsCobrimentosFace(a.facesData?.circ?.cob ?? []);
    const info = [
      `Seção Circular — Ø ${a.D || 0} cm`,
      `Barras longitudinais: ${nb}`,
      `Estribos medidos: ${a.facesData?.circ?.nEstribos ?? 0}`,
      st ? `Cobrimento médio: ${st.media} mm` : 'Sem leituras de cobrimento',
      ...(st ? [`Mínimo: ${st.min} mm  |  Máximo: ${st.max} mm`] : []),
    ];
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <rect width="${W}" height="${H}" fill="#FFFFFF"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#E8EDF5" stroke="${NAVY}" stroke-width="2.2"/>
      <circle cx="${cx}" cy="${cy}" r="${rb}" fill="none" stroke="#2563EB" stroke-width="1.4" stroke-dasharray="4,3"/>
      ${barras}
      <line x1="${cx - r}" y1="${cy + r + 16}" x2="${cx + r}" y2="${cy + r + 16}" stroke="${PRIMARY}" stroke-width="1"/>
      <text x="${cx}" y="${cy + r + 30}" text-anchor="middle" font-size="11" font-weight="700" fill="${PRIMARY}" font-family="Calibri, sans-serif">Ø = ${a.D || 0} cm</text>
      <text x="242" y="42" font-size="11.5" font-weight="700" fill="${NAVY}" font-family="Calibri, sans-serif">Resumo da Seção</text>
      ${info.map((t, idx) => `<text x="242" y="${68 + idx * 22}" font-size="11" font-weight="${idx === 0 || idx === 4 ? '700' : '400'}" fill="${PRIMARY}" font-family="Calibri, sans-serif">${escSvg(t)}</text>`).join('')}
    </svg>`;
  }

  const maxW = 136, maxH = 108;
  const rx = Math.max(10, a.X || 30);
  const ry = Math.max(10, a.Y || 30);
  const esc = Math.min(maxW / rx, maxH / ry);
  const ew = Math.max(62, Math.round(rx * esc));
  const eh = Math.max(54, Math.round(ry * esc));
  const ex = Math.round(138 - ew / 2);
  const ey = Math.round(112 - eh / 2);
  const cv = 11;

  let obs = '';
  if (op === 'B' || op === 'C' || op === 'D') {
    obs += `<rect x="${ex}" y="${ey - 22}" width="${ew}" height="22" fill="url(#hp)" stroke="#94A3B8" stroke-width="0.7"/>`;
  }
  if (op === 'B') {
    obs += `<rect x="${ex - 22}" y="${ey}" width="22" height="${eh}" fill="url(#hp)" stroke="#94A3B8" stroke-width="0.7"/>`;
    obs += `<rect x="${ex + ew}" y="${ey}" width="22" height="${eh}" fill="url(#hp)" stroke="#94A3B8" stroke-width="0.7"/>`;
  }
  if (op === 'C') {
    obs += `<rect x="${ex + ew}" y="${ey}" width="22" height="${eh}" fill="url(#hp)" stroke="#94A3B8" stroke-width="0.7"/>`;
  }

  // Barras nas faces
  const pts: Array<[number, number]> = [];
  const addLine = (x1: number, y1: number, x2: number, y2: number, n: number) => {
    const count = Math.max(2, n || 2);
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      pts.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
    }
  };
  addLine(ex + cv, ey + eh - cv, ex + ew - cv, ey + eh - cv, a.barras?.['1X'] ?? 3);
  if (faces.includes('2X')) addLine(ex + cv, ey + cv, ex + ew - cv, ey + cv, a.barras?.['2X'] ?? 3);
  else addLine(ex + cv, ey + cv, ex + ew - cv, ey + cv, 2);
  if (faces.includes('1Y')) addLine(ex + cv, ey + cv, ex + cv, ey + eh - cv, a.barras?.['1Y'] ?? 3);
  if (faces.includes('2Y')) addLine(ex + ew - cv, ey + cv, ex + ew - cv, ey + eh - cv, a.barras?.['2Y'] ?? 3);

  const uniq: Array<[number, number]> = [];
  for (const p of pts) {
    if (!uniq.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 4)) uniq.push(p);
  }
  const barrasXml = uniq
    .map(([bx, by]) => `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="3.8" fill="${PRIMARY}"/>`)
    .join('');

  let arestas = '';
  if (faces.includes('1X')) arestas += `<line x1="${ex}" y1="${ey + eh}" x2="${ex + ew}" y2="${ey + eh}" stroke="${FACE_COLORS['1X']}" stroke-width="3.2"/>`;
  if (faces.includes('2X')) arestas += `<line x1="${ex}" y1="${ey}" x2="${ex + ew}" y2="${ey}" stroke="${FACE_COLORS['2X']}" stroke-width="3.2"/>`;
  if (faces.includes('1Y')) arestas += `<line x1="${ex}" y1="${ey}" x2="${ex}" y2="${ey + eh}" stroke="${FACE_COLORS['1Y']}" stroke-width="3.2"/>`;
  if (faces.includes('2Y')) arestas += `<line x1="${ex + ew}" y1="${ey}" x2="${ex + ew}" y2="${ey + eh}" stroke="${FACE_COLORS['2Y']}" stroke-width="3.2"/>`;

  // Legenda à direita com Méd / Mín / Máx por face
  const stepY = faces.length > 3 ? 42 : 46;
  const startY = faces.length > 3 ? 52 : 60;
  const legenda = faces.map((f, idx) => {
    const cor = FACE_COLORS[f] ?? NAVY;
    const nome = FACE_LABELS[f] ?? f;
    const st = statsCobrimentosFace(a.facesData?.[f]?.cob ?? []);
    const nEst = a.facesData?.[f]?.nEstribos ?? a.facesData?.[f]?.cob?.length ?? 0;
    const y = startY + idx * stepY;
    const linhaCob = st
      ? `Méd: ${st.media} | Mín: ${st.min} | Máx: ${st.max} mm`
      : 'Sem leituras de cobrimento';
    return `<rect x="242" y="${y - 9}" width="10" height="10" rx="2" fill="${cor}"/>` +
      `<text x="258" y="${y}" font-size="10.8" font-weight="700" fill="${PRIMARY}" font-family="Calibri, sans-serif">${escSvg(nome)} (${a.barras?.[f] ?? 0}B / ${nEst}E)</text>` +
      `<text x="258" y="${y + 13}" font-size="9.8" font-weight="600" fill="${SUBTEXT}" font-family="Calibri, sans-serif">${escSvg(linhaCob)}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#FFFFFF"/>
    ${hatch}
    ${obs}
    <rect x="${ex}" y="${ey}" width="${ew}" height="${eh}" fill="#E8EDF5" stroke="${PRIMARY}" stroke-width="1.6"/>
    <rect x="${ex + cv}" y="${ey + cv}" width="${ew - 2 * cv}" height="${eh - 2 * cv}" fill="none" stroke="#64748B" stroke-width="1.1" stroke-dasharray="3,2"/>
    ${arestas}
    ${barrasXml}
    <text x="${ex + ew / 2}" y="${ey + eh + 20}" text-anchor="middle" font-size="11" font-weight="700" fill="${PRIMARY}" font-family="Calibri, sans-serif">X = ${a.X || 0} cm</text>
    ${op !== 'B' ? `<text x="${ex - 14}" y="${ey + eh / 2 + 4}" text-anchor="end" font-size="11" font-weight="700" fill="${PRIMARY}" font-family="Calibri, sans-serif">Y = ${a.Y || 0} cm</text>` : ''}
    <text x="242" y="30" font-size="11.5" font-weight="700" fill="${NAVY}" font-family="Calibri, sans-serif">Faces Ensaiadas — Cobrimentos</text>
    ${legenda}
  </svg>`;
}

function gerarSvgViga(a: AmostraRow): string {
  const W = 460;
  const H = 236;
  const op = a.opcao as OpcaoViga;
  const faces = getFacesDaOpcao('viga', op);
  const hatch =
    `<defs><pattern id="hv" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
    `<line x1="0" y1="0" x2="0" y2="7" stroke="#94A3B8" stroke-width="1.4"/></pattern></defs>`;

  const rb = Math.max(10, a.X || 20);
  const rh = Math.max(15, a.Y || 45);
  const esc = Math.min(106 / rb, 114 / rh);
  const ew = Math.max(52, Math.round(rb * esc));
  const eh = Math.max(66, Math.round(rh * esc));
  const ex = Math.round(134 - ew / 2);
  const ey = Math.round(114 - eh / 2);
  const cv = 10;

  let obs = '';
  if (op !== 'VE') {
    obs += `<rect x="${ex - 32}" y="${ey - 22}" width="${ew + 64}" height="22" fill="url(#hv)" stroke="#94A3B8" stroke-width="0.7"/>`;
  }
  if (op === 'VB' || op === 'VC' || op === 'VD') {
    obs += `<rect x="${ex + ew}" y="${ey}" width="22" height="${eh}" fill="url(#hv)" stroke="#94A3B8" stroke-width="0.7"/>`;
  }
  if (op === 'VD') {
    obs += `<rect x="${ex - 22}" y="${ey}" width="22" height="${eh}" fill="url(#hv)" stroke="#94A3B8" stroke-width="0.7"/>`;
  }
  if (op === 'VC') {
    obs += `<rect x="${ex}" y="${ey + eh}" width="${ew}" height="20" fill="url(#hv)" stroke="#94A3B8" stroke-width="0.7"/>`;
  }

  let arestas = '';
  if (faces.includes('fundo')) arestas += `<line x1="${ex}" y1="${ey + eh}" x2="${ex + ew}" y2="${ey + eh}" stroke="${FACE_COLORS.fundo}" stroke-width="3.2"/>`;
  if (faces.includes('topo')) arestas += `<line x1="${ex}" y1="${ey}" x2="${ex + ew}" y2="${ey}" stroke="${FACE_COLORS.topo}" stroke-width="3.2"/>`;
  if (faces.includes('lat1')) arestas += `<line x1="${ex}" y1="${ey}" x2="${ex}" y2="${ey + eh}" stroke="${FACE_COLORS.lat1}" stroke-width="3.2"/>`;
  if (faces.includes('lat2')) arestas += `<line x1="${ex + ew}" y1="${ey}" x2="${ex + ew}" y2="${ey + eh}" stroke="${FACE_COLORS.lat2}" stroke-width="3.2"/>`;

  const nInf = Math.max(2, a.barras?.fundo ?? 3);
  const nSup = Math.max(2, a.barras?.topo ?? 2);
  let barrasXml = '';
  for (let i = 0; i < nInf; i++) {
    const x = ex + cv + ((ew - 2 * cv) * i) / (nInf - 1);
    barrasXml += `<circle cx="${x.toFixed(1)}" cy="${ey + eh - cv}" r="3.6" fill="${PRIMARY}"/>`;
  }
  for (let i = 0; i < nSup; i++) {
    const x = ex + cv + ((ew - 2 * cv) * i) / (nSup - 1);
    barrasXml += `<circle cx="${x.toFixed(1)}" cy="${ey + cv}" r="3.6" fill="${PRIMARY}"/>`;
  }

  const stepY = faces.length > 3 ? 42 : 46;
  const startY = faces.length > 3 ? 52 : 60;
  const legenda = faces.map((f, idx) => {
    const cor = FACE_COLORS[f] ?? NAVY;
    const nome = FACE_LABELS[f] ?? f;
    const st = statsCobrimentosFace(a.facesData?.[f]?.cob ?? []);
    const nEst = a.facesData?.[f]?.nEstribos ?? a.facesData?.[f]?.cob?.length ?? 0;
    const y = startY + idx * stepY;
    const linhaCob = st
      ? `Méd: ${st.media} | Mín: ${st.min} | Máx: ${st.max} mm`
      : 'Sem leituras de cobrimento';
    return `<rect x="236" y="${y - 9}" width="10" height="10" rx="2" fill="${cor}"/>` +
      `<text x="252" y="${y}" font-size="10.8" font-weight="700" fill="${PRIMARY}" font-family="Calibri, sans-serif">${escSvg(nome)} (${a.barras?.[f] ?? 0}B / ${nEst}E)</text>` +
      `<text x="252" y="${y + 13}" font-size="9.8" font-weight="600" fill="${SUBTEXT}" font-family="Calibri, sans-serif">${escSvg(linhaCob)}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#FFFFFF"/>
    ${hatch}
    ${obs}
    <rect x="${ex}" y="${ey}" width="${ew}" height="${eh}" fill="#E8EDF5" stroke="${PRIMARY}" stroke-width="1.6"/>
    <rect x="${ex + cv}" y="${ey + cv}" width="${ew - 2 * cv}" height="${eh - 2 * cv}" fill="none" stroke="#64748B" stroke-width="1.1" stroke-dasharray="3,2"/>
    ${arestas}
    ${barrasXml}
    <text x="${ex + ew / 2}" y="${ey + eh + 24}" text-anchor="middle" font-size="11" font-weight="700" fill="${PRIMARY}" font-family="Calibri, sans-serif">b = ${a.X || 0} cm</text>
    <text x="${ex - 14}" y="${ey + eh / 2 + 4}" text-anchor="end" font-size="11" font-weight="700" fill="${PRIMARY}" font-family="Calibri, sans-serif">h = ${a.Y || 0} cm</text>
    <text x="236" y="30" font-size="11.5" font-weight="700" fill="${NAVY}" font-family="Calibri, sans-serif">Faces Ensaiadas — Cobrimentos</text>
    ${legenda}
  </svg>`;
}

function gerarSvgLaje(a: AmostraRow): string {
  const W = 460;
  const H = 240;
  const ld = a.lajeData;
  const lx = Math.max(10, ld?.larguraX ?? 100);
  const ly = Math.max(10, ld?.alturaY ?? 100);
  const ext = ld?.camadaExterna ?? ((ld?.barrasH?.length ?? 0) > 0 ? 'H' : 'V');
  const bh = ordenarBarras(ld?.barrasH ?? []);
  const bv = ordenarBarras(ld?.barrasV ?? []);
  const stats = ld ? calcularCobrimentosLaje(ld) : null;

  const maxW = 186, maxH = 152;
  const esc = Math.min(maxW / lx, maxH / ly);
  const mw = Math.max(80, Math.round(lx * esc));
  const mh = Math.max(70, Math.round(ly * esc));
  const mx = 48;
  const my = Math.round((H - mh) / 2) + 2;

  const passo = Math.max(5, ld?.passoGrid ?? 10);
  let grid = '';
  for (let x = passo; x < lx; x += passo) {
    const px = mx + (x / lx) * mw;
    grid += `<line x1="${px.toFixed(1)}" y1="${my}" x2="${px.toFixed(1)}" y2="${my + mh}" stroke="#E2E8F0" stroke-width="0.7"/>`;
  }
  for (let y = passo; y < ly; y += passo) {
    const py = my + (y / ly) * mh;
    grid += `<line x1="${mx}" y1="${py.toFixed(1)}" x2="${mx + mw}" y2="${py.toFixed(1)}" stroke="#E2E8F0" stroke-width="0.7"/>`;
  }

  let linhasH = '';
  bh.forEach((b, i) => {
    const py = my + Math.min(1, Math.max(0, b.pos / ly)) * mh;
    const sw = ext === 'H' ? '2.4' : '1.4';
    const dash = ext === 'H' ? '' : ' stroke-dasharray="4,2"';
    const cobTxt = ext === 'H' && b.cob?.trim() ? ` (${b.cob.trim()}mm)` : '';
    linhasH += `<line x1="${mx}" y1="${py.toFixed(1)}" x2="${mx + mw}" y2="${py.toFixed(1)}" stroke="${FACE_COLORS.dirH}" stroke-width="${sw}"${dash}/>`;
    linhasH += `<text x="${mx - 5}" y="${(py + 3).toFixed(1)}" text-anchor="end" font-size="8.5" font-weight="700" fill="${FACE_COLORS.dirH}" font-family="Calibri, sans-serif">H${i + 1}</text>`;
    if (cobTxt) {
      linhasH += `<text x="${mx + mw + 4}" y="${(py + 3).toFixed(1)}" font-size="8.2" font-weight="700" fill="${FACE_COLORS.dirH}" font-family="Calibri, sans-serif">${escSvg(b.cob.trim())}mm</text>`;
    }
  });

  let linhasV = '';
  bv.forEach((b, i) => {
    const px = mx + Math.min(1, Math.max(0, b.pos / lx)) * mw;
    const sw = ext === 'V' ? '2.4' : '1.4';
    const dash = ext === 'V' ? '' : ' stroke-dasharray="4,2"';
    const cobTxt = ext === 'V' && b.cob?.trim() ? b.cob.trim() : '';
    linhasV += `<line x1="${px.toFixed(1)}" y1="${my}" x2="${px.toFixed(1)}" y2="${my + mh}" stroke="${FACE_COLORS.dirV}" stroke-width="${sw}"${dash}/>`;
    linhasV += `<text x="${px.toFixed(1)}" y="${my - (cobTxt ? 14 : 5)}" text-anchor="middle" font-size="8.5" font-weight="700" fill="${FACE_COLORS.dirV}" font-family="Calibri, sans-serif">V${i + 1}</text>`;
    if (cobTxt) {
      linhasV += `<text x="${px.toFixed(1)}" y="${my - 4}" text-anchor="middle" font-size="8" font-weight="700" fill="${FACE_COLORS.dirV}" font-family="Calibri, sans-serif">${escSvg(cobTxt)}mm</text>`;
    }
  });

  const infoX = mx + mw + (ext === 'H' ? 40 : 22);
  const cobResumo = stats && stats.cobMedio !== null
    ? [
        `Médio: ${fmtComma(stats.cobMedio, 1)} mm`,
        `Mín: ${fmtComma(stats.cobMinimo!, 0)} mm  |  Máx: ${fmtComma(stats.cobMaximo!, 0)} mm`,
      ]
    : ['Sem leituras de cobrimento'];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#FFFFFF"/>
    <rect x="${mx}" y="${my}" width="${mw}" height="${mh}" fill="#F8FAFC" stroke="${PRIMARY}" stroke-width="1.6"/>
    ${grid}
    ${ext === 'H' ? linhasV + linhasH : linhasH + linhasV}
    <text x="${mx + mw / 2}" y="${my + mh + 18}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${PRIMARY}" font-family="Calibri, sans-serif">Largura X = ${lx} cm</text>
    <text x="${mx - 28}" y="${my + mh / 2}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${PRIMARY}" font-family="Calibri, sans-serif" transform="rotate(-90 ${mx - 28} ${my + mh / 2})">Altura Y = ${ly} cm</text>
    <text x="${infoX}" y="44" font-size="11.2" font-weight="700" fill="${NAVY}" font-family="Calibri, sans-serif">Malha Ensaiada</text>
    <line x1="${infoX}" y1="64" x2="${infoX + 16}" y2="64" stroke="${FACE_COLORS.dirH}" stroke-width="${ext === 'H' ? '2.5' : '1.4'}"${ext === 'H' ? '' : ' stroke-dasharray="4,2"'}/>
    <text x="${infoX + 21}" y="68" font-size="10" fill="${PRIMARY}" font-family="Calibri, sans-serif">Horiz. (H): ${bh.length}${ext === 'H' ? ' ★' : ''}</text>
    <line x1="${infoX}" y1="86" x2="${infoX + 16}" y2="86" stroke="${FACE_COLORS.dirV}" stroke-width="${ext === 'V' ? '2.5' : '1.4'}"${ext === 'V' ? '' : ' stroke-dasharray="4,2"'}/>
    <text x="${infoX + 21}" y="90" font-size="10" fill="${PRIMARY}" font-family="Calibri, sans-serif">Vert. (V): ${bv.length}${ext === 'V' ? ' ★' : ''}</text>
    <text x="${infoX}" y="114" font-size="9" fill="${SUBTEXT}" font-family="Calibri, sans-serif">★ Camada mais externa</text>
    <text x="${infoX}" y="142" font-size="10.2" font-weight="700" fill="${NAVY}" font-family="Calibri, sans-serif">Cobrimentos</text>
    ${cobResumo.map((t, i) => `<text x="${infoX}" y="${158 + i * 16}" font-size="9.8" font-weight="600" fill="${PRIMARY}" font-family="Calibri, sans-serif">${escSvg(t)}</text>`).join('')}
  </svg>`;
}

// ── Perfis de elevação por face (Pilar = vertical, Viga = horizontal) ──

function gerarSvgPerfilVerticalFace(face: string, nBarras: number, fd: FaceData): string {
  const ne = Math.max(1, fd.nEstribos || fd.cob?.length || 1);
  const nb = Math.max(1, nBarras || 1);

  const espVals = Array.from({ length: Math.max(0, ne - 1) }, (_, i) => {
    const raw = fd.espV?.[i]?.replace(',', '.');
    const n = raw ? parseFloat(raw) : NaN;
    return !isNaN(n) && n > 0 ? n : null;
  });
  const espHVals = Array.from({ length: Math.max(0, nb - 1) }, (_, i) => {
    const raw = fd.espH?.[i]?.replace(',', '.');
    const n = raw ? parseFloat(raw) : NaN;
    return !isNaN(n) && n > 0 ? n : null;
  });

  const cobPerpEsq = fd.cobPerpIni?.trim() || '';
  const cobPerpDir = fd.cobPerpFim?.trim() || '';
  const st = statsCobrimentosFace(fd.cob ?? []);
  const faceNome = FACE_LABELS[face] ?? face;
  const col = FACE_COLORS[face] || '#2563EB';

  const headerH = 34;
  const ML = 64;
  const MR = 88;
  const MT = headerH + 26;
  const MB = 42;

  const minStepY = 34;
  const minStepX = 46;
  const padY = 24;
  const padX = cobPerpEsq || cobPerpDir ? 38 : 26;

  const rawGapY = espVals.map(v => v ?? 15);
  const rawGapX = espHVals.map(v => v ?? 12);

  const scY = Math.max(minStepY / Math.max(Math.min(...(rawGapY.length ? rawGapY : [15])), 1), 2.2);
  const gapYPx = rawGapY.map(v => Math.min(64, Math.max(minStepY, v * scY)));
  const ch = Math.max(106, gapYPx.reduce((a, b) => a + b, 0) + 2 * padY);

  const scX = Math.max(minStepX / Math.max(Math.min(...(rawGapX.length ? rawGapX : [12])), 1), 3.0);
  const gapXPx = rawGapX.map(v => Math.min(76, Math.max(minStepX, v * scX)));
  const cw = Math.max(120, gapXPx.reduce((a, b) => a + b, 0) + 2 * padX);

  const W = Math.max(300, ML + cw + MR);
  const H = MT + ch + MB;
  const ox = Math.round((W - (ML + cw + MR)) / 2) + ML;
  const oy = MT;

  const barX: number[] = [];
  if (nb === 1) barX.push(ox + cw / 2);
  else {
    barX.push(ox + padX);
    for (let i = 0; i < nb - 1; i++) barX.push(barX[barX.length - 1] + gapXPx[i]);
  }

  const estrY: number[] = [];
  if (ne === 1) estrY.push(oy + ch / 2);
  else {
    estrY.push(oy + padY);
    for (let i = 0; i < ne - 1; i++) estrY.push(estrY[estrY.length - 1] + gapYPx[i]);
  }

  const cotaBotY = oy + ch + 15;
  const subtitulo = st ? `Méd: ${st.media} | Mín: ${st.min} | Máx: ${st.max} mm` : `${nb}B / ${ne}E`;

  let inner = '';
  // Cabeçalho do card
  inner += `<rect x="0" y="0" width="${W}" height="${headerH}" fill="#F2F4F8"/>`;
  inner += `<rect x="0" y="0" width="4" height="${headerH}" fill="${col}"/>`;
  inner += `<line x1="0" y1="${headerH}" x2="${W}" y2="${headerH}" stroke="#CBD5E1" stroke-width="1"/>`;
  inner += `<text x="12" y="14" font-size="10.5" font-weight="700" fill="${PRIMARY}" font-family="Calibri, sans-serif">${escSvg(faceNome)}</text>`;
  inner += `<text x="12" y="27" font-size="9.2" font-weight="600" fill="${SUBTEXT}" font-family="Calibri, sans-serif">${escSvg(subtitulo)}</text>`;

  // Contorno do pilar
  inner += `<rect x="${ox}" y="${oy}" width="${cw}" height="${ch}" fill="#EEF2F7" stroke="${PRIMARY}" stroke-width="1.8"/>`;

  // Barras longitudinais (verticais)
  barX.forEach((x, i) => {
    inner += `<line x1="${x.toFixed(1)}" y1="${oy + 5}" x2="${x.toFixed(1)}" y2="${oy + ch - 5}" stroke="${col}" stroke-width="1.8" opacity="0.72"/>`;
    inner += `<text x="${x.toFixed(1)}" y="${oy - 7}" text-anchor="middle" font-size="10" font-weight="700" fill="${PRIMARY}" font-family="Calibri, sans-serif">B${i + 1}</text>`;
  });

  // Estribos (horizontais) + cobrimentos
  estrY.forEach((y, i) => {
    const cobVal = fd.cob?.[i]?.trim() || '';
    inner += `<line x1="${ox + 10}" y1="${y.toFixed(1)}" x2="${ox + cw - 10}" y2="${y.toFixed(1)}" stroke="${col}" stroke-width="2.5"/>`;
    inner += `<text x="${ox + cw + 8}" y="${(y + 3.5).toFixed(1)}" font-size="9.8" font-weight="700" fill="${SUBTEXT}" font-family="Calibri, sans-serif">E${i + 1}</text>`;
    if (cobVal) {
      inner += `<text x="${ox + cw + 30}" y="${(y + 3.5).toFixed(1)}" font-size="10" font-weight="700" fill="${col}" font-family="Calibri, sans-serif">${escSvg(cobVal.replace('.', ','))}mm</text>`;
    }
  });

  // Cotas de espaçamento entre estribos (esquerda)
  for (let i = 0; i < estrY.length - 1; i++) {
    const y1 = estrY[i], y2 = estrY[i + 1];
    inner += `<line x1="${ox - 12}" y1="${y1.toFixed(1)}" x2="${ox - 12}" y2="${y2.toFixed(1)}" stroke="${GOLD}" stroke-width="1.1"/>`;
    inner += `<line x1="${ox - 16}" y1="${y1.toFixed(1)}" x2="${ox - 8}" y2="${y1.toFixed(1)}" stroke="${GOLD}" stroke-width="1.1"/>`;
    inner += `<line x1="${ox - 16}" y1="${y2.toFixed(1)}" x2="${ox - 8}" y2="${y2.toFixed(1)}" stroke="${GOLD}" stroke-width="1.1"/>`;
    const lbl = espVals[i] !== null ? `${fmtComma(espVals[i]!, Number.isInteger(espVals[i]!) ? 0 : 1)}cm` : '—';
    inner += `<text x="${ox - 19}" y="${((y1 + y2) / 2 + 3.5).toFixed(1)}" text-anchor="end" font-size="9.5" font-weight="700" fill="${GOLD}" font-family="Calibri, sans-serif">${escSvg(lbl)}</text>`;
  }

  // Linha de cota inferior: cobPerpEsq + espH + cobPerpDir
  if (cobPerpEsq) {
    inner += `<line x1="${ox}" y1="${cotaBotY}" x2="${barX[0].toFixed(1)}" y2="${cotaBotY}" stroke="${PERP_COLOR}" stroke-width="1.2"/>`;
    inner += `<line x1="${ox}" y1="${cotaBotY - 4}" x2="${ox}" y2="${cotaBotY + 4}" stroke="${PERP_COLOR}" stroke-width="1.2"/>`;
    inner += `<line x1="${barX[0].toFixed(1)}" y1="${cotaBotY - 4}" x2="${barX[0].toFixed(1)}" y2="${cotaBotY + 4}" stroke="${PERP_COLOR}" stroke-width="1.2"/>`;
    inner += `<text x="${((ox + barX[0]) / 2).toFixed(1)}" y="${cotaBotY + 15}" text-anchor="middle" font-size="9.2" font-weight="700" fill="${PERP_COLOR}" font-family="Calibri, sans-serif">${escSvg(cobPerpEsq.replace('.', ','))}mm</text>`;
  }
  for (let i = 0; i < barX.length - 1; i++) {
    const x1 = barX[i], x2 = barX[i + 1];
    inner += `<line x1="${x1.toFixed(1)}" y1="${cotaBotY}" x2="${x2.toFixed(1)}" y2="${cotaBotY}" stroke="${GOLD}" stroke-width="1.1"/>`;
    inner += `<line x1="${x1.toFixed(1)}" y1="${cotaBotY - 4}" x2="${x1.toFixed(1)}" y2="${cotaBotY + 4}" stroke="${GOLD}" stroke-width="1.1"/>`;
    inner += `<line x1="${x2.toFixed(1)}" y1="${cotaBotY - 4}" x2="${x2.toFixed(1)}" y2="${cotaBotY + 4}" stroke="${GOLD}" stroke-width="1.1"/>`;
    const lbl = espHVals[i] !== null ? `${fmtComma(espHVals[i]!, Number.isInteger(espHVals[i]!) ? 0 : 1)}cm` : '—';
    inner += `<text x="${((x1 + x2) / 2).toFixed(1)}" y="${cotaBotY + 15}" text-anchor="middle" font-size="9.5" font-weight="700" fill="${GOLD}" font-family="Calibri, sans-serif">${escSvg(lbl)}</text>`;
  }
  if (cobPerpDir) {
    const xLast = barX[nb - 1];
    inner += `<line x1="${xLast.toFixed(1)}" y1="${cotaBotY}" x2="${ox + cw}" y2="${cotaBotY}" stroke="${PERP_COLOR}" stroke-width="1.2"/>`;
    inner += `<line x1="${xLast.toFixed(1)}" y1="${cotaBotY - 4}" x2="${xLast.toFixed(1)}" y2="${cotaBotY + 4}" stroke="${PERP_COLOR}" stroke-width="1.2"/>`;
    inner += `<line x1="${ox + cw}" y1="${cotaBotY - 4}" x2="${ox + cw}" y2="${cotaBotY + 4}" stroke="${PERP_COLOR}" stroke-width="1.2"/>`;
    inner += `<text x="${((xLast + ox + cw) / 2).toFixed(1)}" y="${cotaBotY + 15}" text-anchor="middle" font-size="9.2" font-weight="700" fill="${PERP_COLOR}" font-family="Calibri, sans-serif">${escSvg(cobPerpDir.replace('.', ','))}mm</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1"/>
    ${inner}
  </svg>`;
}

function gerarSvgPerfilHorizontalFace(face: string, nBarras: number, fd: FaceData): string {
  const ne = Math.max(1, fd.nEstribos || fd.cob?.length || 1);
  const nb = Math.max(1, nBarras || 1);

  const espEstr = Array.from({ length: Math.max(0, ne - 1) }, (_, i) => {
    const raw = fd.espV?.[i]?.replace(',', '.');
    const n = raw ? parseFloat(raw) : NaN;
    return !isNaN(n) && n > 0 ? n : null;
  });
  const espLong = Array.from({ length: Math.max(0, nb - 1) }, (_, i) => {
    const raw = fd.espH?.[i]?.replace(',', '.');
    const n = raw ? parseFloat(raw) : NaN;
    return !isNaN(n) && n > 0 ? n : null;
  });

  const cobPerpSup = fd.cobPerpIni?.trim() || '';
  const cobPerpInf = fd.cobPerpFim?.trim() || '';
  const st = statsCobrimentosFace(fd.cob ?? []);
  const faceNome = FACE_LABELS[face] ?? face;
  const col = FACE_COLORS[face] || '#2563EB';

  const headerH = 34;
  const ML = 68;
  const MR = 40;
  const MT = headerH + 38;
  const MB = 38;

  const minStepX = 56;
  const minStepY = 36;
  const padX = 32;
  const padY = cobPerpSup || cobPerpInf ? 32 : 24;

  const rawGapX = espEstr.map(v => v ?? 15);
  const rawGapY = espLong.map(v => v ?? 10);

  const scX = Math.max(minStepX / Math.max(Math.min(...(rawGapX.length ? rawGapX : [15])), 1), 3.0);
  const gapXPx = rawGapX.map(v => Math.min(82, Math.max(minStepX, v * scX)));
  const cw = Math.max(180, gapXPx.reduce((a, b) => a + b, 0) + 2 * padX);

  const scY = Math.max(minStepY / Math.max(Math.min(...(rawGapY.length ? rawGapY : [10])), 1), 2.8);
  const gapYPx = rawGapY.map(v => Math.min(62, Math.max(minStepY, v * scY)));
  const ch = Math.max(92, gapYPx.reduce((a, b) => a + b, 0) + 2 * padY);

  const W = Math.max(320, ML + cw + MR);
  const H = MT + ch + MB;
  const ox = Math.round((W - (ML + cw + MR)) / 2) + ML;
  const oy = MT;

  const barY: number[] = [];
  if (nb === 1) barY.push(oy + ch / 2);
  else {
    barY.push(oy + padY);
    for (let i = 0; i < nb - 1; i++) barY.push(barY[barY.length - 1] + gapYPx[i]);
  }

  const estrX: number[] = [];
  if (ne === 1) estrX.push(ox + cw / 2);
  else {
    estrX.push(ox + padX);
    for (let i = 0; i < ne - 1; i++) estrX.push(estrX[estrX.length - 1] + gapXPx[i]);
  }

  const cotaEsqX = ox - 12;
  const subtitulo = st ? `Méd: ${st.media} | Mín: ${st.min} | Máx: ${st.max} mm` : `${nb}B / ${ne}E`;

  let inner = '';
  // Cabeçalho do card
  inner += `<rect x="0" y="0" width="${W}" height="${headerH}" fill="#F2F4F8"/>`;
  inner += `<rect x="0" y="0" width="4" height="${headerH}" fill="${col}"/>`;
  inner += `<line x1="0" y1="${headerH}" x2="${W}" y2="${headerH}" stroke="#CBD5E1" stroke-width="1"/>`;
  inner += `<text x="12" y="14" font-size="10.5" font-weight="700" fill="${PRIMARY}" font-family="Calibri, sans-serif">${escSvg(faceNome)}</text>`;
  inner += `<text x="12" y="27" font-size="9.2" font-weight="600" fill="${SUBTEXT}" font-family="Calibri, sans-serif">${escSvg(subtitulo)}</text>`;

  // Contorno horizontal da viga
  inner += `<rect x="${ox}" y="${oy}" width="${cw}" height="${ch}" fill="#EEF2F7" stroke="${PRIMARY}" stroke-width="1.8"/>`;
  inner += `<line x1="${ox}" y1="${oy - 3}" x2="${ox}" y2="${oy + ch + 3}" stroke="${PRIMARY}" stroke-width="1.4" stroke-dasharray="3,2"/>`;
  inner += `<line x1="${ox + cw}" y1="${oy - 3}" x2="${ox + cw}" y2="${oy + ch + 3}" stroke="${PRIMARY}" stroke-width="1.4" stroke-dasharray="3,2"/>`;

  // Barras longitudinais (horizontais)
  barY.forEach((y, i) => {
    inner += `<line x1="${ox + 5}" y1="${y.toFixed(1)}" x2="${ox + cw - 5}" y2="${y.toFixed(1)}" stroke="${col}" stroke-width="1.8" opacity="0.72"/>`;
    inner += `<text x="${ox + cw + 8}" y="${(y + 3.5).toFixed(1)}" font-size="10" font-weight="700" fill="${PRIMARY}" font-family="Calibri, sans-serif">B${i + 1}</text>`;
  });

  // Estribos (verticais) + cobrimentos no topo
  estrX.forEach((x, i) => {
    const cobVal = fd.cob?.[i]?.trim() || '';
    inner += `<line x1="${x.toFixed(1)}" y1="${oy + 8}" x2="${x.toFixed(1)}" y2="${oy + ch - 8}" stroke="${col}" stroke-width="2.5"/>`;
    inner += `<text x="${x.toFixed(1)}" y="${oy - 20}" text-anchor="middle" font-size="9.5" font-weight="700" fill="${SUBTEXT}" font-family="Calibri, sans-serif">E${i + 1}</text>`;
    if (cobVal) {
      inner += `<text x="${x.toFixed(1)}" y="${oy - 7}" text-anchor="middle" font-size="9.8" font-weight="700" fill="${col}" font-family="Calibri, sans-serif">${escSvg(cobVal.replace('.', ','))}mm</text>`;
    }
  });

  // Cotas de espaçamento entre estribos (embaixo)
  for (let i = 0; i < estrX.length - 1; i++) {
    const x1 = estrX[i], x2 = estrX[i + 1];
    inner += `<line x1="${x1.toFixed(1)}" y1="${oy + ch + 14}" x2="${x2.toFixed(1)}" y2="${oy + ch + 14}" stroke="${GOLD}" stroke-width="1.1"/>`;
    inner += `<line x1="${x1.toFixed(1)}" y1="${oy + ch + 10}" x2="${x1.toFixed(1)}" y2="${oy + ch + 18}" stroke="${GOLD}" stroke-width="1.1"/>`;
    inner += `<line x1="${x2.toFixed(1)}" y1="${oy + ch + 10}" x2="${x2.toFixed(1)}" y2="${oy + ch + 18}" stroke="${GOLD}" stroke-width="1.1"/>`;
    const lbl = espEstr[i] !== null ? `${fmtComma(espEstr[i]!, Number.isInteger(espEstr[i]!) ? 0 : 1)}cm` : '—';
    inner += `<text x="${((x1 + x2) / 2).toFixed(1)}" y="${oy + ch + 29}" text-anchor="middle" font-size="9.5" font-weight="700" fill="${GOLD}" font-family="Calibri, sans-serif">${escSvg(lbl)}</text>`;
  }

  // Linha de cota esquerda: cobPerpSup + espLong + cobPerpInf
  if (cobPerpSup) {
    inner += `<line x1="${cotaEsqX}" y1="${oy}" x2="${cotaEsqX}" y2="${barY[0].toFixed(1)}" stroke="${PERP_COLOR}" stroke-width="1.2"/>`;
    inner += `<line x1="${cotaEsqX - 4}" y1="${oy}" x2="${cotaEsqX + 4}" y2="${oy}" stroke="${PERP_COLOR}" stroke-width="1.2"/>`;
    inner += `<line x1="${cotaEsqX - 4}" y1="${barY[0].toFixed(1)}" x2="${cotaEsqX + 4}" y2="${barY[0].toFixed(1)}" stroke="${PERP_COLOR}" stroke-width="1.2"/>`;
    inner += `<text x="${cotaEsqX - 7}" y="${((oy + barY[0]) / 2 + 3.5).toFixed(1)}" text-anchor="end" font-size="9.2" font-weight="700" fill="${PERP_COLOR}" font-family="Calibri, sans-serif">${escSvg(cobPerpSup.replace('.', ','))}mm</text>`;
  }
  for (let i = 0; i < barY.length - 1; i++) {
    const y1 = barY[i], y2 = barY[i + 1];
    inner += `<line x1="${cotaEsqX}" y1="${y1.toFixed(1)}" x2="${cotaEsqX}" y2="${y2.toFixed(1)}" stroke="${GOLD}" stroke-width="1.1"/>`;
    inner += `<line x1="${cotaEsqX - 4}" y1="${y1.toFixed(1)}" x2="${cotaEsqX + 4}" y2="${y1.toFixed(1)}" stroke="${GOLD}" stroke-width="1.1"/>`;
    inner += `<line x1="${cotaEsqX - 4}" y1="${y2.toFixed(1)}" x2="${cotaEsqX + 4}" y2="${y2.toFixed(1)}" stroke="${GOLD}" stroke-width="1.1"/>`;
    const lbl = espLong[i] !== null ? `${fmtComma(espLong[i]!, Number.isInteger(espLong[i]!) ? 0 : 1)}cm` : '—';
    inner += `<text x="${cotaEsqX - 7}" y="${((y1 + y2) / 2 + 3.5).toFixed(1)}" text-anchor="end" font-size="9.5" font-weight="700" fill="${GOLD}" font-family="Calibri, sans-serif">${escSvg(lbl)}</text>`;
  }
  if (cobPerpInf) {
    const yLast = barY[nb - 1];
    inner += `<line x1="${cotaEsqX}" y1="${yLast.toFixed(1)}" x2="${cotaEsqX}" y2="${oy + ch}" stroke="${PERP_COLOR}" stroke-width="1.2"/>`;
    inner += `<line x1="${cotaEsqX - 4}" y1="${yLast.toFixed(1)}" x2="${cotaEsqX + 4}" y2="${yLast.toFixed(1)}" stroke="${PERP_COLOR}" stroke-width="1.2"/>`;
    inner += `<line x1="${cotaEsqX - 4}" y1="${oy + ch}" x2="${cotaEsqX + 4}" y2="${oy + ch}" stroke="${PERP_COLOR}" stroke-width="1.2"/>`;
    inner += `<text x="${cotaEsqX - 7}" y="${((yLast + oy + ch) / 2 + 3.5).toFixed(1)}" text-anchor="end" font-size="9.2" font-weight="700" fill="${PERP_COLOR}" font-family="Calibri, sans-serif">${escSvg(cobPerpInf.replace('.', ','))}mm</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1"/>
    ${inner}
  </svg>`;
}

export type PerfilSvgFace = {
  face: string;
  faceLabel: string;
  svg: string;
};

/** Gera string SVG técnica do esquema do elemento (Pilar, Viga ou Laje/Área Livre). */
export function gerarSvgEsquemaPacometria(amostra: AmostraRow): string {
  if (amostra.tipo === 'viga') return gerarSvgViga(amostra);
  if (amostra.tipo === 'laje') return gerarSvgLaje(amostra);
  return gerarSvgPilar(amostra);
}

/**
 * Gera os SVGs de elevação/perfil por face para Pilar (vertical) e Viga (horizontal).
 * Para Laje retorna array vazio (a malha já é representada em gerarSvgEsquemaPacometria).
 */
export function gerarSvgsPerfisPacometria(amostra: AmostraRow): PerfilSvgFace[] {
  if (amostra.tipo === 'laje') return [];
  const chaves = getFacesDaOpcao(amostra.tipo, amostra.opcao);
  const chavesEfetivas = chaves.length > 0 ? chaves : Object.keys(amostra.facesData ?? {});
  const perfis: PerfilSvgFace[] = [];

  for (const face of chavesEfetivas) {
    const fd = amostra.facesData?.[face];
    if (!fd) continue;
    const nBarras = amostra.barras?.[face] ?? 2;
    const svg = amostra.tipo === 'viga'
      ? gerarSvgPerfilHorizontalFace(face, nBarras, fd)
      : gerarSvgPerfilVerticalFace(face, nBarras, fd);
    perfis.push({
      face,
      faceLabel: FACE_LABELS[face] ?? face,
      svg,
    });
  }

  return perfis;
}
