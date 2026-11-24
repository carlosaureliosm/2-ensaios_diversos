'use client';
// src/modules/pacometria/components/ModalImportarObra.tsx
//
// Modal para importar amostras (com fotos) de uma obra salva no servidor (Modo Obra)
// para a aba "2. Dados de Campo".

import { useState } from 'react';
import type { ObraGrupoPacometria } from '@/modules/pacometria/types';

const PRIMARY = '#1E3264';
const GREEN   = '#1A7A44';
const BORDER  = '#E2E8F0';
const TEXT    = '#1A2340';
const SUBTEXT = '#6B7490';

type Props = {
  grupos: ObraGrupoPacometria[];
  currentUserId: string;
  amostrasAtuaisCount: number;
  carregando: boolean;
  erro: string;
  onAtualizar: () => void;
  onImportar: (grupo: ObraGrupoPacometria, modo: 'adicionar' | 'substituir') => void;
  onFechar: () => void;
};

function formatarDataHora(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function ModalImportarObra({
  grupos,
  currentUserId,
  amostrasAtuaisCount,
  carregando,
  erro,
  onAtualizar,
  onImportar,
  onFechar,
}: Props) {
  const [modo, setModo] = useState<'adicionar' | 'substituir'>('adicionar');

  return (
    <div
      onClick={onFechar}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 10, width: '100%', maxWidth: 620,
          maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(15,23,42,0.28)', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '14px 18px', background: PRIMARY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Importar do Modo Obra</h2>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#BFDBFE' }}>
              Selecione uma obra salva no servidor para trazer as amostras e fotos para o laudo
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={onAtualizar}
              disabled={carregando}
              style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 700,
                background: 'rgba(255,255,255,0.14)', color: '#fff', border: 'none',
                cursor: carregando ? 'wait' : 'pointer', fontFamily: 'inherit',
              }}
            >
              {carregando ? 'Atualizando…' : 'Atualizar'}
            </button>
            <button
              onClick={onFechar}
              aria-label="Fechar"
              style={{
                width: 28, height: 28, borderRadius: 6, border: 'none',
                background: 'rgba(255,255,255,0.14)', color: '#fff', cursor: 'pointer',
                fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Opção adicionar vs substituir */}
        {amostrasAtuaisCount > 0 && (
          <div style={{ padding: '10px 18px', background: '#F8FAFC', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 12 }}>
            <span style={{ fontWeight: 700, color: TEXT }}>Já existem {amostrasAtuaisCount} amostra(s) no laudo:</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', color: TEXT }}>
              <input type="radio" name="modoImportacao" checked={modo === 'adicionar'} onChange={() => setModo('adicionar')} />
              Adicionar ao final
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', color: TEXT }}>
              <input type="radio" name="modoImportacao" checked={modo === 'substituir'} onChange={() => setModo('substituir')} />
              Substituir atuais
            </label>
          </div>
        )}

        {/* Lista de obras */}
        <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
          {erro && (
            <div style={{ padding: '10px 12px', borderRadius: 7, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 12, marginBottom: 12 }}>
              {erro}
            </div>
          )}

          {carregando && grupos.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '32px 0', color: SUBTEXT, fontSize: 13 }}>
              Carregando obras salvas no servidor…
            </p>
          ) : grupos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 12px', color: SUBTEXT }}>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>Nenhuma obra salva no Modo Obra</p>
              <p style={{ margin: '4px 0 0', fontSize: 12 }}>
                Crie uma obra na aba <strong>3. Modo Obra</strong> para registrar dados em campo.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {grupos.map(g => {
                const ehCriador = g.createdBy === currentUserId;
                const qtdFotos = g.amostras.filter(a => Boolean(a.fotoPath)).length;
                return (
                  <div
                    key={g.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                      padding: '12px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13.5, fontWeight: 800, color: TEXT }}>{g.nome}</span>
                        <span
                          style={{
                            fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                            background: ehCriador ? '#DCFCE7' : '#EEF2FF',
                            color: ehCriador ? '#166534' : PRIMARY,
                          }}
                        >
                          {ehCriador ? 'Você' : g.createdByNome}
                        </span>
                      </div>
                      <p style={{ margin: '3px 0 0', fontSize: 11.5, color: SUBTEXT }}>
                        {g.amostras.length} amostra{g.amostras.length !== 1 ? 's' : ''}
                        {qtdFotos > 0 ? ` · ${qtdFotos} foto${qtdFotos !== 1 ? 's' : ''}` : ''}
                        {' · '}Atualizado em {formatarDataHora(g.updatedAt || g.createdAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => onImportar(g, amostrasAtuaisCount > 0 ? modo : 'substituir')}
                      disabled={g.amostras.length === 0}
                      style={{
                        padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                        border: 'none', fontFamily: 'inherit',
                        background: g.amostras.length > 0 ? GREEN : '#CBD5E1',
                        color: '#fff',
                        cursor: g.amostras.length > 0 ? 'pointer' : 'not-allowed',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Importar ({g.amostras.length})
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 18px', borderTop: `1px solid ${BORDER}`, background: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: SUBTEXT }}>
            Os dados permanecem salvos no Modo Obra até o criador apagá-los.
          </span>
          <button
            onClick={onFechar}
            style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700,
              background: '#E2E8F0', color: TEXT, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
