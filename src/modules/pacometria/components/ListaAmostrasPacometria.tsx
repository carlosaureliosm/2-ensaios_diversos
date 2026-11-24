'use client';
// src/modules/pacometria/components/ListaAmostrasPacometria.tsx
//
// Tabela (desktop) e cards (mobile) de amostras de Pacometria.
// Reutilizado por "2. Dados de Campo" e "3. Modo Obra" (com suporte a somenteLeitura).

import { memo, useRef } from 'react';
import {
  PainelPlanilha,
  tabelaHeaderStyle,
  tabelaThTextStyle,
} from '@/components/PlanilhaUI';
import {
  AmostraRow,
  TIPO_LABELS,
  getResumoOpcao,
} from '@/modules/pacometria/types';

const PRIMARY = '#1E3264';
const GOLD    = '#C8A020';
const BORDER  = '#E8EAF0';
const TEXT    = '#1A2340';
const SUBTEXT = '#6B7490';
const SUCCESS = '#1A7A44';
const DANGER  = '#C0392B';

type Props = {
  amostras: AmostraRow[];
  titulo: string;
  corBarra?: string;
  somenteLeitura?: boolean;
  uploadingFotoId?: string | null;
  salvando?: boolean;
  direitaExtra?: React.ReactNode;
  mobileAcoesExtra?: React.ReactNode;
  onNovaAmostra?: () => void;
  onEditar?: (a: AmostraRow) => void;
  onApagar?: (id: string) => void;
  onAnexarFoto?: (id: string, file: File) => void;
  onRemoverFoto?: (id: string) => void;
};

