// src/modules/pacometria/svgRelatorio.ts
//
// Gera SVGs técnicos puros (string SVG, sem React) para rasterização em PNG e inclusão
// no relatório DOCX de pacometria:
//   - Pilar (retangular A..D ou circular E)
//   - Viga (VA..VE)
//   - Área Livre / Laje (malha LA..LC)

import {
  AmostraRow,
  FACE_COLORS,
  FACE_LABELS,
  OpcaoPilar,
  OpcaoViga,
  getFacesDaOpcao,
  ordenarBarras,
} from './types';

function escSvg(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function mediaCobrimentosFace(cob: string[]): string | null {
  const nums = cob
    .map(v => parseFloat(v.replace(',', '.')))
    .filter(n => !isNaN(n) && n > 0);
  if (nums.length === 0) return null;
  const media = nums.reduce((a, b) => a + b, 0) / nums.length;
  return `${media.toFixed(1).replace('.', ',')} mm`;
}

function gerarSvgPilar(a: AmostraRow): string {
  const W = 440;
  const H = 220;
  const op = a.opcao as OpcaoPilar;
  const faces = getFacesDaOpcao('pilar', op);
  const hatch =
    `<defs><pattern id="hp" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
    `<line x1="0" y1="0" x2="0" y2="7" stroke="#94A3B8" stroke-width="1.4"/></pattern></defs>`;

  if (op === 'E') {
    const cx = 150, cy = 108, r = 64, rb = 49;
    const nb = Math.max(4, a.barras?.circ ?? 8);
    let barras = '';
    for (let i = 0; i < nb; i++) {
      const ang = (2 * Math.PI / nb) * i - Math.PI / 2;
      const bx = (cx + rb * Math.cos(ang)).toFixed(1);
      const by = (cy + rb * Math.sin(ang)).toFixed(1);
      barras += `<circle cx="${bx}" cy="${by}" r="4.2" fill="#0F243E"/>`;
    }
    const med = mediaCobrimentosFace(a.facesData?.circ?.cob ?? []);
    const info = [
      `Seção Circular — Ø ${a.D || 0} cm`,
      `Barras longitudinais: ${nb}`,
      `Estribos medidos: ${a.facesData?.circ?.nEstribos ?? 0}`,
      med ? `Cobrimento médio: ${med}` : 'Sem leituras de cobrimento',
    ];
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <rect width="${W}" height="${H}" fill="#FFFFFF"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#E8EDF5" stroke="#002060" stroke-width="2.2"/>
      <circle cx="${cx}" cy="${cy}" r="${rb}" fill="none" stroke="#2563EB" stroke-width="1.4" stroke-dasharray="4,3"/>
      ${barras}
      <line x1="${cx - r}" y1="${cy + r + 16}" x2="${cx + r}" y2="${cy + r + 16}" stroke="#0F243E" stroke-width="1"/>
      <text x="${cx}" y="${cy + r + 30}" text-anchor="middle" font-size="11" font-weight="700" fill="#0F243E" font-family="Calibri, sans-serif">Ø = ${a.D || 0} cm</text>
      ${info.map((t, idx) => `<text x="250" y="${74 + idx * 22}" font-size="11.5" font-weight="${idx === 0 ? '700' : '400'}" fill="#0F243E" font-family="Calibri, sans-serif">${escSvg(t)}</text>`).join('')}
    </svg>`;
  }

  const maxW = 140, maxH = 110;
  const rx = Math.max(10, a.X || 30);
  const ry = Math.max(10, a.Y || 30);
  const esc = Math.min(maxW / rx, maxH / ry);
  const ew = Math.max(64, Math.round(rx * esc));
  const eh = Math.max(54, Math.round(ry * esc));
  const ex = Math.round(150 - ew / 2);
  const ey = Math.round(108 - eh / 2);
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

  // Deduplica pontos próximos (cantos)
  const uniq: Array<[number, number]> = [];
  for (const p of pts) {
    if (!uniq.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 4)) uniq.push(p);
  }
  const barrasXml = uniq
    .map(([bx, by]) => `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="3.8" fill="#0F243E"/>`)
    .join('');

  // Destaque colorido nas arestas das faces ensaiadas
  let arestas = '';
  if (faces.includes('1X')) arestas += `<line x1="${ex}" y1="${ey + eh}" x2="${ex + ew}" y2="${ey + eh}" stroke="${FACE_COLORS['1X']}" stroke-width="3.2"/>`;
  if (faces.includes('2X')) arestas += `<line x1="${ex}" y1="${ey}" x2="${ex + ew}" y2="${ey}" stroke="${FACE_COLORS['2X']}" stroke-width="3.2"/>`;
  if (faces.includes('1Y')) arestas += `<line x1="${ex}" y1="${ey}" x2="${ex}" y2="${ey + eh}" stroke="${FACE_COLORS['1Y']}" stroke-width="3.2"/>`;
  if (faces.includes('2Y')) arestas += `<line x1="${ex + ew}" y1="${ey}" x2="${ex + ew}" y2="${ey + eh}" stroke="${FACE_COLORS['2Y']}" stroke-width="3.2"/>`;

  // Legenda à direita
  const legenda = faces.map((f, idx) => {
    const cor = FACE_COLORS[f] ?? '#002060';
    const nome = FACE_LABELS[f] ?? f;
    const med = mediaCobrimentosFace(a.facesData?.[f]?.cob ?? []);
    const y = 62 + idx * 28;
    return `<rect x="262" y="${y - 9}" width="10" height="10" rx="2" fill="${cor}"/>` +
      `<text x="278" y="${y}" font-size="11" font-weight="700" fill="#0F243E" font-family="Calibri, sans-serif">${escSvg(nome)}</text>` +
      `<text x="278" y="${y + 12}" font-size="10" fill="#475569" font-family="Calibri, sans-serif">${a.barras?.[f] ?? 0} barras · Cob. méd.: ${med ?? '—'}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#FFFFFF"/>
    ${hatch}
    ${obs}
    <rect x="${ex}" y="${ey}" width="${ew}" height="${eh}" fill="#E8EDF5" stroke="#0F243E" stroke-width="1.6"/>
    <rect x="${ex + cv}" y="${ey + cv}" width="${ew - 2 * cv}" height="${eh - 2 * cv}" fill="none" stroke="#64748B" stroke-width="1.1" stroke-dasharray="3,2"/>
    ${arestas}
    ${barrasXml}
    <text x="${ex + ew / 2}" y="${ey + eh + 20}" text-anchor="middle" font-size="11" font-weight="700" fill="#0F243E" font-family="Calibri, sans-serif">X = ${a.X || 0} cm</text>
    ${op !== 'B' ? `<text x="${ex - 16}" y="${ey + eh / 2 + 4}" text-anchor="end" font-size="11" font-weight="700" fill="#0F243E" font-family="Calibri, sans-serif">Y = ${a.Y || 0} cm</text>` : ''}
    <text x="262" y="40" font-size="11.5" font-weight="700" fill="#002060" font-family="Calibri, sans-serif">Faces Ensaiadas (Seção)</text>
    ${legenda}
  </svg>`;
}

function gerarSvgViga(a: AmostraRow): string {
  const W = 440;
  const H = 220;
  const op = a.opcao as OpcaoViga;
  const faces = getFacesDaOpcao('viga', op);
  const hatch =
    `<defs><pattern id="hv" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
    `<line x1="0" y1="0" x2="0" y2="7" stroke="#94A3B8" stroke-width="1.4"/></pattern></defs>`;

  const rb = Math.max(10, a.X || 20);
  const rh = Math.max(15, a.Y || 45);
  const esc = Math.min(110 / rb, 118 / rh);
  const ew = Math.max(52, Math.round(rb * esc));
  const eh = Math.max(66, Math.round(rh * esc));
  const ex = Math.round(145 - ew / 2);
  const ey = Math.round(112 - eh / 2);
  const cv = 10;

  let obs = '';
  if (op !== 'VE') {
    obs += `<rect x="${ex - 36}" y="${ey - 22}" width="${ew + 72}" height="22" fill="url(#hv)" stroke="#94A3B8" stroke-width="0.7"/>`;
  }
  if (op === 'VB' || op === 'VC' || op === 'VD') {
    obs += `<rect x="${ex + ew}" y="${ey}" width="24" height="${eh}" fill="url(#hv)" stroke="#94A3B8" stroke-width="0.7"/>`;
  }
  if (op === 'VD') {
    obs += `<rect x="${ex - 24}" y="${ey}" width="24" height="${eh}" fill="url(#hv)" stroke="#94A3B8" stroke-width="0.7"/>`;
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
    barrasXml += `<circle cx="${x.toFixed(1)}" cy="${ey + eh - cv}" r="3.6" fill="#0F243E"/>`;
  }
  for (let i = 0; i < nSup; i++) {
    const x = ex + cv + ((ew - 2 * cv) * i) / (nSup - 1);
    barrasXml += `<circle cx="${x.toFixed(1)}" cy="${ey + cv}" r="3.6" fill="#0F243E"/>`;
  }

  const legenda = faces.map((f, idx) => {
    const cor = FACE_COLORS[f] ?? '#002060';
    const nome = FACE_LABELS[f] ?? f;
    const med = mediaCobrimentosFace(a.facesData?.[f]?.cob ?? []);
    const y = 62 + idx * 28;
    return `<rect x="255" y="${y - 9}" width="10" height="10" rx="2" fill="${cor}"/>` +
      `<text x="271" y="${y}" font-size="11" font-weight="700" fill="#0F243E" font-family="Calibri, sans-serif">${escSvg(nome)}</text>` +
      `<text x="271" y="${y + 12}" font-size="10" fill="#475569" font-family="Calibri, sans-serif">${a.barras?.[f] ?? 0} barras · Cob. méd.: ${med ?? '—'}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#FFFFFF"/>
    ${hatch}
    ${obs}
    <rect x="${ex}" y="${ey}" width="${ew}" height="${eh}" fill="#E8EDF5" stroke="#0F243E" stroke-width="1.6"/>
    <rect x="${ex + cv}" y="${ey + cv}" width="${ew - 2 * cv}" height="${eh - 2 * cv}" fill="none" stroke="#64748B" stroke-width="1.1" stroke-dasharray="3,2"/>
    ${arestas}
    ${barrasXml}
    <text x="${ex + ew / 2}" y="${ey + eh + 24}" text-anchor="middle" font-size="11" font-weight="700" fill="#0F243E" font-family="Calibri, sans-serif">b = ${a.X || 0} cm</text>
    <text x="${ex - 16}" y="${ey + eh / 2 + 4}" text-anchor="end" font-size="11" font-weight="700" fill="#0F243E" font-family="Calibri, sans-serif">h = ${a.Y || 0} cm</text>
    <text x="255" y="40" font-size="11.5" font-weight="700" fill="#002060" font-family="Calibri, sans-serif">Faces Ensaiadas (Seção)</text>
    ${legenda}
  </svg>`;
}

function gerarSvgLaje(a: AmostraRow): string {
  const W = 440;
  const H = 230;
  const ld = a.lajeData;
  const lx = Math.max(10, ld?.larguraX ?? 100);
  const ly = Math.max(10, ld?.alturaY ?? 100);
  const ext = ld?.camadaExterna ?? ((ld?.barrasH?.length ?? 0) > 0 ? 'H' : 'V');
  const bh = ordenarBarras(ld?.barrasH ?? []);
  const bv = ordenarBarras(ld?.barrasV ?? []);

  const maxW = 190, maxH = 155;
  const esc = Math.min(maxW / lx, maxH / ly);
  const mw = Math.max(80, Math.round(lx * esc));
  const mh = Math.max(70, Math.round(ly * esc));
  const mx = 46;
  const my = Math.round((H - mh) / 2) - 4;

  // Grade de fundo
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
    linhasH += `<line x1="${mx}" y1="${py.toFixed(1)}" x2="${mx + mw}" y2="${py.toFixed(1)}" stroke="${FACE_COLORS.dirH}" stroke-width="${sw}"${dash}/>`;
    linhasH += `<text x="${mx - 5}" y="${(py + 3).toFixed(1)}" text-anchor="end" font-size="8.5" font-weight="700" fill="${FACE_COLORS.dirH}" font-family="Calibri, sans-serif">H${i + 1}</text>`;
  });

  let linhasV = '';
  bv.forEach((b, i) => {
    const px = mx + Math.min(1, Math.max(0, b.pos / lx)) * mw;
    const sw = ext === 'V' ? '2.4' : '1.4';
    const dash = ext === 'V' ? '' : ' stroke-dasharray="4,2"';
    linhasV += `<line x1="${px.toFixed(1)}" y1="${my}" x2="${px.toFixed(1)}" y2="${my + mh}" stroke="${FACE_COLORS.dirV}" stroke-width="${sw}"${dash}/>`;
    linhasV += `<text x="${px.toFixed(1)}" y="${my - 5}" text-anchor="middle" font-size="8.5" font-weight="700" fill="${FACE_COLORS.dirV}" font-family="Calibri, sans-serif">V${i + 1}</text>`;
  });

  const infoX = mx + mw + 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#FFFFFF"/>
    <rect x="${mx}" y="${my}" width="${mw}" height="${mh}" fill="#F8FAFC" stroke="#0F243E" stroke-width="1.6"/>
    ${grid}
    ${ext === 'H' ? linhasV + linhasH : linhasH + linhasV}
    <text x="${mx + mw / 2}" y="${my + mh + 18}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0F243E" font-family="Calibri, sans-serif">Largura X = ${lx} cm</text>
    <text x="${mx - 28}" y="${my + mh / 2}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0F243E" font-family="Calibri, sans-serif" transform="rotate(-90 ${mx - 28} ${my + mh / 2})">Altura Y = ${ly} cm</text>
    <text x="${infoX}" y="54" font-size="11.5" font-weight="700" fill="#002060" font-family="Calibri, sans-serif">Malha Ensaiada</text>
    <line x1="${infoX}" y1="74" x2="${infoX + 18}" y2="74" stroke="${FACE_COLORS.dirH}" stroke-width="${ext === 'H' ? '2.5' : '1.4'}"${ext === 'H' ? '' : ' stroke-dasharray="4,2"'}/>
    <text x="${infoX + 24}" y="78" font-size="10.5" fill="#0F243E" font-family="Calibri, sans-serif">Horizontais (H): ${bh.length}${ext === 'H' ? ' ★' : ''}</text>
    <line x1="${infoX}" y1="98" x2="${infoX + 18}" y2="98" stroke="${FACE_COLORS.dirV}" stroke-width="${ext === 'V' ? '2.5' : '1.4'}"${ext === 'V' ? '' : ' stroke-dasharray="4,2"'}/>
    <text x="${infoX + 24}" y="102" font-size="10.5" fill="#0F243E" font-family="Calibri, sans-serif">Verticais (V): ${bv.length}${ext === 'V' ? ' ★' : ''}</text>
    <text x="${infoX}" y="128" font-size="9.5" fill="#475569" font-family="Calibri, sans-serif">★ Camada mais externa</text>
    <text x="${infoX}" y="142" font-size="9.5" fill="#475569" font-family="Calibri, sans-serif">(define o cobrimento)</text>
  </svg>`;
}

/** Gera string SVG técnica do esquema do elemento (Pilar, Viga ou Laje/Área Livre). */
export function gerarSvgEsquemaPacometria(amostra: AmostraRow): string {
  if (amostra.tipo === 'viga') return gerarSvgViga(amostra);
  if (amostra.tipo === 'laje') return gerarSvgLaje(amostra);
  return gerarSvgPilar(amostra);
}
