'use client';
// src/app/(dashboard)/ensaios/pacometria/page.tsx

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// ── Constantes visuais ──────────────────────────────────────────
const PRIMARY     = '#1E3264';
const GOLD        = '#C8A020';
const BG          = '#F8F9FA';
const BORDER      = '#E8EAF0';
const TEXT        = '#1A2340';
const SUBTEXT     = '#6B7490';
const SUCCESS     = '#1A7A44';
const DANGER      = '#C0392B';
const EXCEL_BLUE  = '#002060';
const GREEN       = '#2E7D32';
const GREEN_LIGHT = '#F0F8F4';
const GREEN_BORDER = '#B8DFC8';

const FACE_COLORS: Record<string, string> = {
  '1X': '#2563EB', '2X': '#DC2626', '1Y': '#16A34A', '2Y': '#9333EA', circ: '#2563EB',
};

// ── Tipos ───────────────────────────────────────────────────────
type TipoElemento = 'pilar' | 'viga' | 'laje';
type OpcaoAcessibilidade = 'A' | 'B' | 'C' | 'D' | 'E';

type FaceData = {
  nEstribos: number;
  cob: string[];    // cobrimento por estribo (mm)
  espV: string[];   // espaçamento entre estribos (cm)
  espH: string[];   // espaçamento entre barras longitudinais (cm)
};

type AmostraRow = {
  id: string;
  item: number;
  elemento: string;
  tipo: TipoElemento;
  opcao: OpcaoAcessibilidade;
  // Geometria
  X: number; Y: number; C1: number; C2: number; D: number;
  barras: Record<string, number>;
  facesData: Record<string, FaceData>;
  // Calculados
  cobMedio: number | null;
  cobMinimo: number | null;
  cobMaximo: number | null;
  cobDesvio: number | null;
  cobCV: number | null;
  cobModa: number | null;
  // Foto
  fotoFile?: File | null;
  fotoPreview?: string | null;
  fotoWidth?: number;
  fotoHeight?: number;
};

type Cabecalho = {
  rlt: string; data: string; cliente: string; obra: string;
  att: string; endereco: string; notas: string;
};

// ── Constantes ──────────────────────────────────────────────────
const LS_KEY = 'tecomat_pacometria_v1';

const OPCOES_CONFIG: Record<OpcaoAcessibilidade, { label: string; desc: string; faces: string[] }> = {
  A: { label: 'Todas as faces', desc: '4 faces livres', faces: ['1X', '2X', '1Y', '2Y'] },
  B: { label: '1 face vista',   desc: 'Apenas lado 1X',  faces: ['1X'] },
  C: { label: '2 faces em L',   desc: 'Lado 1X + 1Y',   faces: ['1X', '1Y'] },
  D: { label: '3 faces vistas', desc: '1X + 2X + 1Y',   faces: ['1X', '2X', '1Y'] },
  E: { label: 'Circular',       desc: 'Diâmetro D',      faces: ['circ'] },
};

const FACE_LABELS: Record<string, string> = {
  '1X': 'Lado 1X (base)', '2X': 'Lado 2X (topo)',
  '1Y': 'Lado 1Y (esquerda)', '2Y': 'Lado 2Y (direita)',
  circ: 'Vista lateral',
};