export const ListaAmostrasPacometria = memo(function ListaAmostrasPacometria({
  amostras,
  titulo,
  corBarra = PRIMARY,
  somenteLeitura = false,
  uploadingFotoId = null,
  salvando = false,
  direitaExtra,
  mobileAcoesExtra,
  onNovaAmostra,
  onEditar,
  onApagar,
  onAnexarFoto,
  onRemoverFoto,
}: Props) {
  const fotoRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const colunas = somenteLeitura
    ? ['Item', 'Elemento', 'Tipo / Opção', 'Médio', 'Mínimo', 'Máximo', 'Desv. Padrão', 'CV (%)', 'Moda', 'Foto']
    : ['Item', 'Elemento', 'Tipo / Opção', 'Médio', 'Mínimo', 'Máximo', 'Desv. Padrão', 'CV (%)', 'Moda', 'Foto', 'Ações'];

  return (
    <div>
      {/* Tabela — desktop */}
      <div className="amostras-table-section">
        <PainelPlanilha
          titulo={titulo}
          corBarra={corBarra}
          direita={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: '#E2E8F0' }}>
                {amostras.length} amostra{amostras.length !== 1 ? 's' : ''}
                {salvando ? ' · Salvando…' : ''}
              </span>
              {direitaExtra}
              {!somenteLeitura && onNovaAmostra && (
                <button
                  onClick={onNovaAmostra}
                  disabled={salvando}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 12px', borderRadius: 6, fontSize: 11.5, fontWeight: 700,
                    cursor: salvando ? 'wait' : 'pointer', fontFamily: 'inherit',
                    background: GOLD, color: '#fff', border: 'none',
                    opacity: salvando ? 0.7 : 1,
                  }}
                >
                  + Nova Amostra
                </button>
              )}
            </div>
          }
        >
          {amostras.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: SUBTEXT }}>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>Nenhuma amostra registrada</p>
              {!somenteLeitura && (
                <p style={{ margin: '4px 0 0', fontSize: 12 }}>Clique em &ldquo;+ Nova Amostra&rdquo; para começar</p>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={tabelaHeaderStyle}>
                    {colunas.map((h, hi) => (
                      <th
                        key={h}
                        style={{
                          ...tabelaThTextStyle,
                          padding: '8px 10px',
                          textAlign: hi === 1 || hi === 2 ? 'left' : 'center',
                          borderLeft: hi > 0 ? '1px solid #E2E8F0' : undefined,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {amostras.map((a, i) => {
                    const enviandoFoto = uploadingFotoId === a.id;
                    return (
                      <tr key={a.id} style={{ borderTop: '1px solid #E2E8F0', background: i % 2 === 1 ? '#F8FAFC' : '#fff' }}>
                        <td style={{ padding: '9px 10px', fontSize: 12.5, fontWeight: 800, color: '#475569', textAlign: 'center', width: 44 }}>{a.item}</td>
                        <td style={{ padding: '9px 10px', fontSize: 13, fontWeight: 700, color: TEXT, borderLeft: '1px solid #E2E8F0' }}>{a.elemento}</td>
                        <td style={{ padding: '9px 10px', fontSize: 12, color: SUBTEXT, borderLeft: '1px solid #E2E8F0' }}>
                          <span style={{ fontWeight: 600, color: TEXT }}>{TIPO_LABELS[a.tipo] ?? a.tipo}</span>
                          <span style={{ marginLeft: 6, fontSize: 11, background: '#EEF2FF', color: PRIMARY, borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>{getResumoOpcao(a)}</span>
                        </td>
                        <td style={{ padding: '9px 10px', fontSize: 13, fontWeight: 700, textAlign: 'center', borderLeft: '1px solid #E2E8F0', color: a.cobMedio !== null ? TEXT : SUBTEXT }}>
                          {a.cobMedio !== null ? `${a.cobMedio.toFixed(1)} mm` : '—'}
                        </td>
                        <td style={{ padding: '9px 10px', textAlign: 'center', borderLeft: '1px solid #E2E8F0' }}>
                          {a.cobMinimo !== null ? (
                            <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: a.cobMinimo < 20 ? '#FEF2F2' : '#DCFCE7', color: a.cobMinimo < 20 ? '#B91C1C' : '#166534' }}>
                              {a.cobMinimo.toFixed(0)} mm
                            </span>
                          ) : <span style={{ color: SUBTEXT }}>—</span>}
                        </td>
                        <td style={{ padding: '9px 10px', fontSize: 12.5, textAlign: 'center', borderLeft: '1px solid #E2E8F0', color: a.cobMaximo !== null ? TEXT : SUBTEXT }}>
                          {a.cobMaximo !== null ? `${a.cobMaximo.toFixed(0)} mm` : '—'}
                        </td>
                        <td style={{ padding: '9px 10px', fontSize: 12.5, textAlign: 'center', borderLeft: '1px solid #E2E8F0', color: a.cobDesvio !== null ? TEXT : SUBTEXT }}>
                          {a.cobDesvio !== null ? `${a.cobDesvio.toFixed(1)} mm` : '—'}
                        </td>
                        <td style={{ padding: '9px 10px', fontSize: 12.5, fontWeight: 700, textAlign: 'center', borderLeft: '1px solid #E2E8F0', color: a.cobCV !== null ? (a.cobCV > 20 ? DANGER : a.cobCV > 10 ? '#B45309' : SUCCESS) : SUBTEXT }}>
                          {a.cobCV !== null ? `${a.cobCV.toFixed(1)}%` : '—'}
                        </td>
                        <td style={{ padding: '9px 10px', fontSize: 12.5, textAlign: 'center', borderLeft: '1px solid #E2E8F0', color: a.cobModa !== null ? TEXT : SUBTEXT }}>
                          {a.cobModa !== null ? `${a.cobModa} mm` : '—'}
                        </td>

                        {/* Célula foto */}
                        <td style={{ padding: '8px 10px', borderLeft: '1px solid #E2E8F0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            {a.fotoPreview ? (
                              <>
                                <img
                                  src={a.fotoPreview}
                                  alt="foto"
                                  decoding="async"
                                  loading="lazy"
                                  style={{
                                    width: 34, height: 34, borderRadius: 4, objectFit: 'cover',
                                    border: `1px solid ${BORDER}`, background: '#F1F5F9',
                                    opacity: enviandoFoto ? 0.65 : 1,
                                  }}
                                />
                                {enviandoFoto ? (
                                  <span style={{ fontSize: 10, color: SUBTEXT, fontWeight: 700 }}>…</span>
                                ) : !somenteLeitura && onRemoverFoto && (
                                  <button
                                    onClick={() => {
                                      onRemoverFoto(a.id);
                                      if (fotoRefs.current[a.id]) fotoRefs.current[a.id]!.value = '';
                                    }}
                                    aria-label="Remover foto"
                                    style={{ width: 22, height: 22, borderRadius: 4, border: 'none', background: '#FFF0EE', color: DANGER, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  >
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                  </button>
                                )}
                              </>
                            ) : enviandoFoto ? (
                              <span style={{ fontSize: 11, color: SUBTEXT, fontWeight: 600 }}>Enviando…</span>
                            ) : !somenteLeitura && onAnexarFoto ? (
                              <>
                                <input
                                  ref={el => { fotoRefs.current[a.id] = el; }}
                                  type="file"
                                  accept="image/*"
                                  style={{ display: 'none' }}
                                  onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) onAnexarFoto(a.id, file);
                                    e.target.value = '';
                                  }}
                                />
                                <button
                                  onClick={() => fotoRefs.current[a.id]?.click()}
                                  aria-label="Anexar foto"
                                  style={{ width: 30, height: 30, borderRadius: 6, border: `1px dashed ${BORDER}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUBTEXT }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                </button>
                              </>
                            ) : (
                              <span style={{ color: SUBTEXT, fontSize: 12 }}>—</span>
                            )}
                          </div>
                        </td>

                        {/* Ações */}
                        {!somenteLeitura && (
                          <td style={{ padding: '8px 10px', borderLeft: '1px solid #E2E8F0' }}>
                            <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                              {onEditar && (
                                <button onClick={() => onEditar(a)} aria-label="Editar amostra" style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#EEF1F8', color: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                              )}
                              {onApagar && (
                                <button onClick={() => onApagar(a.id)} aria-label="Apagar amostra" style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#FFF0EE', color: DANGER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </PainelPlanilha>
      </div>

      {/* Cards — mobile */}
      <div className="amostras-cards-section" style={{ flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: SUBTEXT }}>
            {amostras.length} amostra{amostras.length !== 1 ? 's' : ''}
            {salvando ? ' · Salvando…' : ''}
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {mobileAcoesExtra}
            {!somenteLeitura && onNovaAmostra && (
              <button
                onClick={onNovaAmostra}
                disabled={salvando}
                style={{
                  padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                  cursor: salvando ? 'wait' : 'pointer', fontFamily: 'inherit',
                  background: corBarra, color: '#fff', border: 'none',
                }}
              >
                + Nova Amostra
              </button>
            )}
          </div>
        </div>
        {amostras.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: SUBTEXT, background: '#fff', border: '1px solid #94A3B8', borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>Nenhuma amostra registrada</p>
          </div>
        ) : amostras.map(a => {
          const enviandoFoto = uploadingFotoId === a.id;
          return (
            <div key={a.id} style={{ background: '#fff', borderRadius: 8, border: '1px solid #94A3B8', padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: SUBTEXT }}>#{a.item}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: TEXT }}>{a.elemento}</span>
                  <span style={{ fontSize: 10, background: '#EEF2FF', color: PRIMARY, borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>
                    {TIPO_LABELS[a.tipo] ?? a.tipo} · {getResumoOpcao(a)}
                  </span>
                </div>
                {!somenteLeitura && (
                  <div style={{ display: 'flex', gap: 5 }}>
                    {onEditar && (
                      <button onClick={() => onEditar(a)} aria-label="Editar" style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: '#EEF1F8', color: PRIMARY, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                    )}
                    {onApagar && (
                      <button onClick={() => onApagar(a.id)} aria-label="Apagar" style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: '#FFF0EE', color: DANGER, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                      </button>
                    )}
                  </div>
                )}
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
                    <img
                      src={a.fotoPreview}
                      alt="foto"
                      decoding="async"
                      loading="lazy"
                      style={{
                        width: 40, height: 40, borderRadius: 6, objectFit: 'cover',
                        border: `1px solid ${BORDER}`, background: '#F1F5F9',
                        opacity: enviandoFoto ? 0.65 : 1,
                      }}
                    />
                    {enviandoFoto ? (
                      <span style={{ fontSize: 11, color: SUBTEXT, fontWeight: 600 }}>Salvando foto…</span>
                    ) : !somenteLeitura && onRemoverFoto && (
                      <button
                        onClick={() => {
                          onRemoverFoto(a.id);
                          if (fotoRefs.current[a.id + '_m']) fotoRefs.current[a.id + '_m']!.value = '';
                        }}
                        style={{ fontSize: 11, color: DANGER, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        Remover foto
                      </button>
                    )}
                  </>
                ) : enviandoFoto ? (
                  <span style={{ fontSize: 11, color: SUBTEXT, fontWeight: 600 }}>Enviando foto…</span>
                ) : !somenteLeitura && onAnexarFoto ? (
                  <>
                    <input
                      ref={el => { fotoRefs.current[a.id + '_m'] = el; }}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) onAnexarFoto(a.id, file);
                        e.target.value = '';
                      }}
                    />
                    <button
                      onClick={() => fotoRefs.current[a.id + '_m']?.click()}
                      style={{ fontSize: 11, color: PRIMARY, background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      Anexar foto
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
