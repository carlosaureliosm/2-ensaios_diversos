'use client';
// src/app/(dashboard)/ensaios/aderencia/page.tsx

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import {
  MODELOS_SISTEMA_CAMADAS,
  svgEsquemaCamadas,
  numeroRomano,
  obterModeloCamadas,
  criarCorpoDeProva,
  redimensionarCorposDeProva,
  calcularEstatisticasCPs,
  type ModeloSistemaCamadas,
  type SituacaoAderencia,
  type CorpoDeProva,
  type FotoAnexo,
} from '@/modules/aderencia';

const PRIMARY = '#1E3264';
const GOLD = '#C8A020';
const BG = '#F8F9FA';
const BORDER = '#E8EAF0';
const TEXT = '#1A2340';
const SUBTEXT = '#6B7490';
const DANGER = '#C0392B';

const MIN_SITUACOES = 1;
const MAX_SITUACOES = 10;
const NUM_CPS_PADRAO = 6;

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
  fontSize: 13.5, fontFamily: 'inherit', color: TEXT, background: '#fff',
  outline: 'none', width: '100%', boxSizing: 'border-box',
};

const cellInputStyle: React.CSSProperties = {
  padding: '6px 7px', borderRadius: 5, border: `1.5px solid ${BORDER}`,
  fontSize: 12.5, fontFamily: 'inherit', color: TEXT, background: '#fff',
  outline: 'none', width: '100%', boxSizing: 'border-box', textAlign: 'center',
};

function ModeloCard({ modelo, selecionado, onSelecionar }: { modelo: ModeloSistemaCamadas; selecionado: boolean; onSelecionar: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelecionar}
      style={{
        border: `1.5px solid ${selecionado ? PRIMARY : BORDER}`,
        borderRadius: 10,
        padding: '12px 10px',
        cursor: 'pointer',
        background: selecionado ? '#EEF2FF' : '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        textAlign: 'center',
        fontFamily: 'inherit',
      }}
    >
      <div dangerouslySetInnerHTML={{ __html: svgEsquemaCamadas(modelo.camadas, modelo.disposicao) }} style={{ lineHeight: 0, maxWidth: '100%' }} />
      <span style={{ fontSize: 11.5, fontWeight: 700, color: selecionado ? PRIMARY : TEXT, lineHeight: 1.35 }}>{modelo.nome}</span>
    </button>
  );
}

// ── Utilitários de foto ────────────────────────────────────────
function comprimirImagem(file: File): Promise<FotoAnexo> {
  return new Promise((resolve, reject) => {
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
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function FotoSlot({ foto, onEscolher, onRemover, label }: { foto: FotoAnexo | null; onEscolher: (file: File) => void; onRemover: () => void; label: string }) {
  const id = `foto-${label}-${Math.random().toString(36).slice(2)}`;
  return (
    <div style={{ position: 'relative', width: 54, height: 54, flexShrink: 0 }}>
      <input
        id={id}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onEscolher(f); e.target.value = ''; }}
      />
      {foto ? (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <img src={`data:${foto.contentType};base64,${foto.base64}`} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, border: `1.5px solid ${BORDER}` }} />
          <button type="button" onClick={onRemover} title="Remover foto" style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: DANGER, color: '#fff', border: '2px solid #fff', fontSize: 10, lineHeight: '14px', cursor: 'pointer', padding: 0 }}>×</button>
        </div>
      ) : (
        <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', borderRadius: 6, border: `1.5px dashed ${BORDER}`, cursor: 'pointer', color: SUBTEXT, fontSize: 9, fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>
          + {label}
        </label>
      )}
    </div>
  );
}

