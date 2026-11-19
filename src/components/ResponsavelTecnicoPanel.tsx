'use client';
// src/components/ResponsavelTecnicoPanel.tsx
// Bloco padronizado "Responsáveis Técnicos e Assinaturas" no estilo Planilha Técnica Compacta.
// Deixa explícito que todo laudo leva assinatura dupla:
//   1. João Ribeiro de Carvalho (Gestor do setor / ARTs — assinatura fixa no modelo DOCX)
//   2. Engenheiro responsável pelo ensaio (perfil logado ou outro responsável informado abaixo)

import { useRef } from 'react';
import {
  CelulaFicha,
  CORES_PLANILHA,
  fichaInputStyle,
  PainelPlanilha,
} from '@/components/PlanilhaUI';

export const GESTOR_SETOR_FIXO = {
  nome: 'João Ribeiro de Carvalho',
  cargo: 'Engenheiro Civil',
  crea: 'CREA Nº49780 – PE',
} as const;

export type ResponsavelTecnicoPanelProps = {
  userName: string;
  userCrea: string;
  userCargo?: string;
  userAssinatura?: string;
  outroResp?: boolean;
  onOutroRespChange?: (ativo: boolean) => void;
  outroRespNome?: string;
  onOutroRespNomeChange?: (valor: string) => void;
  outroRespCrea?: string;
  onOutroRespCreaChange?: (valor: string) => void;
  outroRespPreview?: string | null;
  onOutroRespFileSelect?: (file: File) => void;
  onOutroRespFileRemove?: () => void;
  idPrefix?: string;
};

