'use client';
// src/modules/pacometria/components/ModalAmostra.tsx

import { useState, useRef } from 'react';
import { InteiroInput } from '@/components/PlanilhaUI';
import {
  AmostraRow,
  BarraMalha,
  FACE_COLORS,
  FACE_LABELS,
  FaceData,
  LajeData,
  OPCOES_LAJE,
  OPCOES_PILAR,
  OPCOES_VIGA,
  OpcaoAcessibilidade,
  OpcaoLaje,
  OpcaoPilar,
  OpcaoViga,
  TipoElemento,
  calcularCobrimentos,
  calcularCobrimentosLaje,
  ensureFaceArrays,
  gerarMalhaRegular,
  getFacesDaOpcao,
  initFaceData,
  initLajeData,
  newId,
  ordenarBarras,
} from '../types';
import {
  FerramentaMalha,
  SvgMalhaLaje,
  SvgPerfilHorizontal,
  SvgPerfilVertical,
  SvgSecaoPilar,
  SvgSecaoViga,
  svgOpcaoLaje,
  svgOpcaoPilar,
  svgOpcaoViga,
} from './PacometriaSvgs';

const PRIMARY = '#1E3264';
const BG = '#F8F9FA';
const BORDER = '#E8EAF0';
const TEXT = '#1A2340';
const SUBTEXT = '#6B7490';
const SUCCESS = '#1A7A44';
const DANGER = '#C0392B';

const inputStyle: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: 7,
  border: `1.5px solid ${BORDER}`,
  fontSize: 14,
  fontFamily: 'inherit',
  color: TEXT,
  background: '#fff',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

