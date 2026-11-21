'use client';
// src/modules/pacometria/components/ModalAmostra.tsx

import { useState, useRef } from 'react';
import {
  CORES_PLANILHA,
  CelulaFicha,
  InteiroInput,
  PainelPlanilha,
  fichaInputStyle,
  tabelaHeaderStyle,
  tabelaThTextStyle,
} from '@/components/PlanilhaUI';
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
  SvgIndicadorFace,
  SvgMalhaLaje,
  SvgPerfilHorizontal,
  SvgPerfilVertical,
  SvgSecaoPilar,
  SvgSecaoViga,
  svgOpcaoLaje,
  svgOpcaoPilar,
  svgOpcaoViga,
} from './PacometriaSvgs';

const {
  PRIMARY,
  GOLD,
  BG,
  BORDER,
  BORDER_CELL,
  BORDER_PANEL,
  HEADER_SUB,
  ZEBRA,
  TEXT,
  SUBTEXT,
  SUCCESS,
  DANGER,
} = CORES_PLANILHA;

const PERP_COLOR = '#0F766E';

const cellInputCenter: React.CSSProperties = {
  ...fichaInputStyle,
  textAlign: 'center',
  fontWeight: 600,
  height: 26,
};

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
    setLajeData(prev => {
      const novaExt: 'H' | 'V' =
        cfg.permiteH && cfg.permiteV
          ? (prev.camadaExterna ?? 'H')
          : cfg.permiteH
            ? 'H'
            : 'V';
      return {
        ...prev,
        camadaExterna: novaExt,
        barrasH: cfg.permiteH
          ? (prev.barrasH.length > 0 ? prev.barrasH : gerarMalhaRegular(prev.larguraX, prev.alturaY, espRapido, true, false, prev.passoGrid, novaExt).barrasH)
          : [],
        barrasV: cfg.permiteV
          ? (prev.barrasV.length > 0 ? prev.barrasV : gerarMalhaRegular(prev.larguraX, prev.alturaY, espRapido, false, true, prev.passoGrid, novaExt).barrasV)
          : [],
      };
    });
    if (!cfg.permiteH && ferramenta === 'addH') setFerramenta('addV');
    if (!cfg.permiteV && ferramenta === 'addV') setFerramenta('addH');
  }

  // Helpers Pilar / Viga
  function getFaceData(face: string): FaceData {
    const nb = isCirc ? (barras['circ'] || 6) : (barras[face] || 2);
    const fd = facesData[face] || initFaceData();
    return ensureFaceArrays(fd, nb);
  }

  function updateFaceData(face: string, updater: (fd: FaceData) => FaceData) {
    const nb = isCirc ? (barras['circ'] || 6) : (barras[face] || 2);
    setFacesData(prev => {
      const current = prev[face] || initFaceData();
      const updated = updater(ensureFaceArrays(current, nb));
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

  // Renderiza as tabelas padronizadas da Etapa 3 para Pilar e Viga
  // Regra estrutural (NBR 6118): cobrimento na face é SEMPRE nos estribos (camada externa);
  // barras longitudinais ficam atrás dos estribos (apenas espaçamento e distância às bordas perpendiculares).
  function renderTabelasFace(face: string, nBarras: number, fd: FaceData) {
    const col = FACE_COLORS[face] || '#2563EB';
    const labelIni = isViga ? 'Borda Sup. → B1 (mm)' : 'Borda Esq. → B1 (mm)';
    const labelFim = isViga ? `B${nBarras} → Borda Inf. (mm)` : `B${nBarras} → Borda Dir. (mm)`;
    const colsEst = Math.min(Math.max(1, fd.nEstribos - 1), 4);
    const colsLong = Math.min(Math.max(1, nBarras - 1), 4);

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 14, alignItems: 'start' }}>
        {/* BLOCO 1: ESTRIBOS (CAMADA EXTERNA — DEFINE COBRIMENTO) */}
        <div style={{ border: `1px solid ${BORDER_PANEL}`, borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
          <div style={{ padding: '6px 12px', background: HEADER_SUB, borderBottom: `1px solid ${BORDER_PANEL}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Estribos ({fd.nEstribos})
            </span>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: col }}>Camada externa — define cobrimento</span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={tabelaHeaderStyle}>
                <th style={{ ...tabelaThTextStyle, padding: '6px 8px', width: 72 }}>Estribo</th>
                <th style={{ ...tabelaThTextStyle, padding: '6px 8px', borderLeft: `1px solid ${BORDER_CELL}` }}>Cobrimento na face (mm)</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: fd.nEstribos }, (_, i) => (
                <tr key={i} style={{ background: i % 2 === 1 ? ZEBRA : '#fff', borderTop: i > 0 ? `1px solid ${BORDER_CELL}` : undefined }}>
                  <td style={{ padding: '4px 8px', fontSize: 12, fontWeight: 800, color: col, textAlign: 'center' }}>E{i + 1}</td>
                  <td className="planilha-cell" style={{ padding: '2px 8px', borderLeft: `1px solid ${BORDER_CELL}` }}>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={fd.cob[i] ?? ''}
                      placeholder="—"
                      style={cellInputCenter}
                      onChange={e => updateFaceData(face, f => {
                        const c = [...f.cob];
                        c[i] = e.target.value;
                        return { ...f, cob: c };
                      })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {fd.nEstribos > 1 && (
            <div style={{ borderTop: `1px solid ${BORDER_PANEL}` }}>
              <div style={{ padding: '5px 12px', background: HEADER_SUB, borderBottom: `1px solid ${BORDER_CELL}` }}>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Espaçamento entre estribos (cm)
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colsEst}, minmax(0, 1fr))` }}>
                {Array.from({ length: fd.nEstribos - 1 }, (_, i) => (
                  <CelulaFicha
                    key={i}
                    label={`E${i + 1} – E${i + 2}`}
                    borderRight={(i + 1) % colsEst !== 0 && i < fd.nEstribos - 2}
                    borderBottom={i < fd.nEstribos - 1 - ((fd.nEstribos - 1) % colsEst || colsEst)}
                  >
                    <input
                      type="text"
                      inputMode="decimal"
                      value={fd.espV[i] ?? ''}
                      placeholder="cm"
                      style={{ ...cellInputCenter, textAlign: 'left' }}
                      onChange={e => updateFaceData(face, f => {
                        const ev = [...f.espV];
                        ev[i] = e.target.value;
                        return { ...f, espV: ev };
                      })}
                    />
                  </CelulaFicha>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* BLOCO 2: BARRAS LONGITUDINAIS (ATRÁS DOS ESTRIBOS — SEM COBRIMENTO NA FACE) */}
        <div style={{ border: `1px solid ${BORDER_PANEL}`, borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
          <div style={{ padding: '6px 12px', background: HEADER_SUB, borderBottom: `1px solid ${BORDER_PANEL}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Barras Longitudinais ({nBarras})
            </span>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: SUBTEXT }}>Internas (atrás dos estribos)</span>
          </div>

          {nBarras > 1 ? (
            <div>
              <div style={{ padding: '5px 12px', background: HEADER_SUB, borderBottom: `1px solid ${BORDER_CELL}` }}>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Espaçamento entre barras longitudinais (cm)
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colsLong}, minmax(0, 1fr))` }}>
                {Array.from({ length: nBarras - 1 }, (_, i) => (
                  <CelulaFicha
                    key={i}
                    label={`B${i + 1} – B${i + 2}`}
                    borderRight={(i + 1) % colsLong !== 0 && i < nBarras - 2}
                    borderBottom={!isCirc || i < nBarras - 1 - ((nBarras - 1) % colsLong || colsLong)}
                  >
                    <input
                      type="text"
                      inputMode="decimal"
                      value={fd.espH[i] ?? ''}
                      placeholder="cm"
                      style={{ ...cellInputCenter, textAlign: 'left' }}
                      onChange={e => updateFaceData(face, f => {
                        const eh = [...f.espH];
                        eh[i] = e.target.value;
                        return { ...f, espH: eh };
                      })}
                    />
                  </CelulaFicha>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '10px 12px', fontSize: 11, color: SUBTEXT, borderBottom: !isCirc ? `1px solid ${BORDER_CELL}` : undefined }}>
              1 barra longitudinal nesta face (sem vão entre barras).
            </div>
          )}

          {/* Cobrimento / distância à face perpendicular nas bordas (apenas se não circular) */}
          {!isCirc && (
            <div style={{ borderTop: nBarras > 1 ? `1px solid ${BORDER_PANEL}` : undefined }}>
              <div style={{ padding: '5px 12px', background: HEADER_SUB, borderBottom: `1px solid ${BORDER_CELL}` }}>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: PERP_COLOR, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Cobrimento perpendicular às bordas (mm) — linha de cota
                </span>
              </div>
              <div className={nBarras > 1 ? 'planilha-grid-2' : undefined}>
                <CelulaFicha label={labelIni} borderRight={nBarras > 1} borderBottom={false}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={fd.cobPerpIni ?? ''}
                    placeholder="mm"
                    style={{ ...cellInputCenter, textAlign: 'left', color: PERP_COLOR }}
                    onChange={e => updateFaceData(face, f => ({ ...f, cobPerpIni: e.target.value }))}
                  />
                </CelulaFicha>
                {nBarras > 1 && (
                  <CelulaFicha label={labelFim} borderBottom={false}>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={fd.cobPerpFim ?? ''}
                      placeholder="mm"
                      style={{ ...cellInputCenter, textAlign: 'left', color: PERP_COLOR }}
                      onChange={e => updateFaceData(face, f => ({ ...f, cobPerpFim: e.target.value }))}
                    />
                  </CelulaFicha>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Renderiza tabela de barras (H ou V) para Laje no padrão Planilha Técnica Compacta
  function renderTabelaLaje(dir: 'H' | 'V', lista: BarraMalha[]) {
    if (lista.length === 0) return null;
    const isH = dir === 'H';
    const cor = isH ? FACE_COLORS.dirH : FACE_COLORS.dirV;
    const camadaExterna: 'H' | 'V' = lajeData.camadaExterna ?? (barrasHOrd.length > 0 ? 'H' : 'V');
    const isExterna = dir === camadaExterna;

    const titulo = isH
      ? `Barras Horizontais — Direção X (${lista.length})`
      : `Barras Verticais — Direção Y (${lista.length})`;
    const maxPos = isH ? lajeData.alturaY : lajeData.larguraX;

    const cobIniKey = isH ? 'cobPerpHSup' : 'cobPerpVEsq';
    const cobFimKey = isH ? 'cobPerpHInf' : 'cobPerpVDir';
    const labelIni = isH ? 'Borda Sup. → H1 (mm)' : 'Borda Esq. → V1 (mm)';
    const labelFim = isH ? `H${lista.length} → Borda Inf. (mm)` : `V${lista.length} → Borda Dir. (mm)`;

    return (
      <PainelPlanilha
        titulo={titulo}
        marginBottom={14}
        direita={
          <span style={{ fontSize: 10, fontWeight: 700, color: isExterna ? '#FDE68A' : '#CBD5E1' }}>
            {isExterna ? '★ Camada externa (define cobrimento)' : 'Camada interna (atrás da externa)'}
          </span>
        }
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={tabelaHeaderStyle}>
                <th style={{ ...tabelaThTextStyle, padding: '7px 8px', width: 58 }}>Barra</th>
                <th style={{ ...tabelaThTextStyle, padding: '7px 8px', borderLeft: `1px solid ${BORDER_CELL}` }}>
                  {isH ? 'Pos. Y (cm)' : 'Pos. X (cm)'}
                </th>
                {isExterna && (
                  <th style={{ ...tabelaThTextStyle, padding: '7px 8px', borderLeft: `1px solid ${BORDER_CELL}` }}>
                    Cobrimento na face (mm)
                  </th>
                )}
                <th style={{ ...tabelaThTextStyle, padding: '7px 6px', borderLeft: `1px solid ${BORDER_CELL}`, width: 34 }} />
              </tr>
            </thead>
            <tbody>
              {lista.map((b, i) => {
                const sel = barraSelId === b.id;
                return (
                  <tr
                    key={b.id}
                    style={{
                      background: sel ? '#EFF6FF' : i % 2 === 1 ? ZEBRA : '#fff',
                      borderTop: i > 0 ? `1px solid ${BORDER_CELL}` : undefined,
                    }}
                  >
                    <td style={{ padding: '4px 8px', fontSize: 12, fontWeight: 800, color: cor, textAlign: 'center' }}>
                      {dir}{i + 1}
                    </td>
                    <td className="planilha-cell" style={{ padding: '2px 6px', borderLeft: `1px solid ${BORDER_CELL}` }}>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={String(b.pos)}
                        style={cellInputCenter}
                        onFocus={() => setBarraSelId(b.id)}
                        onChange={e => {
                          const v = parseFloat(e.target.value.replace(',', '.'));
                          if (!isNaN(v) && v >= 0 && v <= maxPos) {
                            atualizarBarra(dir, b.id, { pos: v });
                          }
                        }}
                      />
                    </td>
                    {isExterna && (
                      <td className="planilha-cell" style={{ padding: '2px 6px', borderLeft: `1px solid ${BORDER_CELL}` }}>
                        <input
                          ref={el => { cobInputsRef.current[b.id] = el; }}
                          type="text"
                          inputMode="decimal"
                          value={b.cob}
                          placeholder="—"
                          style={cellInputCenter}
                          onFocus={() => setBarraSelId(b.id)}
                          onChange={e => atualizarBarra(dir, b.id, { cob: e.target.value })}
                        />
                      </td>
                    )}
                    <td style={{ padding: '2px 4px', textAlign: 'center', borderLeft: `1px solid ${BORDER_CELL}` }}>
                      <button
                        type="button"
                        onClick={() => removerBarraPorId(dir, b.id)}
                        aria-label="Remover barra"
                        style={{ border: 'none', background: 'transparent', color: DANGER, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Cobrimento perpendicular nas bordas (segue a linha de cota) */}
        <div style={{ borderTop: `1px solid ${BORDER_PANEL}` }}>
          <div style={{ padding: '5px 12px', background: HEADER_SUB, borderBottom: `1px solid ${BORDER_CELL}` }}>
            <span style={{ fontSize: 9.5, fontWeight: 800, color: PERP_COLOR, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Cobrimento perpendicular às bordas (mm) — linha de cota
            </span>
          </div>
          <div className={lista.length > 1 ? 'planilha-grid-2' : undefined}>
            <CelulaFicha label={labelIni} borderRight={lista.length > 1} borderBottom={lista.length > 1}>
              <input
                type="text"
                inputMode="decimal"
                value={lajeData[cobIniKey] ?? ''}
                placeholder="mm"
                style={{ ...cellInputCenter, textAlign: 'left', color: PERP_COLOR }}
                onChange={e => setLajeData(p => ({ ...p, [cobIniKey]: e.target.value }))}
              />
            </CelulaFicha>
            {lista.length > 1 && (
              <CelulaFicha label={labelFim} borderBottom={true}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={lajeData[cobFimKey] ?? ''}
                  placeholder="mm"
                  style={{ ...cellInputCenter, textAlign: 'left', color: PERP_COLOR }}
                  onChange={e => setLajeData(p => ({ ...p, [cobFimKey]: e.target.value }))}
                />
              </CelulaFicha>
            )}
          </div>
        </div>

        {/* Rodapé técnico com espaçamentos calculados entre barras consecutivas */}
        {lista.length > 1 && (
          <div style={{ padding: '7px 12px', background: HEADER_SUB, display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'center' }}>
            <span style={{ fontSize: 9.5, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Espaçamentos:
            </span>
            {lista.slice(0, -1).map((b, i) => {
              const esp = Math.round((lista[i + 1].pos - b.pos) * 10) / 10;
              return (
                <span key={b.id} style={{ fontSize: 11, fontWeight: 700, color: TEXT }}>
                  <span style={{ color: cor }}>{dir}{i + 1}–{dir}{i + 2}:</span> {esp} cm
                </span>
              );
            })}
          </div>
        )}
      </PainelPlanilha>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.52)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
      <div style={{ background: BG, borderRadius: 10, border: `1px solid ${BORDER_PANEL}`, width: '100%', maxWidth: 920, maxHeight: '94vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(15,23,42,0.28)' }}>
        {/* Header modal */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER_PANEL}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 20 }}>
          <div style={{ borderLeft: `4px solid ${GOLD}`, paddingLeft: 10 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: PRIMARY }}>
              {amostraInicial ? 'Editar amostra' : 'Nova amostra'}
            </p>
            <p style={{ margin: '1px 0 0', fontSize: 11, color: SUBTEXT }}>Item {amostraInicial?.item ?? itemNum}</p>
          </div>
          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {([
              { s: 1 as const, label: 'Tipo' },
              { s: 2 as const, label: isLaje ? 'Malha' : 'Geometria' },
              { s: 3 as const, label: 'Leituras' },
            ]).map(({ s, label }, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, background: etapa > s ? SUCCESS : etapa === s ? PRIMARY : '#E2E8F0', color: etapa >= s ? '#fff' : SUBTEXT }}>
                    {etapa > s ? '✓' : s}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: etapa === s ? PRIMARY : SUBTEXT }}>{label}</span>
                </div>
                {i < 2 && <div style={{ width: 18, height: 1, background: '#CBD5E1' }} />}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar modal"
            style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${BORDER_PANEL}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUBTEXT }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ padding: '18px 20px' }}>
          {/* ── ETAPA 1: IDENTIFICAÇÃO, TIPO E CONFIGURAÇÃO ── */}
          {etapa === 1 && (
            <div>
              <PainelPlanilha titulo="Identificação e Tipo de Elemento" marginBottom={14}>
                <CelulaFicha label="Identificação do elemento" htmlFor="elem-nome">
                  <input
                    id="elem-nome"
                    style={{ ...fichaInputStyle, textTransform: 'uppercase', fontWeight: 700, fontSize: 13 }}
                    value={elemento}
                    onChange={e => setElemento(e.target.value.toUpperCase())}
                    placeholder={placeholderElemento}
                  />
                </CelulaFicha>
                <div style={{ padding: 12, background: '#fff' }}>
                  <div style={{ fontSize: 9.5, fontWeight: 800, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                    Tipo de elemento estrutural
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                    {([
                      {
                        id: 'pilar' as const,
                        titulo: 'Pilar',
                        subtitulo: 'Desenho vertical (seção + perfil)',
                        icon: (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                            border: `1.5px solid ${ativo ? PRIMARY : BORDER_CELL}`,
                            borderRadius: 8,
                            padding: '10px 12px',
                            cursor: 'pointer',
                            background: ativo ? '#EEF2FF' : '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            textAlign: 'left',
                            fontFamily: 'inherit',
                          }}
                        >
                          <div style={{ width: 34, height: 34, borderRadius: 6, background: ativo ? PRIMARY : HEADER_SUB, color: ativo ? '#fff' : SUBTEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {item.icon}
                          </div>
                          <div>
                            <div style={{ fontSize: 12.5, fontWeight: 800, color: ativo ? PRIMARY : TEXT }}>{item.titulo}</div>
                            <div style={{ fontSize: 10.5, color: SUBTEXT, marginTop: 1, lineHeight: 1.25 }}>{item.subtitulo}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </PainelPlanilha>

              <PainelPlanilha
                titulo={
                  tipo === 'pilar'
                    ? 'Acessibilidade do Pilar em Campo'
                    : tipo === 'viga'
                      ? 'Acessibilidade da Viga em Campo'
                      : 'Configuração da Malha na Área Ensaiada'
                }
                marginBottom={0}
              >
                <div style={{ padding: 12 }}>
                  {tipo === 'pilar' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
                      {(Object.keys(OPCOES_PILAR) as OpcaoPilar[]).map(id => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setOpcao(id)}
                          style={{
                            border: `1.5px solid ${opcao === id ? PRIMARY : BORDER_CELL}`,
                            borderRadius: 8,
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
                  )}

                  {tipo === 'viga' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
                      {(Object.keys(OPCOES_VIGA) as OpcaoViga[]).map(id => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setOpcao(id)}
                          style={{
                            border: `1.5px solid ${opcao === id ? PRIMARY : BORDER_CELL}`,
                            borderRadius: 8,
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
                  )}

                  {tipo === 'laje' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                      {(Object.keys(OPCOES_LAJE) as OpcaoLaje[]).map(id => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => selecionarOpcaoLaje(id)}
                          style={{
                            border: `1.5px solid ${opcao === id ? PRIMARY : BORDER_CELL}`,
                            borderRadius: 8,
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
                  )}
                </div>
              </PainelPlanilha>
            </div>
          )}

          {/* ── ETAPA 2: GEOMETRIA / DESENHO NA MALHA ── */}
          {etapa === 2 && tipo === 'pilar' && (
            <div>
              <PainelPlanilha titulo={`Dados Geométricos — ${isCirc ? 'Seção Circular' : 'Seção Transversal do Pilar'}`} marginBottom={14}>
                {isCirc ? (
                  <div className="planilha-grid-2">
                    <CelulaFicha label="Diâmetro D (cm)" htmlFor="geom-d" borderRight borderBottom={false}>
                      <InteiroInput id="geom-d" style={fichaInputStyle} value={D} min={5} onChange={setD} />
                    </CelulaFicha>
                    <CelulaFicha label="Nº de barras longitudinais (total)" htmlFor="geom-bcirc" borderBottom={false}>
                      <InteiroInput id="geom-bcirc" style={fichaInputStyle} value={barras['circ'] ?? 6} min={1} onChange={n => setBarras(p => ({ ...p, circ: n }))} />
                    </CelulaFicha>
                  </div>
                ) : (
                  <>
                    <div className="planilha-grid-2">
                      <CelulaFicha label="Dimensão X (cm)" htmlFor="geom-x" borderRight>
                        <InteiroInput id="geom-x" style={fichaInputStyle} value={X} min={5} onChange={setX} />
                      </CelulaFicha>
                      <CelulaFicha label="Dimensão Y (cm)" htmlFor="geom-y">
                        <InteiroInput id="geom-y" style={fichaInputStyle} value={Y} min={5} onChange={setY} />
                      </CelulaFicha>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${faces.length}, minmax(0, 1fr))` }}>
                      {faces.map((f, idx) => (
                        <CelulaFicha
                          key={f}
                          label={`● Barras — ${FACE_LABELS[f]}`}
                          htmlFor={`geom-b${f}`}
                          borderRight={idx < faces.length - 1}
                          borderBottom={false}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 9, height: 9, borderRadius: '50%', background: FACE_COLORS[f] || PRIMARY, flexShrink: 0 }} />
                            <InteiroInput
                              id={`geom-b${f}`}
                              style={fichaInputStyle}
                              value={barras[f] ?? 2}
                              min={1}
                              onChange={n => setBarras(p => ({ ...p, [f]: n }))}
                            />
                          </div>
                        </CelulaFicha>
                      ))}
                    </div>
                  </>
                )}
              </PainelPlanilha>

              <PainelPlanilha titulo="Pré-visualização da Seção Transversal" marginBottom={0}>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 8px', background: '#fff' }}>
                  {isCirc ? (
                    <svg width={200} height={180} viewBox="0 0 200 180">
                      {(() => {
                        const r = Math.min(62, Math.max(36, D * 1.1)), cx = 100, cy = 80;
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
                                  <circle cx={bx} cy={by} r={4.5} fill="white" stroke="#2563EB" strokeWidth={1.5} />
                                  <circle cx={bx} cy={by} r={2.2} fill="#2563EB" />
                                </g>
                              );
                            })}
                            <text x={cx} y={cy + r + 20} textAnchor="middle" fontSize={10} fill="#B8890E" fontWeight="700">⌀ {D} cm</text>
                          </g>
                        );
                      })()}
                    </svg>
                  ) : (
                    <SvgSecaoPilar X={X} Y={Y} C1={C1} C2={C2} faces={faces} barras={barras} />
                  )}
                </div>
              </PainelPlanilha>
            </div>
          )}

          {etapa === 2 && isViga && (
            <div>
              <PainelPlanilha titulo="Dados Geométricos — Seção Transversal da Viga" marginBottom={14}>
                <div className="planilha-grid-2">
                  <CelulaFicha label="Largura b (cm)" htmlFor="viga-b" borderRight>
                    <InteiroInput id="viga-b" style={fichaInputStyle} value={X} min={5} onChange={setX} />
                  </CelulaFicha>
                  <CelulaFicha label="Altura h (cm)" htmlFor="viga-h">
                    <InteiroInput id="viga-h" style={fichaInputStyle} value={Y} min={5} onChange={setY} />
                  </CelulaFicha>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${faces.length}, minmax(0, 1fr))` }}>
                  {faces.map((f, idx) => (
                    <CelulaFicha
                      key={f}
                      label={`● Barras — ${FACE_LABELS[f]}`}
                      htmlFor={`viga-b-${f}`}
                      borderRight={idx < faces.length - 1}
                      borderBottom={false}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: FACE_COLORS[f] || PRIMARY, flexShrink: 0 }} />
                        <InteiroInput
                          id={`viga-b-${f}`}
                          style={fichaInputStyle}
                          value={barras[f] ?? 2}
                          min={1}
                          onChange={n => setBarras(p => ({ ...p, [f]: n }))}
                        />
                      </div>
                    </CelulaFicha>
                  ))}
                </div>
              </PainelPlanilha>

              <PainelPlanilha titulo="Pré-visualização da Seção Transversal" marginBottom={0}>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 8px', background: '#fff' }}>
                  <SvgSecaoViga b={X} h={Y} C1={C1} C2={C2} faces={faces} barras={barras} />
                </div>
              </PainelPlanilha>
            </div>
          )}

          {etapa === 2 && isLaje && (
            <div>
              <PainelPlanilha titulo="Parâmetros da Malha Quadrada" marginBottom={14}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                  <CelulaFicha label="Largura Lx (cm)" htmlFor="laje-lx" borderRight borderBottom={false}>
                    <InteiroInput
                      id="laje-lx"
                      style={fichaInputStyle}
                      value={lajeData.larguraX}
                      min={20}
                      onChange={v => setLajeData(p => ({
                        ...p,
                        larguraX: v,
                        barrasV: p.barrasV.filter(b => b.pos < v),
                      }))}
                    />
                  </CelulaFicha>
                  <CelulaFicha label="Altura Ly (cm)" htmlFor="laje-ly" borderRight borderBottom={false}>
                    <InteiroInput
                      id="laje-ly"
                      style={fichaInputStyle}
                      value={lajeData.alturaY}
                      min={20}
                      onChange={v => setLajeData(p => ({
                        ...p,
                        alturaY: v,
                        barrasH: p.barrasH.filter(b => b.pos < v),
                      }))}
                    />
                  </CelulaFicha>
                  <CelulaFicha label="Passo da malha (cm)" htmlFor="laje-passo" borderRight borderBottom={false}>
                    <select
                      id="laje-passo"
                      style={{ ...fichaInputStyle, cursor: 'pointer' }}
                      value={lajeData.passoGrid}
                      onChange={e => setLajeData(p => ({ ...p, passoGrid: Number(e.target.value) }))}
                    >
                      <option value={5}>5 cm</option>
                      <option value={10}>10 cm</option>
                      <option value={15}>15 cm</option>
                      <option value={20}>20 cm</option>
                    </select>
                  </CelulaFicha>
                  <CelulaFicha label="Gerar malha regular (cm)" htmlFor="laje-esp" borderBottom={false}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <InteiroInput id="laje-esp" style={fichaInputStyle} value={espRapido} min={5} onChange={setEspRapido} />
                      <button
                        type="button"
                        onClick={() => setLajeData(p => gerarMalhaRegular(p.larguraX, p.alturaY, espRapido, lajeCfg.permiteH, lajeCfg.permiteV, p.passoGrid, p.camadaExterna))}
                        style={{ padding: '4px 10px', borderRadius: 5, border: 'none', background: PRIMARY, color: '#fff', fontSize: 10.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
                      >
                        Aplicar
                      </button>
                    </div>
                  </CelulaFicha>
                </div>
                {lajeCfg.permiteH && lajeCfg.permiteV && (
                  <div style={{ padding: '8px 12px', background: HEADER_SUB, borderTop: `1px solid ${BORDER_CELL}`, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Armadura mais externa (define o cobrimento da laje):
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {([
                        { id: 'H' as const, label: '━ Barras Horizontais (H)', cor: FACE_COLORS.dirH },
                        { id: 'V' as const, label: '┃ Barras Verticais (V)', cor: FACE_COLORS.dirV },
                      ]).map(opt => {
                        const sel = (lajeData.camadaExterna ?? 'H') === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setLajeData(p => ({ ...p, camadaExterna: opt.id }))}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 5,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              border: `1.5px solid ${sel ? opt.cor : BORDER_CELL}`,
                              background: sel ? opt.cor : '#fff',
                              color: sel ? '#fff' : opt.cor,
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </PainelPlanilha>

              <PainelPlanilha
                titulo={`Desenho Livre na Malha (${lajeData.larguraX} × ${lajeData.alturaY} cm)`}
                marginBottom={0}
                direita={
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#BFDBFE' }}>
                    {barrasHOrd.length} H · {barrasVOrd.length} V
                  </span>
                }
              >
                {/* Barra de ferramentas */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 12px', background: HEADER_SUB, borderBottom: `1px solid ${BORDER_PANEL}` }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {lajeCfg.permiteH && (
                      <button
                        type="button"
                        onClick={() => setFerramenta('addH')}
                        style={{
                          padding: '5px 11px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          border: `1.5px solid ${ferramenta === 'addH' ? FACE_COLORS.dirH : BORDER_CELL}`,
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
                          padding: '5px 11px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          border: `1.5px solid ${ferramenta === 'addV' ? FACE_COLORS.dirV : BORDER_CELL}`,
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
                        padding: '5px 11px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        border: `1.5px solid ${ferramenta === 'remove' ? DANGER : BORDER_CELL}`,
                        background: ferramenta === 'remove' ? DANGER : '#fff',
                        color: ferramenta === 'remove' ? '#fff' : DANGER,
                      }}
                    >
                      ✕ Remover
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLajeData(p => ({ ...p, barrasH: [], barrasV: [] }))}
                    style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1px solid ${BORDER_PANEL}`, background: '#fff', color: SUBTEXT, fontFamily: 'inherit' }}
                  >
                    Limpar malha
                  </button>
                </div>

                <div style={{ padding: '12px', background: '#fff', overflow: 'auto', maxHeight: 420, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
              </PainelPlanilha>
            </div>
          )}

          {/* ── ETAPA 3: LEITURAS DE COBRIMENTO E ESPAÇAMENTO ── */}
          {etapa === 3 && (tipo === 'pilar' || isViga) && (
            <div>
              {faces.map((face, fi) => {
                const fd = getFaceData(face);
                const nBarras = isCirc ? (barras['circ'] || 6) : (barras[face] || 2);
                const tituloFace = `${FACE_LABELS[face]} — ${isViga ? 'Vista Horizontal' : 'Vista Vertical'} (${nBarras} barra${nBarras !== 1 ? 's' : ''})`;
                return (
                  <PainelPlanilha
                    key={face}
                    titulo={tituloFace}
                    marginBottom={fi < faces.length - 1 ? 16 : 0}
                    direita={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <label htmlFor={`ne-${face}`} style={{ fontSize: 10, fontWeight: 700, color: '#BFDBFE', textTransform: 'uppercase' }}>
                          Nº estribos:
                        </label>
                        <InteiroInput
                          id={`ne-${face}`}
                          style={{ width: 52, height: 24, borderRadius: 4, border: '1px solid rgba(255,255,255,0.35)', background: '#fff', color: TEXT, textAlign: 'center', fontSize: 12, fontWeight: 700, outline: 'none' }}
                          value={fd.nEstribos}
                          min={1}
                          onChange={n => updateFaceData(face, f => ensureFaceArrays({ ...f, nEstribos: n }, nBarras))}
                        />
                      </div>
                    }
                  >
                    {/* Área do desenho SVG + miniatura com seta indicando a face vista */}
                    <div
                      style={{
                        padding: '12px',
                        background: '#fff',
                        borderBottom: `1px solid ${BORDER_PANEL}`,
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 16,
                      }}
                    >
                      <div
                        style={{
                          padding: '8px 10px',
                          background: ZEBRA,
                          border: `1px solid ${BORDER_CELL}`,
                          borderRadius: 8,
                          flexShrink: 0,
                        }}
                      >
                        <SvgIndicadorFace
                          tipo={isViga ? 'viga' : 'pilar'}
                          faceAtiva={face}
                          facesLivres={faces}
                        />
                      </div>
                      <div style={{ flex: '1 1 320px', overflow: 'auto', maxHeight: 420, display: 'flex', justifyContent: 'center' }}>
                        {isViga ? (
                          <SvgPerfilHorizontal face={face} nBarras={nBarras} fd={fd} />
                        ) : (
                          <SvgPerfilVertical face={face} nBarras={nBarras} fd={fd} />
                        )}
                      </div>
                    </div>

                    {/* Tabelas padronizadas refletindo exatamente estribos e barras longitudinais */}
                    <div style={{ padding: 12, background: BG }}>
                      {renderTabelasFace(face, nBarras, fd)}
                    </div>
                  </PainelPlanilha>
                );
              })}
            </div>
          )}

          {etapa === 3 && isLaje && (
            <div>
              <PainelPlanilha
                titulo={`Malha Desenhada — ${lajeData.larguraX} × ${lajeData.alturaY} cm (passo ${lajeData.passoGrid} cm)`}
                marginBottom={14}
                direita={
                  lajeCfg.permiteH && lajeCfg.permiteV ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#BFDBFE' }}>Camada externa:</span>
                      {(['H', 'V'] as const).map(dir => {
                        const sel = (lajeData.camadaExterna ?? 'H') === dir;
                        return (
                          <button
                            key={dir}
                            type="button"
                            onClick={() => setLajeData(p => ({ ...p, camadaExterna: dir }))}
                            style={{
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 10.5,
                              fontWeight: 800,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              border: '1px solid rgba(255,255,255,0.45)',
                              background: sel ? GOLD : 'transparent',
                              color: sel ? PRIMARY : '#fff',
                            }}
                          >
                            {dir === 'H' ? 'Horiz. (H)' : 'Vert. (V)'}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#BFDBFE' }}>Clique na barra para editar</span>
                  )
                }
              >
                <div style={{ padding: 12, background: '#fff', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                  <div style={{ padding: '8px 10px', background: ZEBRA, border: `1px solid ${BORDER_CELL}`, borderRadius: 8, flexShrink: 0 }}>
                    <SvgIndicadorFace
                      tipo="laje"
                      camadaExterna={lajeData.camadaExterna ?? (barrasHOrd.length > 0 ? 'H' : 'V')}
                    />
                  </div>
                  <div style={{ flex: '1 1 340px', overflow: 'auto', maxHeight: 420, display: 'flex', justifyContent: 'center' }}>
                    <SvgMalhaLaje
                      lajeData={lajeData}
                      modo="leitura"
                      barraSelecionadaId={barraSelId}
                      onSelectBarra={handleSelectBarraSvg}
                    />
                  </div>
                </div>
              </PainelPlanilha>

              {renderTabelaLaje('H', barrasHOrd)}
              {renderTabelaLaje('V', barrasVOrd)}
            </div>
          )}
        </div>

        {/* Footer modal */}
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${BORDER_PANEL}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', bottom: 0, background: '#fff', zIndex: 20 }}>
          <button
            type="button"
            onClick={etapa === 1 ? onFechar : () => setEtapa(e => (e - 1) as 1 | 2 | 3)}
            style={{ padding: '8px 18px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: HEADER_SUB, color: TEXT, border: `1px solid ${BORDER_PANEL}` }}
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
                borderRadius: 7,
                fontSize: 12.5,
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
              style={{ padding: '8px 22px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: SUCCESS, color: '#fff', border: 'none' }}
            >
              ✓ Confirmar amostra
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
