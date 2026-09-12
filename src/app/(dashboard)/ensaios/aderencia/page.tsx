'use client';
// src/app/(dashboard)/ensaios/aderencia/page.tsx

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import { MODELOS_SISTEMA_CAMADAS, svgEsquemaCamadas, numeroRomano, type ModeloSistemaCamadas } from '@/modules/aderencia';

const PRIMARY = '#1E3264';
const GOLD = '#C8A020';
const BG = '#F8F9FA';
const BORDER = '#E8EAF0';
const TEXT = '#1A2340';
const SUBTEXT = '#6B7490';

const MIN_SITUACOES = 1;
const MAX_SITUACOES = 10;

function Campo({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label htmlFor={htmlFor} style={{ fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      {children}
    </div>
  );
}

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

export default function AderenciaPage() {
  const router = useRouter();
  const [numSituacoes, setNumSituacoes] = useState(1);
  const [modeloPorSituacao, setModeloPorSituacao] = useState<string[]>([MODELOS_SISTEMA_CAMADAS[0].id]);
  const [configConfirmada, setConfigConfirmada] = useState(false);

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
    setConfigConfirmada(false);
  }

  function selecionarModelo(indice: number, modeloId: string) {
    setModeloPorSituacao(prev => prev.map((id, i) => (i === indice ? modeloId : id)));
    setConfigConfirmada(false);
  }

  return (
    <div style={{ backgroundColor: BG, minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <Header paginaAtiva="ensaios" />

      <main style={{ maxWidth: 1060, margin: '0 auto', padding: '24px 20px 60px' }}>
        <div style={{ borderLeft: `4px solid ${GOLD}`, paddingLeft: 12, marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: TEXT }}>Resistência de Aderência à Tração</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: SUBTEXT }}>Configuração inicial do relatório</p>
        </div>

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
            onClick={() => setConfigConfirmada(true)}
            style={{ padding: '11px 22px', borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Continuar →
          </button>
        </div>

        {configConfirmada && (
          <div style={{ marginTop: 24, background: '#EEF2FF', border: `1px solid ${PRIMARY}`, borderRadius: 12, padding: '16px 20px' }}>
            <p style={{ margin: '0 0 8px', fontSize: 12.5, fontWeight: 800, color: PRIMARY }}>Configuração confirmada</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: TEXT, lineHeight: 1.7 }}>
              {modeloPorSituacao.map((modeloId, i) => {
                const modelo = MODELOS_SISTEMA_CAMADAS.find(m => m.id === modeloId)!;
                return (
                  <li key={i}>
                    Situação {numeroRomano(i + 1)}: <strong>{modelo.nome}</strong>
                  </li>
                );
              })}
            </ul>
            <p style={{ margin: '10px 0 0', fontSize: 11.5, color: SUBTEXT }}>
              O formulário de preenchimento por Situação (etapa 5) ainda será implementado.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