// ── Utilitários ─────────────────────────────────────────────────
function newId() { return typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Math.random()); }
function maskData(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
function salvarLocal(cab: Cabecalho, amostras: AmostraRow[]) {
  const sem = amostras.map(({ fotoFile: _f, fotoPreview: _p, ...rest }) => rest);
  try { localStorage.setItem(LS_KEY, JSON.stringify({ cab, amostras: sem })); } catch {}
}
function carregarLocal(): { cab: Cabecalho; amostras: AmostraRow[] } | null {
  try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}

function calcularCobrimentos(facesData: Record<string, FaceData>): {
  cobMedio: number | null; cobMinimo: number | null; cobMaximo: number | null;
  cobDesvio: number | null; cobCV: number | null; cobModa: number | null;
} {
  const todos: number[] = [];
  Object.values(facesData).forEach(fd => {
    fd.cob.forEach(v => { const n = parseFloat(v.replace(',', '.')); if (!isNaN(n) && n > 0) todos.push(n); });
  });
  const nil = { cobMedio: null, cobMinimo: null, cobMaximo: null, cobDesvio: null, cobCV: null, cobModa: null };
  if (todos.length === 0) return nil;
  const cobMedio = todos.reduce((a, b) => a + b, 0) / todos.length;
  const cobMinimo = Math.min(...todos);
  const cobMaximo = Math.max(...todos);
  const cobDesvio = todos.length < 2 ? 0
    : Math.sqrt(todos.reduce((acc, v) => acc + (v - cobMedio) ** 2, 0) / (todos.length - 1));
  const cobCV = cobMedio > 0 ? (cobDesvio / cobMedio) * 100 : 0;
  // Moda por arredondamento (Opção B)
  const freq: Record<number, number> = {};
  todos.forEach(v => { const r = Math.round(v); freq[r] = (freq[r] || 0) + 1; });
  const maxFreq = Math.max(...Object.values(freq));
  const modas = Object.entries(freq).filter(([, f]) => f === maxFreq).map(([v]) => Number(v));
  const cobModa = maxFreq > 1 ? modas[0] : null;
  return { cobMedio, cobMinimo, cobMaximo, cobDesvio, cobCV, cobModa };
}

function initFaceData(): FaceData {
  return { nEstribos: 3, cob: ['', '', ''], espV: ['', ''], espH: [] };
}

function ensureFaceArrays(fd: FaceData, nBarras: number): FaceData {
  const ne = Math.max(1, fd.nEstribos);
  const cob = Array(ne).fill('').map((_, i) => fd.cob[i] ?? '');
  const espV = Math.max(0, ne - 1) > 0 ? Array(ne - 1).fill('').map((_, i) => fd.espV[i] ?? '') : [];
  const espH = Math.max(0, nBarras - 1) > 0 ? Array(nBarras - 1).fill('').map((_, i) => fd.espH[i] ?? '') : [];
  return { ...fd, cob, espV, espH };
}

function comprimirImagem(file: File): Promise<{ base64: string; width: number; height: number; contentType: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 800;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL('image/jpeg', 0.65).split(',')[1] ?? '';
        resolve({ base64, width, height, contentType: 'image/jpeg' });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ── SVG Helpers ─────────────────────────────────────────────────
function svgOpcao(id: OpcaoAcessibilidade): string {
  // Dimensões do card SVG
  const W = 80, H = 64;
  // Elemento concreto centrado
  const ex = 14, ey = 8, ew = 52, eh = 38;
  // Cobrimento visual
  const cv = 7;
  // Raio das barras
  const br = 3;
  // Hachura de obstrução
  const hatch = `<defs><pattern id="hx${id}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#999" stroke-width="1.2"/></pattern></defs>`;
  const hFill = `url(#hx${id})`;
  const concrete = '#E8EAF0';
  const barFill = '#1A2340';

  // Barras padrão para seção retangular: 3 em cima, 3 embaixo, 1 lateral cada lado
  function barras3x3() {
    const xs = [ex + cv, ex + ew / 2, ex + ew - cv];
    const yTop = ey + cv, yBot = ey + eh - cv;
    const yMid = ey + eh / 2;
    let b = '';
    xs.forEach(x => {
      b += `<circle cx="${x}" cy="${yTop}" r="${br}" fill="${barFill}"/>`;
      b += `<circle cx="${x}" cy="${yBot}" r="${br}" fill="${barFill}"/>`;
    });
    // Laterais intermediárias
    b += `<circle cx="${ex + cv}" cy="${yMid}" r="${br}" fill="${barFill}"/>`;
    b += `<circle cx="${ex + ew - cv}" cy="${yMid}" r="${br}" fill="${barFill}"/>`;
    return b;
  }

  // Cotas X e Y
  const cotaX = `<line x1="${ex}" y1="${ey + eh + 5}" x2="${ex + ew}" y2="${ey + eh + 5}" stroke="#1A2340" stroke-width="0.8" marker-start="url(#arr${id})" marker-end="url(#arr${id})"/>
    <text x="${ex + ew / 2}" y="${ey + eh + 14}" text-anchor="middle" font-size="7" fill="#1A2340" font-family="sans-serif">X</text>`;
  const cotaY = `<line x1="${ex - 5}" y1="${ey}" x2="${ex - 5}" y2="${ey + eh}" stroke="#1A2340" stroke-width="0.8" marker-start="url(#arr${id})" marker-end="url(#arr${id})"/>
    <text x="${ex - 12}" y="${ey + eh / 2 + 3}" text-anchor="middle" font-size="7" fill="#1A2340" font-family="sans-serif">Y</text>`;
  const arrows = `<defs><marker id="arr${id}" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto"><path d="M0,0 L0,4 L4,2 z" fill="#1A2340"/></marker></defs>`;

  if (id === 'A') {
    // 0 faces obstruídas — pilar isolado
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${hatch}${arrows}
      <rect x="${ex}" y="${ey}" width="${ew}" height="${eh}" fill="${concrete}" stroke="#1A2340" stroke-width="1.5"/>
      ${barras3x3()}
      ${cotaX}${cotaY}
    </svg>`;
  }

  if (id === 'B') {
    // 3 faces obstruídas: topo, esquerda, direita — apenas base (1X) livre
    const hTop    = `<rect x="${ex}" y="0" width="${ew}" height="${ey}" fill="${hFill}"/>`;
    const hLeft   = `<rect x="0" y="${ey}" width="${ex}" height="${eh}" fill="${hFill}"/>`;
    const hRight  = `<rect x="${ex + ew}" y="${ey}" width="${W - ex - ew}" height="${eh}" fill="${hFill}"/>`;
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${hatch}${arrows}
      ${hTop}${hLeft}${hRight}
      <rect x="${ex}" y="${ey}" width="${ew}" height="${eh}" fill="${concrete}" stroke="#1A2340" stroke-width="1.5"/>
      ${barras3x3()}
      ${cotaX}
    </svg>`;
  }

  if (id === 'C') {
    // 2 faces obstruídas: topo e direita — base (1X) e esquerda (1Y) livres
    const hTop   = `<rect x="${ex}" y="0" width="${ew}" height="${ey}" fill="${hFill}"/>`;
    const hRight = `<rect x="${ex + ew}" y="${ey}" width="${W - ex - ew}" height="${eh}" fill="${hFill}"/>`;
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${hatch}${arrows}
      ${hTop}${hRight}
      <rect x="${ex}" y="${ey}" width="${ew}" height="${eh}" fill="${concrete}" stroke="#1A2340" stroke-width="1.5"/>
      ${barras3x3()}
      ${cotaX}${cotaY}
    </svg>`;
  }

  if (id === 'D') {
    // 1 face obstruída: apenas topo — base, esquerda e direita livres
    const hTop = `<rect x="${ex}" y="0" width="${ew}" height="${ey}" fill="${hFill}"/>`;
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${hatch}${arrows}
      ${hTop}
      <rect x="${ex}" y="${ey}" width="${ew}" height="${eh}" fill="${concrete}" stroke="#1A2340" stroke-width="1.5"/>
      ${barras3x3()}
      ${cotaX}${cotaY}
    </svg>`;
  }

  if (id === 'E') {
    // Circular
    const cx = W / 2, cy = H / 2 - 4, r = 22, rb = r - 6;
    const nb = 8;
    let bcirc = '';
    for (let i = 0; i < nb; i++) {
      const ang = (2 * Math.PI / nb) * i - Math.PI / 2;
      bcirc += `<circle cx="${(cx + rb * Math.cos(ang)).toFixed(1)}" cy="${(cy + rb * Math.sin(ang)).toFixed(1)}" r="${br}" fill="${barFill}"/>`;
    }
    // Diâmetro com seta diagonal
    const x1 = (cx - r * 0.6).toFixed(1), y1 = (cy + r * 0.6).toFixed(1);
    const x2 = (cx + r * 0.6).toFixed(1), y2 = (cy - r * 0.6).toFixed(1);
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs><marker id="arr${id}" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto"><path d="M0,0 L0,4 L4,2 z" fill="#1A2340"/></marker></defs>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${concrete}" stroke="#1A2340" stroke-width="2"/>
      <circle cx="${cx}" cy="${cy}" r="${rb}" fill="none" stroke="#1A2340" stroke-width="0.8" stroke-dasharray="2,2"/>
      ${bcirc}
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1A2340" stroke-width="0.8" marker-end="url(#arr${id})"/>
      <line x1="${(cx - r).toFixed(1)}" y1="${(cy + r + 5).toFixed(1)}" x2="${(cx + r).toFixed(1)}" y2="${(cy + r + 5).toFixed(1)}" stroke="#1A2340" stroke-width="0.8" marker-start="url(#arr${id})" marker-end="url(#arr${id})"/>
      <text x="${cx}" y="${(cy + r + 14).toFixed(1)}" text-anchor="middle" font-size="7" fill="#1A2340" font-family="sans-serif">D</text>
    </svg>`;
  }

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"/>`;
}

function SvgSecao({ X, Y, C1, C2, faces, barras }: { X: number; Y: number; C1: number; C2: number; faces: string[]; barras: Record<string, number> }) {
  const W = 240, H = 180, MX = 36, MY = 28;
  const sc = Math.min((W - 2 * MX) / Math.max(X, 1), (H - 2 * MY) / Math.max(Y, 1));
  const cw = X * sc, ch = Y * sc;
  const ox = (W - cw) / 2, oy = (H - ch) / 2;
  const c1 = C1 * sc, c2 = C2 * sc;
  const BAR = Math.max(3, Math.min(6, sc * 0.7));
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
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ fontFamily: 'monospace' }}>
      <rect x={ox} y={oy} width={cw} height={ch} fill="#EEF2F7" stroke={PRIMARY} strokeWidth={2} />
      <rect x={ox + cv} y={oy + cv} width={cw - 2 * cv} height={ch - 2 * cv} fill="none" stroke="#2563EB" strokeWidth={1} strokeDasharray="3,2" />
      {(['1X', '2X', '1Y', '2Y'] as string[]).map(f =>
        faces.includes(f) ? barsInFace(f).map((p, i) => (
          <g key={`${f}-${i}`}>
            <circle cx={p.x} cy={p.y} r={BAR + 2} fill="white" stroke={FACE_COLORS[f]} strokeWidth={1.5} />
            <circle cx={p.x} cy={p.y} r={BAR * 0.55} fill={FACE_COLORS[f]} />
          </g>
        )) : null
      )}
      {/* Cotas */}
      <line x1={ox} y1={oy + ch + 12} x2={ox + cw} y2={oy + ch + 12} stroke={GOLD} strokeWidth={1} />
      <text x={ox + cw / 2} y={oy + ch + 22} textAnchor="middle" fontSize={9} fill={GOLD}>{X} cm</text>
      <line x1={ox - 12} y1={oy} x2={ox - 12} y2={oy + ch} stroke={GOLD} strokeWidth={1} />
      <text x={ox - 24} y={oy + ch / 2} textAnchor="middle" fontSize={9} fill={GOLD} transform={`rotate(-90,${ox - 24},${oy + ch / 2})`}>{Y} cm</text>
      {/* Labels faces */}
      <text x={ox + cw / 2} y={oy - 6} textAnchor="middle" fontSize={8} fill={FACE_COLORS['2X']} fontWeight="500">2X{!faces.includes('2X') ? ' ✕' : ''}</text>
      <text x={ox + cw / 2} y={oy + ch + 34} textAnchor="middle" fontSize={8} fill={FACE_COLORS['1X']} fontWeight="500">1X{!faces.includes('1X') ? ' ✕' : ''}</text>
      <text x={ox - 30} y={oy + ch / 2} textAnchor="middle" fontSize={8} fill={FACE_COLORS['1Y']} transform={`rotate(-90,${ox - 30},${oy + ch / 2})`}>1Y{!faces.includes('1Y') ? ' ✕' : ''}</text>
      <text x={ox + cw + 28} y={oy + ch / 2} textAnchor="middle" fontSize={8} fill={FACE_COLORS['2Y']} transform={`rotate(90,${ox + cw + 28},${oy + ch / 2})`}>2Y{!faces.includes('2Y') ? ' ✕' : ''}</text>
    </svg>
  );
}

function SvgPerfil({ face, nBarras, fd, C1 }: { face: string; nBarras: number; fd: FaceData; C1: number }) {
  const W = 220, H = 200, MX = 32, MY = 20;
  const espVals = fd.espV.map(v => parseFloat(v) || 15);
  const espHVals = fd.espH.map(v => parseFloat(v) || 10);
  const ne = fd.nEstribos;
  const FOLGA = espVals.length > 0 ? espVals[0] * 0.4 : 8;
  const totalH = ne > 1 ? espVals.slice(0, ne - 1).reduce((a, b) => a + b, 0) : 0;
  const altReal = totalH + 2 * FOLGA;
  const totalW = nBarras > 1 ? espHVals.slice(0, nBarras - 1).reduce((a, b) => a + b, 0) : 20;
  const concreteW = totalW + C1 * 2;
  const sc = Math.min((W - 2 * MX) / Math.max(concreteW, 1), (H - 2 * MY) / Math.max(altReal, 1));
  const cw = concreteW * sc, ch = altReal * sc;
  const ox = (W - cw) / 2, oy = (H - ch) / 2;
  const c1s = C1 * sc;
  const folgas = FOLGA * sc;
  const col = FACE_COLORS[face] || '#2563EB';

  const barX: number[] = [ox + c1s];
  for (let i = 0; i < nBarras - 1; i++) barX.push(barX[barX.length - 1] + (espHVals[i] || 10) * sc);

  const estrY: number[] = [oy + folgas];
  for (let i = 0; i < ne - 1; i++) estrY.push(estrY[estrY.length - 1] + (espVals[i] || 15) * sc);

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ fontFamily: 'monospace' }}>
      <rect x={ox} y={oy} width={cw} height={ch} fill="#EEF2F7" stroke={PRIMARY} strokeWidth={2} />
      {/* Barras longitudinais */}
      {barX.map((x, i) => <line key={i} x1={x} y1={oy + 4} x2={x} y2={oy + ch - 4} stroke={col} strokeWidth={2} />)}
      {/* Estribos */}
      {estrY.map((y, i) => (
        <g key={i}>
          <line x1={ox + c1s - 4} y1={y} x2={ox + cw - c1s + 4} y2={y} stroke={col} strokeWidth={2} />
          {fd.cob[i] ? <text x={ox + cw - c1s + 8} y={y + 4} fontSize={8} fill={col}>{fd.cob[i]}mm</text> : null}
        </g>
      ))}
      {/* Cotas espV */}
      {estrY.map((y, i) => i < estrY.length - 1 ? (
        <g key={i}>
          <line x1={ox - 12} y1={y} x2={ox - 12} y2={estrY[i + 1]} stroke={GOLD} strokeWidth={1} />
          <text x={ox - 14} y={(y + estrY[i + 1]) / 2 + 4} textAnchor="end" fontSize={8} fill={GOLD}>{espVals[i] || '?'}cm</text>
        </g>
      ) : null)}
      {/* Cotas espH */}
      {barX.map((x, i) => i < barX.length - 1 ? (
        <g key={i}>
          <line x1={x} y1={oy + ch + 12} x2={barX[i + 1]} y2={oy + ch + 12} stroke={GOLD} strokeWidth={1} />
          <text x={(x + barX[i + 1]) / 2} y={oy + ch + 22} textAnchor="middle" fontSize={8} fill={GOLD}>{espHVals[i] || '?'}cm</text>
        </g>
      ) : null)}
      <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={9} fill={col} fontWeight="500">{FACE_LABELS[face]}</text>
    </svg>
  );
}