export function ResponsavelTecnicoPanel({
  userName,
  userCrea,
  userCargo,
  userAssinatura,
  outroResp = false,
  onOutroRespChange,
  outroRespNome = '',
  onOutroRespNomeChange,
  outroRespCrea = '',
  onOutroRespCreaChange,
  outroRespPreview = null,
  onOutroRespFileSelect,
  onOutroRespFileRemove,
  idPrefix = 'resp',
}: ResponsavelTecnicoPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const permiteOutro = typeof onOutroRespChange === 'function';

  return (
    <PainelPlanilha
      titulo="Responsáveis Técnicos e Assinaturas"
      direita={
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.88)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Assinatura dupla no laudo
        </span>
      }
    >
      {/* Grade 2 colunas: Gestor fixo (esquerda) + Engenheiro do ensaio (direita) */}
      <div
        className="planilha-grid-2"
        style={{
          borderBottom: permiteOutro ? `1px solid ${CORES_PLANILHA.BORDER_CELL}` : undefined,
        }}
      >
        {/* Coluna 1: Gestor do setor (fixo) */}
        <div
          className="planilha-cell-r"
          style={{
            padding: '10px 14px',
            background: CORES_PLANILHA.ZEBRA,
            borderRight: `1px solid ${CORES_PLANILHA.BORDER_CELL}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                color: CORES_PLANILHA.SUBTEXT,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              1. Gestor do Setor (ARTs)
            </span>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: CORES_PLANILHA.PRIMARY,
                background: '#EEF1F8',
                border: '1px solid #D5DCEF',
                borderRadius: 4,
                padding: '1px 6px',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              Fixo no laudo
            </span>
          </div>
          <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: CORES_PLANILHA.TEXT }}>
            {GESTOR_SETOR_FIXO.nome}
          </p>
          <p style={{ margin: 0, fontSize: 11.5, color: CORES_PLANILHA.SUBTEXT }}>
            {GESTOR_SETOR_FIXO.cargo} · {GESTOR_SETOR_FIXO.crea}
          </p>
          <div style={{ marginTop: 4 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                fontWeight: 600,
                color: CORES_PLANILHA.SUCCESS,
                background: CORES_PLANILHA.GREEN_LIGHT,
                border: `1px solid ${CORES_PLANILHA.GREEN_BORDER}`,
                borderRadius: 5,
                padding: '2px 8px',
              }}
            >
              ✓ Assinatura incluída automaticamente
            </span>
          </div>
        </div>

        {/* Coluna 2: Engenheiro do ensaio (perfil logado) */}
        <div
          style={{
            padding: '10px 14px',
            background: CORES_PLANILHA.SURFACE,
            opacity: outroResp ? 0.5 : 1,
            transition: 'opacity 0.15s',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                color: CORES_PLANILHA.SUBTEXT,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              2. Engenheiro do Ensaio
            </span>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: outroResp ? CORES_PLANILHA.SUBTEXT : CORES_PLANILHA.PRIMARY,
                background: outroResp ? '#F1F5F9' : '#EEF1F8',
                border: `1px solid ${outroResp ? '#E2E8F0' : '#D5DCEF'}`,
                borderRadius: 4,
                padding: '1px 6px',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              {outroResp ? 'Substituído abaixo' : 'Perfil logado'}
            </span>
          </div>
          <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: CORES_PLANILHA.TEXT }}>
            {userName || <span style={{ color: CORES_PLANILHA.SUBTEXT }}>—</span>}
          </p>
          <p style={{ margin: 0, fontSize: 11.5, color: CORES_PLANILHA.SUBTEXT }}>
            CREA: {userCrea || 'Não cadastrado'}
            {userCargo ? ` · ${userCargo}` : ''}
          </p>
          <div style={{ marginTop: 4 }}>
            {userAssinatura ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={userAssinatura}
                alt="Assinatura do engenheiro"
                style={{ maxHeight: 36, maxWidth: 180, objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <p style={{ margin: 0, fontSize: 11.5, color: CORES_PLANILHA.SUBTEXT }}>
                Assinatura não cadastrada —{' '}
                <a href="/usuarios" style={{ color: CORES_PLANILHA.PRIMARY, textDecoration: 'underline' }}>
                  cadastrar no perfil
                </a>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Opção de outro responsável técnico (engenheiro do ensaio) */}
      {permiteOutro && (
        <>
          <div
            style={{
              padding: '9px 14px',
              background: outroResp ? CORES_PLANILHA.HEADER_SUB : CORES_PLANILHA.SURFACE,
              borderBottom: outroResp ? `1px solid ${CORES_PLANILHA.BORDER_CELL}` : undefined,
            }}
          >
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={outroResp}
                onChange={e => onOutroRespChange?.(e.target.checked)}
                style={{ width: 15, height: 15, accentColor: CORES_PLANILHA.PRIMARY, cursor: 'pointer' }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: outroResp ? CORES_PLANILHA.PRIMARY : CORES_PLANILHA.SUBTEXT,
                }}
              >
                Outro engenheiro responsável para este relatório (substitui apenas a 2ª assinatura)
              </span>
            </label>
          </div>

          {outroResp && (
            <div style={{ background: CORES_PLANILHA.SURFACE }}>
              <div className="planilha-grid-2">
                <CelulaFicha
                  label="Engenheiro Responsável TECOMAT"
                  htmlFor={`${idPrefix}-outro-nome`}
                  borderRight
                >
                  <input
                    id={`${idPrefix}-outro-nome`}
                    style={fichaInputStyle}
                    value={outroRespNome}
                    onChange={e => onOutroRespNomeChange?.(e.target.value)}
                    placeholder="Nome completo do engenheiro"
                  />
                </CelulaFicha>
                <CelulaFicha label="CREA" htmlFor={`${idPrefix}-outro-crea`}>
                  <input
                    id={`${idPrefix}-outro-crea`}
                    style={fichaInputStyle}
                    value={outroRespCrea}
                    onChange={e => onOutroRespCreaChange?.(e.target.value)}
                    placeholder="Nº CREA"
                  />
                </CelulaFicha>
              </div>

              <div style={{ padding: '8px 12px 10px', background: CORES_PLANILHA.ZEBRA }}>
                <p
                  style={{
                    margin: '0 0 6px',
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: CORES_PLANILHA.SUBTEXT,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Imagem da Assinatura
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      onOutroRespFileSelect?.(f);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      background: '#EEF1F8',
                      color: CORES_PLANILHA.PRIMARY,
                      border: `1px solid ${CORES_PLANILHA.BORDER}`,
                    }}
                  >
                    {outroRespPreview ? '↻ Trocar imagem' : '📁 Selecionar assinatura'}
                  </button>
                  {outroRespPreview && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={outroRespPreview}
                        alt="Prévia assinatura"
                        style={{
                          maxHeight: 36,
                          maxWidth: 160,
                          objectFit: 'contain',
                          border: `1px solid ${CORES_PLANILHA.BORDER}`,
                          borderRadius: 6,
                          padding: 3,
                          background: '#fff',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          onOutroRespFileRemove?.();
                          if (fileRef.current) fileRef.current.value = '';
                        }}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          background: '#FFF0EE',
                          color: CORES_PLANILHA.DANGER,
                          border: '1px solid #FADADD',
                        }}
                      >
                        Remover
                      </button>
                    </>
                  )}
                </div>
                <p style={{ margin: '5px 0 0', fontSize: 11, color: CORES_PLANILHA.SUBTEXT }}>
                  PNG com fundo transparente recomendado · não será salva no perfil
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </PainelPlanilha>
  );
}
