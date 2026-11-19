'use client';
// src/components/PlanilhaUI.tsx
// Primitivos visuais padronizados no estilo "Planilha Técnica Compacta"
// (referência: módulo de Aderência). Usado por todos os módulos de ensaio
// existentes e futuros para manter cores, tabelas, fichas e responsividade uniformes.

import type { CSSProperties, ReactNode } from 'react';

export const CORES_PLANILHA = {
  PRIMARY: '#1E3264',
  GOLD: '#C8A020',
  BG: '#F8F9FA',
  SURFACE: '#FFFFFF',
  HEADER_SUB: '#F1F5F9',
  ZEBRA: '#F8FAFC',
  BORDER: '#E8EAF0',
  BORDER_PANEL: '#94A3B8',
  BORDER_CELL: '#E2E8F0',
  BORDER_FOOT: '#CBD5E1',
  TEXT: '#1A2340',
  SUBTEXT: '#6B7490',
  TH_TEXT: '#334155',
  SUCCESS: '#1A7A44',
  DANGER: '#C0392B',
  GREEN: '#2E7D32',
  GREEN_LIGHT: '#F0F8F4',
  GREEN_BORDER: '#B8DFC8',
} as const;

export const fichaInputStyle: CSSProperties = {
  padding: '2px 0',
  border: 'none',
  borderRadius: 0,
  fontSize: 12.5,
  fontFamily: 'inherit',
  fontWeight: 500,
  color: CORES_PLANILHA.TEXT,
  background: 'transparent',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  height: 24,
};

export const tabelaHeaderStyle: CSSProperties = {
  background: CORES_PLANILHA.HEADER_SUB,
  borderBottom: `1px solid ${CORES_PLANILHA.BORDER_PANEL}`,
};

export const tabelaThTextStyle: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 800,
  color: CORES_PLANILHA.TH_TEXT,
  textTransform: 'uppercase',
  letterSpacing: '0.02em',
  textAlign: 'center',
};

/** CSS compartilhado para grades contínuas, foco de célula e responsividade mobile. */
export function PlanilhaStyles() {
  return (
    <style>{`
      .planilha-cell:focus-within {
        background: #EFF6FF !important;
        box-shadow: inset 0 0 0 1.8px #2563EB;
      }
      .planilha-grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }
      .planilha-grid-3 {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .planilha-grid-rlt {
        display: grid;
        grid-template-columns: 150px 160px minmax(0, 1fr);
      }
      .planilha-cell-r {
        min-width: 0;
      }
      @media (max-width: 720px) {
        .planilha-grid-2,
        .planilha-grid-3,
        .planilha-grid-rlt {
          grid-template-columns: 1fr !important;
        }
        .planilha-cell-r {
          border-right: none !important;
        }
      }
    `}</style>
  );
}

/** Painel no padrão "planilha técnica": borda #94A3B8, barra superior azul-marinho e corpo limpo. */
export function PainelPlanilha({
  titulo,
  direita,
  children,
  corBarra = CORES_PLANILHA.PRIMARY,
  marginBottom = 14,
}: {
  titulo: string;
  direita?: ReactNode;
  children: ReactNode;
  corBarra?: string;
  marginBottom?: number;
}) {
  return (
    <section
      style={{
        border: `1px solid ${CORES_PLANILHA.BORDER_PANEL}`,
        borderRadius: 8,
        overflow: 'hidden',
        background: CORES_PLANILHA.SURFACE,
        marginBottom,
      }}
    >
      <div
        style={{
          background: corBarra,
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 800,
            color: '#fff',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {titulo}
        </span>
        {direita}
      </div>
      {children}
    </section>
  );
}

/** Célula de ficha técnica: rótulo compacto em cima + campo alinhado abaixo, foco na célula inteira. */
export function CelulaFicha({
  label,
  htmlFor,
  children,
  borderRight = false,
  borderBottom = true,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  borderRight?: boolean;
  borderBottom?: boolean;
}) {
  return (
    <div
      className={`planilha-cell${borderRight ? ' planilha-cell-r' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '7px 12px 5px',
        minWidth: 0,
        borderRight: borderRight ? `1px solid ${CORES_PLANILHA.BORDER_CELL}` : undefined,
        borderBottom: borderBottom ? `1px solid ${CORES_PLANILHA.BORDER_CELL}` : undefined,
        transition: 'background 0.1s',
      }}
    >
      <label
        htmlFor={htmlFor}
        style={{
          margin: 0,
          fontSize: 9.5,
          fontWeight: 800,
          color: CORES_PLANILHA.SUBTEXT,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          lineHeight: 1.25,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
