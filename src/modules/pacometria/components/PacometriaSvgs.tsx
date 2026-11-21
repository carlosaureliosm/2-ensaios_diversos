'use client';
// src/modules/pacometria/components/PacometriaSvgs.tsx

import { useState, useRef } from 'react';
import {
  FACE_COLORS,
  FaceData,
  LajeData,
  OpcaoLaje,
  OpcaoPilar,
  OpcaoViga,
  ordenarBarras,
} from '../types';

const PRIMARY = '#1E3264';
const GOLD = '#B8890E';
const SUBTEXT = '#64748B';
const PERP_COLOR = '#0F766E';

// ── Cards da Etapa 1: Pilar ──────────────────────────────────────
export function svgOpcaoPilar(id: OpcaoPilar): string {
  const W = 80, H = 64;
  const ex = 14, ey = 8, ew = 52, eh = 38;
  const cv = 7;
  const br = 3;
  const hatch = `<defs><pattern id="hxp${id}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#999" stroke-width="1.2"/></pattern></defs>`;
  const hFill = `url(#hxp${id})`;
  const concrete = '#E8EAF0';
  const barFill = '#1A2340';

  function barras3x3() {
    const xs = [ex + cv, ex + ew / 2, ex + ew - cv];
    const yTop = ey + cv, yBot = ey + eh - cv;
    const yMid = ey + eh / 2;
    let b = '';
    xs.forEach(x => {
      b += `<circle cx="${x}" cy="${yTop}" r="${br}" fill="${barFill}"/>`;
      b += `<circle cx="${x}" cy="${yBot}" r="${br}" fill="${barFill}"/>`;
    });
    b += `<circle cx="${ex + cv}" cy="${yMid}" r="${br}" fill="${barFill}"/>`;
    b += `<circle cx="${ex + ew - cv}" cy="${yMid}" r="${br}" fill="${barFill}"/>`;
    return b;
  }

  const cotaX = `<line x1="${ex}" y1="${ey + eh + 5}" x2="${ex + ew}" y2="${ey + eh + 5}" stroke="#1A2340" stroke-width="0.8" marker-start="url(#arrp${id})" marker-end="url(#arrp${id})"/>
    <text x="${ex + ew / 2}" y="${ey + eh + 14}" text-anchor="middle" font-size="7" fill="#1A2340" font-family="sans-serif">X</text>`;
  const cotaY = `<line x1="${ex - 5}" y1="${ey}" x2="${ex - 5}" y2="${ey + eh}" stroke="#1A2340" stroke-width="0.8" marker-start="url(#arrp${id})" marker-end="url(#arrp${id})"/>
    <text x="${ex - 12}" y="${ey + eh / 2 + 3}" text-anchor="middle" font-size="7" fill="#1A2340" font-family="sans-serif">Y</text>`;
  const arrows = `<defs><marker id="arrp${id}" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto"><path d="M0,0 L0,4 L4,2 z" fill="#1A2340"/></marker></defs>`;

  if (id === 'A') {
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${hatch}${arrows}
      <rect x="${ex}" y="${ey}" width="${ew}" height="${eh}" fill="${concrete}" stroke="#1A2340" stroke-width="1.5"/>
      ${barras3x3()}
      ${cotaX}${cotaY}
    </svg>`;
  }
  if (id === 'B') {
    const hTop = `<rect x="${ex}" y="0" width="${ew}" height="${ey}" fill="${hFill}"/>`;
    const hLeft = `<rect x="0" y="${ey}" width="${ex}" height="${eh}" fill="${hFill}"/>`;
    const hRight = `<rect x="${ex + ew}" y="${ey}" width="${W - ex - ew}" height="${eh}" fill="${hFill}"/>`;
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${hatch}${arrows}
      ${hTop}${hLeft}${hRight}
      <rect x="${ex}" y="${ey}" width="${ew}" height="${eh}" fill="${concrete}" stroke="#1A2340" stroke-width="1.5"/>
      ${barras3x3()}
      ${cotaX}
    </svg>`;
  }
  if (id === 'C') {
    const hTop = `<rect x="${ex}" y="0" width="${ew}" height="${ey}" fill="${hFill}"/>`;
    const hRight = `<rect x="${ex + ew}" y="${ey}" width="${W - ex - ew}" height="${eh}" fill="${hFill}"/>`;
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${hatch}${arrows}
      ${hTop}${hRight}
      <rect x="${ex}" y="${ey}" width="${ew}" height="${eh}" fill="${concrete}" stroke="#1A2340" stroke-width="1.5"/>
      ${barras3x3()}
      ${cotaX}${cotaY}
    </svg>`;
  }
  if (id === 'D') {
    const hTop = `<rect x="${ex}" y="0" width="${ew}" height="${ey}" fill="${hFill}"/>`;
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${hatch}${arrows}
      ${hTop}
      <rect x="${ex}" y="${ey}" width="${ew}" height="${eh}" fill="${concrete}" stroke="#1A2340" stroke-width="1.5"/>
      ${barras3x3()}
      ${cotaX}${cotaY}
    </svg>`;
  }

  const cx = W / 2, cy = H / 2 - 4, r = 22, rb = r - 6;
  const nb = 8;
  let bcirc = '';
  for (let i = 0; i < nb; i++) {
    const ang = (2 * Math.PI / nb) * i - Math.PI / 2;
    bcirc += `<circle cx="${(cx + rb * Math.cos(ang)).toFixed(1)}" cy="${(cy + rb * Math.sin(ang)).toFixed(1)}" r="${br}" fill="${barFill}"/>`;
  }
  const x1 = (cx - r * 0.6).toFixed(1), y1 = (cy + r * 0.6).toFixed(1);
  const x2 = (cx + r * 0.6).toFixed(1), y2 = (cy - r * 0.6).toFixed(1);
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs><marker id="arrp${id}" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto"><path d="M0,0 L0,4 L4,2 z" fill="#1A2340"/></marker></defs>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${concrete}" stroke="#1A2340" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="${rb}" fill="none" stroke="#1A2340" stroke-width="0.8" stroke-dasharray="2,2"/>
    ${bcirc}
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1A2340" stroke-width="0.8" marker-end="url(#arrp${id})"/>
    <line x1="${(cx - r).toFixed(1)}" y1="${(cy + r + 5).toFixed(1)}" x2="${(cx + r).toFixed(1)}" y2="${(cy + r + 5).toFixed(1)}" stroke="#1A2340" stroke-width="0.8" marker-start="url(#arrp${id})" marker-end="url(#arrp${id})"/>
    <text x="${cx}" y="${(cy + r + 14).toFixed(1)}" text-anchor="middle" font-size="7" fill="#1A2340" font-family="sans-serif">D</text>
  </svg>`;
}

// ── Cards da Etapa 1: Viga ───────────────────────────────────────
export function svgOpcaoViga(id: OpcaoViga): string {
  const W = 80, H = 64;
  const ex = 26, ey = 10, ew = 28, eh = 38;
  const cv = 5.5;
  const br = 2.6;
  const hatch = `<defs><pattern id="hxv${id}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#999" stroke-width="1.2"/></pattern></defs>`;
  const hFill = `url(#hxv${id})`;
  const concrete = '#E8EAF0';
  const barFill = '#1A2340';

  const barrasViga = `
    <circle cx="${ex + cv}" cy="${ey + cv}" r="${br}" fill="${barFill}"/>
    <circle cx="${ex + ew - cv}" cy="${ey + cv}" r="${br}" fill="${barFill}"/>
    <circle cx="${ex + cv}" cy="${ey + eh - cv}" r="${br}" fill="${barFill}"/>
    <circle cx="${ex + ew / 2}" cy="${ey + eh - cv}" r="${br}" fill="${barFill}"/>
    <circle cx="${ex + ew - cv}" cy="${ey + eh - cv}" r="${br}" fill="${barFill}"/>
  `;
  const estribo = `<rect x="${ex + cv - 1}" y="${ey + cv - 1}" width="${ew - 2 * cv + 2}" height="${eh - 2 * cv + 2}" fill="none" stroke="#2563EB" stroke-width="0.8" stroke-dasharray="2,1.5"/>`;

  const cotaB = `<line x1="${ex}" y1="${ey + eh + 5}" x2="${ex + ew}" y2="${ey + eh + 5}" stroke="#1A2340" stroke-width="0.8"/>
    <text x="${ex + ew / 2}" y="${ey + eh + 13}" text-anchor="middle" font-size="7" fill="#1A2340" font-family="sans-serif">b</text>`;
  const cotaH = `<line x1="${ex - 5}" y1="${ey}" x2="${ex - 5}" y2="${ey + eh}" stroke="#1A2340" stroke-width="0.8"/>
    <text x="${ex - 11}" y="${ey + eh / 2 + 2.5}" text-anchor="middle" font-size="7" fill="#1A2340" font-family="sans-serif">h</text>`;

  const lajeTopo = `<rect x="4" y="0" width="${W - 8}" height="${ey}" fill="${hFill}" stroke="#94A3B8" stroke-width="0.6"/>`;
  const paredeDir = `<rect x="${ex + ew}" y="${ey}" width="${W - ex - ew - 4}" height="${eh}" fill="${hFill}"/>`;
  const paredeEsq = `<rect x="4" y="${ey}" width="${ex - 4}" height="${eh}" fill="${hFill}"/>`;
  const obsFundo = `<rect x="${ex}" y="${ey + eh}" width="${ew}" height="9" fill="${hFill}"/>`;

  let obs = '';
  if (id === 'VA') obs = lajeTopo;
  if (id === 'VB') obs = lajeTopo + paredeDir;
  if (id === 'VC') obs = lajeTopo + paredeDir + obsFundo;
  if (id === 'VD') obs = lajeTopo + paredeEsq + paredeDir;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${hatch}
    ${obs}
    <rect x="${ex}" y="${ey}" width="${ew}" height="${eh}" fill="${concrete}" stroke="#1A2340" stroke-width="1.5"/>
    ${estribo}
    ${barrasViga}
    ${id !== 'VC' ? cotaB : ''}
    ${id !== 'VD' ? cotaH : ''}
  </svg>`;
}

// ── Cards da Etapa 1: Área Livre / Laje ──────────────────────────
export function svgOpcaoLaje(id: OpcaoLaje): string {
  const W = 80, H = 64;
  const x0 = 16, y0 = 8, sz = 44;
  const grid = Array.from({ length: 5 }, (_, i) => {
    const p = (sz / 4) * i;
    return `<line x1="${x0 + p}" y1="${y0}" x2="${x0 + p}" y2="${y0 + sz}" stroke="#CBD5E1" stroke-width="0.6"/>
            <line x1="${x0}" y1="${y0 + p}" x2="${x0 + sz}" y2="${y0 + p}" stroke="#CBD5E1" stroke-width="0.6"/>`;
  }).join('');

  const barsH = [11, 22, 33].map(d =>
    `<line x1="${x0 + 2}" y1="${y0 + d}" x2="${x0 + sz - 2}" y2="${y0 + d}" stroke="#2563EB" stroke-width="1.8"/>`,
  ).join('');
  const barsV = [11, 22, 33].map(d =>
    `<line x1="${x0 + d}" y1="${y0 + 2}" x2="${x0 + d}" y2="${y0 + sz - 2}" stroke="#DC2626" stroke-width="1.8"/>`,
  ).join('');

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect x="${x0}" y="${y0}" width="${sz}" height="${sz}" fill="#EEF2F7" stroke="#1A2340" stroke-width="1.5"/>
    ${grid}
    ${id === 'LA' || id === 'LB' ? barsH : ''}
    ${id === 'LA' || id === 'LC' ? barsV : ''}
    <text x="${x0 + sz / 2}" y="${y0 + sz + 10}" text-anchor="middle" font-size="7" fill="#1A2340" font-family="sans-serif">Lx × Ly</text>
  </svg>`;
}

// ── Etapa 2: Seção Transversal Pilar ─────────────────────────────
export function SvgSecaoPilar({
  X, Y, C1, C2, faces, barras,
}: {
  X: number; Y: number; C1: number; C2: number; faces: string[]; barras: Record<string, number>;
}) {
  const W = 320, H = 240, MX = 74, MY = 52;
  const sc = Math.min((W - 2 * MX) / Math.max(X, 1), (H - 2 * MY) / Math.max(Y, 1));
  const cw = X * sc, ch = Y * sc;
  const ox = (W - cw) / 2, oy = (H - ch) / 2 - 4;
  const c1 = Math.min(C1 * sc, cw * 0.2);
  const c2 = Math.min(C2 * sc, ch * 0.2);
  const BAR = Math.max(2.6, Math.min(5, sc * 0.65));
  const cv = Math.min(cw, ch) * 0.12;

  function barsInFace(face: string) {
    const n = barras[face] || 2;
    const pts: { x: number; y: number }[] = [];
    if (face === '1X' || face === '2X') {
      const y = face === '1X' ? oy + ch - c2 : oy + c2;
      const avail = cw - 2 * c1;
      for (let i = 0; i < n; i++) pts.push({ x: ox + c1 + (n === 1 ? avail / 2 : (avail / (n - 1)) * i), y });
    } else {
      const x = face === '1Y' ? ox + c1 : ox + cw - c1;
      const avail = ch - 2 * c2;
      for (let i = 1; i < n - 1; i++) pts.push({ x, y: oy + c2 + (avail / (n - 1)) * i });
    }
    return pts;
  }

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ fontFamily: 'monospace', display: 'block' }}>
      <rect x={ox} y={oy} width={cw} height={ch} fill="#EEF2F7" stroke={PRIMARY} strokeWidth={2} />
      <rect x={ox + cv} y={oy + cv} width={cw - 2 * cv} height={ch - 2 * cv} fill="none" stroke="#2563EB" strokeWidth={1} strokeDasharray="3,2" />
      {(['1X', '2X', '1Y', '2Y'] as string[]).map(f =>
        faces.includes(f) ? barsInFace(f).map((p, i) => (
          <g key={`${f}-${i}`}>
            <circle cx={p.x} cy={p.y} r={BAR + 1.8} fill="white" stroke={FACE_COLORS[f]} strokeWidth={1.5} />
            <circle cx={p.x} cy={p.y} r={BAR * 0.55} fill={FACE_COLORS[f]} />
          </g>
        )) : null,
      )}
      {/* Cota X (inferior) */}
      <line x1={ox} y1={oy + ch + 14} x2={ox + cw} y2={oy + ch + 14} stroke={GOLD} strokeWidth={1} />
      <line x1={ox} y1={oy + ch + 10} x2={ox} y2={oy + ch + 18} stroke={GOLD} strokeWidth={1} />
      <line x1={ox + cw} y1={oy + ch + 10} x2={ox + cw} y2={oy + ch + 18} stroke={GOLD} strokeWidth={1} />
      <text x={ox + cw / 2} y={oy + ch + 26} textAnchor="middle" fontSize={9.5} fill={GOLD} fontWeight="700">X = {X} cm</text>

      {/* Cota Y (esquerda) */}
      <line x1={ox - 14} y1={oy} x2={ox - 14} y2={oy + ch} stroke={GOLD} strokeWidth={1} />
      <line x1={ox - 18} y1={oy} x2={ox - 10} y2={oy} stroke={GOLD} strokeWidth={1} />
      <line x1={ox - 18} y1={oy + ch} x2={ox - 10} y2={oy + ch} stroke={GOLD} strokeWidth={1} />
      <text x={ox - 24} y={oy + ch / 2} textAnchor="middle" fontSize={9.5} fill={GOLD} fontWeight="700" transform={`rotate(-90,${ox - 24},${oy + ch / 2})`}>Y = {Y} cm</text>

      {/* Labels das faces bem afastados das cotas */}
      <text x={ox + cw / 2} y={oy - 14} textAnchor="middle" fontSize={9.5} fill={FACE_COLORS['2X']} fontWeight="700">
        2X{!faces.includes('2X') ? ' ✕' : ''}
      </text>
      <text x={ox + cw / 2} y={oy + ch + 42} textAnchor="middle" fontSize={9.5} fill={FACE_COLORS['1X']} fontWeight="700">
        1X{!faces.includes('1X') ? ' ✕' : ''}
      </text>
      <text x={ox - 46} y={oy + ch / 2} textAnchor="middle" fontSize={9.5} fill={FACE_COLORS['1Y']} fontWeight="700" transform={`rotate(-90,${ox - 46},${oy + ch / 2})`}>
        1Y{!faces.includes('1Y') ? ' ✕' : ''}
      </text>
      <text x={ox + cw + 22} y={oy + ch / 2} textAnchor="middle" fontSize={9.5} fill={FACE_COLORS['2Y']} fontWeight="700" transform={`rotate(90,${ox + cw + 22},${oy + ch / 2})`}>
        2Y{!faces.includes('2Y') ? ' ✕' : ''}
      </text>
    </svg>
  );
}

