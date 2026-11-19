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
      .btn-pri:hover {
        box-shadow: 0 4px 16px rgba(30,50,100,0.3) !important;
      }
      .btn-gold:hover {
        background: #b08c18 !important;
      }
      .tabs-row {
        display: flex;
        border-bottom: 2px solid ${CORES_PLANILHA.BORDER};
      }
      .tab-btn {
        padding: 10px 24px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
        background: transparent;
        border: none;
        border-bottom: 3px solid transparent;
        margin-bottom: -2px;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.15s;
        color: ${CORES_PLANILHA.SUBTEXT};
      }
      .tab-btn:hover:not(:disabled) {
        opacity: 0.8;
      }
      .tab-btn.tab-ativo {
        color: ${CORES_PLANILHA.PRIMARY};
        border-bottom-color: ${CORES_PLANILHA.GOLD};
      }
      .tab-btn.tab-ativo.tab-obra {
        color: ${CORES_PLANILHA.GREEN};
        border-bottom-color: ${CORES_PLANILHA.GREEN};
      }
      .tab-icon {
        display: none;
      }
      .tab-label-full {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .tab-label-short {
        display: none;
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
      @media (max-width: 600px) {
        .page-title-row {
          flex-direction: column !important;
          align-items: flex-start !important;
          gap: 10px !important;
        }
        .page-action-btns {
          width: 100%;
          display: flex;
          gap: 8px;
        }
        .page-action-btns button {
          flex: 1;
          justify-content: center;
        }
        .tabs-row {
          background: #F1F3F8;
          padding: 6px 6px 0;
          gap: 4px !important;
          border-bottom: none !important;
          border-radius: 10px 10px 0 0;
        }
        .tab-btn {
          flex: 1;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 4px !important;
          padding: 10px 4px 8px !important;
          font-size: 11px !important;
          white-space: nowrap;
          border-radius: 8px 8px 0 0 !important;
          background: rgba(255,255,255,0.6) !important;
          border-bottom: 3px solid transparent !important;
          margin-bottom: 0 !important;
        }
        .tab-btn.tab-ativo {
          background: #fff !important;
          opacity: 1 !important;
          border-bottom: 4px solid ${CORES_PLANILHA.GOLD} !important;
        }
        .tab-btn.tab-ativo.tab-obra {
          border-bottom-color: ${CORES_PLANILHA.GREEN} !important;
        }
        .tab-icon {
          display: block !important;
        }
        .tab-label-full {
          display: none !important;
        }
        .tab-label-short {
          display: block !important;
          font-weight: 700;
          font-size: 11px;
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

/** Cabeçalho padrão de todos os módulos de ensaio: breadcrumb, filete dourado, título e ações. */
export function EnsaioCabecalho({
  breadcrumb,
  titulo,
  subtitulo,
  salvoMsg,
  onLimparTudo,
  onGerarRelatorio,
  gerandoDocx = false,
  podeGerar = true,
  labelGerar = 'Gerar relatório',
  marginBottom = 22,
}: {
  breadcrumb: string;
  titulo: string;
  subtitulo: string;
  salvoMsg?: string;
  onLimparTudo?: () => void;
  onGerarRelatorio?: () => void;
  gerandoDocx?: boolean;
  podeGerar?: boolean;
  labelGerar?: string;
  marginBottom?: number;
}) {
  const desabilitado = gerandoDocx || !podeGerar;
  return (
    <div style={{ marginBottom }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <a href="/dashboard" style={{ fontSize: 12, color: CORES_PLANILHA.SUBTEXT, textDecoration: 'none' }}>
          Ensaios
        </a>
        <span style={{ fontSize: 12, color: CORES_PLANILHA.SUBTEXT }}>›</span>
        <span style={{ fontSize: 12, color: CORES_PLANILHA.PRIMARY, fontWeight: 700 }}>{breadcrumb}</span>
      </div>
      <div
        className="page-title-row"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}
      >
        <div style={{ borderLeft: `4px solid ${CORES_PLANILHA.GOLD}`, paddingLeft: 14 }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 700,
              color: CORES_PLANILHA.SUBTEXT,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            Ensaio
          </p>
          <h1 style={{ margin: '3px 0 0', fontSize: 22, fontWeight: 800, color: CORES_PLANILHA.TEXT }}>{titulo}</h1>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: CORES_PLANILHA.SUBTEXT }}>{subtitulo}</p>
        </div>
        {(salvoMsg || onLimparTudo || onGerarRelatorio) && (
          <div className="page-action-btns" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {salvoMsg && (
              <span
                style={{
                  fontSize: 12,
                  color: CORES_PLANILHA.SUCCESS,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {salvoMsg}
              </span>
            )}
            {onLimparTudo && (
              <button
                type="button"
                onClick={onLimparTudo}
                style={{
                  padding: '8px 14px',
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  background: '#FFF0EE',
                  color: CORES_PLANILHA.DANGER,
                  border: '1px solid #FADADD',
                }}
              >
                🗑 Limpar Tudo
              </button>
            )}
            {onGerarRelatorio && (
              <button
                type="button"
                onClick={onGerarRelatorio}
                disabled={desabilitado}
                className="btn-gold"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 18px',
                  borderRadius: 7,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: desabilitado ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  backgroundColor: CORES_PLANILHA.GOLD,
                  color: CORES_PLANILHA.PRIMARY,
                  border: 'none',
                  opacity: podeGerar ? 1 : 0.5,
                  transition: 'background 0.15s',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                {gerandoDocx ? 'Gerando…' : labelGerar}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export type EnsaioTabItem<T extends string = string> = {
  id: T;
  labelFull: ReactNode;
  labelShort: ReactNode;
  icon?: ReactNode;
  variante?: 'padrao' | 'obra';
  disabled?: boolean;
  title?: string;
};

/** Barra de abas padronizada: abas normais com borda dourada (#C8A020) e Modo Obra com borda verde (#2E7D32). */
export function EnsaioTabs<T extends string>({
  tabs,
  abaAtiva,
  onChange,
  marginBottom = 0,
}: {
  tabs: readonly EnsaioTabItem<NoInfer<T>>[];
  abaAtiva: T;
  onChange: (id: NoInfer<T>) => void;
  marginBottom?: number;
}) {
  return (
    <div className="tabs-row" style={{ marginBottom }}>
      {tabs.map((tab) => {
        const ativa = abaAtiva === tab.id;
        const ehObra = tab.variante === 'obra';
        const corAtiva = ehObra ? CORES_PLANILHA.GREEN : CORES_PLANILHA.PRIMARY;
        const corTexto = tab.disabled ? '#C0C8D8' : ativa ? corAtiva : CORES_PLANILHA.SUBTEXT;
        return (
          <button
            key={tab.id}
            type="button"
            className={`tab-btn${ativa ? ' tab-ativo' : ''}${ehObra ? ' tab-obra' : ''}`}
            onClick={() => (!tab.disabled ? onChange(tab.id) : undefined)}
            title={tab.title}
            style={{
              color: corTexto,
              cursor: tab.disabled ? 'not-allowed' : 'pointer',
              opacity: tab.disabled ? 0.55 : 1,
            }}
          >
            {tab.icon && (
              <span className="tab-icon" style={{ color: corTexto }}>
                {tab.icon}
              </span>
            )}
            <span className="tab-label-full">{tab.labelFull}</span>
            <span className="tab-label-short" style={{ color: corTexto }}>
              {tab.labelShort}
            </span>
          </button>
        );
      })}
    </div>
  );
}