function Campo({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label
        htmlFor={htmlFor}
        style={{ fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export type ModalAmostraProps = {
  amostraInicial?: AmostraRow | null;
  onSalvar: (a: AmostraRow) => void;
  onFechar: () => void;
  itemNum: number;
};

const DEFAULT_BARRAS: Record<string, number> = {
  '1X': 3,
  '2X': 3,
  '1Y': 2,
  '2Y': 2,
  circ: 6,
  fundo: 3,
  topo: 2,
  lat1: 2,
  lat2: 2,
};

export function ModalAmostra({ amostraInicial, onSalvar, onFechar, itemNum }: ModalAmostraProps) {
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [elemento, setElemento] = useState(amostraInicial?.elemento ?? '');
  const [tipo, setTipo] = useState<TipoElemento>(amostraInicial?.tipo ?? 'pilar');
  const [opcao, setOpcao] = useState<OpcaoAcessibilidade | null>(amostraInicial?.opcao ?? null);

  // Geometria Pilar / Viga
  const [X, setX] = useState(amostraInicial?.X ?? 30);
  const [Y, setY] = useState(amostraInicial?.Y ?? 50);
  const [C1] = useState(amostraInicial?.C1 ?? 3);
  const [C2] = useState(amostraInicial?.C2 ?? 3);
  const [D, setD] = useState(amostraInicial?.D ?? 40);
  const [barras, setBarras] = useState<Record<string, number>>({
    ...DEFAULT_BARRAS,
    ...(amostraInicial?.barras ?? {}),
  });
  const [facesData, setFacesData] = useState<Record<string, FaceData>>(amostraInicial?.facesData ?? {});

  // Geometria e dados Laje / Área Livre
  const [lajeData, setLajeData] = useState<LajeData>(
    () => amostraInicial?.lajeData ?? initLajeData('LA'),
  );
  const [ferramenta, setFerramenta] = useState<FerramentaMalha>('addH');
  const [espRapido, setEspRapido] = useState(20);
  const [barraSelId, setBarraSelId] = useState<string | null>(null);
  const cobInputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  const faces = getFacesDaOpcao(tipo, opcao);
  const isCirc = tipo === 'pilar' && opcao === 'E';
  const isLaje = tipo === 'laje';
  const isViga = tipo === 'viga';
  const lajeCfg = isLaje && opcao && opcao in OPCOES_LAJE
    ? OPCOES_LAJE[opcao as OpcaoLaje]
    : OPCOES_LAJE.LA;

  function selecionarTipo(novoTipo: TipoElemento) {
    if (novoTipo === tipo) return;
    setTipo(novoTipo);
    if (novoTipo === 'pilar') {
      setOpcao(null);
      setX(30);
      setY(50);
    } else if (novoTipo === 'viga') {
      setOpcao('VA');
      setX(20);
      setY(50);
    } else {
      setOpcao('LA');
      setLajeData(initLajeData('LA'));
      setFerramenta('addH');
    }
  }

  function selecionarOpcaoLaje(op: OpcaoLaje) {
    setOpcao(op);
    const cfg = OPCOES_LAJE[op];
    setLajeData(prev => ({
      ...prev,
      barrasH: cfg.permiteH ? (prev.barrasH.length > 0 ? prev.barrasH : gerarMalhaRegular(prev.larguraX, prev.alturaY, espRapido, true, false, prev.passoGrid).barrasH) : [],
      barrasV: cfg.permiteV ? (prev.barrasV.length > 0 ? prev.barrasV : gerarMalhaRegular(prev.larguraX, prev.alturaY, espRapido, false, true, prev.passoGrid).barrasV) : [],
    }));
    if (!cfg.permiteH && ferramenta === 'addH') setFerramenta('addV');
    if (!cfg.permiteV && ferramenta === 'addV') setFerramenta('addH');
  }

  // Helpers Pilar / Viga
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

  // Helpers Laje / Malha Quadrada
  function toggleBarra(dir: 'H' | 'V', posCm: number) {
    setLajeData(prev => {
      const key = dir === 'H' ? 'barrasH' : 'barrasV';
      const lista = prev[key];
      const existe = lista.find(b => Math.abs(b.pos - posCm) < 0.5);
      if (existe) {
        return { ...prev, [key]: lista.filter(b => b.id !== existe.id) };
      }
      if (ferramenta === 'remove') return prev;
      return {
        ...prev,
        [key]: ordenarBarras([...lista, { id: newId(), pos: posCm, cob: '' }]),
      };
    });
  }

  function atualizarBarra(dir: 'H' | 'V', id: string, patch: Partial<BarraMalha>) {
    setLajeData(prev => {
      const key = dir === 'H' ? 'barrasH' : 'barrasV';
      const atualizadas = prev[key].map(b => (b.id === id ? { ...b, ...patch } : b));
      return {
        ...prev,
        [key]: patch.pos !== undefined ? ordenarBarras(atualizadas) : atualizadas,
      };
    });
  }

  function removerBarraPorId(dir: 'H' | 'V', id: string) {
    setLajeData(prev => {
      const key = dir === 'H' ? 'barrasH' : 'barrasV';
      return { ...prev, [key]: prev[key].filter(b => b.id !== id) };
    });
  }

  function handleSelectBarraSvg(id: string) {
    setBarraSelId(id);
    const el = cobInputsRef.current[id];
    if (el) {
      el.focus();
      el.select();
    }
  }

  function handleSalvar() {
    const id = amostraInicial?.id ?? newId();
    const item = amostraInicial?.item ?? itemNum;

    if (isLaje) {
      const lajeFinal: LajeData = {
        ...lajeData,
        barrasH: ordenarBarras(lajeData.barrasH),
        barrasV: ordenarBarras(lajeData.barrasV),
      };
      const stats = calcularCobrimentosLaje(lajeFinal);
      onSalvar({
        id,
        item,
        elemento: elemento.trim(),
        tipo: 'laje',
        opcao: (opcao as OpcaoLaje) || 'LA',
        X: lajeFinal.larguraX,
        Y: lajeFinal.alturaY,
        C1,
        C2,
        D,
        barras,
        facesData: {},
        lajeData: lajeFinal,
        ...stats,
        fotoFile: amostraInicial?.fotoFile,
        fotoPreview: amostraInicial?.fotoPreview,
      });
      return;
    }

    const allFacesData: Record<string, FaceData> = {};
    faces.forEach(f => {
      allFacesData[f] = getFaceData(f);
    });
    const stats = calcularCobrimentos(allFacesData);
    onSalvar({
      id,
      item,
      elemento: elemento.trim(),
      tipo,
      opcao: opcao!,
      X,
      Y,
      C1,
      C2,
      D,
      barras,
      facesData: allFacesData,
      ...stats,
      fotoFile: amostraInicial?.fotoFile,
      fotoPreview: amostraInicial?.fotoPreview,
    });
  }

  const podeAvancar1 = !!opcao && elemento.trim().length > 0;
  const totalBarrasLaje = lajeData.barrasH.length + lajeData.barrasV.length;
  const podeAvancar2 = isLaje ? totalBarrasLaje > 0 : true;

  const placeholderElemento =
    tipo === 'pilar'
      ? 'EX: P1 – TÉRREO'
      : tipo === 'viga'
        ? 'EX: V1 – PAV. TIPO'
        : 'EX: L1 – LAJE GARAGEM';

  const barrasHOrd = ordenarBarras(lajeData.barrasH);
  const barrasVOrd = ordenarBarras(lajeData.barrasV);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 820, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.22)' }}>
        {/* Header modal */}
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: PRIMARY }}>
              {amostraInicial ? 'Editar amostra' : 'Nova amostra'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: SUBTEXT }}>Item {amostraInicial?.item ?? itemNum}</p>
          </div>
          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {([1, 2, 3] as const).map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: etapa > s ? SUCCESS : etapa === s ? PRIMARY : BORDER, color: etapa >= s ? '#fff' : SUBTEXT }}>
                  {etapa > s ? '✓' : s}
                </div>
                {i < 2 && <div style={{ width: 20, height: 1, background: BORDER }} />}
              </div>
            ))}
          </div>
          <button onClick={onFechar} aria-label="Fechar modal" style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUBTEXT }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* ── ETAPA 1: IDENTIFICAÇÃO, TIPO E CONFIGURAÇÃO ── */}
          {etapa === 1 && (
            <div>
              {/* Seletor de Tipo de Elemento */}
              <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Tipo de elemento estrutural
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
                {([
                  {
                    id: 'pilar' as const,
                    titulo: 'Pilar',
                    subtitulo: 'Desenho vertical (seção + perfil)',
                    icon: (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="7" y="2" width="10" height="20" rx="1.5" />
                        <line x1="10" y1="4" x2="10" y2="20" />
                        <line x1="14" y1="4" x2="14" y2="20" />
                        <line x1="7" y1="8" x2="17" y2="8" />
                        <line x1="7" y1="16" x2="17" y2="16" />
                      </svg>
                    ),
                  },
                  {
                    id: 'viga' as const,
                    titulo: 'Viga',
                    subtitulo: 'Desenho horizontal (estribos verticais)',
                    icon: (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="7" width="20" height="10" rx="1.5" />
                        <line x1="4" y1="10" x2="20" y2="10" />
                        <line x1="4" y1="14" x2="20" y2="14" />
                        <line x1="8" y1="7" x2="8" y2="17" />
                        <line x1="16" y1="7" x2="16" y2="17" />
                      </svg>
                    ),
                  },
                  {
                    id: 'laje' as const,
                    titulo: 'Área Livre / Laje',
                    subtitulo: 'Desenho livre em malha quadrada',
                    icon: (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="1.5" />
                        <line x1="3" y1="9" x2="21" y2="9" />
                        <line x1="3" y1="15" x2="21" y2="15" />
                        <line x1="9" y1="3" x2="9" y2="21" />
                        <line x1="15" y1="3" x2="15" y2="21" />
                      </svg>
                    ),
                  },
                ]).map(item => {
                  const ativo = tipo === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selecionarTipo(item.id)}
                      style={{
                        border: `1.5px solid ${ativo ? PRIMARY : BORDER}`,
                        borderRadius: 10,
                        padding: '12px 14px',
                        cursor: 'pointer',
                        background: ativo ? '#EEF2FF' : '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 11,
                        textAlign: 'left',
                        fontFamily: 'inherit',
                      }}
                    >
                      <div style={{ width: 38, height: 38, borderRadius: 8, background: ativo ? PRIMARY : '#F1F5F9', color: ativo ? '#fff' : SUBTEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {item.icon}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: ativo ? PRIMARY : TEXT }}>{item.titulo}</div>
                        <div style={{ fontSize: 11, color: SUBTEXT, marginTop: 2, lineHeight: 1.25 }}>{item.subtitulo}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Identificação */}
              <div style={{ marginBottom: 20 }}>
                <Campo label="Identificação do elemento" htmlFor="elem-nome">
                  <input
                    id="elem-nome"
                    style={{ ...inputStyle, textTransform: 'uppercase' }}
                    value={elemento}
                    onChange={e => setElemento(e.target.value.toUpperCase())}
                    placeholder={placeholderElemento}
                  />
                </Campo>
              </div>

              {/* Opções conforme o tipo */}
              {tipo === 'pilar' && (
                <>
                  <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Acessibilidade do pilar em campo
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 12 }}>
                    {(Object.keys(OPCOES_PILAR) as OpcaoPilar[]).map(id => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setOpcao(id)}
                        style={{
                          border: `1.5px solid ${opcao === id ? PRIMARY : BORDER}`,
                          borderRadius: 10,
                          padding: '10px 6px 8px',
                          cursor: 'pointer',
                          background: opcao === id ? '#EEF2FF' : '#fff',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 6,
                          fontFamily: 'inherit',
                        }}
                      >
                        <div dangerouslySetInnerHTML={{ __html: svgOpcaoPilar(id) }} style={{ lineHeight: 0 }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: opcao === id ? PRIMARY : SUBTEXT, textAlign: 'center', lineHeight: 1.3 }}>
                          {id} — {OPCOES_PILAR[id].label}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {tipo === 'viga' && (
                <>
                  <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Acessibilidade da viga em campo
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 12 }}>
                    {(Object.keys(OPCOES_VIGA) as OpcaoViga[]).map(id => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setOpcao(id)}
                        style={{
                          border: `1.5px solid ${opcao === id ? PRIMARY : BORDER}`,
                          borderRadius: 10,
                          padding: '10px 6px 8px',
                          cursor: 'pointer',
                          background: opcao === id ? '#EEF2FF' : '#fff',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 6,
                          fontFamily: 'inherit',
                        }}
                      >
                        <div dangerouslySetInnerHTML={{ __html: svgOpcaoViga(id) }} style={{ lineHeight: 0 }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: opcao === id ? PRIMARY : SUBTEXT, textAlign: 'center', lineHeight: 1.3 }}>
                          {OPCOES_VIGA[id].codigo} — {OPCOES_VIGA[id].label}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {tipo === 'laje' && (
                <>
                  <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Configuração da malha na área ensaiada
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
                    {(Object.keys(OPCOES_LAJE) as OpcaoLaje[]).map(id => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => selecionarOpcaoLaje(id)}
                        style={{
                          border: `1.5px solid ${opcao === id ? PRIMARY : BORDER}`,
                          borderRadius: 10,
                          padding: '12px 10px 10px',
                          cursor: 'pointer',
                          background: opcao === id ? '#EEF2FF' : '#fff',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 6,
                          fontFamily: 'inherit',
                        }}
                      >
                        <div dangerouslySetInnerHTML={{ __html: svgOpcaoLaje(id) }} style={{ lineHeight: 0 }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: opcao === id ? PRIMARY : TEXT, textAlign: 'center', lineHeight: 1.3 }}>
                          {OPCOES_LAJE[id].label}
                        </span>
                        <span style={{ fontSize: 10, color: SUBTEXT, textAlign: 'center' }}>
                          {OPCOES_LAJE[id].desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── ETAPA 2: GEOMETRIA / DESENHO NA MALHA ── */}
          {etapa === 2 && tipo === 'pilar' && (
            <div>
              <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Dados geométricos — {isCirc ? 'seção circular' : 'seção transversal do pilar'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px 16px', marginBottom: 20 }}>
                {isCirc ? (
                  <>
                    <Campo label="Diâmetro D (cm)" htmlFor="geom-d">
                      <InteiroInput id="geom-d" style={inputStyle} value={D} min={5} onChange={setD} />
                    </Campo>
                    <Campo label="Nº barras (total)" htmlFor="geom-bcirc">
                      <InteiroInput id="geom-bcirc" style={inputStyle} value={barras['circ'] ?? 6} min={1} onChange={n => setBarras(p => ({ ...p, circ: n }))} />
                    </Campo>
                  </>
                ) : (
                  <>
                    <Campo label="Dimensão X (cm)" htmlFor="geom-x">
                      <InteiroInput id="geom-x" style={inputStyle} value={X} min={5} onChange={setX} />
                    </Campo>
                    <Campo label="Dimensão Y (cm)" htmlFor="geom-y">
                      <InteiroInput id="geom-y" style={inputStyle} value={Y} min={5} onChange={setY} />
                    </Campo>
                    {(['1X', '2X', '1Y', '2Y'] as string[]).map(f => {
                      const enabled = faces.includes(f);
                      return (
                        <Campo key={f} label={`Barras ${FACE_LABELS[f]}`} htmlFor={`geom-b${f}`}>
                          <InteiroInput
                            id={`geom-b${f}`}
                            style={{ ...inputStyle, opacity: enabled ? 1 : 0.4 }}
                            disabled={!enabled}
                            value={barras[f] ?? 2}
                            min={1}
                            onChange={n => setBarras(p => ({ ...p, [f]: n }))}
                          />
                        </Campo>
                      );
                    })}
                  </>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0', background: BG, borderRadius: 10, border: `1px solid ${BORDER}` }}>
                {isCirc ? (
                  <svg width={180} height={160} viewBox="0 0 180 160">
                    {(() => {
                      const r = Math.min(60, D * 1.1), cx = 90, cy = 75;
                      const nb = barras['circ'] || 6;
                      return (
                        <g>
                          <circle cx={cx} cy={cy} r={r} fill="#EEF2F7" stroke={PRIMARY} strokeWidth={2} />
                          <circle cx={cx} cy={cy} r={r * 0.75} fill="none" stroke="#2563EB" strokeWidth={1} strokeDasharray="3,2" />
                          {Array.from({ length: nb }, (_, i) => {
                            const ang = (2 * Math.PI / nb) * i - Math.PI / 2;
                            const bx = cx + r * 0.75 * Math.cos(ang);
                            const by = cy + r * 0.75 * Math.sin(ang);
                            return (
                              <g key={i}>
                                <circle cx={bx} cy={by} r={5} fill="white" stroke="#2563EB" strokeWidth={1.5} />
                                <circle cx={bx} cy={by} r={2.5} fill="#2563EB" />
                              </g>
                            );
                          })}
                          <text x={cx} y={cy + r + 16} textAnchor="middle" fontSize={9} fill="#C8A020">⌀ {D} cm</text>
                        </g>
                      );
                    })()}
                  </svg>
                ) : (
                  <SvgSecaoPilar X={X} Y={Y} C1={C1} C2={C2} faces={faces} barras={barras} />
                )}
              </div>
            </div>
          )}

          {etapa === 2 && isViga && (
            <div>
              <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Dados geométricos — seção transversal da viga
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px 16px', marginBottom: 20 }}>
                <Campo label="Largura b (cm)" htmlFor="viga-b">
                  <InteiroInput id="viga-b" style={inputStyle} value={X} min={5} onChange={setX} />
                </Campo>
                <Campo label="Altura h (cm)" htmlFor="viga-h">
                  <InteiroInput id="viga-h" style={inputStyle} value={Y} min={5} onChange={setY} />
                </Campo>
                {(['fundo', 'topo', 'lat1', 'lat2'] as string[]).map(f => {
                  const enabled = faces.includes(f);
                  return (
                    <Campo key={f} label={`Barras — ${FACE_LABELS[f]}`} htmlFor={`viga-b-${f}`}>
                      <InteiroInput
                        id={`viga-b-${f}`}
                        style={{ ...inputStyle, opacity: enabled ? 1 : 0.4 }}
                        disabled={!enabled}
                        value={barras[f] ?? 2}
                        min={1}
                        onChange={n => setBarras(p => ({ ...p, [f]: n }))}
                      />
                    </Campo>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0', background: BG, borderRadius: 10, border: `1px solid ${BORDER}` }}>
                <SvgSecaoViga b={X} h={Y} C1={C1} C2={C2} faces={faces} barras={barras} />
              </div>
            </div>
          )}

          {etapa === 2 && isLaje && (
            <div>
              <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Desenho livre em malha quadrada — defina a área e clique para posicionar as barras
              </p>

              {/* Parâmetros da malha */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
                <Campo label="Largura Lx (cm)" htmlFor="laje-lx">
                  <InteiroInput
                    id="laje-lx"
                    style={inputStyle}
                    value={lajeData.larguraX}
                    min={20}
                    onChange={v => setLajeData(p => ({
                      ...p,
                      larguraX: v,
                      barrasV: p.barrasV.filter(b => b.pos < v),
                    }))}
                  />
                </Campo>
                <Campo label="Altura Ly (cm)" htmlFor="laje-ly">
                  <InteiroInput
                    id="laje-ly"
                    style={inputStyle}
                    value={lajeData.alturaY}
                    min={20}
                    onChange={v => setLajeData(p => ({
                      ...p,
                      alturaY: v,
                      barrasH: p.barrasH.filter(b => b.pos < v),
                    }))}
                  />
                </Campo>
                <Campo label="Passo da malha (cm)" htmlFor="laje-passo">
                  <select
                    id="laje-passo"
                    style={inputStyle}
                    value={lajeData.passoGrid}
                    onChange={e => setLajeData(p => ({ ...p, passoGrid: Number(e.target.value) }))}
                  >
                    <option value={5}>5 cm</option>
                    <option value={10}>10 cm</option>
                    <option value={15}>15 cm</option>
                    <option value={20}>20 cm</option>
                  </select>
                </Campo>
                <Campo label="Gerar malha regular (cm)" htmlFor="laje-esp">
                  <div style={{ display: 'flex', gap: 6 }}>
                    <InteiroInput id="laje-esp" style={{ ...inputStyle, padding: '8px 8px' }} value={espRapido} min={5} onChange={setEspRapido} />
                    <button
                      type="button"
                      onClick={() => setLajeData(p => gerarMalhaRegular(p.larguraX, p.alturaY, espRapido, lajeCfg.permiteH, lajeCfg.permiteV, p.passoGrid))}
                      style={{ padding: '0 10px', borderRadius: 7, border: 'none', background: PRIMARY, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
                    >
                      Aplicar
                    </button>
                  </div>
                </Campo>
              </div>

              {/* Barra de ferramentas de desenho livre */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12, padding: '8px 12px', background: '#F1F5F9', borderRadius: 8, border: `1px solid ${BORDER}` }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {lajeCfg.permiteH && (
                    <button
                      type="button"
                      onClick={() => setFerramenta('addH')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        border: `1.5px solid ${ferramenta === 'addH' ? FACE_COLORS.dirH : BORDER}`,
                        background: ferramenta === 'addH' ? FACE_COLORS.dirH : '#fff',
                        color: ferramenta === 'addH' ? '#fff' : FACE_COLORS.dirH,
                      }}
                    >
                      ━ Barra Horizontal (H)
                    </button>
                  )}
                  {lajeCfg.permiteV && (
                    <button
                      type="button"
                      onClick={() => setFerramenta('addV')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        border: `1.5px solid ${ferramenta === 'addV' ? FACE_COLORS.dirV : BORDER}`,
                        background: ferramenta === 'addV' ? FACE_COLORS.dirV : '#fff',
                        color: ferramenta === 'addV' ? '#fff' : FACE_COLORS.dirV,
                      }}
                    >
                      ┃ Barra Vertical (V)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setFerramenta('remove')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      border: `1.5px solid ${ferramenta === 'remove' ? DANGER : BORDER}`,
                      background: ferramenta === 'remove' ? DANGER : '#fff',
                      color: ferramenta === 'remove' ? '#fff' : DANGER,
                    }}
                  >
                    ✕ Remover
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: SUBTEXT }}>
                    {barrasHOrd.length} H · {barrasVOrd.length} V
                  </span>
                  <button
                    type="button"
                    onClick={() => setLajeData(p => ({ ...p, barrasH: [], barrasV: [] }))}
                    style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1px solid ${BORDER}`, background: '#fff', color: SUBTEXT, fontFamily: 'inherit' }}
                  >
                    Limpar malha
                  </button>
                </div>
              </div>

              {/* Canvas interativo da malha quadrada */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 8px', background: BG, borderRadius: 10, border: `1px solid ${BORDER}` }}>
                <SvgMalhaLaje
                  lajeData={lajeData}
                  modo="editor"
                  ferramenta={ferramenta}
                  onToggleBarraH={pos => toggleBarra('H', pos)}
                  onToggleBarraV={pos => toggleBarra('V', pos)}
                />
                <p style={{ margin: '6px 0 0', fontSize: 11, color: SUBTEXT, textAlign: 'center' }}>
                  Clique na malha para adicionar ou remover uma barra na posição destacada (grade de {lajeData.passoGrid} cm).
                  {totalBarrasLaje === 0 && (
                    <strong style={{ color: DANGER }}> Adicione pelo menos 1 barra para continuar.</strong>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* ── ETAPA 3: LEITURAS DE COBRIMENTO E ESPAÇAMENTO ── */}
          {etapa === 3 && tipo === 'pilar' && (
            <div>
              <p style={{ margin: '0 0 16px', fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Vistas laterais — dados do ensaio por face
              </p>
              {faces.map((face, fi) => {
                const fd = getFaceData(face);
                const nBarras = isCirc ? (barras['circ'] || 6) : (barras[face] || 2);
                const col = FACE_COLORS[face] || '#2563EB';
                return (
                  <div key={face} style={{ marginBottom: fi < faces.length - 1 ? 24 : 0 }}>
                    <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: col, background: col + '18', borderRadius: 6, padding: '3px 10px', marginBottom: 12 }}>
                      {FACE_LABELS[face]}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, alignItems: 'start' }}>
                      <div style={{ background: BG, borderRadius: 8, border: `1px solid ${BORDER}`, padding: 8, display: 'flex', justifyContent: 'center' }}>
                        <SvgPerfilVertical face={face} nBarras={nBarras} fd={fd} C1={C1} />
                      </div>
                      <div>
                        <div style={{ marginBottom: 12 }}>
                          <Campo label="Nº de estribos no trecho" htmlFor={`ne-${face}`}>
                            <InteiroInput
                              id={`ne-${face}`}
                              style={{ ...inputStyle, maxWidth: 120 }}
                              value={fd.nEstribos}
                              min={1}
                              onChange={n => updateFaceData(face, f => ensureFaceArrays({ ...f, nEstribos: n }, nBarras))}
                            />
                          </Campo>
                        </div>
                        <div style={{ height: 1, background: BORDER, marginBottom: 12 }} />
                        <div style={{ background: BG, borderRadius: 8, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ background: PRIMARY }}>
                                <th style={{ padding: '7px 10px', fontSize: 11, fontWeight: 600, color: '#fff', textAlign: 'center', width: 56 }}>Estribo</th>
                                <th style={{ padding: '7px 10px', fontSize: 11, fontWeight: 600, color: '#fff', textAlign: 'center' }}>Cobrimento (mm)</th>
                                <th style={{ padding: '7px 10px', fontSize: 11, fontWeight: 600, color: '#fff', textAlign: 'center' }}>Esp. Estribos (cm)</th>
                                <th style={{ padding: '7px 10px', fontSize: 11, fontWeight: 600, color: '#fff', textAlign: 'center' }}>Esp. Long. (cm)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Array.from({ length: fd.nEstribos }, (_, i) => (
                                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#F8F9FA', borderBottom: `1px solid ${BORDER}` }}>
                                  <td style={{ padding: '6px 10px', fontSize: 12, fontWeight: 700, color: col, textAlign: 'center' }}>C{i + 1}</td>
                                  <td style={{ padding: '4px 6px' }}>
                                    <input type="text" inputMode="decimal" value={fd.cob[i] ?? ''} placeholder="—" style={{ border: 'none', outline: 'none', width: '100%', textAlign: 'center', background: 'transparent', fontSize: 13 }} onChange={e => updateFaceData(face, f => { const c = [...f.cob]; c[i] = e.target.value; return { ...f, cob: c }; })} />
                                  </td>
                                  <td style={{ padding: '4px 6px' }}>
                                    {i < fd.nEstribos - 1
                                      ? <input type="text" inputMode="decimal" value={fd.espV[i] ?? ''} placeholder="—" style={{ border: 'none', outline: 'none', width: '100%', textAlign: 'center', background: 'transparent', fontSize: 13 }} onChange={e => updateFaceData(face, f => { const ev = [...f.espV]; ev[i] = e.target.value; return { ...f, espV: ev }; })} />
                                      : <span style={{ display: 'block', textAlign: 'center', color: SUBTEXT, fontSize: 12 }}>—</span>}
                                  </td>
                                  <td style={{ padding: '4px 6px' }}>
                                    {i < fd.espH.length
                                      ? <input type="text" inputMode="decimal" value={fd.espH[i] ?? ''} placeholder="—" style={{ border: 'none', outline: 'none', width: '100%', textAlign: 'center', background: 'transparent', fontSize: 13 }} onChange={e => updateFaceData(face, f => { const eh = [...f.espH]; eh[i] = e.target.value; return { ...f, espH: eh }; })} />
                                      : <span style={{ display: 'block', textAlign: 'center', color: SUBTEXT, fontSize: 12 }}>—</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                    {fi < faces.length - 1 && <div style={{ height: 1, background: BORDER, marginTop: 20 }} />}
                  </div>
                );
              })}
            </div>
          )}

          {etapa === 3 && isViga && (
            <div>
              <p style={{ margin: '0 0 16px', fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Vistas horizontais da viga — dados do ensaio por face
              </p>
              {faces.map((face, fi) => {
                const fd = getFaceData(face);
                const nBarras = barras[face] || 2;
                const col = FACE_COLORS[face] || '#2563EB';
                return (
                  <div key={face} style={{ marginBottom: fi < faces.length - 1 ? 26 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                      <div style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, color: col, background: col + '18', borderRadius: 6, padding: '4px 10px' }}>
                        {FACE_LABELS[face]} ({nBarras} barras long.)
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label htmlFor={`ne-viga-${face}`} style={{ fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase' }}>
                          Nº de estribos:
                        </label>
                        <InteiroInput
                          id={`ne-viga-${face}`}
                          style={{ ...inputStyle, width: 72, padding: '5px 8px', textAlign: 'center' }}
                          value={fd.nEstribos}
                          min={1}
                          onChange={n => updateFaceData(face, f => ensureFaceArrays({ ...f, nEstribos: n }, nBarras))}
                        />
                      </div>
                    </div>

                    {/* Desenho HORIZONTAL em destaque */}
                    <div style={{ background: BG, borderRadius: 8, border: `1px solid ${BORDER}`, padding: '10px 12px', display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                      <SvgPerfilHorizontal face={face} nBarras={nBarras} fd={fd} C1={C1} />
                    </div>

                    {/* Tabela compacta por estribo */}
                    <div style={{ background: BG, borderRadius: 8, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: PRIMARY }}>
                            <th style={{ padding: '7px 10px', fontSize: 11, fontWeight: 600, color: '#fff', textAlign: 'center', width: 64 }}>Estribo</th>
                            <th style={{ padding: '7px 10px', fontSize: 11, fontWeight: 600, color: '#fff', textAlign: 'center' }}>Cobrimento (mm)</th>
                            <th style={{ padding: '7px 10px', fontSize: 11, fontWeight: 600, color: '#fff', textAlign: 'center' }}>Esp. Estribos (cm)</th>
                            <th style={{ padding: '7px 10px', fontSize: 11, fontWeight: 600, color: '#fff', textAlign: 'center' }}>Esp. Long. (cm)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: fd.nEstribos }, (_, i) => (
                            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#F8F9FA', borderBottom: `1px solid ${BORDER}` }}>
                              <td style={{ padding: '6px 10px', fontSize: 12, fontWeight: 700, color: col, textAlign: 'center' }}>E{i + 1}</td>
                              <td style={{ padding: '4px 6px' }}>
                                <input type="text" inputMode="decimal" value={fd.cob[i] ?? ''} placeholder="—" style={{ border: 'none', outline: 'none', width: '100%', textAlign: 'center', background: 'transparent', fontSize: 13 }} onChange={e => updateFaceData(face, f => { const c = [...f.cob]; c[i] = e.target.value; return { ...f, cob: c }; })} />
                              </td>
                              <td style={{ padding: '4px 6px' }}>
                                {i < fd.nEstribos - 1
                                  ? <input type="text" inputMode="decimal" value={fd.espV[i] ?? ''} placeholder="—" style={{ border: 'none', outline: 'none', width: '100%', textAlign: 'center', background: 'transparent', fontSize: 13 }} onChange={e => updateFaceData(face, f => { const ev = [...f.espV]; ev[i] = e.target.value; return { ...f, espV: ev }; })} />
                                  : <span style={{ display: 'block', textAlign: 'center', color: SUBTEXT, fontSize: 12 }}>—</span>}
                              </td>
                              <td style={{ padding: '4px 6px' }}>
                                {i < fd.espH.length
                                  ? <input type="text" inputMode="decimal" value={fd.espH[i] ?? ''} placeholder="—" style={{ border: 'none', outline: 'none', width: '100%', textAlign: 'center', background: 'transparent', fontSize: 13 }} onChange={e => updateFaceData(face, f => { const eh = [...f.espH]; eh[i] = e.target.value; return { ...f, espH: eh }; })} />
                                  : <span style={{ display: 'block', textAlign: 'center', color: SUBTEXT, fontSize: 12 }}>—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {fi < faces.length - 1 && <div style={{ height: 1, background: BORDER, marginTop: 22 }} />}
                  </div>
                );
              })}
            </div>
          )}

          {etapa === 3 && isLaje && (
            <div>
              <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Leituras de cobrimento na malha — clique numa barra no desenho ou preencha na tabela
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: 16, alignItems: 'start' }}>
                {/* Malha com cotas e cobrimentos */}
                <div style={{ background: BG, borderRadius: 10, border: `1px solid ${BORDER}`, padding: 8, display: 'flex', justifyContent: 'center', position: 'sticky', top: 72 }}>
                  <SvgMalhaLaje
                    lajeData={lajeData}
                    modo="leitura"
                    barraSelecionadaId={barraSelId}
                    onSelectBarra={handleSelectBarraSvg}
                  />
                </div>

                {/* Tabelas H e V */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {barrasHOrd.length > 0 && (
                    <div>
                      <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: FACE_COLORS.dirH, background: FACE_COLORS.dirH + '18', borderRadius: 6, padding: '3px 10px', marginBottom: 8 }}>
                        Barras Horizontais — Direção X ({barrasHOrd.length})
                      </div>
                      <div style={{ background: BG, borderRadius: 8, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: PRIMARY }}>
                              <th style={{ padding: '7px 8px', fontSize: 11, fontWeight: 600, color: '#fff', textAlign: 'center', width: 52 }}>Barra</th>
                              <th style={{ padding: '7px 8px', fontSize: 11, fontWeight: 600, color: '#fff', textAlign: 'center' }}>Pos. Y (cm)</th>
                              <th style={{ padding: '7px 8px', fontSize: 11, fontWeight: 600, color: '#fff', textAlign: 'center' }}>Esp. (cm)</th>
                              <th style={{ padding: '7px 8px', fontSize: 11, fontWeight: 600, color: '#fff', textAlign: 'center' }}>Cobrimento (mm)</th>
                              <th style={{ padding: '7px 6px', width: 32 }} />
                            </tr>
                          </thead>
                          <tbody>
                            {barrasHOrd.map((b, i) => {
                              const esp = i > 0 ? Math.round((b.pos - barrasHOrd[i - 1].pos) * 10) / 10 : null;
                              const sel = barraSelId === b.id;
                              return (
                                <tr key={b.id} style={{ background: sel ? '#EEF2FF' : i % 2 === 0 ? '#fff' : '#F8F9FA', borderBottom: `1px solid ${BORDER}` }}>
                                  <td style={{ padding: '6px 8px', fontSize: 12, fontWeight: 700, color: FACE_COLORS.dirH, textAlign: 'center' }}>H{i + 1}</td>
                                  <td style={{ padding: '4px 6px' }}>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={String(b.pos)}
                                      style={{ border: 'none', outline: 'none', width: '100%', textAlign: 'center', background: 'transparent', fontSize: 12.5, color: TEXT }}
                                      onFocus={() => setBarraSelId(b.id)}
                                      onChange={e => {
                                        const v = parseFloat(e.target.value.replace(',', '.'));
                                        if (!isNaN(v) && v >= 0 && v <= lajeData.alturaY) {
                                          atualizarBarra('H', b.id, { pos: v });
                                        }
                                      }}
                                    />
                                  </td>
                                  <td style={{ padding: '6px 8px', fontSize: 12, color: SUBTEXT, textAlign: 'center' }}>
                                    {esp !== null ? `${esp} cm` : '—'}
                                  </td>
                                  <td style={{ padding: '4px 6px' }}>
                                    <input
                                      ref={el => { cobInputsRef.current[b.id] = el; }}
                                      type="text"
                                      inputMode="decimal"
                                      value={b.cob}
                                      placeholder="—"
                                      style={{ border: 'none', outline: 'none', width: '100%', textAlign: 'center', background: 'transparent', fontSize: 13, fontWeight: 700, color: TEXT }}
                                      onFocus={() => setBarraSelId(b.id)}
                                      onChange={e => atualizarBarra('H', b.id, { cob: e.target.value })}
                                    />
                                  </td>
                                  <td style={{ padding: '4px', textAlign: 'center' }}>
                                    <button type="button" onClick={() => removerBarraPorId('H', b.id)} aria-label="Remover barra" style={{ border: 'none', background: 'transparent', color: DANGER, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>✕</button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {barrasVOrd.length > 0 && (
                    <div>
                      <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: FACE_COLORS.dirV, background: FACE_COLORS.dirV + '18', borderRadius: 6, padding: '3px 10px', marginBottom: 8 }}>
                        Barras Verticais — Direção Y ({barrasVOrd.length})
                      </div>
                      <div style={{ background: BG, borderRadius: 8, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: PRIMARY }}>
                              <th style={{ padding: '7px 8px', fontSize: 11, fontWeight: 600, color: '#fff', textAlign: 'center', width: 52 }}>Barra</th>
                              <th style={{ padding: '7px 8px', fontSize: 11, fontWeight: 600, color: '#fff', textAlign: 'center' }}>Pos. X (cm)</th>
                              <th style={{ padding: '7px 8px', fontSize: 11, fontWeight: 600, color: '#fff', textAlign: 'center' }}>Esp. (cm)</th>
                              <th style={{ padding: '7px 8px', fontSize: 11, fontWeight: 600, color: '#fff', textAlign: 'center' }}>Cobrimento (mm)</th>
                              <th style={{ padding: '7px 6px', width: 32 }} />
                            </tr>
                          </thead>
                          <tbody>
                            {barrasVOrd.map((b, i) => {
                              const esp = i > 0 ? Math.round((b.pos - barrasVOrd[i - 1].pos) * 10) / 10 : null;
                              const sel = barraSelId === b.id;
                              return (
                                <tr key={b.id} style={{ background: sel ? '#FEF2F2' : i % 2 === 0 ? '#fff' : '#F8F9FA', borderBottom: `1px solid ${BORDER}` }}>
                                  <td style={{ padding: '6px 8px', fontSize: 12, fontWeight: 700, color: FACE_COLORS.dirV, textAlign: 'center' }}>V{i + 1}</td>
                                  <td style={{ padding: '4px 6px' }}>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={String(b.pos)}
                                      style={{ border: 'none', outline: 'none', width: '100%', textAlign: 'center', background: 'transparent', fontSize: 12.5, color: TEXT }}
                                      onFocus={() => setBarraSelId(b.id)}
                                      onChange={e => {
                                        const v = parseFloat(e.target.value.replace(',', '.'));
                                        if (!isNaN(v) && v >= 0 && v <= lajeData.larguraX) {
                                          atualizarBarra('V', b.id, { pos: v });
                                        }
                                      }}
                                    />
                                  </td>
                                  <td style={{ padding: '6px 8px', fontSize: 12, color: SUBTEXT, textAlign: 'center' }}>
                                    {esp !== null ? `${esp} cm` : '—'}
                                  </td>
                                  <td style={{ padding: '4px 6px' }}>
                                    <input
                                      ref={el => { cobInputsRef.current[b.id] = el; }}
                                      type="text"
                                      inputMode="decimal"
                                      value={b.cob}
                                      placeholder="—"
                                      style={{ border: 'none', outline: 'none', width: '100%', textAlign: 'center', background: 'transparent', fontSize: 13, fontWeight: 700, color: TEXT }}
                                      onFocus={() => setBarraSelId(b.id)}
                                      onChange={e => atualizarBarra('V', b.id, { cob: e.target.value })}
                                    />
                                  </td>
                                  <td style={{ padding: '4px', textAlign: 'center' }}>
                                    <button type="button" onClick={() => removerBarraPorId('V', b.id)} aria-label="Remover barra" style={{ border: 'none', background: 'transparent', color: DANGER, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>✕</button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer modal */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', bottom: 0, background: '#fff' }}>
          <button
            type="button"
            onClick={etapa === 1 ? onFechar : () => setEtapa(e => (e - 1) as 1 | 2 | 3)}
            style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#F0F2F8', color: TEXT, border: 'none' }}
          >
            {etapa === 1 ? 'Cancelar' : '← Voltar'}
          </button>
          {etapa < 3 ? (
            <button
              type="button"
              onClick={() => setEtapa(e => (e + 1) as 2 | 3)}
              disabled={etapa === 1 ? !podeAvancar1 : !podeAvancar2}
              style={{
                padding: '8px 22px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: (etapa === 1 ? podeAvancar1 : podeAvancar2) ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                background: PRIMARY,
                color: '#fff',
                border: 'none',
                opacity: (etapa === 1 ? podeAvancar1 : podeAvancar2) ? 1 : 0.45,
              }}
            >
              Próximo →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSalvar}
              style={{ padding: '8px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: SUCCESS, color: '#fff', border: 'none' }}
            >
              ✓ Confirmar amostra
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