// ── Etapa 2: Seção Transversal Viga ──────────────────────────────
export function SvgSecaoViga({
  b, h, C1, C2, faces, barras,
}: {
  b: number; h: number; C1: number; C2: number; faces: string[]; barras: Record<string, number>;
}) {
  const W = 320, H = 248, MX = 76, MY = 54;
  const sc = Math.min((W - 2 * MX) / Math.max(b, 1), (H - 2 * MY) / Math.max(h, 1));
  const cw = b * sc, ch = h * sc;
  const ox = (W - cw) / 2, oy = (H - ch) / 2;
  const c1 = Math.min(C1 * sc, cw * 0.22);
  const c2 = Math.min(C2 * sc, ch * 0.22);
  const BAR = Math.max(2.6, Math.min(5, sc * 0.65));
  const cv = Math.min(cw, ch) * 0.14;

  function barsInFace(face: string) {
    const n = barras[face] || 2;
    const pts: { x: number; y: number }[] = [];
    if (face === 'fundo' || face === 'topo') {
      const y = face === 'fundo' ? oy + ch - c2 : oy + c2;
      const avail = cw - 2 * c1;
      for (let i = 0; i < n; i++) pts.push({ x: ox + c1 + (n === 1 ? avail / 2 : (avail / (n - 1)) * i), y });
    } else {
      const x = face === 'lat1' ? ox + c1 : ox + cw - c1;
      const avail = ch - 2 * c2;
      for (let i = 0; i < n; i++) pts.push({ x, y: oy + c2 + (n === 1 ? avail / 2 : (avail / (n - 1)) * i) });
    }
    return pts;
  }

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ fontFamily: 'monospace', display: 'block' }}>
      <defs>
        <pattern id="vigaHatchPreview" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#94A3B8" strokeWidth="1.2" />
        </pattern>
      </defs>
      {!faces.includes('topo') && (
        <rect x={Math.max(16, ox - 36)} y={oy - 14} width={Math.min(W - 32, cw + 72)} height={14} fill="url(#vigaHatchPreview)" stroke="#CBD5E1" strokeWidth={0.8} />
      )}
      <rect x={ox} y={oy} width={cw} height={ch} fill="#EEF2F7" stroke={PRIMARY} strokeWidth={2} />
      <rect x={ox + cv} y={oy + cv} width={cw - 2 * cv} height={ch - 2 * cv} fill="none" stroke="#2563EB" strokeWidth={1} strokeDasharray="3,2" />
      {(['fundo', 'topo', 'lat1', 'lat2'] as string[]).map(f =>
        faces.includes(f) ? barsInFace(f).map((p, i) => (
          <g key={`${f}-${i}`}>
            <circle cx={p.x} cy={p.y} r={BAR + 1.8} fill="white" stroke={FACE_COLORS[f]} strokeWidth={1.5} />
            <circle cx={p.x} cy={p.y} r={BAR * 0.55} fill={FACE_COLORS[f]} />
          </g>
        )) : null,
      )}
      {/* Cota b (inferior) */}
      <line x1={ox} y1={oy + ch + 14} x2={ox + cw} y2={oy + ch + 14} stroke={GOLD} strokeWidth={1} />
      <line x1={ox} y1={oy + ch + 10} x2={ox} y2={oy + ch + 18} stroke={GOLD} strokeWidth={1} />
      <line x1={ox + cw} y1={oy + ch + 10} x2={ox + cw} y2={oy + ch + 18} stroke={GOLD} strokeWidth={1} />
      <text x={ox + cw / 2} y={oy + ch + 26} textAnchor="middle" fontSize={9.5} fill={GOLD} fontWeight="700">b = {b} cm</text>

      {/* Cota h (esquerda) */}
      <line x1={ox - 14} y1={oy} x2={ox - 14} y2={oy + ch} stroke={GOLD} strokeWidth={1} />
      <line x1={ox - 18} y1={oy} x2={ox - 10} y2={oy} stroke={GOLD} strokeWidth={1} />
      <line x1={ox - 18} y1={oy + ch} x2={ox - 10} y2={oy + ch} stroke={GOLD} strokeWidth={1} />
      <text x={ox - 24} y={oy + ch / 2} textAnchor="middle" fontSize={9.5} fill={GOLD} fontWeight="700" transform={`rotate(-90,${ox - 24},${oy + ch / 2})`}>h = {h} cm</text>

      {/* Labels das faces com folga garantida */}
      <text x={ox + cw / 2} y={oy - 22} textAnchor="middle" fontSize={9.5} fill={FACE_COLORS['topo']} fontWeight="700">
        Topo{!faces.includes('topo') ? ' (laje)' : ''}
      </text>
      <text x={ox + cw / 2} y={oy + ch + 42} textAnchor="middle" fontSize={9.5} fill={FACE_COLORS['fundo']} fontWeight="700">
        Fundo{!faces.includes('fundo') ? ' ✕' : ''}
      </text>
      <text x={ox - 48} y={oy + ch / 2} textAnchor="middle" fontSize={9.5} fill={FACE_COLORS['lat1']} fontWeight="700" transform={`rotate(-90,${ox - 48},${oy + ch / 2})`}>
        Lat. 1{!faces.includes('lat1') ? ' ✕' : ''}
      </text>
      <text x={ox + cw + 24} y={oy + ch / 2} textAnchor="middle" fontSize={9.5} fill={FACE_COLORS['lat2']} fontWeight="700" transform={`rotate(90,${ox + cw + 24},${oy + ch / 2})`}>
        Lat. 2{!faces.includes('lat2') ? ' ✕' : ''}
      </text>
    </svg>
  );
}

