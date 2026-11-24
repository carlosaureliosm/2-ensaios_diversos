// src/modules/pacometria/svgRelatorio.ts
//
// Gera SVGs técnicos puros (string SVG, sem React) para rasterização em PNG e inclusão
// no relatório DOCX de pacometria:
//   - Seção transversal / malha: Pilar (retangular A..D ou circular E), Viga (VA..VE), Laje (LA..LC)
//     com estatísticas Méd / Mín / Máx por face (sem destaque vermelho, pois não há limite normativo)
//   - Perfis de elevação por face: vertical (Pilar) e horizontal (Viga), com:
//       * Barras longitudinais (B1..Bn) em azul (#2563EB)
//       * Estribos (E1..En) e cobrimentos em vermelho sóbrio (#A8383B)
//       * Todas as linhas e valores de cotas (espaçamentos e cobrimentos às bordas) em amarelo (#B8890E)
//       * Legenda integrada de cores no próprio perfil.

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
const BARRA_COLOR = '#2563EB';   // Azul para barras longitudinais (B1..Bn)
const ESTRIBO_COLOR = '#A8383B'; // Vermelho sóbrio (não tão vivo) para estribos (E1..En)

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
  const W = 490;
  const H = 262;
  const op = a.opcao as OpcaoPilar;
  const faces = getFacesDaOpcao('pilar', op);
  const hatch =
    `<defs><pattern id="hp" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
    `<line x1="0" y1="0" x2="0" y2="8" stroke="#94A3B8" stroke-width="1.5"/></pattern></defs>`;

  if (op === 'E') {
    const cx = 108, cy = 120, r = 68, rb = 50;
    const nb = Math.max(4, a.barras?.circ ?? 8);
    let barras = '';
    for (let i = 0; i < nb; i++) {
      const ang = (2 * Math.PI / nb) * i - Math.PI / 2;
      const bx = (cx + rb * Math.cos(ang)).toFixed(1);
      const by = (cy + rb * Math.sin(ang)).toFixed(1);
      barras += `<circle cx="${bx}" cy="${by}" r="4.8" fill="${PRIMARY}"/>`;
    }
    const st = statsCobrimentosFace(a.facesData?.circ?.cob ?? []);
    const info = [
      `Circular — Ø ${a.D || 0} cm`,
      `Barras long.: ${nb}`,
      `Estribos medidos: ${a.facesData?.circ?.nEstribos ?? 0}`,
      st ? `Cob. médio: ${st.media} mm` : 'Sem leituras de cobrimento',
      ...(st ? [`Mín: ${st.min} mm | Máx: ${st.max} mm`] : []),
    ];
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <rect width="${W}" height="${H}" fill="#FFFFFF"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#E8EDF5" stroke="${NAVY}" stroke-width="2.4"/>
      <circle cx="${cx}" cy="${cy}" r="${rb}" fill="none" stroke="${ESTRIBO_COLOR}" stroke-width="1.6" stroke-dasharray="5,3"/>
      ${barras}
      <line x1="${cx - r}" y1="${cy + r + 18}" x2="${cx + r}" y2="${cy + r + 18}" stroke="${PRIMARY}" stroke-width="1.2"/>
      <text x="${cx}" y="${cy + r + 39}" text-anchor="middle" font-size="18.5" font-weight="700" fill="${PRIMARY}" font-family="Calibri, sans-serif">Ø = ${a.D || 0} cm</text>
      <text x="198" y="38" font-size="20" font-weight="700" fill="${NAVY}" font-family="Calibri, sans-serif">Resumo da Seção</text>
      ${info.map((t, idx) => `<text x="198" y="${74 + idx * 35}" font-size="18" font-weight="${idx === 0 || idx === 4 ? '700' : '400'}" fill="${PRIMARY}" font-family="Calibri, sans-serif">${escSvg(t)}</text>`).join('')}
    </svg>`;
  }

  const maxW = 132, maxH = 118;
  const rx = Math.max(10, a.X || 30);
  const ry = Math.max(10, a.Y || 30);
  const esc = Math.min(maxW / rx, maxH / ry);
  const ew = Math.max(68, Math.round(rx * esc));
  const eh = Math.max(60, Math.round(ry * esc));
  const ex = Math.round(112 - ew / 2);
  const ey = Math.round(122 - eh / 2);
  const cv = 12;

  let obs = '';
  if (op === 'B' || op === 'C' || op === 'D') {
    obs += `<rect x="${ex}" y="${ey - 22}" width="${ew}" height="22" fill="url(#hp)" stroke="#94A3B8" stroke-width="0.8"/>`;
  }
  if (op === 'B') {
    obs += `<rect x="${ex - 22}" y="${ey}" width="22" height="${eh}" fill="url(#hp)" stroke="#94A3B8" stroke-width="0.8"/>`;
    obs += `<rect x="${ex + ew}" y="${ey}" width="22" height="${eh}" fill="url(#hp)" stroke="#94A3B8" stroke-width="0.8"/>`;
  }
  if (op === 'C') {
    obs += `<rect x="${ex + ew}" y="${ey}" width="22" height="${eh}" fill="url(#hp)" stroke="#94A3B8" stroke-width="0.8"/>`;
  }

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
    .map(([bx, by]) => `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="4.4" fill="${PRIMARY}"/>`)
    .join('');

  let arestas = '';
  if (faces.includes('1X')) arestas += `<line x1="${ex}" y1="${ey + eh}" x2="${ex + ew}" y2="${ey + eh}" stroke="${FACE_COLORS['1X']}" stroke-width="3.8"/>`;
  if (faces.includes('2X')) arestas += `<line x1="${ex}" y1="${ey}" x2="${ex + ew}" y2="${ey}" stroke="${FACE_COLORS['2X']}" stroke-width="3.8"/>`;
  if (faces.includes('1Y')) arestas += `<line x1="${ex}" y1="${ey}" x2="${ex}" y2="${ey + eh}" stroke="${FACE_COLORS['1Y']}" stroke-width="3.8"/>`;
  if (faces.includes('2Y')) arestas += `<line x1="${ex + ew}" y1="${ey}" x2="${ex + ew}" y2="${ey + eh}" stroke="${FACE_COLORS['2Y']}" stroke-width="3.8"/>`;

  const stepY = faces.length > 3 ? 53 : 60;
  const startY = faces.length > 3 ? 58 : 70;
  const legenda = faces.map((f, idx) => {
    const cor = FACE_COLORS[f] ?? NAVY;
    const nome = FACE_LABELS[f] ?? f;
    const st = statsCobrimentosFace(a.facesData?.[f]?.cob ?? []);
    const nEst = a.facesData?.[f]?.nEstribos ?? a.facesData?.[f]?.cob?.length ?? 0;
    const y = startY + idx * stepY;
    const linhaCob = st
      ? `Méd:${st.media} | Mín:${st.min} | Máx:${st.max} mm`
      : 'Sem leituras de cobrimento';
    return `<rect x="198" y="${y - 14}" width="14" height="14" rx="2.5" fill="${cor}"/>` +
      `<text x="218" y="${y}" font-size="17.5" font-weight="700" fill="${PRIMARY}" font-family="Calibri, sans-serif">${escSvg(nome)} (${a.barras?.[f] ?? 0}B/${nEst}E)</text>` +
      `<text x="218" y="${y + 21}" font-size="16.5" font-weight="600" fill="${SUBTEXT}" font-family="Calibri, sans-serif">${escSvg(linhaCob)}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#FFFFFF"/>
    ${hatch}
    ${obs}
    <rect x="${ex}" y="${ey}" width="${ew}" height="${eh}" fill="#E8EDF5" stroke="${PRIMARY}" stroke-width="2"/>
    <rect x="${ex + cv}" y="${ey + cv}" width="${ew - 2 * cv}" height="${eh - 2 * cv}" fill="none" stroke="#64748B" stroke-width="1.3" stroke-dasharray="4,2.5"/>
    ${arestas}
    ${barrasXml}
    <text x="${ex + ew / 2}" y="${ey + eh + 28}" text-anchor="middle" font-size="18" font-weight="700" fill="${PRIMARY}" font-family="Calibri, sans-serif">X = ${a.X || 0} cm</text>
    ${op !== 'B' ? `<text x="${ex - 8}" y="${ey + eh / 2 + 6}" text-anchor="end" font-size="18" font-weight="700" fill="${PRIMARY}" font-family="Calibri, sans-serif">Y = ${a.Y || 0} cm</text>` : ''}
    <text x="198" y="32" font-size="19.5" font-weight="700" fill="${NAVY}" font-family="Calibri, sans-serif">Faces — Cobrimentos</text>
    ${legenda}
  </svg>`;
}

function gerarSvgViga(a: AmostraRow): string {
  const W = 490;
  const H = 262;
  const op = a.opcao as OpcaoViga;
  const faces = getFacesDaOpcao('viga', op);
  const hatch =
    `<defs><pattern id="hv" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
    `<line x1="0" y1="0" x2="0" y2="8" stroke="#94A3B8" stroke-width="1.5"/></pattern></defs>`;

  const rb = Math.max(10, a.X || 20);
  const rh = Math.max(15, a.Y || 45);
  const esc = Math.min(110 / rb, 122 / rh);
  const ew = Math.max(58, Math.round(rb * esc));
  const eh = Math.max(72, Math.round(rh * esc));
  const ex = Math.round(112 - ew / 2);
  const ey = Math.round(124 - eh / 2);
  const cv = 11;

  let obs = '';
  if (op !== 'VE') {
    obs += `<rect x="${ex - 30}" y="${ey - 22}" width="${ew + 60}" height="22" fill="url(#hv)" stroke="#94A3B8" stroke-width="0.8"/>`;
  }
  if (op === 'VB' || op === 'VC' || op === 'VD') {
    obs += `<rect x="${ex + ew}" y="${ey}" width="22" height="${eh}" fill="url(#hv)" stroke="#94A3B8" stroke-width="0.8"/>`;
  }
  if (op === 'VD') {
    obs += `<rect x="${ex - 22}" y="${ey}" width="22" height="${eh}" fill="url(#hv)" stroke="#94A3B8" stroke-width="0.8"/>`;
  }
  if (op === 'VC') {
    obs += `<rect x="${ex}" y="${ey + eh}" width="${ew}" height="20" fill="url(#hv)" stroke="#94A3B8" stroke-width="0.8"/>`;
  }

  let arestas = '';
  if (faces.includes('fundo')) arestas += `<line x1="${ex}" y1="${ey + eh}" x2="${ex + ew}" y2="${ey + eh}" stroke="${FACE_COLORS.fundo}" stroke-width="3.8"/>`;
  if (faces.includes('topo')) arestas += `<line x1="${ex}" y1="${ey}" x2="${ex + ew}" y2="${ey}" stroke="${FACE_COLORS.topo}" stroke-width="3.8"/>`;
  if (faces.includes('lat1')) arestas += `<line x1="${ex}" y1="${ey}" x2="${ex}" y2="${ey + eh}" stroke="${FACE_COLORS.lat1}" stroke-width="3.8"/>`;
  if (faces.includes('lat2')) arestas += `<line x1="${ex + ew}" y1="${ey}" x2="${ex + ew}" y2="${ey + eh}" stroke="${FACE_COLORS.lat2}" stroke-width="3.8"/>`;

  const nInf = Math.max(2, a.barras?.fundo ?? 3);
  const nSup = Math.max(2, a.barras?.topo ?? 2);
  let barrasXml = '';
  for (let i = 0; i < nInf; i++) {
    const x = ex + cv + ((ew - 2 * cv) * i) / (nInf - 1);
    barrasXml += `<circle cx="${x.toFixed(1)}" cy="${ey + eh - cv}" r="4.2" fill="${PRIMARY}"/>`;
  }
  for (let i = 0; i < nSup; i++) {
    const x = ex + cv + ((ew - 2 * cv) * i) / (nSup - 1);
    barrasXml += `<circle cx="${x.toFixed(1)}" cy="${ey + cv}" r="4.2" fill="${PRIMARY}"/>`;
  }

  const stepY = faces.length > 3 ? 53 : 60;
  const startY = faces.length > 3 ? 58 : 70;
  const legenda = faces.map((f, idx) => {
    const cor = FACE_COLORS[f] ?? NAVY;
    const nome = FACE_LABELS[f] ?? f;
    const st = statsCobrimentosFace(a.facesData?.[f]?.cob ?? []);
    const nEst = a.facesData?.[f]?.nEstribos ?? a.facesData?.[f]?.cob?.length ?? 0;
    const y = startY + idx * stepY;
    const linhaCob = st
      ? `Méd:${st.media} | Mín:${st.min} | Máx:${st.max} mm`
      : 'Sem leituras de cobrimento';
    return `<rect x="198" y="${y - 14}" width="14" height="14" rx="2.5" fill="${cor}"/>` +
      `<text x="218" y="${y}" font-size="17.5" font-weight="700" fill="${PRIMARY}" font-family="Calibri, sans-serif">${escSvg(nome)} (${a.barras?.[f] ?? 0}B/${nEst}E)</text>` +
      `<text x="218" y="${y + 21}" font-size="16.5" font-weight="600" fill="${SUBTEXT}" font-family="Calibri, sans-serif">${escSvg(linhaCob)}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#FFFFFF"/>
    ${hatch}
    ${obs}
    <rect x="${ex}" y="${ey}" width="${ew}" height="${eh}" fill="#E8EDF5" stroke="${PRIMARY}" stroke-width="2"/>
    <rect x="${ex + cv}" y="${ey + cv}" width="${ew - 2 * cv}" height="${eh - 2 * cv}" fill="none" stroke="#64748B" stroke-width="1.3" stroke-dasharray="4,2.5"/>
    ${arestas}
    ${barrasXml}
    <text x="${ex + ew / 2}" y="${ey + eh + 28}" text-anchor="middle" font-size="18" font-weight="700" fill="${PRIMARY}" font-family="Calibri, sans-serif">b = ${a.X || 0} cm</text>
    <text x="${ex - 8}" y="${ey + eh / 2 + 6}" text-anchor="end" font-size="18" font-weight="700" fill="${PRIMARY}" font-family="Calibri, sans-serif">h = ${a.Y || 0} cm</text>
    <text x="198" y="32" font-size="19.5" font-weight="700" fill="${NAVY}" font-family="Calibri, sans-serif">Faces — Cobrimentos</text>
    ${legenda}
  </svg>`;
}

function gerarSvgLaje(a: AmostraRow): string {
  const W = 560;
  const H = 285;
  const ld = a.lajeData;
  const lx = Math.max(10, ld?.larguraX ?? 100);
  const ly = Math.max(10, ld?.alturaY ?? 100);
  const ext = ld?.camadaExterna ?? ((ld?.barrasH?.length ?? 0) > 0 ? 'H' : 'V');
  const bh = ordenarBarras(ld?.barrasH ?? []);
  const bv = ordenarBarras(ld?.barrasV ?? []);
  const stats = ld ? calcularCobrimentosLaje(ld) : null;

  const maxW = 224, maxH = 184;
  const esc = Math.min(maxW / lx, maxH / ly);
  const mw = Math.max(96, Math.round(lx * esc));
  const mh = Math.max(84, Math.round(ly * esc));
  const mx = 56;
  const my = Math.round((H - mh) / 2) + 4;

  const passo = Math.max(5, ld?.passoGrid ?? 10);
  let grid = '';
  for (let x = passo; x < lx; x += passo) {
    const px = mx + (x / lx) * mw;
    grid += `<line x1="${px.toFixed(1)}" y1="${my}" x2="${px.toFixed(1)}" y2="${my + mh}" stroke="#E2E8F0" stroke-width="0.8"/>`;
  }
  for (let y = passo; y < ly; y += passo) {
    const py = my + (y / ly) * mh;
    grid += `<line x1="${mx}" y1="${py.toFixed(1)}" x2="${mx + mw}" y2="${py.toFixed(1)}" stroke="#E2E8F0" stroke-width="0.8"/>`;
  }

  let linhasH = '';
  bh.forEach((b, i) => {
    const py = my + Math.min(1, Math.max(0, b.pos / ly)) * mh;
    const sw = ext === 'H' ? '2.8' : '1.6';
    const dash = ext === 'H' ? '' : ' stroke-dasharray="5,2.5"';
    const cobTxt = ext === 'H' && b.cob?.trim() ? b.cob.trim() : '';
    linhasH += `<line x1="${mx}" y1="${py.toFixed(1)}" x2="${mx + mw}" y2="${py.toFixed(1)}" stroke="${FACE_COLORS.dirH}" stroke-width="${sw}"${dash}/>`;
    linhasH += `<text x="${mx - 6}" y="${(py + 5).toFixed(1)}" text-anchor="end" font-size="14.5" font-weight="700" fill="${FACE_COLORS.dirH}" font-family="Calibri, sans-serif">H${i + 1}</text>`;
    if (cobTxt) {
      linhasH += `<text x="${mx + mw + 5}" y="${(py + 5).toFixed(1)}" font-size="14" font-weight="700" fill="${FACE_COLORS.dirH}" font-family="Calibri, sans-serif">${escSvg(cobTxt)}mm</text>`;
    }
  });

  let linhasV = '';
  bv.forEach((b, i) => {
    const px = mx + Math.min(1, Math.max(0, b.pos / lx)) * mw;
    const sw = ext === 'V' ? '2.8' : '1.6';
    const dash = ext === 'V' ? '' : ' stroke-dasharray="5,2.5"';
    const cobTxt = ext === 'V' && b.cob?.trim() ? b.cob.trim() : '';
    linhasV += `<line x1="${px.toFixed(1)}" y1="${my}" x2="${px.toFixed(1)}" y2="${my + mh}" stroke="${FACE_COLORS.dirV}" stroke-width="${sw}"${dash}/>`;
    linhasV += `<text x="${px.toFixed(1)}" y="${my - (cobTxt ? 22 : 8)}" text-anchor="middle" font-size="14.5" font-weight="700" fill="${FACE_COLORS.dirV}" font-family="Calibri, sans-serif">V${i + 1}</text>`;
    if (cobTxt) {
      linhasV += `<text x="${px.toFixed(1)}" y="${my - 5}" text-anchor="middle" font-size="13.5" font-weight="700" fill="${FACE_COLORS.dirV}" font-family="Calibri, sans-serif">${escSvg(cobTxt)}mm</text>`;
    }
  });

  const infoX = mx + mw + (ext === 'H' ? 60 : 28);
  const cobResumo = stats && stats.cobMedio !== null
    ? [
        `Médio: ${fmtComma(stats.cobMedio, 1)} mm`,
        `Mín: ${fmtComma(stats.cobMinimo!, 0)} | Máx: ${fmtComma(stats.cobMaximo!, 0)} mm`,
      ]
    : ['Sem leituras'];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#FFFFFF"/>
    <rect x="${mx}" y="${my}" width="${mw}" height="${mh}" fill="#F8FAFC" stroke="${PRIMARY}" stroke-width="2"/>
    ${grid}
    ${ext === 'H' ? linhasV + linhasH : linhasH + linhasV}
    <text x="${mx + mw / 2}" y="${my + mh + 26}" text-anchor="middle" font-size="17.5" font-weight="700" fill="${PRIMARY}" font-family="Calibri, sans-serif">Largura X = ${lx} cm</text>
    <text x="${mx - 38}" y="${my + mh / 2}" text-anchor="middle" font-size="17.5" font-weight="700" fill="${PRIMARY}" font-family="Calibri, sans-serif" transform="rotate(-90 ${mx - 38} ${my + mh / 2})">Altura Y = ${ly} cm</text>
    <text x="${infoX}" y="46" font-size="19" font-weight="700" fill="${NAVY}" font-family="Calibri, sans-serif">Malha Ensaiada</text>
    <line x1="${infoX}" y1="74" x2="${infoX + 20}" y2="74" stroke="${FACE_COLORS.dirH}" stroke-width="${ext === 'H' ? '3' : '1.6'}"${ext === 'H' ? '' : ' stroke-dasharray="5,2.5"'}/>
    <text x="${infoX + 26}" y="80" font-size="16.5" fill="${PRIMARY}" font-family="Calibri, sans-serif">Horiz. (H): ${bh.length}${ext === 'H' ? ' ★' : ''}</text>
    <line x1="${infoX}" y1="104" x2="${infoX + 20}" y2="104" stroke="${FACE_COLORS.dirV}" stroke-width="${ext === 'V' ? '3' : '1.6'}"${ext === 'V' ? '' : ' stroke-dasharray="5,2.5"'}/>
    <text x="${infoX + 26}" y="110" font-size="16.5" fill="${PRIMARY}" font-family="Calibri, sans-serif">Vert. (V): ${bv.length}${ext === 'V' ? ' ★' : ''}</text>
    <text x="${infoX}" y="138" font-size="14.5" fill="${SUBTEXT}" font-family="Calibri, sans-serif">★ Camada externa</text>
    <text x="${infoX}" y="176" font-size="18" font-weight="700" fill="${NAVY}" font-family="Calibri, sans-serif">Cobrimentos</text>
    ${cobResumo.map((t, i) => `<text x="${infoX}" y="${202 + i * 25}" font-size="16.5" font-weight="600" fill="${PRIMARY}" font-family="Calibri, sans-serif">${escSvg(t)}</text>`).join('')}
  </svg>`;
}

// ── Perfis de elevação por face (Pilar = vertical, Viga = horizontal) ──
// Cores padronizadas:
//   - Barras longitudinais (B1..Bn): azul (#2563EB)
//   - Estribos (E1..En) + cobrimentos: vermelho sóbrio (#A8383B)
//   - Todas as linhas e cotas (espaçamentos e cobrimentos de borda): amarelo (#B8890E)

function legendaCoresPerfilSvg(W: number, yBase: number): string {
  const yMid = yBase + 13;
  return (
    `<line x1="0" y1="${yBase}" x2="${W}" y2="${yBase}" stroke="#E2E8F0" stroke-width="1"/>` +
    `<rect x="0" y="${yBase + 1}" width="${W}" height="24" fill="#FAFBFD"/>` +
    `<line x1="10" y1="${yMid}" x2="24" y2="${yMid}" stroke="${BARRA_COLOR}" stroke-width="3"/>` +
    `<text x="29" y="${yMid + 5}" font-size="14.5" font-weight="700" fill="${BARRA_COLOR}" font-family="Calibri, sans-serif">Barras (B)</text>` +
    `<line x1="116" y1="${yMid}" x2="130" y2="${yMid}" stroke="${ESTRIBO_COLOR}" stroke-width="3.2"/>` +
    `<text x="135" y="${yMid + 5}" font-size="14.5" font-weight="700" fill="${ESTRIBO_COLOR}" font-family="Calibri, sans-serif">Estribos / Cob. (E)</text>` +
    `<line x1="288" y1="${yMid}" x2="302" y2="${yMid}" stroke="${GOLD}" stroke-width="2"/>` +
    `<text x="307" y="${yMid + 5}" font-size="14.5" font-weight="700" fill="${GOLD}" font-family="Calibri, sans-serif">Cotas</text>`
  );
}

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
  const faceAccent = FACE_COLORS[face] || NAVY;

  const headerH = 46;
  const footerH = 26;
  const ML = 76;
  const MR = 104;
  const MT = headerH + 26;
  const MB = 48 + footerH;

  const minStepY = 40;
  const minStepX = 56;
  const padY = 28;
  const padX = cobPerpEsq || cobPerpDir ? 46 : 30;

  const rawGapY = espVals.map(v => v ?? 15);
  const rawGapX = espHVals.map(v => v ?? 12);

  const scY = Math.max(minStepY / Math.max(Math.min(...(rawGapY.length ? rawGapY : [15])), 1), 2.6);
  const gapYPx = rawGapY.map(v => Math.min(72, Math.max(minStepY, v * scY)));
  const ch = Math.max(126, gapYPx.reduce((a, b) => a + b, 0) + 2 * padY);

  const scX = Math.max(minStepX / Math.max(Math.min(...(rawGapX.length ? rawGapX : [12])), 1), 3.4);
  const gapXPx = rawGapX.map(v => Math.min(86, Math.max(minStepX, v * scX)));
  const cw = Math.max(142, gapXPx.reduce((a, b) => a + b, 0) + 2 * padX);

  const W = Math.max(360, ML + cw + MR);
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

  const cotaBotY = oy + ch + 18;
  const subtitulo = st ? `Méd: ${st.media} | Mín: ${st.min} | Máx: ${st.max} mm` : `${nb}B / ${ne}E`;

  let inner = '';
  // Cabeçalho do card
  inner += `<rect x="0" y="0" width="${W}" height="${headerH}" fill="#F2F4F8"/>`;
  inner += `<rect x="0" y="0" width="5" height="${headerH}" fill="${faceAccent}"/>`;
  inner += `<line x1="0" y1="${headerH}" x2="${W}" y2="${headerH}" stroke="#CBD5E1" stroke-width="1"/>`;
  inner += `<text x="14" y="20" font-size="18" font-weight="700" fill="${PRIMARY}" font-family="Calibri, sans-serif">${escSvg(faceNome)}</text>`;
  inner += `<text x="14" y="40" font-size="16" font-weight="600" fill="${SUBTEXT}" font-family="Calibri, sans-serif">${escSvg(subtitulo)}</text>`;

  // Contorno do pilar
  inner += `<rect x="${ox}" y="${oy}" width="${cw}" height="${ch}" fill="#EEF2F7" stroke="${PRIMARY}" stroke-width="2"/>`;

  // Barras longitudinais (verticais, AZUL) + nomes B1..Bn em AZUL
  barX.forEach((x, i) => {
    inner += `<line x1="${x.toFixed(1)}" y1="${oy + 6}" x2="${x.toFixed(1)}" y2="${oy + ch - 6}" stroke="${BARRA_COLOR}" stroke-width="2.6" opacity="0.88"/>`;
    inner += `<text x="${x.toFixed(1)}" y="${oy - 7}" text-anchor="middle" font-size="17.5" font-weight="700" fill="${BARRA_COLOR}" font-family="Calibri, sans-serif">B${i + 1}</text>`;
  });

  // Estribos (horizontais, VERMELHO SÓBRIO) + nomes E1..En e cobrimentos em VERMELHO SÓBRIO
  estrY.forEach((y, i) => {
    const cobVal = fd.cob?.[i]?.trim() || '';
    inner += `<line x1="${ox + 10}" y1="${y.toFixed(1)}" x2="${ox + cw - 10}" y2="${y.toFixed(1)}" stroke="${ESTRIBO_COLOR}" stroke-width="3.2"/>`;
    inner += `<text x="${ox + cw + 7}" y="${(y + 6).toFixed(1)}" font-size="17.5" font-weight="700" fill="${ESTRIBO_COLOR}" font-family="Calibri, sans-serif">E${i + 1}</text>`;
    if (cobVal) {
      inner += `<text x="${ox + cw + 38}" y="${(y + 6).toFixed(1)}" font-size="17.5" font-weight="700" fill="${ESTRIBO_COLOR}" font-family="Calibri, sans-serif">${escSvg(cobVal.replace('.', ','))}mm</text>`;
    }
  });

  // Cotas de espaçamento entre estribos (esquerda, AMARELO/GOLD)
  for (let i = 0; i < estrY.length - 1; i++) {
    const y1 = estrY[i], y2 = estrY[i + 1];
    inner += `<line x1="${ox - 10}" y1="${y1.toFixed(1)}" x2="${ox - 10}" y2="${y2.toFixed(1)}" stroke="${GOLD}" stroke-width="1.5"/>`;
    inner += `<line x1="${ox - 15}" y1="${y1.toFixed(1)}" x2="${ox - 5}" y2="${y1.toFixed(1)}" stroke="${GOLD}" stroke-width="1.5"/>`;
    inner += `<line x1="${ox - 15}" y1="${y2.toFixed(1)}" x2="${ox - 5}" y2="${y2.toFixed(1)}" stroke="${GOLD}" stroke-width="1.5"/>`;
    const lbl = espVals[i] !== null ? `${fmtComma(espVals[i]!, Number.isInteger(espVals[i]!) ? 0 : 1)}cm` : '—';
    inner += `<text x="${ox - 18}" y="${((y1 + y2) / 2 + 6).toFixed(1)}" text-anchor="end" font-size="16.5" font-weight="700" fill="${GOLD}" font-family="Calibri, sans-serif">${escSvg(lbl)}</text>`;
  }

  // Linha de cota inferior: cobPerpEsq + espH + cobPerpDir (TODAS em AMARELO/GOLD)
  if (cobPerpEsq) {
    inner += `<line x1="${ox}" y1="${cotaBotY}" x2="${barX[0].toFixed(1)}" y2="${cotaBotY}" stroke="${GOLD}" stroke-width="1.5"/>`;
    inner += `<line x1="${ox}" y1="${cotaBotY - 5}" x2="${ox}" y2="${cotaBotY + 5}" stroke="${GOLD}" stroke-width="1.5"/>`;
    inner += `<line x1="${barX[0].toFixed(1)}" y1="${cotaBotY - 5}" x2="${barX[0].toFixed(1)}" y2="${cotaBotY + 5}" stroke="${GOLD}" stroke-width="1.5"/>`;
    inner += `<text x="${((ox + barX[0]) / 2).toFixed(1)}" y="${cotaBotY + 23}" text-anchor="middle" font-size="16.5" font-weight="700" fill="${GOLD}" font-family="Calibri, sans-serif">${escSvg(cobPerpEsq.replace('.', ','))}mm</text>`;
  }
  for (let i = 0; i < barX.length - 1; i++) {
    const x1 = barX[i], x2 = barX[i + 1];
    inner += `<line x1="${x1.toFixed(1)}" y1="${cotaBotY}" x2="${x2.toFixed(1)}" y2="${cotaBotY}" stroke="${GOLD}" stroke-width="1.5"/>`;
    inner += `<line x1="${x1.toFixed(1)}" y1="${cotaBotY - 5}" x2="${x1.toFixed(1)}" y2="${cotaBotY + 5}" stroke="${GOLD}" stroke-width="1.5"/>`;
    inner += `<line x1="${x2.toFixed(1)}" y1="${cotaBotY - 5}" x2="${x2.toFixed(1)}" y2="${cotaBotY + 5}" stroke="${GOLD}" stroke-width="1.5"/>`;
    const lbl = espHVals[i] !== null ? `${fmtComma(espHVals[i]!, Number.isInteger(espHVals[i]!) ? 0 : 1)}cm` : '—';
    inner += `<text x="${((x1 + x2) / 2).toFixed(1)}" y="${cotaBotY + 23}" text-anchor="middle" font-size="16.5" font-weight="700" fill="${GOLD}" font-family="Calibri, sans-serif">${escSvg(lbl)}</text>`;
  }
  if (cobPerpDir) {
    const xLast = barX[nb - 1];
    inner += `<line x1="${xLast.toFixed(1)}" y1="${cotaBotY}" x2="${ox + cw}" y2="${cotaBotY}" stroke="${GOLD}" stroke-width="1.5"/>`;
    inner += `<line x1="${xLast.toFixed(1)}" y1="${cotaBotY - 5}" x2="${xLast.toFixed(1)}" y2="${cotaBotY + 5}" stroke="${GOLD}" stroke-width="1.5"/>`;
    inner += `<line x1="${ox + cw}" y1="${cotaBotY - 5}" x2="${ox + cw}" y2="${cotaBotY + 5}" stroke="${GOLD}" stroke-width="1.5"/>`;
    inner += `<text x="${((xLast + ox + cw) / 2).toFixed(1)}" y="${cotaBotY + 23}" text-anchor="middle" font-size="16.5" font-weight="700" fill="${GOLD}" font-family="Calibri, sans-serif">${escSvg(cobPerpDir.replace('.', ','))}mm</text>`;
  }

  // Legenda de cores no rodapé do card
  inner += legendaCoresPerfilSvg(W, H - footerH);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.2"/>
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
  const faceAccent = FACE_COLORS[face] || NAVY;

  const headerH = 46;
  const footerH = 26;
  const ML = 82;
  const MR = 48;
  const MT = headerH + 42;
  const MB = 46 + footerH;

  const minStepX = 66;
  const minStepY = 44;
  const padX = 38;
  const padY = cobPerpSup || cobPerpInf ? 38 : 28;

  const rawGapX = espEstr.map(v => v ?? 15);
  const rawGapY = espLong.map(v => v ?? 10);

  const scX = Math.max(minStepX / Math.max(Math.min(...(rawGapX.length ? rawGapX : [15])), 1), 3.4);
  const gapXPx = rawGapX.map(v => Math.min(92, Math.max(minStepX, v * scX)));
  const cw = Math.max(210, gapXPx.reduce((a, b) => a + b, 0) + 2 * padX);

  const scY = Math.max(minStepY / Math.max(Math.min(...(rawGapY.length ? rawGapY : [10])), 1), 3.2);
  const gapYPx = rawGapY.map(v => Math.min(72, Math.max(minStepY, v * scY)));
  const ch = Math.max(108, gapYPx.reduce((a, b) => a + b, 0) + 2 * padY);

  const W = Math.max(380, ML + cw + MR);
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

  const cotaEsqX = ox - 14;
  const subtitulo = st ? `Méd: ${st.media} | Mín: ${st.min} | Máx: ${st.max} mm` : `${nb}B / ${ne}E`;

  let inner = '';
  // Cabeçalho do card
  inner += `<rect x="0" y="0" width="${W}" height="${headerH}" fill="#F2F4F8"/>`;
  inner += `<rect x="0" y="0" width="5" height="${headerH}" fill="${faceAccent}"/>`;
  inner += `<line x1="0" y1="${headerH}" x2="${W}" y2="${headerH}" stroke="#CBD5E1" stroke-width="1"/>`;
  inner += `<text x="14" y="20" font-size="18" font-weight="700" fill="${PRIMARY}" font-family="Calibri, sans-serif">${escSvg(faceNome)}</text>`;
  inner += `<text x="14" y="40" font-size="16" font-weight="600" fill="${SUBTEXT}" font-family="Calibri, sans-serif">${escSvg(subtitulo)}</text>`;

  // Contorno horizontal da viga
  inner += `<rect x="${ox}" y="${oy}" width="${cw}" height="${ch}" fill="#EEF2F7" stroke="${PRIMARY}" stroke-width="2"/>`;
  inner += `<line x1="${ox}" y1="${oy - 3}" x2="${ox}" y2="${oy + ch + 3}" stroke="${PRIMARY}" stroke-width="1.6" stroke-dasharray="3,2"/>`;
  inner += `<line x1="${ox + cw}" y1="${oy - 3}" x2="${ox + cw}" y2="${oy + ch + 3}" stroke="${PRIMARY}" stroke-width="1.6" stroke-dasharray="3,2"/>`;

  // Barras longitudinais (horizontais, AZUL) + nomes B1..Bn em AZUL
  barY.forEach((y, i) => {
    inner += `<line x1="${ox + 6}" y1="${y.toFixed(1)}" x2="${ox + cw - 6}" y2="${y.toFixed(1)}" stroke="${BARRA_COLOR}" stroke-width="2.6" opacity="0.88"/>`;
    inner += `<text x="${ox + cw + 7}" y="${(y + 6).toFixed(1)}" font-size="17.5" font-weight="700" fill="${BARRA_COLOR}" font-family="Calibri, sans-serif">B${i + 1}</text>`;
  });

  // Estribos (verticais, VERMELHO SÓBRIO) + nomes E1..En e cobrimentos em VERMELHO SÓBRIO
  estrX.forEach((x, i) => {
    const cobVal = fd.cob?.[i]?.trim() || '';
    inner += `<line x1="${x.toFixed(1)}" y1="${oy + 9}" x2="${x.toFixed(1)}" y2="${oy + ch - 9}" stroke="${ESTRIBO_COLOR}" stroke-width="3.2"/>`;
    inner += `<text x="${x.toFixed(1)}" y="${oy - 25}" text-anchor="middle" font-size="16.5" font-weight="700" fill="${ESTRIBO_COLOR}" font-family="Calibri, sans-serif">E${i + 1}</text>`;
    if (cobVal) {
      inner += `<text x="${x.toFixed(1)}" y="${oy - 7}" text-anchor="middle" font-size="16.5" font-weight="700" fill="${ESTRIBO_COLOR}" font-family="Calibri, sans-serif">${escSvg(cobVal.replace('.', ','))}mm</text>`;
    }
  });

  // Cotas de espaçamento entre estribos (embaixo, AMARELO/GOLD)
  for (let i = 0; i < estrX.length - 1; i++) {
    const x1 = estrX[i], x2 = estrX[i + 1];
    inner += `<line x1="${x1.toFixed(1)}" y1="${oy + ch + 14}" x2="${x2.toFixed(1)}" y2="${oy + ch + 14}" stroke="${GOLD}" stroke-width="1.5"/>`;
    inner += `<line x1="${x1.toFixed(1)}" y1="${oy + ch + 9}" x2="${x1.toFixed(1)}" y2="${oy + ch + 19}" stroke="${GOLD}" stroke-width="1.5"/>`;
    inner += `<line x1="${x2.toFixed(1)}" y1="${oy + ch + 9}" x2="${x2.toFixed(1)}" y2="${oy + ch + 19}" stroke="${GOLD}" stroke-width="1.5"/>`;
    const lbl = espEstr[i] !== null ? `${fmtComma(espEstr[i]!, Number.isInteger(espEstr[i]!) ? 0 : 1)}cm` : '—';
    inner += `<text x="${((x1 + x2) / 2).toFixed(1)}" y="${oy + ch + 38}" text-anchor="middle" font-size="16.5" font-weight="700" fill="${GOLD}" font-family="Calibri, sans-serif">${escSvg(lbl)}</text>`;
  }

  // Linha de cota esquerda: cobPerpSup + espLong + cobPerpInf (TODAS em AMARELO/GOLD)
  if (cobPerpSup) {
    inner += `<line x1="${cotaEsqX}" y1="${oy}" x2="${cotaEsqX}" y2="${barY[0].toFixed(1)}" stroke="${GOLD}" stroke-width="1.5"/>`;
    inner += `<line x1="${cotaEsqX - 5}" y1="${oy}" x2="${cotaEsqX + 5}" y2="${oy}" stroke="${GOLD}" stroke-width="1.5"/>`;
    inner += `<line x1="${cotaEsqX - 5}" y1="${barY[0].toFixed(1)}" x2="${cotaEsqX + 5}" y2="${barY[0].toFixed(1)}" stroke="${GOLD}" stroke-width="1.5"/>`;
    inner += `<text x="${cotaEsqX - 7}" y="${((oy + barY[0]) / 2 + 6).toFixed(1)}" text-anchor="end" font-size="16.5" font-weight="700" fill="${GOLD}" font-family="Calibri, sans-serif">${escSvg(cobPerpSup.replace('.', ','))}mm</text>`;
  }
  for (let i = 0; i < barY.length - 1; i++) {
    const y1 = barY[i], y2 = barY[i + 1];
    inner += `<line x1="${cotaEsqX}" y1="${y1.toFixed(1)}" x2="${cotaEsqX}" y2="${y2.toFixed(1)}" stroke="${GOLD}" stroke-width="1.5"/>`;
    inner += `<line x1="${cotaEsqX - 5}" y1="${y1.toFixed(1)}" x2="${cotaEsqX + 5}" y2="${y1.toFixed(1)}" stroke="${GOLD}" stroke-width="1.5"/>`;
    inner += `<line x1="${cotaEsqX - 5}" y1="${y2.toFixed(1)}" x2="${cotaEsqX + 5}" y2="${y2.toFixed(1)}" stroke="${GOLD}" stroke-width="1.5"/>`;
    const lbl = espLong[i] !== null ? `${fmtComma(espLong[i]!, Number.isInteger(espLong[i]!) ? 0 : 1)}cm` : '—';
    inner += `<text x="${cotaEsqX - 7}" y="${((y1 + y2) / 2 + 6).toFixed(1)}" text-anchor="end" font-size="16.5" font-weight="700" fill="${GOLD}" font-family="Calibri, sans-serif">${escSvg(lbl)}</text>`;
  }
  if (cobPerpInf) {
    const yLast = barY[nb - 1];
    inner += `<line x1="${cotaEsqX}" y1="${yLast.toFixed(1)}" x2="${cotaEsqX}" y2="${oy + ch}" stroke="${GOLD}" stroke-width="1.5"/>`;
    inner += `<line x1="${cotaEsqX - 5}" y1="${yLast.toFixed(1)}" x2="${cotaEsqX + 5}" y2="${yLast.toFixed(1)}" stroke="${GOLD}" stroke-width="1.5"/>`;
    inner += `<line x1="${cotaEsqX - 5}" y1="${oy + ch}" x2="${cotaEsqX + 5}" y2="${oy + ch}" stroke="${GOLD}" stroke-width="1.5"/>`;
    inner += `<text x="${cotaEsqX - 7}" y="${((yLast + oy + ch) / 2 + 6).toFixed(1)}" text-anchor="end" font-size="16.5" font-weight="700" fill="${GOLD}" font-family="Calibri, sans-serif">${escSvg(cobPerpInf.replace('.', ','))}mm</text>`;
  }

  // Legenda de cores no rodapé do card
  inner += legendaCoresPerfilSvg(W, H - footerH);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.2"/>
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
