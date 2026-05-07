'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Paleta TECOMAT ────────────────────────────────────────────────
const PRIMARY  = '#1E3264';
const GOLD     = '#C8A020';
const BG       = '#F8F9FA';
const BORDER   = '#E8EAF0';
const TEXT     = '#1A2340';
const SUBTEXT  = '#6B7490';
const SUCCESS  = '#1A7A44';
const DANGER   = '#C0392B';
// Azul do modelo Excel (cabeçalho da tabela)
const EXCEL_BLUE = '#002060';

// ── Tipos ─────────────────────────────────────────────────────────
type Posicao = '0°' | '+90°' | '-90°';

type AmostraRow = {
  id: string;
  item: number;
  amostra: string;
  posicao: Posicao;
  limInf: number | null;
  limSup: number | null;
  ieMedio: number | null;
  status: 'Amostra Válida' | 'Amostra Perdida';
  ieEfetivo: number | null;
  resistencia: number | null;
  dispersao: string;
  impactosRaw: string[];
};

type Cabecalho = {
  rlt: string;
  data: string;
  cliente: string;
  obra: string;
  att: string;
  endereco: string;
  respNome: string;
  respCrea: string;
  notas: string;
  bigorna: string[];
};

const POSICOES: Posicao[] = ['0°', '+90°', '-90°'];
const LS_KEY = 'tecomat_esclerometria_v1';

// ── Cálculo (portado 1:1 do .py) ─────────────────────────────────
function calcularAmostra(
  amostra: string,
  posicao: Posicao,
  impactosStr: string[],
  coefBigorna: number,
  item: number
): AmostraRow {
  const id = typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Math.random());
  const validos = impactosStr
    .map(v => parseFloat(v.replace(',', '.')))
    .filter(v => !isNaN(v) && v > 0);

  if (validos.length === 0) {
    return { id, item, amostra, posicao, limInf: null, limSup: null, ieMedio: null,
      status: 'Amostra Perdida', ieEfetivo: null, resistencia: null, dispersao: '-', impactosRaw: impactosStr };
  }

  const mediaBruta = validos.reduce((a, b) => a + b, 0) / validos.length;
  const limInf = mediaBruta * 0.90;
  const limSup = mediaBruta * 1.10;
  const filtrados = validos.filter(v => v >= limInf && v <= limSup);

  if (filtrados.length < 5) {
    return { id, item, amostra, posicao, limInf, limSup, ieMedio: null,
      status: 'Amostra Perdida', ieEfetivo: null, resistencia: null, dispersao: '-', impactosRaw: impactosStr };
  }

  const ieMedio = filtrados.reduce((a, b) => a + b, 0) / filtrados.length;
  const ieEfetivo = ieMedio * coefBigorna;

  let resistencia: number;
  let dispersao: string;

  if (posicao === '0°') {
    resistencia = (0.0089 * ieEfetivo ** 2) + (1.111 * ieEfetivo) - 15.78;
    dispersao = ieEfetivo <= 26 ? '±4,5' : ieEfetivo <= 32 ? '±6,0' : ieEfetivo <= 38 ? '±6,5' : ieEfetivo <= 44 ? '±7,0' : '±7,5';
  } else if (posicao === '+90°') {
    resistencia = (0.0099 * ieEfetivo ** 2) + (1.063 * ieEfetivo) - 24.31;
    dispersao = ieEfetivo <= 29 ? '±4,5' : ieEfetivo <= 38 ? '±6,0' : ieEfetivo <= 43 ? '±6,5' : ieEfetivo <= 48 ? '±7,0' : '±7,5';
  } else {
    resistencia = (0.0133 * ieEfetivo ** 2) + (0.800 * ieEfetivo) - 5.33;
    dispersao = ieEfetivo <= 23 ? '±4,5' : ieEfetivo <= 29 ? '±6,0' : ieEfetivo <= 35 ? '±6,5' : ieEfetivo <= 41 ? '±7,0' : '±7,5';
  }

  return { id, item, amostra, posicao, limInf, limSup, ieMedio,
    status: 'Amostra Válida', ieEfetivo, resistencia, dispersao, impactosRaw: impactosStr };
}

function fmt(v: number | null, dec = 2): string {
  if (v === null) return '—';
  return v.toFixed(dec);
}

function salvarLocal(cab: Cabecalho, amostras: AmostraRow[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ cab, amostras })); } catch {}
}
function carregarLocal(): { cab: Cabecalho; amostras: AmostraRow[] } | null {
  try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}

// ── Sub-componentes ───────────────────────────────────────────────
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 7, border: `1.5px solid ${BORDER}`,
  fontSize: 14, fontFamily: 'inherit', color: TEXT, background: '#fff',
  outline: 'none', width: '100%', boxSizing: 'border-box', transition: 'border-color 0.15s',
};

function StatusBadge({ status }: { status: AmostraRow['status'] }) {
  const ok = status === 'Amostra Válida';
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
      background: ok ? '#E8F5EE' : '#FFF0EE', color: ok ? SUCCESS : DANGER,
      border: `1px solid ${ok ? '#B8DFC8' : '#FADADD'}`, whiteSpace: 'nowrap',
    }}>
      {ok ? '✓ Válida' : '✗ Perdida'}
    </span>
  );
}