// ── Etapa 3: Perfil Vertical (Pilar) — Dimensionamento Dinâmico ──
export function SvgPerfilVertical({
  face, nBarras, fd,
}: {
  face: string; nBarras: number; fd: FaceData; C1?: number;
}) {
  const ne = Math.max(1, fd.nEstribos);
  const nb = Math.max(1, nBarras);
  const espVals = Array.from({ length: Math.max(0, ne - 1) }, (_, i) => {
    const raw = fd.espV[i]?.replace(',', '.');
    const n = raw ? parseFloat(raw) : NaN;
    return !isNaN(n) && n > 0 ? n : null;
  });
  const espHVals = Array.from({ length: Math.max(0, nb - 1) }, (_, i) => {
    const raw = fd.espH[i]?.replace(',', '.');
    const n = raw ? parseFloat(raw) : NaN;
    return !isNaN(n) && n > 0 ? n : null;
  });

  // Margens dedicadas: nunca colidem
  const ML = 64; // cotas de espaçamento de estribos (esquerda)
  const MR = 76; // labels E1..En + cobrimento (direita)
  const MT = 42; // labels B1..Bm + cobrimento perpendicular (topo)
  const MB = 38; // cotas de espaçamento longitudinal (embaixo)

  // Dimensões dinâmicas garantem legibilidade mesmo com 15+ estribos ou 10+ barras
  const minStepY = 38;
  const minStepX = 48;
  const padX = 24;
  const padY = 26;

  const rawGapY = espVals.map(v => v ?? 15);
  const rawGapX = espHVals.map(v => v ?? 12);

  // Escala Y: garante que o menor vão tenha pelo menos minStepY px
  const minRawY = rawGapY.length > 0 ? Math.min(...rawGapY) : 15;
  const scY = Math.max(minStepY / Math.max(minRawY, 1), 2.4);
  const gapYPx = rawGapY.map(v => Math.min(72, Math.max(minStepY, v * scY)));
  const totalEstriboH = gapYPx.reduce((a, b) => a + b, 0);
  const ch = Math.max(110, totalEstriboH + 2 * padY);

  // Escala X: garante que o menor vão entre barras tenha pelo menos minStepX px
  const minRawX = rawGapX.length > 0 ? Math.min(...rawGapX) : 12;
  const scX = Math.max(minStepX / Math.max(minRawX, 1), 3.2);
  const gapXPx = rawGapX.map(v => Math.min(82, Math.max(minStepX, v * scX)));
  const totalBarraW = gapXPx.reduce((a, b) => a + b, 0);
  const cw = Math.max(96, totalBarraW + 2 * padX);

  const W = ML + cw + MR;
  const H = MT + ch + MB;
  const ox = ML;
  const oy = MT;
  const col = FACE_COLORS[face] || '#2563EB';

  const barX: number[] = [];
  if (nb === 1) {
    barX.push(ox + cw / 2);
  } else {
    barX.push(ox + padX);
    for (let i = 0; i < nb - 1; i++) barX.push(barX[barX.length - 1] + gapXPx[i]);
  }

  const estrY: number[] = [];
  if (ne === 1) {
    estrY.push(oy + ch / 2);
  } else {
    estrY.push(oy + padY);
    for (let i = 0; i < ne - 1; i++) estrY.push(estrY[estrY.length - 1] + gapYPx[i]);
  }

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ fontFamily: 'monospace', display: 'block' }}>
      {/* Contorno do pilar */}
      <rect x={ox} y={oy} width={cw} height={ch} fill="#EEF2F7" stroke={PRIMARY} strokeWidth={2} />

      {/* Barras longitudinais (verticais) + labels B1..Bm e cobrimento perpendicular no topo */}
      {barX.map((x, i) => {
        const cobLong = fd.cobLong?.[i]?.trim();
        const cobPerp = fd.cobPerp?.[i]?.trim();
        return (
          <g key={`b-${i}`}>
            <line x1={x} y1={oy + 6} x2={x} y2={oy + ch - 6} stroke={col} strokeWidth={2.2} />
            <text x={x} y={oy - 22} textAnchor="middle" fontSize={9} fill={PRIMARY} fontWeight="700">B{i + 1}</text>
            {cobLong ? (
              <text x={x} y={oy - 12} textAnchor="middle" fontSize={8} fill={col} fontWeight="700">{cobLong}mm</text>
            ) : null}
            {cobPerp ? (
              <text x={x} y={oy - 3} textAnchor="middle" fontSize={8} fill={PERP_COLOR} fontWeight="700">⊥{cobPerp}mm</text>
            ) : null}
          </g>
        );
      })}

      {/* Estribos (horizontais) + labels E1..En e cobrimento à direita */}
      {estrY.map((y, i) => (
        <g key={`e-${i}`}>
          <line x1={ox + 10} y1={y} x2={ox + cw - 10} y2={y} stroke={col} strokeWidth={2.2} />
          <text x={ox + cw + 8} y={y + 3} fontSize={9} fill={SUBTEXT} fontWeight="700">
            E{i + 1}
          </text>
          {fd.cob[i]?.trim() ? (
            <text x={ox + cw + 28} y={y + 3} fontSize={9} fill={col} fontWeight="700">
              {fd.cob[i].trim()}mm
            </text>
          ) : null}
        </g>
      ))}

      {/* Cotas de espaçamento entre estribos (esquerda) */}
      {estrY.map((y, i) => i < estrY.length - 1 ? (
        <g key={`ev-${i}`}>
          <line x1={ox - 12} y1={y} x2={ox - 12} y2={estrY[i + 1]} stroke={GOLD} strokeWidth={1.1} />
          <line x1={ox - 16} y1={y} x2={ox - 8} y2={y} stroke={GOLD} strokeWidth={1.1} />
          <line x1={ox - 16} y1={estrY[i + 1]} x2={ox - 8} y2={estrY[i + 1]} stroke={GOLD} strokeWidth={1.1} />
          <text x={ox - 18} y={(y + estrY[i + 1]) / 2 + 3} textAnchor="end" fontSize={9} fill={GOLD} fontWeight="700">
            {espVals[i] !== null ? `${espVals[i]}cm` : '—'}
          </text>
        </g>
      ) : null)}

      {/* Cotas de espaçamento entre barras longitudinais (embaixo) */}
      {barX.map((x, i) => i < barX.length - 1 ? (
        <g key={`eh-${i}`}>
          <line x1={x} y1={oy + ch + 13} x2={barX[i + 1]} y2={oy + ch + 13} stroke={GOLD} strokeWidth={1.1} />
          <line x1={x} y1={oy + ch + 9} x2={x} y2={oy + ch + 17} stroke={GOLD} strokeWidth={1.1} />
          <line x1={barX[i + 1]} y1={oy + ch + 9} x2={barX[i + 1]} y2={oy + ch + 17} stroke={GOLD} strokeWidth={1.1} />
          <text x={(x + barX[i + 1]) / 2} y={oy + ch + 28} textAnchor="middle" fontSize={9} fill={GOLD} fontWeight="700">
            {espHVals[i] !== null ? `${espHVals[i]}cm` : '—'}
          </text>
        </g>
      ) : null)}
    </svg>
  );
}