// ── Sub-componentes ─────────────────────────────────────────────
function Campo({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label htmlFor={htmlFor} style={{ fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 7, border: `1.5px solid ${BORDER}`,
  fontSize: 14, fontFamily: 'inherit', color: TEXT, background: '#fff',
  outline: 'none', width: '100%', boxSizing: 'border-box',
};

function Header({ displayName, initials, cargo, onSignOut }: { displayName: string; initials: string; cargo: string; onSignOut: () => void }) {
  return (
    <header className="header-root" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 60, padding: '0 28px', backgroundColor: PRIMARY, boxShadow: '0 2px 12px rgba(30,50,100,0.25)', position: 'sticky', top: 0, zIndex: 50 }}>
      <style>{`.sb-u:hover{background:rgba(255,255,255,0.12)!important}.nv-u:hover{color:#fff!important}`}</style>
      <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src="/logo_tecomat.png" alt="TECOMAT" style={{ height: 34, objectFit: 'contain' }} />
        </a>
        <nav style={{ display: 'flex', gap: 6 }}>
          <a href="/dashboard" className="nv-u" style={{ fontSize: 13, fontWeight: 600, color: '#fff', textDecoration: 'none', padding: '4px 10px', borderRadius: 6, borderBottom: `2px solid ${GOLD}`, paddingBottom: 5 }}>Ensaios</a>
          <a href="/usuarios" className="nv-u" style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.65)', textDecoration: 'none', padding: '4px 10px', borderRadius: 6 }}>Usuários</a>
        </nav>
      </div>
      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: GOLD, color: PRIMARY, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.25)', flexShrink: 0 }}>{initials}</div>
          <div>
            <p className="header-user-name" style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: 0 }}>{displayName}</p>
            {cargo && <p className="header-cargo" style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '2px 0 0' }}>{cargo}</p>}
          </div>
        </div>
        <div className="header-divider" style={{ width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.15)' }} />
        <button className="sb-u" onClick={onSignOut} aria-label="Sair" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span className="signout-text">Sair</span>
        </button>
      </div>
    </header>
  );
}