function Header({ displayName, initials, cargo, onSignOut }: {
  displayName: string; initials: string; cargo: string; onSignOut: () => void;
}) {
  return (
    <header style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      height: 60, padding: '0 28px', backgroundColor: PRIMARY,
      boxShadow: '0 2px 12px rgba(30,50,100,0.25)', position: 'sticky', top: 0, zIndex: 50,
    }}>
      <style>{`.sb-u:hover{background:rgba(255,255,255,0.12)!important}.nv-u:hover{color:#fff!important}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src="/logo_tecomat.png" alt="TECOMAT" style={{ height: 34, objectFit: 'contain' }} />
        </a>
        <nav style={{ display: 'flex', gap: 6 }}>
          <a href="/dashboard" className="nv-u" style={{ fontSize: 13, fontWeight: 600, color: '#fff', textDecoration: 'none', padding: '4px 10px', borderRadius: 6, borderBottom: `2px solid ${GOLD}`, paddingBottom: 5 }}>Ensaios</a>
          <a href="/usuarios" className="nv-u" style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.65)', textDecoration: 'none', padding: '4px 10px', borderRadius: 6, transition: 'color 0.15s' }}>Usuários</a>
        </nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: GOLD, color: PRIMARY, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.25)' }}>{initials}</div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: 0 }}>{displayName}</p>
            {cargo && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '2px 0 0' }}>{cargo}</p>}
          </div>
        </div>
        <div style={{ width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.15)' }} />
        <button className="sb-u" onClick={onSignOut} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sair
        </button>
      </div>
    </header>
  );
}

// ══════════════════════════════════════════════════════════════════
// GERADOR DE PDF — fiel ao Modelo_esclerometria.xlsx
// ══════════════════════════════════════════════════════════════════
async function gerarPDFOficial(
  cab: Cabecalho,
  amostras: AmostraRow[],
  mediaBigorna: number,
  coefBigorna: number,
  rltOficial: string
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210;
  const ML = 10, MR = 10;

  // Cores do modelo
  const azulEscuro: [number, number, number] = [0, 32, 96];    // #002060
  const azulMedio: [number, number, number]  = [30, 50, 100];  // #1E3264 (linhas)
  const cinzaClaro: [number, number, number] = [242, 242, 242];
  const branco: [number, number, number]     = [255, 255, 255];
  const preto: [number, number, number]      = [0, 0, 0];
  const verdeOk: [number, number, number]    = [26, 122, 68];
  const vermelhoPerdida: [number, number, number] = [192, 57, 43];

  // ── Logo TECOMAT (base64 embutida) ──────────────────────────────
  // Busca a logo do servidor Next.js como fallback
  const logoUrl = '/logo_tecomat.png';

  const carregarImagem = (url: string): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        canvas.getContext('2d')!.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve('');
      img.src = url;
    });

  const logoData = await carregarImagem(logoUrl);

  // ── Função utilitária para linha horizontal ─────────────────────
  const hLine = (y: number, x1 = ML, x2 = PW - MR, lw = 0.3, color: [number,number,number] = [180,185,200]) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(lw);
    doc.line(x1, y, x2, y);
  };

  const vLine = (x: number, y1: number, y2: number, lw = 0.3, color: [number,number,number] = [180,185,200]) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(lw);
    doc.line(x, y1, x, y2);
  };

  const rect = (x: number, y: number, w: number, h: number, fill: [number,number,number], stroke?: [number,number,number]) => {
    doc.setFillColor(...fill);
    if (stroke) { doc.setDrawColor(...stroke); doc.setLineWidth(0.4); doc.rect(x, y, w, h, 'FD'); }
    else doc.rect(x, y, w, h, 'F');
  };

  // Texto
  const txt = (text: string, x: number, y: number, opts: {
    size?: number; bold?: boolean; color?: [number,number,number];
    align?: 'left'|'center'|'right'; maxWidth?: number;
  } = {}) => {
    doc.setFontSize(opts.size ?? 9);
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setTextColor(...(opts.color ?? preto));
    doc.text(text, x, y, { align: opts.align ?? 'left', maxWidth: opts.maxWidth });
  };

  // ────────────────────────────────────────────────────────────────
  // CABEÇALHO — replicado do Excel
  // ────────────────────────────────────────────────────────────────
  const drawCabecalho = (paginaAtual: number, totalPaginas: number) => {
    // Fundo azul escuro do cabeçalho
    rect(ML, 8, PW - ML - MR, 30, azulEscuro);

    // Logo
    if (logoData) {
      doc.addImage(logoData, 'PNG', ML + 2, 10, 38, 13);
    } else {
      txt('TECOMAT ENGENHARIA', ML + 3, 18, { size: 11, bold: true, color: branco });
    }

    // Título "ENSAIO DE ESCLEROMETRIA"
    txt('ENSAIO DE ESCLEROMETRIA', PW / 2, 16, { size: 13, bold: true, color: branco, align: 'center' });
    txt('NBR 7584:2012', PW / 2, 22, { size: 8, color: [200, 210, 230], align: 'center' });

    // Caixa RLT (direita)
    rect(PW - MR - 42, 10, 42, 8, [0, 20, 70]);
    txt('Nº DO LAUDO', PW - MR - 41, 14.5, { size: 6, bold: true, color: [180, 190, 215] });
    txt(rltOficial, PW - MR - 21, 17.5, { size: 7.5, bold: true, color: branco, align: 'center' });

    // Caixa Página
    rect(PW - MR - 42, 20, 42, 8, [0, 20, 70]);
    txt('PÁGINA', PW - MR - 41, 24.5, { size: 6, bold: true, color: [180, 190, 215] });
    txt(`${paginaAtual} / ${totalPaginas}`, PW - MR - 21, 27.5, { size: 7.5, bold: true, color: branco, align: 'center' });

    // Linha dourada
    doc.setFillColor(200, 160, 32);
    doc.rect(ML, 38, PW - ML - MR, 1.2, 'F');
  };

  // ────────────────────────────────────────────────────────────────
  // BLOCO DADOS DA OBRA (logo abaixo do cabeçalho)
  // ────────────────────────────────────────────────────────────────
  const drawDadosObra = (startY: number): number => {
    let y = startY;

    // Borda externa da seção
    doc.setDrawColor(180, 185, 200);
    doc.setLineWidth(0.4);
    doc.rect(ML, y, PW - ML - MR, 28, 'S');

    // Faixa do título
    rect(ML, y, PW - ML - MR, 5.5, cinzaClaro);
    txt('DADOS DA OBRA E CLIENTE', ML + 3, y + 3.8, { size: 7, bold: true, color: azulEscuro });
    hLine(y + 5.5, ML, PW - MR, 0.3, [180, 185, 200]);

    y += 7;

    // Linha 1: Cliente | Data de Emissão
    txt('CLIENTE:', ML + 2, y + 3.2, { size: 7, bold: true, color: [80, 90, 120] });
    txt(cab.cliente || '—', ML + 18, y + 3.2, { size: 8.5, maxWidth: 110 });
    txt('DATA DE EMISSÃO:', PW - MR - 48, y + 3.2, { size: 7, bold: true, color: [80, 90, 120] });
    txt(cab.data || '—', PW - MR - 10, y + 3.2, { size: 8.5, align: 'right' });
    hLine(y + 5, ML, PW - MR, 0.2, [220, 223, 230]);
    y += 5.5;

    // Linha 2: Obra
    txt('OBRA:', ML + 2, y + 3.2, { size: 7, bold: true, color: [80, 90, 120] });
    txt(cab.obra || '—', ML + 18, y + 3.2, { size: 8.5, maxWidth: 140 });
    hLine(y + 5, ML, PW - MR, 0.2, [220, 223, 230]);
    y += 5.5;

    // Linha 3: Att | Endereço
    txt('A/C:', ML + 2, y + 3.2, { size: 7, bold: true, color: [80, 90, 120] });
    txt(cab.att || '—', ML + 18, y + 3.2, { size: 8.5, maxWidth: 55 });
    vLine(ML + 80, y, y + 5, 0.2, [220, 223, 230]);
    txt('ENDEREÇO:', ML + 82, y + 3.2, { size: 7, bold: true, color: [80, 90, 120] });
    txt(cab.endereco || '—', ML + 100, y + 3.2, { size: 8.5, maxWidth: 80 });
    hLine(y + 5, ML, PW - MR, 0.2, [220, 223, 230]);
    y += 5.5;

    // Linha 4: Norma | Responsável
    txt('NORMA:', ML + 2, y + 3.2, { size: 7, bold: true, color: [80, 90, 120] });
    txt('NBR 7584:2012 — Concreto endurecido — Esclerômetro de reflexão', ML + 18, y + 3.2, { size: 7.5, maxWidth: 110 });
    vLine(ML + 135, y, y + 5, 0.2, [220, 223, 230]);
    txt('RESPONSÁVEL:', ML + 137, y + 3.2, { size: 7, bold: true, color: [80, 90, 120] });
    txt(`${cab.respNome || '—'}  |  CREA: ${cab.respCrea || '—'}`, ML + 158, y + 3.2, { size: 7.5, maxWidth: 30, align: 'right' });

    return startY + 29;
  };

  // ────────────────────────────────────────────────────────────────
  // VERIFICAÇÃO DA BIGORNA
  // ────────────────────────────────────────────────────────────────
  const drawBigorna = (startY: number): number => {
    let y = startY;

    doc.setDrawColor(180, 185, 200);
    doc.setLineWidth(0.4);
    doc.rect(ML, y, PW - ML - MR, 20, 'S');

    rect(ML, y, PW - ML - MR, 5.5, cinzaClaro);
    txt('VERIFICAÇÃO DO APARELHO — ÍNDICE ESCLEROMÉTRICO DA BIGORNA', ML + 3, y + 3.8, { size: 7, bold: true, color: azulEscuro });
    hLine(y + 5.5, ML, PW - MR, 0.3, [180, 185, 200]);

    y += 7;

    // Cabeçalhos dos golpes
    const golpeW = 14;
    const startX = ML + 3;
    txt('GOLPE', startX, y + 2.5, { size: 6.5, bold: true, color: [80, 90, 120] });
    for (let i = 0; i < 10; i++) {
      txt(`${i + 1}°`, startX + 18 + i * golpeW, y + 2.5, { size: 7, bold: true, align: 'center' });
    }
    txt('MÉDIA', startX + 18 + 10 * golpeW + 3, y + 2.5, { size: 7, bold: true });
    txt('COEF. CORREÇÃO', PW - MR - 2, y + 2.5, { size: 7, bold: true, align: 'right' });
    hLine(y + 4, ML, PW - MR, 0.2, [210, 214, 220]);
    y += 5;

    // Valores dos golpes
    txt('VALOR', startX, y + 2.5, { size: 6.5, color: [80, 90, 120] });
    for (let i = 0; i < 10; i++) {
      const v = cab.bigorna[i];
      const num = parseFloat(v.replace(',', '.'));
      txt(isNaN(num) ? '—' : num.toFixed(1), startX + 18 + i * golpeW, y + 2.5, { size: 8, bold: true, align: 'center' });
    }
    txt(mediaBigorna > 0 ? mediaBigorna.toFixed(2) : '—', startX + 18 + 10 * golpeW + 3, y + 2.5, { size: 8, bold: true, color: azulEscuro });
    txt(coefBigorna !== 1.0 ? coefBigorna.toFixed(6) : '1,0000', PW - MR - 2, y + 2.5, { size: 8, bold: true, color: azulEscuro, align: 'right' });

    return startY + 21;
  };

  // ────────────────────────────────────────────────────────────────
  // TABELA DE RESULTADOS (autoTable)
  // ────────────────────────────────────────────────────────────────
  const drawTabela = (startY: number, paginaAtual: number, totalPaginas: number) => {
    // Título da seção
    rect(ML, startY, PW - ML - MR, 6, cinzaClaro);
    doc.setDrawColor(180, 185, 200); doc.setLineWidth(0.4);
    doc.rect(ML, startY, PW - ML - MR, 6, 'S');
    txt('RESULTADOS DE ENSAIO — Tabela 1: Estimativa da Resistência à Compressão Superficial (MPa)', ML + 3, startY + 4, { size: 7, bold: true, color: azulEscuro });

    const linhas = amostras.map(a => [
      String(a.item),
      a.amostra,
      a.posicao,
      fmt(a.limInf),
      fmt(a.limSup),
      fmt(a.ieMedio),
      a.status === 'Amostra Válida' ? 'VÁLIDA' : 'PERDIDA',
      fmt(a.ieEfetivo),
      fmt(a.resistencia),
      a.dispersao,
    ]);

    autoTable(doc, {
      head: [[
        'Nº', 'ELEMENTO', 'POSIÇÃO\nESCLERÔMETRO',
        'LIM.\nINF.', 'LIM.\nSUP.', 'I.E.\nMÉDIO',
        'STATUS', 'I.E. MÉDIO\nEFETIVO', 'RESIST. COMPR.\nESTIMADA (MPa)', 'DISP.\n(MPa)',
      ]],
      body: linhas,
      startY: startY + 6,
      margin: { left: ML, right: MR },
      tableWidth: PW - ML - MR,
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 2, bottom: 2, left: 1.5, right: 1.5 },
        font: 'helvetica',
        textColor: preto,
        lineColor: [200, 205, 215],
        lineWidth: 0.2,
        valign: 'middle',
      },
      headStyles: {
        fillColor: azulEscuro,
        textColor: branco,
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'center',
        minCellHeight: 10,
        valign: 'middle',
      },
      alternateRowStyles: { fillColor: [247, 249, 253] },
      columnStyles: {
        0:  { halign: 'center', cellWidth: 8 },
        1:  { cellWidth: 42 },
        2:  { halign: 'center', cellWidth: 20 },
        3:  { halign: 'center', cellWidth: 14 },
        4:  { halign: 'center', cellWidth: 14 },
        5:  { halign: 'center', cellWidth: 14 },
        6:  { halign: 'center', cellWidth: 18 },
        7:  { halign: 'center', cellWidth: 18 },
        8:  { halign: 'center', cellWidth: 24 },
        9:  { halign: 'center', cellWidth: 14 },
      },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 6) {
          const v = data.cell.raw as string;
          data.cell.styles.textColor = v === 'VÁLIDA' ? verdeOk : vermelhoPerdida;
          data.cell.styles.fontStyle = 'bold';
        }
      },
      didDrawPage: (data: any) => {
        const pg = doc.getCurrentPageInfo().pageNumber;
        drawCabecalho(pg, totalPaginas);
        // Rodapé
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 155, 170);
        doc.text(
          `TECOMAT Engenharia  •  Ensaio de Esclerometria  •  ${rltOficial}`,
          PW / 2, 290, { align: 'center' }
        );
        hLine(288, ML, PW - MR, 0.3, [200, 205, 215]);
      },
    });

    return (doc as any).lastAutoTable.finalY as number;
  };

  // ────────────────────────────────────────────────────────────────
  // RODAPÉ: NOTAS + RESPONSÁVEL
  // ────────────────────────────────────────────────────────────────
  const drawRodape = (startY: number) => {
    const available = 282 - startY;
    if (available < 15) { doc.addPage(); startY = 46; }

    let y = startY + 3;

    doc.setDrawColor(180, 185, 200);
    doc.setLineWidth(0.4);
    doc.rect(ML, startY, PW - ML - MR, Math.min(available - 3, 30), 'S');

    rect(ML, startY, PW - ML - MR, 5.5, cinzaClaro);
    txt('NOTAS / OBSERVAÇÕES', ML + 3, startY + 3.8, { size: 7, bold: true, color: azulEscuro });
    hLine(startY + 5.5, ML, PW - MR, 0.3, [180, 185, 200]);

    y = startY + 8;
    if (cab.notas.trim()) {
      const linhasNotas = doc.splitTextToSize(cab.notas, PW - ML - MR - 4);
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
      doc.text(linhasNotas, ML + 3, y);
      y += linhasNotas.length * 4 + 4;
    }

    // Assinatura
    const assinaturaX = PW - MR - 70;
    vLine(assinaturaX, startY + 5.5, startY + Math.min(available - 3, 30), 0.3, [180, 185, 200]);
    txt('RESPONSÁVEL TÉCNICO', assinaturaX + 5, startY + 9, { size: 7, bold: true, color: [80, 90, 120] });

    hLine(startY + 20, assinaturaX + 3, PW - MR - 3, 0.5, [100, 110, 130]);
    txt(cab.respNome || '—', (assinaturaX + PW - MR) / 2, startY + 24, { size: 8, bold: true, align: 'center' });
    txt(`CREA: ${cab.respCrea || '—'}`, (assinaturaX + PW - MR) / 2, startY + 28, { size: 7.5, align: 'center', color: [80, 90, 120] });
  };

  // ────────────────────────────────────────────────────────────────
  // MONTAR DOCUMENTO
  // ────────────────────────────────────────────────────────────────
  // Estimar total de páginas
  const linhasPorPagina1 = Math.floor((282 - 46 - 29 - 21 - 6 - 10 - 30) / 7.5);
  const linhasRestantes = amostras.length - linhasPorPagina1;
  const paginasExtras = linhasRestantes > 0 ? Math.ceil(linhasRestantes / Math.floor((282 - 46 - 6) / 7.5)) : 0;
  const totalPaginas = 1 + paginasExtras;

  // Página 1
  drawCabecalho(1, totalPaginas);

  let y = 42;
  y = drawDadosObra(y) + 3;
  y = drawBigorna(y) + 3;
  const finalTabelaY = drawTabela(y, 1, totalPaginas);
  drawRodape(finalTabelaY + 4);

  // Rodapé página 1
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 155, 170);
  doc.text(`TECOMAT Engenharia  •  Ensaio de Esclerometria  •  ${rltOficial}`, PW / 2, 290, { align: 'center' });
  hLine(288, ML, PW - MR, 0.3, [200, 205, 215]);

  doc.save(`${rltOficial}.pdf`);
}

// ══════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ══════════════════════════════════════════════════════════════════
export default function EsclerometriaPage() {
  const router = useRouter();
  const [userName, setUserName]   = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userCargo, setUserCargo] = useState('');
  const [aba, setAba]             = useState<'cabecalho' | 'campo'>('cabecalho');

  const [cab, setCab] = useState<Cabecalho>({
    rlt: '', data: '', cliente: '', obra: '', att: '', endereco: '',
    respNome: '', respCrea: '', notas: '', bigorna: Array(10).fill(''),
  });

  const [mediaBigorna, setMediaBigorna] = useState(0);
  const [coefBigorna,  setCoefBigorna]  = useState(1.0);

  const [amostras,    setAmostras]    = useState<AmostraRow[]>([]);
  const [editandoId,  setEditandoId]  = useState<string | null>(null);
  const [nomeAmostra, setNomeAmostra] = useState('');
  const [posicao,     setPosicao]     = useState<Posicao>('0°');
  const [impactos,    setImpactos]    = useState<string[]>(Array(16).fill(''));
  const [gerandoPdf,  setGerandoPdf]  = useState(false);
  const [salvoMsg,    setSalvoMsg]    = useState('');

  const impactoRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Usuário ──────────────────────────────────────────────────────
  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      setUserEmail(user.email ?? '');
      const m = user.user_metadata ?? {};
      setUserName(m.full_name ?? m.name ?? user.email ?? '');
      setUserCargo(m.cargo ?? '');
    });
  }, [router]);

  // ── Carregar localStorage ────────────────────────────────────────
  useEffect(() => {
    const saved = carregarLocal();
    if (!saved) return;
    setCab(saved.cab);
    setAmostras(saved.amostras);
    recalcularBigorna(saved.cab.bigorna);
  }, []);

  // ── Auto-save ────────────────────────────────────────────────────
  useEffect(() => {
    salvarLocal(cab, amostras);
    setSalvoMsg('Salvo');
    const t = setTimeout(() => setSalvoMsg(''), 1800);
    return () => clearTimeout(t);
  }, [cab, amostras]);

  const handleSignOut = async () => {
    localStorage.removeItem(LS_KEY);
    const sb = createClient();
    await sb.auth.signOut();
    router.push('/login');
  };

  // ── Bigorna ──────────────────────────────────────────────────────
  const recalcularBigorna = useCallback((vals: string[]) => {
    const nums = vals.map(v => parseFloat(v.replace(',', '.'))).filter(v => !isNaN(v) && v > 0);
    if (nums.length === 0) { setMediaBigorna(0); setCoefBigorna(1.0); return; }
    const media = nums.reduce((a, b) => a + b, 0) / nums.length;
    setMediaBigorna(media);
    setCoefBigorna(media > 0 ? 80 / media : 1.0);
  }, []);

  const setBigorna = (i: number, v: string) => {
    const novo = [...cab.bigorna]; novo[i] = v;
    setCab(c => ({ ...c, bigorna: novo }));
    recalcularBigorna(novo);
  };

  // ── Amostras ─────────────────────────────────────────────────────
  const processarAmostra = () => {
    if (!nomeAmostra.trim() || !impactos.some(v => v.trim())) return;
    if (editandoId) {
      setAmostras(prev => prev.map(a => {
        if (a.id !== editandoId) return a;
        return { ...calcularAmostra(nomeAmostra, posicao, impactos, coefBigorna, a.item), id: a.id, item: a.item };
      }));
      setEditandoId(null);
    } else {
      const item = amostras.length > 0 ? amostras[amostras.length - 1].item + 1 : 1;
      setAmostras(prev => [...prev, calcularAmostra(nomeAmostra, posicao, impactos, coefBigorna, item)]);
    }
    setNomeAmostra(''); setImpactos(Array(16).fill('')); setPosicao('0°');
    impactoRefs.current[0]?.focus();
  };

  const carregarParaEdicao = (a: AmostraRow) => {
    setNomeAmostra(a.amostra); setPosicao(a.posicao);
    setImpactos([...a.impactosRaw, ...Array(16).fill('')].slice(0, 16));
    setEditandoId(a.id); setAba('campo');
  };

  const apagarAmostra = (id: string) => {
    setAmostras(prev => prev.filter(a => a.id !== id).map((a, i) => ({ ...a, item: i + 1 })));
    if (editandoId === id) { setEditandoId(null); setNomeAmostra(''); setImpactos(Array(16).fill('')); }
  };

  const cancelarEdicao = () => {
    setEditandoId(null); setNomeAmostra(''); setImpactos(Array(16).fill('')); setPosicao('0°');
  };

  const limparTudo = () => {
    if (!confirm('Apagar TODOS os dados e começar do zero?')) return;
    setCab({ rlt: '', data: '', cliente: '', obra: '', att: '', endereco: '',
      respNome: '', respCrea: '', notas: '', bigorna: Array(10).fill('') });
    setAmostras([]); setCoefBigorna(1.0); setMediaBigorna(0);
    setNomeAmostra(''); setImpactos(Array(16).fill('')); setEditandoId(null);
    localStorage.removeItem(LS_KEY);
  };

  // ── Helpers de input controlado ──────────────────────────────────
  // Só números
  const onlyNumbers = (v: string) => v.replace(/\D/g, '');
  // Só números e vírgula/ponto (decimais)
  const onlyDecimal = (v: string) => v.replace(/[^\d,.']/g, '');
  // Máscara DD/MM/AAAA com barras automáticas
  const maskData = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0,2)}/${d.slice(2)}`;
    return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
  };

  // ── RLT formatado ─────────────────────────────────────────────────
  const rltOficial = (() => {
    const n = cab.rlt.trim();
    if (!n) return 'RLT.LAU-XXX.26-00';
    if (/^\d+$/.test(n)) return `RLT.LAU-${n.padStart(3, '0')}.26-00`;
    return `RLT.LAU-${n}.26-00`;
  })();

  // ── Iniciais ──────────────────────────────────────────────────────
  const initials = (() => {
    if (!userName) return userEmail.slice(0, 2).toUpperCase();
    const p = userName.trim().split(/\s+/);
    return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
  })();

  // ── Geração do PDF ────────────────────────────────────────────────
  const handleGerarPDF = async () => {
    if (amostras.length === 0) { alert('Nenhuma amostra na tabela.'); return; }
    setGerandoPdf(true);
    try {
      await gerarPDFOficial(cab, amostras, mediaBigorna, coefBigorna, rltOficial);
    } catch (e) {
      console.error(e);
      alert('Erro ao gerar PDF. Veja o console para detalhes.');
    } finally {
      setGerandoPdf(false);
    }
  };

  // ── Sumário ───────────────────────────────────────────────────────
  const validas  = amostras.filter(a => a.status === 'Amostra Válida');
  const perdidas = amostras.filter(a => a.status === 'Amostra Perdida');
  const fckMedia = validas.length > 0
    ? validas.reduce((s, a) => s + (a.resistencia ?? 0), 0) / validas.length
    : null;

  // ═════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════
  return (
    <div style={{ backgroundColor: BG, minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        input:focus, textarea:focus { outline: none; border-color: ${PRIMARY} !important; box-shadow: 0 0 0 3px rgba(30,50,100,0.07); }
        .tab-btn { transition: all 0.15s; border: none; background: transparent; }
        .tab-btn:hover { opacity: 0.8; }
        .row-h:hover { background: #F3F5FB !important; }
        .icon-btn:hover { filter: brightness(0.88); }
        .btn-pri:hover { box-shadow: 0 4px 16px rgba(30,50,100,0.3) !important; }
        .btn-gold:hover { background: #b08c18 !important; }
        .num-in:focus { border-color: ${PRIMARY} !important; background: #F0F4FC !important; }
      `}</style>

      <Header displayName={userName || userEmail} initials={initials} cargo={userCargo} onSignOut={handleSignOut} />

      <main style={{ maxWidth: 1060, margin: '0 auto', padding: '24px 20px' }}>

        {/* Breadcrumb + título */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <a href="/dashboard" style={{ fontSize: 12, color: SUBTEXT, textDecoration: 'none' }}>Ensaios</a>
            <span style={{ fontSize: 12, color: SUBTEXT }}>›</span>
            <span style={{ fontSize: 12, color: PRIMARY, fontWeight: 700 }}>Esclerometria</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ borderLeft: `4px solid ${GOLD}`, paddingLeft: 14 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Ensaio</p>
              <h1 style={{ margin: '3px 0 0', fontSize: 22, fontWeight: 800, color: TEXT }}>Esclerometria</h1>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: SUBTEXT }}>NBR 7584:2012 — Concreto endurecido</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {salvoMsg && (
                <span style={{ fontSize: 12, color: SUCCESS, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  {salvoMsg}
                </span>
              )}
              <button onClick={limparTudo} style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#FFF0EE', color: DANGER, border: `1px solid #FADADD` }}>
                🗑 Limpar Tudo
              </button>
              <button onClick={handleGerarPDF} disabled={gerandoPdf || amostras.length === 0} className="btn-gold" style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 7,
                fontSize: 13, fontWeight: 700, cursor: amostras.length === 0 ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', backgroundColor: GOLD, color: PRIMARY, border: 'none',
                opacity: amostras.length === 0 ? 0.5 : 1, transition: 'background 0.15s',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                {gerandoPdf ? 'Gerando…' : 'Gerar PDF Oficial'}
              </button>
            </div>
          </div>
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', borderBottom: `2px solid ${BORDER}`, marginBottom: 0 }}>
          {(['cabecalho', 'campo'] as const).map(a => (
            <button key={a} className="tab-btn" onClick={() => setAba(a)} style={{
              padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              color: aba === a ? PRIMARY : SUBTEXT,
              borderBottom: aba === a ? `3px solid ${GOLD}` : '3px solid transparent',
              marginBottom: -2,
            }}>
              {a === 'cabecalho' ? '1. Cabeçalho e Aparelho' : `2. Dados de Campo${amostras.length > 0 ? ` (${amostras.length})` : ''}`}
            </button>
          ))}
        </div>

        {/* ══ ABA 1: CABEÇALHO ══ */}
        {aba === 'cabecalho' && (
          <div style={{ paddingTop: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Dados da obra */}
            <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(30,50,100,0.04)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 800, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Dados da Obra e Cliente</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 150px 1fr', gap: '12px 16px', marginBottom: 12 }}>
                <Campo label="Nº do RLT">
                  <input
                    style={inputStyle} inputMode="numeric"
                    value={cab.rlt}
                    onChange={e => setCab(c => ({ ...c, rlt: onlyNumbers(e.target.value) }))}
                    placeholder="Ex: 42"
                    maxLength={6}
                  />
                </Campo>
                <Campo label="Data de Emissão">
                  <input
                    style={inputStyle} inputMode="numeric"
                    value={cab.data}
                    onChange={e => setCab(c => ({ ...c, data: maskData(e.target.value) }))}
                    placeholder="DD/MM/AAAA"
                    maxLength={10}
                  />
                </Campo>
                <Campo label="Cliente">
                  <input
                    style={{ ...inputStyle, textTransform: 'uppercase' }}
                    value={cab.cliente}
                    onChange={e => setCab(c => ({ ...c, cliente: e.target.value.toUpperCase() }))}
                    placeholder="NOME DO CLIENTE"
                  />
                </Campo>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: 12 }}>
                <Campo label="Obra">
                  <input
                    style={{ ...inputStyle, textTransform: 'uppercase' }}
                    value={cab.obra}
                    onChange={e => setCab(c => ({ ...c, obra: e.target.value.toUpperCase() }))}
                    placeholder="DESCRIÇÃO DA OBRA"
                  />
                </Campo>
                <Campo label="A/C (Att.)">
                  <input
                    style={{ ...inputStyle, textTransform: 'uppercase' }}
                    value={cab.att}
                    onChange={e => setCab(c => ({ ...c, att: e.target.value.toUpperCase() }))}
                    placeholder="A/C DE…"
                  />
                </Campo>
              </div>
              <Campo label="Endereço">
                <input
                  style={{ ...inputStyle, textTransform: 'uppercase' }}
                  value={cab.endereco}
                  onChange={e => setCab(c => ({ ...c, endereco: e.target.value.toUpperCase() }))}
                  placeholder="ENDEREÇO COMPLETO DA OBRA"
                />
              </Campo>
            </section>

            {/* Bigorna */}
            <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(30,50,100,0.04)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 800, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Verificação do Aparelho — 10 Golpes na Bigorna</h3>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: SUBTEXT }}>Índice de referência: <strong>IE = 80</strong>. O coeficiente de correção é calculado automaticamente.</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {cab.bigorna.map((v, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: SUBTEXT }}>{i + 1}°</span>
                    <input
                      type="text" inputMode="decimal" value={v}
                      onChange={e => setBigorna(i, onlyDecimal(e.target.value))}
                      className="num-in"
                      onKeyDown={e => {
                        if (e.key === 'Tab' && !e.shiftKey) {
                          e.preventDefault();
                          (document.querySelectorAll('.bigorna-input')[i + 1] as HTMLElement)?.focus();
                        } else if (e.key === 'Tab' && e.shiftKey) {
                          e.preventDefault();
                          (document.querySelectorAll('.bigorna-input')[i - 1] as HTMLElement)?.focus();
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          (document.querySelectorAll('.bigorna-input')[i + 1] as HTMLElement)?.focus();
                        }
                      }}
                      style={{ width: 52, textAlign: 'center', padding: '7px 4px', border: `1.5px solid ${v ? PRIMARY + '55' : BORDER}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', color: TEXT, background: v ? '#F0F4FC' : '#fff', outline: 'none', transition: 'all 0.1s' }}
                      className="num-in bigorna-input"
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 0, background: '#F0F4FC', borderRadius: 10, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
                {[
                  { label: 'Média dos Golpes', value: mediaBigorna > 0 ? mediaBigorna.toFixed(2) : '—', highlight: false },
                  { label: 'Coef. de Correção (80 / Média)', value: coefBigorna !== 1.0 ? coefBigorna.toFixed(6) : coefBigorna.toFixed(4), highlight: coefBigorna !== 1.0 },
                  { label: 'IE de Referência', value: '80,00', highlight: false },
                ].map((item, i) => (
                  <div key={i} style={{ flex: 1, padding: '14px 20px', borderLeft: i > 0 ? `1px solid ${BORDER}` : 'none' }}>
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800, color: item.highlight ? GOLD : PRIMARY }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Responsável */}
            <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(30,50,100,0.04)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 800, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Responsável Técnico TECOMAT</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 16 }}>
                <Campo label="Nome completo">
                  <input style={inputStyle} value={cab.respNome} onChange={e => setCab(c => ({ ...c, respNome: e.target.value }))} placeholder="Engenheiro responsável" />
                </Campo>
                <Campo label="CREA">
                  <input style={inputStyle} value={cab.respCrea} onChange={e => setCab(c => ({ ...c, respCrea: e.target.value }))} placeholder="Nº CREA" />
                </Campo>
              </div>
            </section>

            {/* Notas */}
            <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(30,50,100,0.04)' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 800, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Notas / Observações</h3>
              <textarea value={cab.notas} onChange={e => setCab(c => ({ ...c, notas: e.target.value }))} rows={3}
                placeholder="Observações gerais sobre o ensaio…"
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
              />
            </section>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setAba('campo')} className="btn-pri" style={{ padding: '11px 28px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', backgroundColor: PRIMARY, color: '#fff', border: 'none', boxShadow: '0 2px 8px rgba(30,50,100,0.2)', transition: 'box-shadow 0.15s' }}>
                Avançar para Dados de Campo →
              </button>
            </div>
          </div>
        )}

        {/* ══ ABA 2: DADOS DE CAMPO ══ */}
        {aba === 'campo' && (
          <div style={{ paddingTop: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Form inserção */}
            <section style={{ background: '#fff', border: `1px solid ${editandoId ? GOLD : BORDER}`, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(30,50,100,0.04)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 800, color: editandoId ? '#8B6914' : PRIMARY, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {editandoId ? '✎  Editando Amostra' : '+  Inserir Nova Amostra'}
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, marginBottom: 16 }}>
                <Campo label="Identificação da amostra (ex: P1 - Pilar Térreo)">
                  <input style={inputStyle} value={nomeAmostra} onChange={e => setNomeAmostra(e.target.value)}
                    placeholder="Ex: V1 - Viga Piso 2, P3 - Pilar Térreo…"
                    onKeyDown={e => e.key === 'Enter' && impactoRefs.current[0]?.focus()}
                  />
                </Campo>
                <Campo label="Posição do Esclerômetro">
                  <div style={{ display: 'flex', gap: 6 }}>
                    {POSICOES.map(p => (
                      <button key={p} onClick={() => setPosicao(p)} style={{
                        flex: 1, padding: '8px 4px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                        backgroundColor: posicao === p ? PRIMARY : '#F0F2F8',
                        color: posicao === p ? '#fff' : SUBTEXT,
                        border: `2px solid ${posicao === p ? PRIMARY : 'transparent'}`,
                      }}>
                        {p}
                      </button>
                    ))}
                  </div>
                </Campo>
              </div>

              {/* 16 impactos */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Impactos (máx. 16) — filtro automático ±10% da média bruta — mínimo 5 válidos
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {impactos.map((v, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: SUBTEXT }}>{i + 1}</span>
                      <input
                        ref={el => { impactoRefs.current[i] = el; }}
                        type="text" inputMode="decimal" value={v}
                        onChange={e => {
                          const n = [...impactos];
                          n[i] = onlyDecimal(e.target.value);
                          setImpactos(n);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Tab' && !e.shiftKey) {
                            e.preventDefault();
                            const next = impactoRefs.current[i + 1];
                            if (next) next.focus(); else processarAmostra();
                          } else if (e.key === 'Tab' && e.shiftKey) {
                            e.preventDefault();
                            const prev = impactoRefs.current[i - 1];
                            if (prev) prev.focus();
                          } else if (e.key === 'Enter') {
                            e.preventDefault();
                            const next = impactoRefs.current[i + 1];
                            if (next) next.focus(); else processarAmostra();
                          }
                        }}
                        style={{
                          width: 52, textAlign: 'center', padding: '7px 4px',
                          border: `1.5px solid ${v ? PRIMARY + '55' : BORDER}`,
                          borderRadius: 6, fontSize: 13, fontFamily: 'inherit', color: TEXT,
                          background: v ? '#F0F4FC' : '#fff', outline: 'none', transition: 'all 0.1s',
                        }}
                        onFocus={e => { e.target.style.borderColor = PRIMARY; e.target.style.background = '#E8EFFE'; }}
                        onBlur={e => { e.target.style.borderColor = v ? PRIMARY + '55' : BORDER; e.target.style.background = v ? '#F0F4FC' : '#fff'; }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={processarAmostra} disabled={!nomeAmostra.trim()} className="btn-pri" style={{
                  padding: '10px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  cursor: nomeAmostra.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                  backgroundColor: editandoId ? GOLD : PRIMARY, color: editandoId ? PRIMARY : '#fff',
                  border: 'none', opacity: nomeAmostra.trim() ? 1 : 0.5,
                }}>
                  {editandoId ? '✓ Salvar Alterações' : '+ Calcular e Adicionar'}
                </button>
                {editandoId && (
                  <button onClick={cancelarEdicao} style={{ padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#F0F2F8', color: SUBTEXT, border: 'none' }}>
                    Cancelar
                  </button>
                )}
                <button onClick={() => { setNomeAmostra(''); setImpactos(Array(16).fill('')); setPosicao('0°'); }} style={{ padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#F0F2F8', color: SUBTEXT, border: 'none' }}>
                  Limpar Campos
                </button>
              </div>
            </section>

            {/* Tabela de resultados */}
            <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(30,50,100,0.06)' }}>

              {/* Cabeçalho da tabela — replica o azul #002060 do Excel */}
              <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 96px 62px 62px 62px 110px 76px 110px 64px 72px', padding: '11px 16px', background: EXCEL_BLUE }}>
                {['#', 'ELEMENTO', 'POSIÇÃO', 'LIM. INF.', 'LIM. SUP.', 'I.E. MÉDIO', 'STATUS', 'I.E. EFETIVO', 'RESIST. (MPa)', 'DISP.', 'AÇÕES'].map(h => (
                  <span key={h} style={{ fontSize: 9.5, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>{h}</span>
                ))}
              </div>

              {amostras.length === 0 ? (
                <div style={{ padding: '48px 0', textAlign: 'center', color: SUBTEXT }}>
                  <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.2 }}>⬡</div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Nenhuma amostra inserida</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12 }}>Preencha o formulário acima para adicionar a primeira amostra</p>
                </div>
              ) : (
                amostras.map((a, idx) => {
                  const valida  = a.status === 'Amostra Válida';
                  const editing = editandoId === a.id;
                  return (
                    <div key={a.id} className="row-h" style={{
                      display: 'grid',
                      gridTemplateColumns: '36px 1fr 96px 62px 62px 62px 110px 76px 110px 64px 72px',
                      padding: '11px 16px',
                      borderBottom: idx < amostras.length - 1 ? `1px solid ${BORDER}` : 'none',
                      alignItems: 'center',
                      background: editing ? '#FFFBEC' : idx % 2 === 1 ? '#F8F9FC' : '#fff',
                      opacity: valida ? 1 : 0.72,
                      transition: 'background 0.1s',
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: SUBTEXT, textAlign: 'center' }}>{a.item}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: TEXT, paddingRight: 8 }}>{a.amostra}</span>
                      <span style={{ fontSize: 12, color: SUBTEXT, textAlign: 'center' }}>{a.posicao}</span>
                      <span style={{ fontSize: 12, color: SUBTEXT, textAlign: 'center' }}>{fmt(a.limInf)}</span>
                      <span style={{ fontSize: 12, color: SUBTEXT, textAlign: 'center' }}>{fmt(a.limSup)}</span>
                      <span style={{ fontSize: 12, color: SUBTEXT, textAlign: 'center' }}>{fmt(a.ieMedio)}</span>
                      <div style={{ display: 'flex', justifyContent: 'center' }}><StatusBadge status={a.status} /></div>
                      <span style={{ fontSize: 12, fontWeight: valida ? 700 : 400, color: valida ? PRIMARY : SUBTEXT, textAlign: 'center' }}>{fmt(a.ieEfetivo)}</span>
                      <span style={{ fontSize: 13, fontWeight: valida ? 800 : 400, color: valida ? TEXT : SUBTEXT, textAlign: 'center' }}>{fmt(a.resistencia)}</span>
                      <span style={{ fontSize: 12, color: SUBTEXT, textAlign: 'center' }}>{a.dispersao}</span>
                      <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                        <button className="icon-btn" title="Editar" onClick={() => carregarParaEdicao(a)}
                          style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#EEF1F8', color: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="icon-btn" title="Apagar" onClick={() => { if (confirm(`Apagar "${a.amostra}"?`)) apagarAmostra(a.id); }}
                          style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#FFF0EE', color: DANGER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Sumário */}
              {amostras.length > 0 && (
                <div style={{ display: 'flex', gap: 0, borderTop: `2px solid ${BORDER}`, background: '#F8F9FA' }}>
                  {[
                    { label: 'Total', value: String(amostras.length), color: TEXT },
                    { label: 'Válidas', value: String(validas.length), color: SUCCESS },
                    { label: 'Perdidas', value: String(perdidas.length), color: perdidas.length > 0 ? DANGER : SUBTEXT },
                    ...(fckMedia !== null ? [
                      { label: 'fck médio', value: `${fckMedia.toFixed(1)} MPa`, color: PRIMARY },
                      { label: 'Mín.', value: `${Math.min(...validas.map(a => a.resistencia ?? Infinity)).toFixed(1)} MPa`, color: DANGER },
                      { label: 'Máx.', value: `${Math.max(...validas.map(a => a.resistencia ?? -Infinity)).toFixed(1)} MPa`, color: SUCCESS },
                    ] : []),
                  ].map((item, i) => (
                    <div key={i} style={{ flex: 1, padding: '14px 20px', borderLeft: i > 0 ? `1px solid ${BORDER}` : 'none' }}>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</p>
                      <p style={{ margin: '3px 0 0', fontSize: 18, fontWeight: 800, color: item.color }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}