// ── Etapa 3: Perfil Horizontal (Viga) — Dimensionamento Dinâmico ─
export function SvgPerfilHorizontal({
  face, nBarras, fd,
}: {
  face: string; nBarras: number; fd: FaceData; C1?: number;
}) {
  const ne = Math.max(1, fd.nEstribos);
  const nb = Math.max(1, nBarras);

  const espEstr = Array.from({ length: Math.max(0, ne - 1) }, (_, i) => {
    const raw = fd.espV[i]?.replace(',', '.');
    const n = raw ? parseFloat(raw) : NaN;
    return !isNaN(n) && n > 0 ? n : null;
  });
  const espLong = Array.from({ length: Math.max(0, nb - 1) }, (_, i) => {
    const raw = fd.espH[i]?.replace(',', '.');
    const n = raw ? parseFloat(raw) : NaN;
    return !isNaN(n) && n > 0 ? n : null;
  });

  // Margens dedicadas: zero colisão
  const ML = 64; // cotas de espaçamento longitudinal (esquerda)
  const MR = 92; // labels B1..Bm + cobrimento face / perpendicular (direita)
  const MT = 40; // labels E1..En + cobrimento (topo)
  const MB = 38; // cotas de espaçamento entre estribos (embaixo)

  const minStepX = 56;
  const minStepY = 38;
  const padX = 32;
  const padY = 24;

  const rawGapX = espEstr.map(v => v ?? 15);
  const rawGapY = espLong.map(v => v ?? 10);

  const minRawX = rawGapX.length > 0 ? Math.min(...rawGapX) : 15;
  const scX = Math.max(minStepX / Math.max(minRawX, 1), 3.4);
  const gapXPx = rawGapX.map(v => Math.min(92, Math.max(minStepX, v * scX)));
  const totalEstriboW = gapXPx.reduce((a, b) => a + b, 0);
  const cw = Math.max(180, totalEstriboW + 2 * padX);

  const minRawY = rawGapY.length > 0 ? Math.min(...rawGapY) : 10;
  const scY = Math.max(minStepY / Math.max(minRawY, 1), 3.2);
  const gapYPx = rawGapY.map(v => Math.min(68, Math.max(minStepY, v * scY)));
  const totalBarraH = gapYPx.reduce((a, b) => a + b, 0);
  const ch = Math.max(88, totalBarraH + 2 * padY);

  const W = ML + cw + MR;
  const H = MT + ch + MB;
  const ox = ML;
  const oy = MT;
  const col = FACE_COLORS[face] || '#2563EB';

  const barY: number[] = [];
  if (nb === 1) {
    barY.push(oy + ch / 2);
  } else {
    barY.push(oy + padY);
    for (let i = 0; i < nb - 1; i++) barY.push(barY[barY.length - 1] + gapYPx[i]);
  }

  const estrX: number[] = [];
  if (ne === 1) {
    estrX.push(ox + cw / 2);
  } else {
    estrX.push(ox + padX);
    for (let i = 0; i < ne - 1; i++) estrX.push(estrX[estrX.length - 1] + gapXPx[i]);
  }

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ fontFamily: 'monospace', display: 'block' }}>
      {/* Contorno horizontal da viga */}
      <rect x={ox} y={oy} width={cw} height={ch} fill="#EEF2F7" stroke={PRIMARY} strokeWidth={2} />
      <line x1={ox} y1={oy - 3} x2={ox} y2={oy + ch + 3} stroke={PRIMARY} strokeWidth={1.5} strokeDasharray="3,2" />
      <line x1={ox + cw} y1={oy - 3} x2={ox + cw} y2={oy + ch + 3} stroke={PRIMARY} strokeWidth={1.5} strokeDasharray="3,2" />

      {/* Barras longitudinais (HORIZONTAIS) + labels B1..Bm e cobrimento face / perpendicular à direita */}
      {barY.map((y, i) => {
        const cobLong = fd.cobLong?.[i]?.trim();
        const cobPerp = fd.cobPerp?.[i]?.trim();
        return (
          <g key={`b-${i}`}>
            <line x1={ox + 6} y1={y} x2={ox + cw - 6} y2={y} stroke={col} strokeWidth={2.2} />
            <text x={ox + cw + 8} y={y + (cobPerp ? -2 : 3)} fontSize={9} fill={PRIMARY} fontWeight="700">
              B{i + 1}{cobLong ? ` ${cobLong}mm` : ''}
            </text>
            {cobPerp ? (
              <text x={ox + cw + 8} y={y + 9} fontSize={8.5} fill={PERP_COLOR} fontWeight="700">
                ⊥{cobPerp}mm
              </text>
            ) : null}
          </g>
        );
      })}

      {/* Estribos (VERTICAIS) + labels E1..En e cobrimento no topo */}
      {estrX.map((x, i) => (
        <g key={`e-${i}`}>
          <line x1={x} y1={oy + 10} x2={x} y2={oy + ch - 10} stroke={col} strokeWidth={2.2} />
          <text x={x} y={oy - 20} textAnchor="middle" fontSize={9} fill={SUBTEXT} fontWeight="700">E{i + 1}</text>
          {fd.cob[i]?.trim() ? (
            <text x={x} y={oy - 7} textAnchor="middle" fontSize={9} fill={col} fontWeight="700">{fd.cob[i].trim()}mm</text>
          ) : null}
        </g>
      ))}

      {/* Cotas de espaçamento entre estribos (embaixo, sem texto colidindo) */}
      {estrX.map((x, i) => i < estrX.length - 1 ? (
        <g key={`ev-${i}`}>
          <line x1={x} y1={oy + ch + 13} x2={estrX[i + 1]} y2={oy + ch + 13} stroke={GOLD} strokeWidth={1.1} />
          <line x1={x} y1={oy + ch + 9} x2={x} y2={oy + ch + 17} stroke={GOLD} strokeWidth={1.1} />
          <line x1={estrX[i + 1]} y1={oy + ch + 9} x2={estrX[i + 1]} y2={oy + ch + 17} stroke={GOLD} strokeWidth={1.1} />
          <text x={(x + estrX[i + 1]) / 2} y={oy + ch + 28} textAnchor="middle" fontSize={9} fill={GOLD} fontWeight="700">
            {espEstr[i] !== null ? `${espEstr[i]}cm` : '—'}
          </text>
        </g>
      ) : null)}

      {/* Cotas de espaçamento longitudinal (esquerda) */}
      {barY.map((y, i) => i < barY.length - 1 ? (
        <g key={`eh-${i}`}>
          <line x1={ox - 12} y1={y} x2={ox - 12} y2={barY[i + 1]} stroke={GOLD} strokeWidth={1.1} />
          <line x1={ox - 16} y1={y} x2={ox - 8} y2={y} stroke={GOLD} strokeWidth={1.1} />
          <line x1={ox - 16} y1={barY[i + 1]} x2={ox - 8} y2={barY[i + 1]} stroke={GOLD} strokeWidth={1.1} />
          <text x={ox - 18} y={(y + barY[i + 1]) / 2 + 3} textAnchor="end" fontSize={9} fill={GOLD} fontWeight="700">
            {espLong[i] !== null ? `${espLong[i]}cm` : '—'}
          </text>
        </g>
      ) : null)}
    </svg>
  );
}