// ── Modal de Amostra (fluxo 3 etapas) ──────────────────────────
type ModalAmostraProps = {
  amostraInicial?: AmostraRow | null;
  onSalvar: (a: AmostraRow) => void;
  onFechar: () => void;
  itemNum: number;
};

function ModalAmostra({ amostraInicial, onSalvar, onFechar, itemNum }: ModalAmostraProps) {
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [elemento, setElemento] = useState(amostraInicial?.elemento ?? '');
  const [tipo, setTipo] = useState<TipoElemento>(amostraInicial?.tipo ?? 'pilar');
  const [opcao, setOpcao] = useState<OpcaoAcessibilidade | null>(amostraInicial?.opcao ?? null);
  const [X, setX] = useState(amostraInicial?.X ?? 30);
  const [Y, setY] = useState(amostraInicial?.Y ?? 50);
  const [C1, setC1] = useState(amostraInicial?.C1 ?? 3);
  const [C2, setC2] = useState(amostraInicial?.C2 ?? 3);
  const [D, setD] = useState(amostraInicial?.D ?? 40);
  const [barras, setBarras] = useState<Record<string, number>>(amostraInicial?.barras ?? { '1X': 3, '2X': 3, '1Y': 2, '2Y': 2, circ: 6 });
  const [facesData, setFacesData] = useState<Record<string, FaceData>>(amostraInicial?.facesData ?? {});

  const faces = opcao ? OPCOES_CONFIG[opcao].faces : [];
  const isCirc = opcao === 'E';

  // Garante que cada face tem sua FaceData inicializada
  function getFaceData(face: string): FaceData {
    const nb = barras[face] || 2;
    const fd = facesData[face] || initFaceData();
    return ensureFaceArrays(fd, nb);
  }

  function updateFaceData(face: string, updater: (fd: FaceData) => FaceData) {
    setFacesData(prev => {
      const current = prev[face] || initFaceData();
      const updated = updater(ensureFaceArrays(current, barras[face] || 2));
      return { ...prev, [face]: updated };
    });
  }

  function handleSalvar() {
    const allFacesData: Record<string, FaceData> = {};
    faces.forEach(f => { allFacesData[f] = getFaceData(f); });
    const { cobMedio, cobMinimo, cobMaximo, cobDesvio, cobCV, cobModa } = calcularCobrimentos(allFacesData);
    const id = amostraInicial?.id ?? newId();
    const item = amostraInicial?.item ?? itemNum;
    onSalvar({ id, item, elemento, tipo, opcao: opcao!, X, Y, C1, C2, D, barras, facesData: allFacesData, cobMedio, cobMinimo, cobMaximo, cobDesvio, cobCV, cobModa });
  }

  const podeAvancar1 = !!opcao && elemento.trim().length > 0;
  const podeAvancar2 = true;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 780, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.22)' }}>
        {/* Header modal */}
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: PRIMARY }}>{amostraInicial ? 'Editar amostra' : 'Nova amostra'}</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: SUBTEXT }}>Item {amostraInicial?.item ?? itemNum}</p>
          </div>
          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {([1, 2, 3] as const).map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: etapa > s ? SUCCESS : etapa === s ? PRIMARY : BORDER, color: etapa >= s ? '#fff' : SUBTEXT }}>{etapa > s ? '✓' : s}</div>
                {i < 2 && <div style={{ width: 20, height: 1, background: BORDER }} />}
              </div>
            ))}
          </div>
          <button onClick={onFechar} aria-label="Fechar modal" style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUBTEXT }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ padding: '20px 24px' }}>

          {/* ── ETAPA 1 ── */}
          {etapa === 1 && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <Campo label="Identificação do elemento" htmlFor="elem-nome">
                  <input id="elem-nome" style={{ ...inputStyle, textTransform: 'uppercase' }} value={elemento} onChange={e => setElemento(e.target.value.toUpperCase())} placeholder="EX: P1 – TÉRREO" />
                </Campo>
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Acessibilidade do pilar em campo</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 20 }}>
                {(Object.keys(OPCOES_CONFIG) as OpcaoAcessibilidade[]).map(id => (
                  <button key={id} onClick={() => setOpcao(id)} style={{ border: `1.5px solid ${opcao === id ? PRIMARY : BORDER}`, borderRadius: 10, padding: '10px 6px 8px', cursor: 'pointer', background: opcao === id ? '#EEF2FF' : '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div dangerouslySetInnerHTML={{ __html: svgOpcao(id) }} style={{ lineHeight: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: opcao === id ? PRIMARY : SUBTEXT, textAlign: 'center', lineHeight: 1.3 }}>{id} — {OPCOES_CONFIG[id].label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── ETAPA 2 ── */}
          {etapa === 2 && (
            <div>
              <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dados geométricos — {isCirc ? 'seção circular' : 'seção transversal'}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px 16px', marginBottom: 20 }}>
                {isCirc ? (
                  <>
                    <Campo label="Diâmetro D (cm)" htmlFor="geom-d"><input id="geom-d" type="number" style={inputStyle} value={D} min={5} onChange={e => setD(Number(e.target.value))} /></Campo>
                    <Campo label="Nº barras (total)" htmlFor="geom-bcirc"><input id="geom-bcirc" type="number" style={inputStyle} value={barras['circ'] ?? 6} min={1} onChange={e => setBarras(p => ({ ...p, circ: Number(e.target.value) }))} /></Campo>
                  </>
                ) : (
                  <>
                    <Campo label="Dimensão X (cm)" htmlFor="geom-x"><input id="geom-x" type="number" style={inputStyle} value={X} min={5} onChange={e => setX(Number(e.target.value))} /></Campo>
                    <Campo label="Dimensão Y (cm)" htmlFor="geom-y"><input id="geom-y" type="number" style={inputStyle} value={Y} min={5} onChange={e => setY(Number(e.target.value))} /></Campo>
                    {/* Barras por face habilitada */}
                    {(['1X', '2X', '1Y', '2Y'] as string[]).map(f => {
                      const enabled = faces.includes(f);
                      return (
                        <Campo key={f} label={`Barras ${FACE_LABELS[f]}`} htmlFor={`geom-b${f}`}>
                          <input id={`geom-b${f}`} type="number" style={{ ...inputStyle, opacity: enabled ? 1 : 0.4 }} disabled={!enabled} value={barras[f] ?? 2} min={1} onChange={e => setBarras(p => ({ ...p, [f]: Number(e.target.value) }))} />
                        </Campo>
                      );
                    })}
                  </>
                )}
              </div>
              {/* Preview seção transversal */}
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0', background: BG, borderRadius: 10, border: `1px solid ${BORDER}` }}>
                {isCirc ? (
                  <svg width={180} height={160} viewBox="0 0 180 160">
                    {(() => { const r = Math.min(60, D * 1.1), cx = 90, cy = 75; const nb = barras['circ'] || 6; return (<g>
                      <circle cx={cx} cy={cy} r={r} fill="#EEF2F7" stroke={PRIMARY} strokeWidth={2} />
                      <circle cx={cx} cy={cy} r={r * 0.75} fill="none" stroke="#2563EB" strokeWidth={1} strokeDasharray="3,2" />
                      {Array.from({ length: nb }, (_, i) => { const ang = (2 * Math.PI / nb) * i - Math.PI / 2; const bx = cx + (r * 0.75) * Math.cos(ang), by = cy + (r * 0.75) * Math.sin(ang); return (<g key={i}><circle cx={bx} cy={by} r={5} fill="white" stroke="#2563EB" strokeWidth={1.5} /><circle cx={bx} cy={by} r={2.5} fill="#2563EB" /></g>); })}
                      <text x={cx} y={cy + r + 16} textAnchor="middle" fontSize={9} fill={GOLD}>⌀ {D} cm</text>
                    </g>); })()}
                  </svg>
                ) : (
                  <SvgSecao X={X} Y={Y} C1={C1} C2={C2} faces={faces} barras={barras} />
                )}
              </div>
            </div>
          )}

          {/* ── ETAPA 3 ── */}
          {etapa === 3 && (
            <div>
              <p style={{ margin: '0 0 16px', fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Vistas laterais — dados do ensaio por face</p>
              {faces.map((face, fi) => {
                const fd = getFaceData(face);
                const nBarras = isCirc ? (barras['circ'] || 6) : (barras[face] || 2);
                const col = FACE_COLORS[face] || '#2563EB';
                return (
                  <div key={face} style={{ marginBottom: fi < faces.length - 1 ? 24 : 0 }}>
                    <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: col, background: col + '18', borderRadius: 6, padding: '3px 10px', marginBottom: 12 }}>{FACE_LABELS[face]}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, alignItems: 'start' }}>
                      {/* SVG perfil */}
                      <div style={{ background: BG, borderRadius: 8, border: `1px solid ${BORDER}`, padding: 8, display: 'flex', justifyContent: 'center' }}>
                        <SvgPerfil face={face} nBarras={nBarras} fd={fd} C1={isCirc ? C1 : C1} />
                      </div>
                      {/* Inputs */}
                      <div>
                        {/* nEstribos */}
                        <div style={{ marginBottom: 12 }}>
                          <Campo label="Nº de estribos no trecho" htmlFor={`ne-${face}`}>
                            <input id={`ne-${face}`} type="number" style={{ ...inputStyle, maxWidth: 120 }} value={fd.nEstribos} min={1} onChange={e => {
                              const n = Math.max(1, parseInt(e.target.value) || 1);
                              updateFaceData(face, f => ensureFaceArrays({ ...f, nEstribos: n }, nBarras));
                            }} />
                          </Campo>
                        </div>
                        <div style={{ height: 1, background: BORDER, marginBottom: 12 }} />
                        {/* Cobrimentos */}
                        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cobrimento por estribo (mm)</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px 10px', marginBottom: 12 }}>
                          {fd.cob.map((v, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ fontSize: 11, color: col, fontWeight: 700, minWidth: 24 }}>C{i + 1}</span>
                              <input type="number" inputMode="decimal" value={v} min={0} placeholder="mm" style={{ ...inputStyle, flex: 1, padding: '6px 8px', fontSize: 12 }} onChange={e => updateFaceData(face, f => { const c = [...f.cob]; c[i] = e.target.value; return { ...f, cob: c }; })} />
                              <span style={{ fontSize: 10, color: SUBTEXT }}>mm</span>
                            </div>
                          ))}
                        </div>
                        {/* Espaçamentos estribos */}
                        {fd.espV.length > 0 && (
                          <>
                            <div style={{ height: 1, background: BORDER, marginBottom: 12 }} />
                            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Espaçamento entre estribos (cm)</p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px 10px', marginBottom: 12 }}>
                              {fd.espV.map((v, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <span style={{ fontSize: 11, color: GOLD, fontWeight: 700, minWidth: 24 }}>E{i + 1}</span>
                                  <input type="number" inputMode="decimal" value={v} min={0} placeholder="cm" style={{ ...inputStyle, flex: 1, padding: '6px 8px', fontSize: 12 }} onChange={e => { updateFaceData(face, f => { const ev = [...f.espV]; ev[i] = e.target.value; return { ...f, espV: ev }; }); }} />
                                  <span style={{ fontSize: 10, color: SUBTEXT }}>cm</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                        {/* Espaçamentos barras */}
                        {fd.espH.length > 0 && (
                          <>
                            <div style={{ height: 1, background: BORDER, marginBottom: 12 }} />
                            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Espaçamento entre barras longitudinais (cm)</p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px 10px' }}>
                              {fd.espH.map((v, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <span style={{ fontSize: 11, color: GOLD, fontWeight: 700, minWidth: 24 }}>E{i + 1}</span>
                                  <input type="number" inputMode="decimal" value={v} min={0} placeholder="cm" style={{ ...inputStyle, flex: 1, padding: '6px 8px', fontSize: 12 }} onChange={e => updateFaceData(face, f => { const eh = [...f.espH]; eh[i] = e.target.value; return { ...f, espH: eh }; })} />
                                  <span style={{ fontSize: 10, color: SUBTEXT }}>cm</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {fi < faces.length - 1 && <div style={{ height: 1, background: BORDER, marginTop: 20 }} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer modal */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', bottom: 0, background: '#fff' }}>
          <button onClick={etapa === 1 ? onFechar : () => setEtapa(e => (e - 1) as 1 | 2 | 3)} style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#F0F2F8', color: TEXT, border: 'none' }}>
            {etapa === 1 ? 'Cancelar' : '← Voltar'}
          </button>
          {etapa < 3 ? (
            <button onClick={() => setEtapa(e => (e + 1) as 2 | 3)} disabled={etapa === 1 ? !podeAvancar1 : !podeAvancar2} style={{ padding: '8px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: podeAvancar1 || etapa > 1 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', background: PRIMARY, color: '#fff', border: 'none', opacity: (etapa === 1 ? podeAvancar1 : podeAvancar2) ? 1 : 0.45 }}>
              Próximo →
            </button>
          ) : (
            <button onClick={handleSalvar} style={{ padding: '8px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: SUCCESS, color: '#fff', border: 'none' }}>
              ✓ Confirmar amostra
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ────────────────────────────────────────────
export default function PacometriaPage() {
  const router = useRouter();

  // Auth
  const [userName, setUserName]     = useState('');
  const [userEmail, setUserEmail]   = useState('');
  const [userCargo, setUserCargo]   = useState('');
  const [userCrea, setUserCrea]     = useState('');
  const [userAssinatura, setUserAssinatura] = useState('');

  // Cabeçalho
  const [cab, setCab] = useState<Cabecalho>({
    rlt: '', data: '', cliente: '', obra: '', att: '', endereco: '', notas: '',
  });

  // Amostras
  const [amostras, setAmostras] = useState<AmostraRow[]>([]);

  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [amostraEditando, setAmostraEditando] = useState<AmostraRow | null>(null);

  // Foto por linha (input ref por id)
  const fotoRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Responsável
  const [outroResp, setOutroResp]         = useState(false);
  const [outroRespNome, setOutroRespNome] = useState('');
  const [outroRespCrea, setOutroRespCrea] = useState('');
  const [outroRespFile, setOutroRespFile] = useState<File | null>(null);
  const [outroRespPreview, setOutroRespPreview] = useState<string | null>(null);
  const outroAssinaturaRef = useRef<HTMLInputElement>(null);

  // Opções relatório
  const [usaMotivacao, setUsaMotivacao]   = useState(false);
  const [motivacao, setMotivacao]         = useState('');
  const [usaFotoGeral, setUsaFotoGeral]   = useState(false);
  const [fotoGeralFile, setFotoGeralFile] = useState<File | null>(null);
  const [usaCroquiGeral, setUsaCroquiGeral] = useState(false);
  const [croquiFile, setCroquiFile]       = useState<File | null>(null);

  // UI
  const [aba, setAba]           = useState<'cabecalho' | 'campo' | 'obra'>('cabecalho');
  const [salvoMsg, setSalvoMsg] = useState('');
  const [gerandoDocx, setGerandoDocx] = useState(false);

  // ── Efeitos ──────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      setUserEmail(user.email ?? '');
      const m = user.user_metadata ?? {};
      setUserName(m.full_name ?? m.name ?? user.email ?? '');
      setUserCargo(m.cargo ?? '');
      setUserCrea(m.crea ?? '');
      setUserAssinatura(m.assinatura_url ?? '');
    });
  }, [router]);

  useEffect(() => {
    const saved = carregarLocal();
    if (saved) { setCab(saved.cab); setAmostras(saved.amostras); }
  }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      salvarLocal(cab, amostras);
      setSalvoMsg('Salvo');
      setTimeout(() => setSalvoMsg(''), 1800);
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [cab, amostras]);

  // ── Handlers ─────────────────────────────────────────────────
  const handleSignOut = async () => {
    const supabase = createClient();
    localStorage.removeItem(LS_KEY);
    await supabase.auth.signOut();
    router.push('/login');
  };

  const initials = (() => {
    if (!userName) return userEmail.slice(0, 2).toUpperCase();
    const p = userName.trim().split(/\s+/);
    return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
  })();

  const rltOficial = (() => {
    const n = cab.rlt.trim();
    if (!n) return 'RLT.LAU-XXX.26-00';
    if (/^\d+$/.test(n)) return `RLT.LAU-${n.padStart(3, '0')}.26-00`;
    return `RLT.LAU-${n}.26-00`;
  })();

  const salvarAmostra = (a: AmostraRow) => {
    setAmostras(prev => {
      const idx = prev.findIndex(x => x.id === a.id);
      if (idx >= 0) {
        const next = [...prev]; next[idx] = a; return next;
      }
      return [...prev, { ...a, item: prev.length + 1 }];
    });
    setModalAberto(false);
    setAmostraEditando(null);
  };

  const apagarAmostra = (id: string) => {
    if (!confirm('Apagar esta amostra?')) return;
    setAmostras(prev => prev.filter(a => a.id !== id).map((a, i) => ({ ...a, item: i + 1 })));
  };

  const editarAmostra = (a: AmostraRow) => {
    setAmostraEditando(a);
    setModalAberto(true);
  };

  const handleFoto = async (id: string, file: File) => {
    const preview = URL.createObjectURL(file);
    setAmostras(prev => prev.map(a => a.id === id ? { ...a, fotoFile: file, fotoPreview: preview } : a));
  };

  const removerFoto = (id: string) => {
    setAmostras(prev => prev.map(a => a.id === id ? { ...a, fotoFile: null, fotoPreview: null } : a));
    if (fotoRefs.current[id]) fotoRefs.current[id]!.value = '';
  };

  const respNomeFinal = outroResp ? outroRespNome : userName;
  const respCreaFinal = outroResp ? outroRespCrea : userCrea;

  // ── Gerar DOCX ───────────────────────────────────────────────
  const gerarDocx = async () => {
    setGerandoDocx(true);
    try {
      // Comprimir fotos das amostras
      const amostrasPayload = await Promise.all(amostras.map(async a => {
        let foto = null;
        if (a.fotoFile instanceof File) {
          foto = await comprimirImagem(a.fotoFile);
        }
        return {
          ...a,
          fotoFile: undefined,
          fotoPreview: undefined,
          foto,
        };
      }));

      // Foto geral e croqui
      let fotoGeralPayload = null;
      if (usaFotoGeral && fotoGeralFile) fotoGeralPayload = await comprimirImagem(fotoGeralFile);
      let croquiPayload = null;
      if (usaCroquiGeral && croquiFile) croquiPayload = await comprimirImagem(croquiFile);

      // Outro responsável
      let outroRespBase64 = '';
      if (outroResp && outroRespFile instanceof File) {
        const r = await comprimirImagem(outroRespFile);
        outroRespBase64 = r.base64;
      }

      const body = {
        cab, amostras: amostrasPayload, rltOficial,
        respNome: respNomeFinal, respCrea: respCreaFinal,
        assinaturaUrl: outroResp ? '' : userAssinatura,
        outroRespBase64,
        usaMotivacao, motivacao,
        usaFotoGeral, fotoGeral: fotoGeralPayload,
        usaCroquiGeral, croqui: croquiPayload,
      };

      const res = await fetch('/api/ensaios/pacometria/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Erro ao gerar DOCX');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${rltOficial}.docx`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Erro ao gerar o relatório. Tente novamente.');
    } finally {
      setGerandoDocx(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box}
        html,body{overflow-x:hidden}
        @media(max-width:600px){
          .header-user-name,.header-cargo,.header-divider{display:none!important}
          .signout-text{display:none!important}
          .tabs-row button{flex:1;font-size:11px!important;padding:10px 4px!important}
          .tab-label-full{display:none}
          .tab-label-short{display:inline}
          .main-pacometria{padding:16px!important}
          .amostras-table-section{display:none!important}
          .amostras-cards-section{display:flex!important}
        }
        @media(min-width:601px){
          .tab-label-short{display:none}
          .tab-label-full{display:inline}
          .amostras-cards-section{display:none!important}
        }
        .tab-btn{padding:12px 20px;border:none;border-bottom:2px solid transparent;background:transparent;font-family:inherit;font-size:13px;font-weight:600;color:${SUBTEXT};cursor:pointer;transition:all .15s}
        .tab-ativo{color:${PRIMARY}!important;border-bottom-color:${PRIMARY}!important}
        .tab-icon{display:none}
        @media(max-width:600px){.tab-icon{display:block;margin-bottom:2px}}
      `}</style>

      <Header displayName={userName} initials={initials} cargo={userCargo} onSignOut={handleSignOut} />

      {/* Tabs */}
      <div className="tabs-row" style={{ background: '#fff', borderBottom: `1px solid ${BORDER}`, display: 'flex', padding: '0 28px' }}>
        {([['cabecalho', 'Cabeçalho e Aparelho', 'Cab.'], ['campo', 'Dados de Campo', 'Dados'], ['obra', 'Modo Obra', 'Obra']] as const).map(([id, full, short]) => (
          <button key={id} className={`tab-btn${aba === id ? ' tab-ativo' : ''}`} onClick={() => setAba(id)}>
            <span className="tab-label-full">{`${id === 'cabecalho' ? '1.' : id === 'campo' ? '2.' : '3.'} ${full}`}</span>
            <span className="tab-label-short">{short}</span>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {salvoMsg && <span style={{ fontSize: 11, color: SUCCESS, fontWeight: 700, alignSelf: 'center', marginRight: 8 }}>✓ {salvoMsg}</span>}
      </div>

      <main className="main-pacometria" style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px' }}>

        {/* ── ABA 1: CABEÇALHO ── */}
        {aba === 'cabecalho' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Identificação */}
            <section style={{ background: '#fff', borderRadius: 10, border: `1px solid ${BORDER}`, padding: '20px 24px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 11, fontWeight: 800, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Identificação do Relatório</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
                <Campo label="Nº do Relatório" htmlFor="rlt">
                  <input id="rlt" style={inputStyle} value={cab.rlt} onChange={e => setCab(p => ({ ...p, rlt: e.target.value }))} placeholder="Ex: 042" />
                </Campo>
                <Campo label="Data de Emissão" htmlFor="data">
                  <input id="data" style={inputStyle} inputMode="numeric" value={cab.data} onChange={e => setCab(p => ({ ...p, data: maskData(e.target.value) }))} placeholder="DD/MM/AAAA" maxLength={10} />
                </Campo>
                <Campo label="Cliente" htmlFor="cliente">
                  <input id="cliente" style={inputStyle} value={cab.cliente} onChange={e => setCab(p => ({ ...p, cliente: e.target.value }))} />
                </Campo>
                <Campo label="Obra" htmlFor="obra">
                  <input id="obra" style={inputStyle} value={cab.obra} onChange={e => setCab(p => ({ ...p, obra: e.target.value }))} />
                </Campo>
                <Campo label="A/T (Att.)" htmlFor="att">
                  <input id="att" style={inputStyle} value={cab.att} onChange={e => setCab(p => ({ ...p, att: e.target.value }))} />
                </Campo>
                <Campo label="Endereço" htmlFor="end">
                  <input id="end" style={inputStyle} value={cab.endereco} onChange={e => setCab(p => ({ ...p, endereco: e.target.value }))} />
                </Campo>
              </div>
            </section>

            {/* Opções do relatório */}
            <section style={{ background: '#fff', borderRadius: 10, border: `1px solid ${BORDER}`, padding: '20px 24px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 11, fontWeight: 800, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Opções do Relatório</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Motivação */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: TEXT }}>
                    <input type="checkbox" checked={usaMotivacao} onChange={e => setUsaMotivacao(e.target.checked)} />
                    Incluir motivação / contexto do ensaio
                  </label>
                  {usaMotivacao && <textarea rows={3} style={{ ...inputStyle, marginTop: 8, resize: 'vertical' }} value={motivacao} onChange={e => setMotivacao(e.target.value)} placeholder="Descreva a motivação do ensaio..." />}
                </div>
                {/* Foto geral */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: TEXT }}>
                    <input type="checkbox" checked={usaFotoGeral} onChange={e => setUsaFotoGeral(e.target.checked)} />
                    Incluir foto geral da estrutura
                  </label>
                  {usaFotoGeral && (
                    <div style={{ marginTop: 8 }}>
                      <input type="file" accept="image/*" onChange={e => { if (e.target.files?.[0]) setFotoGeralFile(e.target.files[0]); }} style={{ fontSize: 12 }} />
                    </div>
                  )}
                </div>
                {/* Croqui geral */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: TEXT }}>
                    <input type="checkbox" checked={usaCroquiGeral} onChange={e => setUsaCroquiGeral(e.target.checked)} />
                    Incluir croqui geral de localização dos elementos
                  </label>
                  {usaCroquiGeral && (
                    <div style={{ marginTop: 8 }}>
                      <input type="file" accept="image/*" onChange={e => { if (e.target.files?.[0]) setCroquiFile(e.target.files[0]); }} style={{ fontSize: 12 }} />
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Responsável */}
            <section style={{ background: '#fff', borderRadius: 10, border: `1px solid ${BORDER}`, padding: '20px 24px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 11, fontWeight: 800, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Responsável Técnico</h3>
              <div style={{ padding: '12px 14px', background: '#F0F4FF', borderRadius: 8, border: `1px solid #BFCBF0`, marginBottom: 14 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: PRIMARY }}>{userName || '—'}</p>
                <p style={{ margin: '3px 0 0', fontSize: 11, color: SUBTEXT }}>CREA: {userCrea || 'não informado'} · {userCargo || ''}</p>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: outroResp ? 14 : 0 }}>
                <input type="checkbox" checked={outroResp} onChange={e => setOutroResp(e.target.checked)} />
                Usar outro responsável técnico
              </label>
              {outroResp && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                  <Campo label="Nome completo" htmlFor="or-nome"><input id="or-nome" style={inputStyle} value={outroRespNome} onChange={e => setOutroRespNome(e.target.value)} /></Campo>
                  <Campo label="CREA" htmlFor="or-crea"><input id="or-crea" style={inputStyle} value={outroRespCrea} onChange={e => setOutroRespCrea(e.target.value)} /></Campo>
                  <div style={{ gridColumn: '1/-1' }}>
                    <Campo label="Assinatura (imagem)">
                      <input ref={outroAssinaturaRef} type="file" accept="image/*" style={{ fontSize: 12 }} onChange={e => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setOutroRespFile(f);
                        setOutroRespPreview(URL.createObjectURL(f));
                      }} />
                      {outroRespPreview && <img src={outroRespPreview} alt="Assinatura" style={{ marginTop: 8, height: 40, objectFit: 'contain' }} />}
                    </Campo>
                  </div>
                </div>
              )}
            </section>

            {/* Notas */}
            <section style={{ background: '#fff', borderRadius: 10, border: `1px solid ${BORDER}`, padding: '20px 24px' }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 800, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Notas do Relatório</h3>
              <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }} value={cab.notas} onChange={e => setCab(p => ({ ...p, notas: e.target.value }))} placeholder="Observações gerais, condições de ensaio..." />
            </section>
          </div>
        )}

        {/* ── ABA 2: DADOS DE CAMPO ── */}
        {aba === 'campo' && (
          <div>
            {/* Botão nova amostra */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: TEXT }}>Amostras de Pacometria</h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: SUBTEXT }}>{amostras.length} amostra{amostras.length !== 1 ? 's' : ''} registrada{amostras.length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => { setAmostraEditando(null); setModalAberto(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: PRIMARY, color: '#fff', border: 'none' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Nova Amostra
              </button>
            </div>

            {amostras.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: SUBTEXT }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={BORDER} strokeWidth="1.5" style={{ marginBottom: 12 }}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Nenhuma amostra registrada</p>
                <p style={{ margin: '4px 0 0', fontSize: 12 }}>Clique em "Nova Amostra" para começar</p>
              </div>
            )}

            {/* Tabela — desktop */}
            {amostras.length > 0 && (
              <div className="amostras-table-section">
                <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: EXCEL_BLUE }}>
                        {['Item', 'Elemento', 'Tipo / Opção', 'Médio', 'Mínimo', 'Máximo', 'Desv. Padrão', 'CV (%)', 'Moda', 'Foto', 'Ações'].map(h => (
                          <th key={h} style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#fff', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {amostras.map((a, i) => (
                        <tr key={a.id} style={{ borderBottom: `1px solid ${BORDER}`, background: i % 2 === 0 ? '#fff' : '#FAFBFD' }}>
                          <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: SUBTEXT, width: 48 }}>{a.item}</td>
                          <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: TEXT }}>{a.elemento}</td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: SUBTEXT }}>
                            <span style={{ fontWeight: 600, color: TEXT }}>{a.tipo.charAt(0).toUpperCase() + a.tipo.slice(1)}</span>
                            <span style={{ marginLeft: 6, fontSize: 11, background: '#EEF2FF', color: PRIMARY, borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>Opção {a.opcao}</span>
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: a.cobMedio !== null ? TEXT : SUBTEXT }}>
                            {a.cobMedio !== null ? `${a.cobMedio.toFixed(1)} mm` : '—'}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {a.cobMinimo !== null ? (
                              <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: a.cobMinimo < 20 ? '#FFF0EE' : '#E8F5EE', color: a.cobMinimo < 20 ? DANGER : SUCCESS, border: `1px solid ${a.cobMinimo < 20 ? '#FADADD' : '#B8DFC8'}` }}>
                                {a.cobMinimo.toFixed(0)} mm
                              </span>
                            ) : <span style={{ color: SUBTEXT }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 13, color: a.cobMaximo !== null ? TEXT : SUBTEXT }}>
                            {a.cobMaximo !== null ? `${a.cobMaximo.toFixed(0)} mm` : '—'}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 13, color: a.cobDesvio !== null ? TEXT : SUBTEXT }}>
                            {a.cobDesvio !== null ? `${a.cobDesvio.toFixed(1)} mm` : '—'}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 13, color: a.cobCV !== null ? (a.cobCV > 20 ? DANGER : a.cobCV > 10 ? '#B45309' : SUCCESS) : SUBTEXT }}>
                            {a.cobCV !== null ? `${a.cobCV.toFixed(1)}%` : '—'}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 13, color: a.cobModa !== null ? TEXT : SUBTEXT }}>
                            {a.cobModa !== null ? `${a.cobModa} mm` : '—'}
                          </td>
                          {/* Célula foto */}
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {a.fotoPreview ? (
                                <>
                                  <img src={a.fotoPreview} alt="foto" style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover', border: `1px solid ${BORDER}` }} />
                                  <button onClick={() => removerFoto(a.id)} aria-label="Remover foto" style={{ width: 22, height: 22, borderRadius: 4, border: 'none', background: '#FFF0EE', color: DANGER, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <input ref={el => { fotoRefs.current[a.id] = el; }} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleFoto(a.id, e.target.files[0]); }} />
                                  <button onClick={() => fotoRefs.current[a.id]?.click()} aria-label="Anexar foto" style={{ width: 32, height: 32, borderRadius: 6, border: `1px dashed ${BORDER}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUBTEXT }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                          {/* Ações */}
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', gap: 5 }}>
                              <button onClick={() => editarAmostra(a)} aria-label="Editar amostra" style={{ width: 30, height: 30, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#EEF1F8', color: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <button onClick={() => apagarAmostra(a.id)} aria-label="Apagar amostra" style={{ width: 30, height: 30, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#FFF0EE', color: DANGER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Cards — mobile */}
            {amostras.length > 0 && (
              <div className="amostras-cards-section" style={{ flexDirection: 'column', gap: 10 }}>
                {amostras.map(a => (
                  <div key={a.id} style={{ background: '#fff', borderRadius: 10, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: SUBTEXT }}>#{a.item}</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: TEXT }}>{a.elemento}</span>
                        <span style={{ fontSize: 10, background: '#EEF2FF', color: PRIMARY, borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>Opção {a.opcao}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button onClick={() => editarAmostra(a)} aria-label="Editar" style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: '#EEF1F8', color: PRIMARY, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onClick={() => apagarAmostra(a.id)} aria-label="Apagar" style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: '#FFF0EE', color: DANGER, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, fontSize: 12, color: SUBTEXT, flexWrap: 'wrap' }}>
                      <span>Médio: <strong style={{ color: TEXT }}>{a.cobMedio !== null ? `${a.cobMedio.toFixed(1)} mm` : '—'}</strong></span>
                      <span>Mín: <strong style={{ color: a.cobMinimo !== null && a.cobMinimo < 20 ? DANGER : TEXT }}>{a.cobMinimo !== null ? `${a.cobMinimo.toFixed(0)} mm` : '—'}</strong></span>
                      <span>Máx: <strong style={{ color: TEXT }}>{a.cobMaximo !== null ? `${a.cobMaximo.toFixed(0)} mm` : '—'}</strong></span>
                      <span>CV: <strong style={{ color: a.cobCV !== null && a.cobCV > 20 ? DANGER : TEXT }}>{a.cobCV !== null ? `${a.cobCV.toFixed(1)}%` : '—'}</strong></span>
                    </div>
                    {/* Foto mobile */}
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {a.fotoPreview ? (
                        <>
                          <img src={a.fotoPreview} alt="foto" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', border: `1px solid ${BORDER}` }} />
                          <button onClick={() => removerFoto(a.id)} style={{ fontSize: 11, color: DANGER, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Remover foto</button>
                        </>
                      ) : (
                        <>
                          <input ref={el => { fotoRefs.current[a.id + '_m'] = el; }} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleFoto(a.id, e.target.files[0]); }} />
                          <button onClick={() => fotoRefs.current[a.id + '_m']?.click()} style={{ fontSize: 11, color: PRIMARY, background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                            Anexar foto
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Botão gerar DOCX */}
            {amostras.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
                <button onClick={gerarDocx} disabled={gerandoDocx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 28px', borderRadius: 9, fontSize: 14, fontWeight: 800, cursor: gerandoDocx ? 'not-allowed' : 'pointer', fontFamily: 'inherit', background: gerandoDocx ? SUBTEXT : PRIMARY, color: '#fff', border: 'none', boxShadow: '0 2px 10px rgba(30,50,100,0.2)' }}>
                  {gerandoDocx ? (
                    <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Gerando...</>
                  ) : (
                    <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>Gerar DOCX Oficial</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── ABA 3: MODO OBRA ── */}
        {aba === 'obra' && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: SUBTEXT }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={BORDER} strokeWidth="1.5" style={{ marginBottom: 12 }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Modo Obra</p>
            <p style={{ margin: '4px 0 0', fontSize: 12 }}>A ser implementado seguindo o padrão dos outros módulos</p>
          </div>
        )}

      </main>

      {/* Modal de amostra */}
      {modalAberto && (
        <ModalAmostra
          amostraInicial={amostraEditando}
          onSalvar={salvarAmostra}
          onFechar={() => { setModalAberto(false); setAmostraEditando(null); }}
          itemNum={amostras.length + 1}
        />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}