// ── Formulário de uma Situação ──────────────────────────────────
function SituacaoForm({
  situacao,
  modelo,
  onChange,
}: {
  situacao: SituacaoAderencia;
  modelo: ModeloSistemaCamadas;
  onChange: (next: SituacaoAderencia) => void;
}) {
  function atualizar<K extends keyof SituacaoAderencia>(campo: K, valor: SituacaoAderencia[K]) {
    onChange({ ...situacao, [campo]: valor });
  }

  function alterarNumCPs(n: number) {
    const numCPs = Math.max(1, n || 1);
    const corposDeProva = redimensionarCorposDeProva(situacao.corposDeProva, numCPs, modelo.colunasFormaRuptura);
    onChange({ ...situacao, numCPs, corposDeProva });
  }

  function atualizarCP(indice: number, next: CorpoDeProva) {
    const corposDeProva = situacao.corposDeProva.map((cp, i) => (i === indice ? next : cp));
    onChange({ ...situacao, corposDeProva });
  }

  async function escolherFoto(indice: number, slot: 0 | 1, file: File) {
    const foto = await comprimirImagem(file);
    const cp = situacao.corposDeProva[indice];
    const fotos: [FotoAnexo | null, FotoAnexo | null] = [...cp.fotos];
    fotos[slot] = foto;
    atualizarCP(indice, { ...cp, fotos });
  }

  function removerFoto(indice: number, slot: 0 | 1) {
    const cp = situacao.corposDeProva[indice];
    const fotos: [FotoAnexo | null, FotoAnexo | null] = [...cp.fotos];
    fotos[slot] = null;
    atualizarCP(indice, { ...cp, fotos });
  }

  const stats = calcularEstatisticasCPs(situacao.corposDeProva);

  return (
    <div>
      {/* Cabeçalho da situação */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px 16px', marginBottom: 18 }}>
        <Campo label="Tipo de revestimento">
          <input style={{ ...inputStyle, textTransform: 'uppercase' }} value={situacao.tipoRevestimento} onChange={e => atualizar('tipoRevestimento', e.target.value.toUpperCase())} placeholder="EX: VERTICAL INTERNO" />
        </Campo>
        <Campo label="Data do ensaio">
          <input style={inputStyle} value={situacao.dataEnsaio} onChange={e => atualizar('dataEnsaio', e.target.value)} placeholder="DD/MM/AAAA" />
        </Campo>
        <Campo label="Nº de corpos de prova">
          <input type="number" style={inputStyle} min={1} value={situacao.numCPs} onChange={e => alterarNumCPs(Number(e.target.value))} />
        </Campo>
        <Campo label="Data de aplicação">
          <input style={inputStyle} value={situacao.dataAplicacao} onChange={e => atualizar('dataAplicacao', e.target.value)} placeholder="DD/MM/AAAA ou NÃO INFORMADA" />
        </Campo>
        <Campo label="Substrato">
          <input style={inputStyle} value={situacao.substrato} onChange={e => atualizar('substrato', e.target.value)} />
        </Campo>
        <Campo label="Idade de ruptura (dias)">
          <input style={inputStyle} value={situacao.idadeRupturaDias} onChange={e => atualizar('idadeRupturaDias', e.target.value)} placeholder="EX: >28" />
        </Campo>
        <Campo label="Chapisco">
          <input style={inputStyle} value={situacao.chapisco} onChange={e => atualizar('chapisco', e.target.value)} />
        </Campo>
        <Campo label="Traço (chapisco)">
          <input style={inputStyle} value={situacao.chapiscoTraco} onChange={e => atualizar('chapiscoTraco', e.target.value)} />
        </Campo>
        <Campo label="Emboço">
          <input style={inputStyle} value={situacao.emboco} onChange={e => atualizar('emboco', e.target.value)} />
        </Campo>
        <Campo label="Traço (emboço)">
          <input style={inputStyle} value={situacao.embocoTraco} onChange={e => atualizar('embocoTraco', e.target.value)} />
        </Campo>
        <Campo label="Argamassa colante">
          <input style={inputStyle} value={situacao.argamassaColante} onChange={e => atualizar('argamassaColante', e.target.value)} />
        </Campo>
        <Campo label="Revestimento">
          <input style={inputStyle} value={situacao.revestimento} onChange={e => atualizar('revestimento', e.target.value)} />
        </Campo>
        <Campo label="Dimensões (cm)">
          <input style={inputStyle} value={situacao.dimensoesCm} onChange={e => atualizar('dimensoesCm', e.target.value)} placeholder="EX: 10X10" />
        </Campo>
        <Campo label="Umidade média (%)">
          <input type="number" style={inputStyle} value={situacao.umidadeMedia ?? ''} onChange={e => atualizar('umidadeMedia', e.target.value === '' ? null : Number(e.target.value))} />
        </Campo>
        <Campo label="Espessura média do revestimento (mm)">
          <input type="number" style={inputStyle} value={situacao.espessuraMediaRevestimento ?? ''} onChange={e => atualizar('espessuraMediaRevestimento', e.target.value === '' ? null : Number(e.target.value))} />
        </Campo>
      </div>

      {/* Esquema + observações */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, alignItems: 'start', marginBottom: 20, padding: '14px 16px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 10 }}>
        <div dangerouslySetInnerHTML={{ __html: svgEsquemaCamadas(modelo.camadas, modelo.disposicao) }} style={{ lineHeight: 0 }} />
        <Campo label="Observações do esquema">
          <textarea
            style={{ ...inputStyle, minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }}
            value={situacao.observacoesEsquema}
            onChange={e => atualizar('observacoesEsquema', e.target.value)}
            placeholder="Observações sobre o sistema de revestimento ensaiado..."
          />
        </Campo>
      </div>

      {/* Tabela de corpos de prova */}
      <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 800, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Resultado do ensaio</p>
      <div style={{ overflowX: 'auto', border: `1px solid ${BORDER}`, borderRadius: 10 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
          <thead>
            <tr style={{ background: BG }}>
              <Th>Nº CP</Th>
              <Th>Bloco</Th>
              <Th>Junta</Th>
              <Th>Tensão Ra (MPa)</Th>
              <Th>Prof. ruptura (mm)</Th>
              {modelo.colunasFormaRuptura.map(col => <Th key={col}>{col} (%)</Th>)}
              <Th>Localização</Th>
              <Th>Fotos</Th>
            </tr>
          </thead>
          <tbody>
            {situacao.corposDeProva.map((cp, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${BORDER}` }}>
                <Td><span style={{ fontWeight: 700, color: SUBTEXT }}>{cp.numero}</span></Td>
                <Td><input style={cellInputStyle} value={cp.bloco} onChange={e => atualizarCP(i, { ...cp, bloco: e.target.value })} /></Td>
                <Td><input style={cellInputStyle} value={cp.junta} onChange={e => atualizarCP(i, { ...cp, junta: e.target.value })} /></Td>
                <Td><input type="number" style={cellInputStyle} value={cp.tensaoRa ?? ''} onChange={e => atualizarCP(i, { ...cp, tensaoRa: e.target.value === '' ? null : Number(e.target.value) })} /></Td>
                <Td><input type="number" style={cellInputStyle} value={cp.profRuptura ?? ''} onChange={e => atualizarCP(i, { ...cp, profRuptura: e.target.value === '' ? null : Number(e.target.value) })} /></Td>
                {modelo.colunasFormaRuptura.map(col => (
                  <Td key={col}>
                    <input
                      type="number"
                      style={cellInputStyle}
                      value={cp.formaRuptura[col] ?? 0}
                      min={0}
                      max={100}
                      onChange={e => atualizarCP(i, { ...cp, formaRuptura: { ...cp.formaRuptura, [col]: Number(e.target.value) } })}
                    />
                  </Td>
                ))}
                <Td><input style={{ ...cellInputStyle, minWidth: 120, textAlign: 'left' }} value={cp.localizacao} onChange={e => atualizarCP(i, { ...cp, localizacao: e.target.value })} /></Td>
                <Td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <FotoSlot foto={cp.fotos[0]} label="1" onEscolher={f => escolherFoto(i, 0, f)} onRemover={() => removerFoto(i, 0)} />
                    <FotoSlot foto={cp.fotos[1]} label="2" onEscolher={f => escolherFoto(i, 1, f)} onRemover={() => removerFoto(i, 1)} />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Médias / DP / CV calculados automaticamente */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 14, padding: '12px 16px', background: '#EEF2FF', border: `1px solid ${PRIMARY}`, borderRadius: 10 }}>
        <Estatistica label="Ra médio" valor={stats.raMedia} unidade="MPa" />
        <Estatistica label="Prof. ruptura média" valor={stats.profRupturaMedia} unidade="mm" />
        <Estatistica label="DP" valor={stats.dp} unidade="MPa" />
        <Estatistica label="CV" valor={stats.cv} unidade="%" />
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '8px 6px', fontSize: 10, fontWeight: 800, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap', textAlign: 'center' }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '5px 6px', minWidth: 64 }}>{children}</td>;
}
function Estatistica({ label, valor, unidade }: { label: string; valor: number | null; unidade: string }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 800, color: PRIMARY }}>{valor === null ? '—' : `${valor.toFixed(2)} ${unidade}`}</p>
    </div>
  );
}

function criarSituacaoVazia(numero: number, modeloId: string): SituacaoAderencia {
  const modelo = obterModeloCamadas(modeloId)!;
  return {
    numero,
    tipoRevestimento: '',
    dataEnsaio: '',
    numCPs: NUM_CPS_PADRAO,
    dataAplicacao: '',
    substrato: '',
    idadeRupturaDias: '',
    chapisco: '',
    chapiscoTraco: '',
    emboco: '',
    embocoTraco: '',
    argamassaColante: '',
    revestimento: '',
    dimensoesCm: '',
    modeloCamadasId: modeloId,
    observacoesEsquema: '',
    corposDeProva: redimensionarCorposDeProva([], NUM_CPS_PADRAO, modelo.colunasFormaRuptura),
    umidadeMedia: null,
    espessuraMediaRevestimento: null,
  };
}

export default function AderenciaPage() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<'config' | 'situacoes'>('config');
  const [numSituacoes, setNumSituacoes] = useState(1);
  const [modeloPorSituacao, setModeloPorSituacao] = useState<string[]>([MODELOS_SISTEMA_CAMADAS[0].id]);
  const [situacoes, setSituacoes] = useState<SituacaoAderencia[]>([]);
  const [situacaoAtual, setSituacaoAtual] = useState(0);

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/login');
    });
  }, [router]);

  function alterarNumSituacoes(n: number) {
    const clamped = Math.max(MIN_SITUACOES, Math.min(MAX_SITUACOES, n));
    setNumSituacoes(clamped);
    setModeloPorSituacao(prev => {
      const next = [...prev];
      while (next.length < clamped) next.push(MODELOS_SISTEMA_CAMADAS[0].id);
      next.length = clamped;
      return next;
    });
  }

  function selecionarModelo(indice: number, modeloId: string) {
    setModeloPorSituacao(prev => prev.map((id, i) => (i === indice ? modeloId : id)));
  }

  function confirmarConfiguracao() {
    setSituacoes(prev =>
      modeloPorSituacao.map((modeloId, i) => {
        const existente = prev[i];
        if (existente && existente.modeloCamadasId === modeloId) return existente;
        return criarSituacaoVazia(i + 1, modeloId);
      })
    );
    setSituacaoAtual(0);
    setEtapa('situacoes');
  }

  function atualizarSituacao(indice: number, next: SituacaoAderencia) {
    setSituacoes(prev => prev.map((s, i) => (i === indice ? next : s)));
  }

  return (
    <div style={{ backgroundColor: BG, minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <Header paginaAtiva="ensaios" />

      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 20px 60px' }}>
        <div style={{ borderLeft: `4px solid ${GOLD}`, paddingLeft: 12, marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: TEXT }}>Resistência de Aderência à Tração</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: SUBTEXT }}>
            {etapa === 'config' ? 'Configuração inicial do relatório' : `Situação ${numeroRomano(situacaoAtual + 1)} de ${numeroRomano(situacoes.length)}`}
          </p>
        </div>

        {etapa === 'config' && (
          <>
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 22px', marginBottom: 20 }}>
              <Campo label="Número de Situações">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => alterarNumSituacoes(numSituacoes - 1)}
                    disabled={numSituacoes <= MIN_SITUACOES}
                    style={{ width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${BORDER}`, background: '#fff', fontSize: 18, fontWeight: 700, color: PRIMARY, cursor: numSituacoes <= MIN_SITUACOES ? 'not-allowed' : 'pointer', opacity: numSituacoes <= MIN_SITUACOES ? 0.4 : 1 }}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={numSituacoes}
                    min={MIN_SITUACOES}
                    max={MAX_SITUACOES}
                    onChange={e => alterarNumSituacoes(Number(e.target.value) || MIN_SITUACOES)}
                    style={{ width: 60, textAlign: 'center', padding: '9px 6px', borderRadius: 7, border: `1.5px solid ${BORDER}`, fontSize: 15, fontWeight: 700, color: TEXT, fontFamily: 'inherit' }}
                  />
                  <button
                    type="button"
                    onClick={() => alterarNumSituacoes(numSituacoes + 1)}
                    disabled={numSituacoes >= MAX_SITUACOES}
                    style={{ width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${BORDER}`, background: '#fff', fontSize: 18, fontWeight: 700, color: PRIMARY, cursor: numSituacoes >= MAX_SITUACOES ? 'not-allowed' : 'pointer', opacity: numSituacoes >= MAX_SITUACOES ? 0.4 : 1 }}
                  >
                    +
                  </button>
                  <span style={{ fontSize: 12, color: SUBTEXT }}>Situação{numSituacoes > 1 ? 'ões' : ''} {numeroRomano(1)}{numSituacoes > 1 ? ` a ${numeroRomano(numSituacoes)}` : ''}</span>
                </div>
              </Campo>
            </div>

            {modeloPorSituacao.map((modeloId, i) => (
              <div key={i} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '18px 22px', marginBottom: 16 }}>
                <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 800, color: PRIMARY }}>Situação {numeroRomano(i + 1)} — Modelo de sistema de camadas</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                  {MODELOS_SISTEMA_CAMADAS.map(modelo => (
                    <ModeloCard key={modelo.id} modelo={modelo} selecionado={modeloId === modelo.id} onSelecionar={() => selecionarModelo(i, modelo.id)} />
                  ))}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                type="button"
                onClick={confirmarConfiguracao}
                style={{ padding: '11px 22px', borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Continuar →
              </button>
            </div>
          </>
        )}

        {etapa === 'situacoes' && situacoes.length > 0 && (
          <>
            {/* Navegação entre situações */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setEtapa('config')} style={{ padding: '7px 12px', borderRadius: 7, border: `1.5px solid ${BORDER}`, background: '#fff', color: SUBTEXT, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                ← Configuração
              </button>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {situacoes.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSituacaoAtual(i)}
                    style={{
                      padding: '7px 14px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                      border: `1.5px solid ${i === situacaoAtual ? PRIMARY : BORDER}`,
                      background: i === situacaoAtual ? PRIMARY : '#fff',
                      color: i === situacaoAtual ? '#fff' : TEXT,
                    }}
                  >
                    {numeroRomano(s.numero)}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 22px', marginBottom: 20 }}>
              <SituacaoForm
                situacao={situacoes[situacaoAtual]}
                modelo={obterModeloCamadas(situacoes[situacaoAtual].modeloCamadasId)!}
                onChange={next => atualizarSituacao(situacaoAtual, next)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => setSituacaoAtual(i => Math.max(0, i - 1))}
                disabled={situacaoAtual === 0}
                style={{ padding: '11px 20px', borderRadius: 8, border: `1.5px solid ${BORDER}`, background: '#fff', color: PRIMARY, fontSize: 13, fontWeight: 700, cursor: situacaoAtual === 0 ? 'not-allowed' : 'pointer', opacity: situacaoAtual === 0 ? 0.4 : 1, fontFamily: 'inherit' }}
              >
                ← Situação anterior
              </button>
              {situacaoAtual < situacoes.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setSituacaoAtual(i => Math.min(situacoes.length - 1, i + 1))}
                  style={{ padding: '11px 20px', borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Próxima situação →
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  title="Autosave e geração de relatório ainda serão implementados"
                  style={{ padding: '11px 20px', borderRadius: 8, border: 'none', background: BORDER, color: SUBTEXT, fontSize: 13, fontWeight: 700, cursor: 'not-allowed', fontFamily: 'inherit' }}
                >
                  Finalizar (em breve)
                </button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