// ── Etapas 2 e 3: Malha Quadrada Interativa (Área Livre / Laje) ──
export type FerramentaMalha = 'addH' | 'addV' | 'remove';

export function SvgMalhaLaje({
  lajeData,
  modo,
  ferramenta = 'addH',
  barraSelecionadaId,
  onToggleBarraH,
  onToggleBarraV,
  onSelectBarra,
}: {
  lajeData: LajeData;
  modo: 'editor' | 'leitura';
  ferramenta?: FerramentaMalha;
  barraSelecionadaId?: string | null;
  onToggleBarraH?: (posCm: number) => void;
  onToggleBarraV?: (posCm: number) => void;
  onSelectBarra?: (id: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverPos, setHoverPos] = useState<{ xCm: number; yCm: number } | null>(null);

  const lx = Math.max(10, lajeData.larguraX);
  const ly = Math.max(10, lajeData.alturaY);
  const passo = Math.max(1, lajeData.passoGrid);

  const barrasH = ordenarBarras(lajeData.barrasH);
  const barrasV = ordenarBarras(lajeData.barrasV);

  // Margens generosas para nunca cortar labels H/V ou cotas
  const ML = 64;
  const MR = modo === 'leitura' ? 112 : 56;
  const MT = modo === 'leitura' ? 54 : 34;
  const MB = 42;

  // Escala dinâmica: cresce quando há muitas barras para manter legibilidade
  const baseArea = 280;
  const needW = Math.max(baseArea, barrasV.length * 46);
  const needH = Math.max(baseArea, barrasH.length * 36);
  const sc = Math.max(needW / lx, needH / ly);
  const drawW = Math.round(lx * sc);
  const drawH = Math.round(ly * sc);

  const W = ML + drawW + MR;
  const H = MT + drawH + MB;
  const ox = ML;
  const oy = MT;

  const gridXs: number[] = [];
  for (let x = 0; x <= lx; x += passo) gridXs.push(x);
  if (gridXs[gridXs.length - 1] !== lx) gridXs.push(lx);

  const gridYs: number[] = [];
  for (let y = 0; y <= ly; y += passo) gridYs.push(y);
  if (gridYs[gridYs.length - 1] !== ly) gridYs.push(ly);

  function snapToGrid(val: number, maxVal: number): number {
    const snapped = Math.round(val / passo) * passo;
    if (snapped <= 0) return Math.min(passo, maxVal / 2);
    if (snapped >= maxVal) return Math.max(maxVal - passo, maxVal / 2);
    return Math.round(snapped * 10) / 10;
  }

  function clientToCm(clientX: number, clientY: number): { xCm: number; yCm: number } | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const sx = ((clientX - rect.left) / rect.width) * W;
    const sy = ((clientY - rect.top) / rect.height) * H;
    if (sx < ox || sx > ox + drawW || sy < oy || sy > oy + drawH) return null;
    return {
      xCm: snapToGrid((sx - ox) / sc, lx),
      yCm: snapToGrid((sy - oy) / sc, ly),
    };
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (modo !== 'editor') return;
    setHoverPos(clientToCm(e.clientX, e.clientY));
  }

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (modo !== 'editor') return;
    const pt = clientToCm(e.clientX, e.clientY);
    if (!pt) return;

    if (ferramenta === 'addH') {
      onToggleBarraH?.(pt.yCm);
    } else if (ferramenta === 'addV') {
      onToggleBarraV?.(pt.xCm);
    } else if (ferramenta === 'remove') {
      const tol = Math.max(passo * 0.6, 4);
      let bestH: { pos: number; dist: number } | null = null;
      barrasH.forEach(b => {
        const d = Math.abs(b.pos - pt.yCm);
        if (d <= tol && (!bestH || d < bestH.dist)) bestH = { pos: b.pos, dist: d };
      });
      let bestV: { pos: number; dist: number } | null = null;
      barrasV.forEach(b => {
        const d = Math.abs(b.pos - pt.xCm);
        if (d <= tol && (!bestV || d < bestV.dist)) bestV = { pos: b.pos, dist: d };
      });
      if (bestH && (!bestV || (bestH as { pos: number; dist: number }).dist <= (bestV as { pos: number; dist: number }).dist)) {
        onToggleBarraH?.((bestH as { pos: number; dist: number }).pos);
      } else if (bestV) {
        onToggleBarraV?.((bestV as { pos: number; dist: number }).pos);
      }
    }
  }

  const labelStepX = Math.max(passo, Math.ceil(lx / 5 / passo) * passo);
  const labelStepY = Math.max(passo, Math.ceil(ly / 5 / passo) * passo);

  return (
    <svg
      ref={svgRef}
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverPos(null)}
      onClick={handleClick}
      style={{
        fontFamily: 'monospace',
        display: 'block',
        cursor: modo === 'editor' ? (ferramenta === 'remove' ? 'not-allowed' : 'crosshair') : 'default',
        userSelect: 'none',
      }}
    >
      {/* Fundo da área de concreto */}
      <rect x={ox} y={oy} width={drawW} height={drawH} fill="#F8FAFC" stroke={PRIMARY} strokeWidth={2} />

      {/* Linhas da malha quadrada */}
      {gridXs.map(x => (
        <g key={`gx-${x}`}>
          <line x1={ox + x * sc} y1={oy} x2={ox + x * sc} y2={oy + drawH} stroke="#DCE3EE" strokeWidth={0.8} />
          {modo === 'editor' && (x % labelStepX === 0 || x === lx) && (
            <text x={ox + x * sc} y={oy + drawH + 16} textAnchor="middle" fontSize={8.5} fill={SUBTEXT}>{x}</text>
          )}
        </g>
      ))}
      {gridYs.map(y => (
        <g key={`gy-${y}`}>
          <line x1={ox} y1={oy + y * sc} x2={ox + drawW} y2={oy + y * sc} stroke="#DCE3EE" strokeWidth={0.8} />
          {modo === 'editor' && (y % labelStepY === 0 || y === ly) && (
            <text x={ox - 8} y={oy + y * sc + 3} textAnchor="end" fontSize={8.5} fill={SUBTEXT}>{y}</text>
          )}
        </g>
      ))}

      {/* Guia de hover no modo editor */}
      {modo === 'editor' && hoverPos && ferramenta === 'addH' && (
        <g pointerEvents="none">
          <line x1={ox} y1={oy + hoverPos.yCm * sc} x2={ox + drawW} y2={oy + hoverPos.yCm * sc} stroke={FACE_COLORS.dirH} strokeWidth={2} strokeDasharray="5,4" opacity={0.8} />
          <rect x={ox + drawW + 5} y={oy + hoverPos.yCm * sc - 8} width={46} height={16} rx={3} fill={FACE_COLORS.dirH} />
          <text x={ox + drawW + 28} y={oy + hoverPos.yCm * sc + 3} textAnchor="middle" fontSize={8.5} fill="#fff" fontWeight="700">y={hoverPos.yCm}</text>
        </g>
      )}
      {modo === 'editor' && hoverPos && ferramenta === 'addV' && (
        <g pointerEvents="none">
          <line x1={ox + hoverPos.xCm * sc} y1={oy} x2={ox + hoverPos.xCm * sc} y2={oy + drawH} stroke={FACE_COLORS.dirV} strokeWidth={2} strokeDasharray="5,4" opacity={0.8} />
          <rect x={ox + hoverPos.xCm * sc - 23} y={oy - 22} width={46} height={16} rx={3} fill={FACE_COLORS.dirV} />
          <text x={ox + hoverPos.xCm * sc} y={oy - 11} textAnchor="middle" fontSize={8.5} fill="#fff" fontWeight="700">x={hoverPos.xCm}</text>
        </g>
      )}

      {/* Barras Horizontais (Dir. X — azul) */}
      {barrasH.map((b, i) => {
        const y = oy + b.pos * sc;
        const selected = barraSelecionadaId === b.id;
        const cobTxt = b.cob?.trim();
        const perpTxt = b.cobPerp?.trim();
        return (
          <g
            key={b.id}
            style={{ cursor: modo === 'leitura' ? 'pointer' : undefined }}
            onClick={modo === 'leitura' ? () => onSelectBarra?.(b.id) : undefined}
          >
            <line x1={ox} y1={y} x2={ox + drawW} y2={y} stroke="transparent" strokeWidth={12} />
            <line x1={ox + 2} y1={y} x2={ox + drawW - 2} y2={y} stroke={FACE_COLORS.dirH} strokeWidth={selected ? 3.5 : 2.2} />
            <text x={ox + drawW + 8} y={y + (perpTxt ? -1 : 3)} fontSize={8.5} fill={FACE_COLORS.dirH} fontWeight="700">
              H{i + 1}{cobTxt ? ` ${cobTxt}mm` : ''}
            </text>
            {perpTxt ? (
              <text x={ox + drawW + 8} y={y + 10} fontSize={8} fill={PERP_COLOR} fontWeight="700">
                ⊥{perpTxt}mm
              </text>
            ) : null}
          </g>
        );
      })}

      {/* Barras Verticais (Dir. Y — vermelho) */}
      {barrasV.map((b, i) => {
        const x = ox + b.pos * sc;
        const selected = barraSelecionadaId === b.id;
        const cobTxt = b.cob?.trim();
        const perpTxt = b.cobPerp?.trim();
        return (
          <g
            key={b.id}
            style={{ cursor: modo === 'leitura' ? 'pointer' : undefined }}
            onClick={modo === 'leitura' ? () => onSelectBarra?.(b.id) : undefined}
          >
            <line x1={x} y1={oy} x2={x} y2={oy + drawH} stroke="transparent" strokeWidth={12} />
            <line x1={x} y1={oy + 2} x2={x} y2={oy + drawH - 2} stroke={FACE_COLORS.dirV} strokeWidth={selected ? 3.5 : 2.2} />
            <text x={x} y={oy - (perpTxt ? 28 : cobTxt ? 18 : 8)} textAnchor="middle" fontSize={8.5} fill={FACE_COLORS.dirV} fontWeight="700">
              V{i + 1}
            </text>
            {cobTxt ? (
              <text x={x} y={oy - (perpTxt ? 17 : 7)} textAnchor="middle" fontSize={8} fill={FACE_COLORS.dirV} fontWeight="700">
                {cobTxt}mm
              </text>
            ) : null}
            {perpTxt ? (
              <text x={x} y={oy - 6} textAnchor="middle" fontSize={8} fill={PERP_COLOR} fontWeight="700">
                ⊥{perpTxt}mm
              </text>
            ) : null}
          </g>
        );
      })}

      {/* Pontos de cruzamento */}
      {barrasH.map(bh =>
        barrasV.map(bv => (
          <circle
            key={`${bh.id}-${bv.id}`}
            cx={ox + bv.pos * sc}
            cy={oy + bh.pos * sc}
            r={2.5}
            fill="#fff"
            stroke={PRIMARY}
            strokeWidth={1.1}
            pointerEvents="none"
          />
        )),
      )}

      {/* Cotas de espaçamento entre barras H (esquerda, modo leitura) */}
      {modo === 'leitura' && barrasH.map((b, i) => {
        if (i >= barrasH.length - 1) return null;
        const y1 = oy + b.pos * sc;
        const y2 = oy + barrasH[i + 1].pos * sc;
        const esp = Math.round((barrasH[i + 1].pos - b.pos) * 10) / 10;
        return (
          <g key={`esph-${b.id}`}>
            <line x1={ox - 12} y1={y1} x2={ox - 12} y2={y2} stroke={GOLD} strokeWidth={1.1} />
            <line x1={ox - 16} y1={y1} x2={ox - 8} y2={y1} stroke={GOLD} strokeWidth={1.1} />
            <line x1={ox - 16} y1={y2} x2={ox - 8} y2={y2} stroke={GOLD} strokeWidth={1.1} />
            <text x={ox - 18} y={(y1 + y2) / 2 + 3} textAnchor="end" fontSize={8.5} fill={GOLD} fontWeight="700">
              {esp}cm
            </text>
          </g>
        );
      })}

      {/* Cotas de espaçamento entre barras V (embaixo, modo leitura) */}
      {modo === 'leitura' && barrasV.map((b, i) => {
        if (i >= barrasV.length - 1) return null;
        const x1 = ox + b.pos * sc;
        const x2 = ox + barrasV[i + 1].pos * sc;
        const esp = Math.round((barrasV[i + 1].pos - b.pos) * 10) / 10;
        return (
          <g key={`espv-${b.id}`}>
            <line x1={x1} y1={oy + drawH + 13} x2={x2} y2={oy + drawH + 13} stroke={GOLD} strokeWidth={1.1} />
            <line x1={x1} y1={oy + drawH + 9} x2={x1} y2={oy + drawH + 17} stroke={GOLD} strokeWidth={1.1} />
            <line x1={x2} y1={oy + drawH + 9} x2={x2} y2={oy + drawH + 17} stroke={GOLD} strokeWidth={1.1} />
            <text x={(x1 + x2) / 2} y={oy + drawH + 28} textAnchor="middle" fontSize={8.5} fill={GOLD} fontWeight="700">
              {esp}cm
            </text>
          </g>
        );
      })}
    </svg>
  );
}
