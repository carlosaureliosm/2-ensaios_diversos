'use client';
// src/app/(dashboard)/ensaios/aderencia/page.tsx

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import {
  MODELOS_SISTEMA_CAMADAS,
  ID_MODELO_PERSONALIZADO,
  MAX_COLUNAS_FORMA_RUPTURA,
  PALETA_CORES_CAMADAS,
  corCamada,
  svgEsquemaCamadas,
  numeroRomano,
  obterModeloCamadas,
  gerarColunasFormaRuptura,
  criarModeloPersonalizadoPadrao,
  resolverModeloSituacao,
  criarCorpoDeProva,
  redimensionarCorposDeProva,
  calcularEstatisticasCPs,
  type ModeloSistemaCamadas,
  type SituacaoAderencia,
  type CorpoDeProva,
  type FotoAnexo,
  type AderenciaCabecalho,
  type AderenciaNormas,
} from '@/modules/aderencia';
import { svgParaPng } from '@/modules/aderencia/svgParaPng';
import { useUserStore } from '@/store/userStore';

const PRIMARY = '#1E3264';
const GOLD = '#C8A020';
const BG = '#F8F9FA';
const BORDER = '#E8EAF0';
const TEXT = '#1A2340';
const SUBTEXT = '#6B7490';
const SUCCESS = '#1A7A44';
const DANGER = '#C0392B';

const MIN_SITUACOES = 1;
const MAX_SITUACOES = 10;
const NUM_CPS_PADRAO = 6;
const LS_KEY = 'tecomat_aderencia_v1';

// ── Autosave (localStorage) ──────────────────────────────────────
// Fotos não são persistidas (mesma decisão do módulo esclerometria): só existem em
// memória do navegador durante a sessão atual, para não gravar payload grande/serializado
// no localStorage nem sugerir visualmente que uma foto sobreviveu quando na verdade foi perdida.
type EstadoPersistido = {
  etapa: 'config' | 'situacoes';
  numSituacoes: number;
  modeloPorSituacao: string[];
  modelosPersonalizados?: (ModeloSistemaCamadas | null)[];
  colunasManuaisPorSituacao?: boolean[];
  situacoes: SituacaoAderencia[];
  situacaoAtual: number;
  cabecalho?: AderenciaCabecalho;
};

const CABECALHO_VAZIO: AderenciaCabecalho = {
  rltNumero: '', cliente: '', obra: '', construtora: '', endereco: '', dataEmissao: '',
  normas: {
    nbr13528_1: false, nbr13528_1_parte2: false, nbr13528_1_parte3: false,
    nbr13749: false, nbr13753: false, nbr13754: false, nbr13755: false,
  },
};

const NORMAS_OPCOES: { campo: keyof AderenciaNormas; label: string; sub?: boolean }[] = [
  { campo: 'nbr13528_1', label: 'NBR 13528-1:2019 (requisitos gerais)' },
  { campo: 'nbr13528_1_parte2', label: 'Parte 2 – Aderência ao substrato', sub: true },
  { campo: 'nbr13528_1_parte3', label: 'Parte 3 – Aderência superficial', sub: true },
  { campo: 'nbr13749', label: 'NBR 13749:2013' },
  { campo: 'nbr13753', label: 'NBR 13753:1996' },
  { campo: 'nbr13754', label: 'NBR 13754:1996' },
  { campo: 'nbr13755', label: 'NBR 13755:2017' },
];

function removerFotos(situacoes: SituacaoAderencia[]): SituacaoAderencia[] {
  return situacoes.map(s => ({
    ...s,
    corposDeProva: s.corposDeProva.map(cp => ({ ...cp, fotos: [null, null] as [FotoAnexo | null, FotoAnexo | null] })),
  }));
}

function salvarLocal(estado: EstadoPersistido) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ...estado, situacoes: removerFotos(estado.situacoes) }));
  } catch {}
}

function carregarLocal(): EstadoPersistido | null {
  try {
    const r = localStorage.getItem(LS_KEY);
    if (!r) return null;
    const parsed = JSON.parse(r) as EstadoPersistido;
    if (!Array.isArray(parsed.situacoes) || !Array.isArray(parsed.modeloPorSituacao)) return null;
    parsed.situacoes = removerFotos(parsed.situacoes);
    return parsed;
  } catch { return null; }
}

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

const SUGESTOES_CAMADAS = [
  'Substrato',
  'Concreto',
  'Contrapiso',
  'Alvenaria',
  'Chapisco',
  'Emboço',
  'Reboco',
  'Argamassa Colante',
  'Cerâmica',
  'Porcelanato',
  'Gesso',
  'Regularização',
  'Pintura',
];

function ModeloCard({
  modelo,
  selecionado,
  onSelecionar,
  personalizado = false,
}: {
  modelo: ModeloSistemaCamadas;
  selecionado: boolean;
  onSelecionar: () => void;
  personalizado?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelecionar}
      style={{
        border: `1.5px solid ${selecionado ? PRIMARY : personalizado ? GOLD : BORDER}`,
        borderRadius: 10,
        padding: '12px 10px',
        cursor: 'pointer',
        background: selecionado ? '#EEF2FF' : personalizado ? '#FFFDF7' : '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        textAlign: 'center',
        fontFamily: 'inherit',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {personalizado && (
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '2px 7px',
            borderRadius: 99,
            background: selecionado ? PRIMARY : GOLD,
            color: '#fff',
          }}
        >
          Criar personalizado
        </span>
      )}
      <div
        dangerouslySetInnerHTML={{ __html: svgEsquemaCamadas(modelo.camadas, modelo.disposicao, modelo.coresCamadas) }}
        style={{ lineHeight: 0, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, padding: '6px 0' }}
      />
      <span style={{ fontSize: 12.5, fontWeight: 700, color: selecionado ? PRIMARY : TEXT, lineHeight: 1.35 }}>
        {personalizado ? 'Personalizado (montar camadas e cores)' : modelo.nome}
      </span>
    </button>
  );
}

function EditorModeloPersonalizado({
  modelo,
  colunasManuais,
  onChange,
}: {
  modelo: ModeloSistemaCamadas;
  colunasManuais: boolean;
  onChange: (nextModelo: ModeloSistemaCamadas, nextColunasManuais: boolean) => void;
}) {
  const cores = modelo.camadas.map((c, idx) => modelo.coresCamadas?.[idx] || corCamada(c));

  function aplicarCamadas(novasCamadas: string[], novasCores: string[], disp = modelo.disposicao) {
    const novasColunas = colunasManuais ? modelo.colunasFormaRuptura : gerarColunasFormaRuptura(novasCamadas);
    onChange(
      {
        ...modelo,
        disposicao: disp,
        camadas: novasCamadas,
        coresCamadas: novasCores,
        colunasFormaRuptura: novasColunas,
      },
      colunasManuais,
    );
  }

  function alterarDisposicao(disp: 'piso' | 'parede') {
    aplicarCamadas(modelo.camadas, cores, disp);
  }

  function alterarNomeCamada(idx: number, novoNome: string) {
    const novasCamadas = modelo.camadas.map((c, i) => (i === idx ? novoNome : c));
    aplicarCamadas(novasCamadas, cores);
  }

  function alterarCorCamada(idx: number, novaCor: string) {
    const novasCores = cores.map((c, i) => (i === idx ? novaCor : c));
    onChange({ ...modelo, coresCamadas: novasCores }, colunasManuais);
  }

  function adicionarCamada(nomeSugerido = '') {
    const nome = nomeSugerido || `Camada ${modelo.camadas.length + 1}`;
    const cor = nomeSugerido ? corCamada(nomeSugerido) : PALETA_CORES_CAMADAS[modelo.camadas.length % PALETA_CORES_CAMADAS.length].cor;
    aplicarCamadas([...modelo.camadas, nome], [...cores, cor]);
  }

  function removerCamada(idx: number) {
    if (modelo.camadas.length <= 1) return;
    aplicarCamadas(
      modelo.camadas.filter((_, i) => i !== idx),
      cores.filter((_, i) => i !== idx),
    );
  }

  function moverCamada(idx: number, direcao: -1 | 1) {
    const destino = idx + direcao;
    if (destino < 0 || destino >= modelo.camadas.length) return;
    const novasCamadas = [...modelo.camadas];
    const novasCores = [...cores];
    [novasCamadas[idx], novasCamadas[destino]] = [novasCamadas[destino], novasCamadas[idx]];
    [novasCores[idx], novasCores[destino]] = [novasCores[destino], novasCores[idx]];
    aplicarCamadas(novasCamadas, novasCores);
  }

  function editarColunaRuptura(idx: number, valor: string) {
    const novasCols = modelo.colunasFormaRuptura.map((c, i) => (i === idx ? valor : c));
    onChange({ ...modelo, colunasFormaRuptura: novasCols }, true);
  }

  function adicionarColunaRuptura() {
    if (modelo.colunasFormaRuptura.length >= MAX_COLUNAS_FORMA_RUPTURA) return;
    const cols = [...modelo.colunasFormaRuptura];
    const idxVazios = cols.findIndex(c => c.trim().toLowerCase() === 'vazios');
    const novaCol = `Col ${cols.length}`;
    if (idxVazios >= 0) cols.splice(idxVazios, 0, novaCol);
    else cols.push(novaCol);
    onChange({ ...modelo, colunasFormaRuptura: cols }, true);
  }

  function removerColunaRuptura(idx: number) {
    if (modelo.colunasFormaRuptura.length <= 1) return;
    const novasCols = modelo.colunasFormaRuptura.filter((_, i) => i !== idx);
    onChange({ ...modelo, colunasFormaRuptura: novasCols }, true);
  }

  function restaurarColunasAutomaticas() {
    onChange(
      { ...modelo, colunasFormaRuptura: gerarColunasFormaRuptura(modelo.camadas) },
      false,
    );
  }

  return (
    <div style={{ marginTop: 16, padding: '16px 18px', background: BG, border: `1.5px solid ${PRIMARY}`, borderRadius: 12 }}>
      <datalist id="sugestoes-camadas-aderencia">
        {SUGESTOES_CAMADAS.map(s => <option key={s} value={s} />)}
      </datalist>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: PRIMARY }}>Construtor de esquema personalizado</p>
          <p style={{ margin: '2px 0 0', fontSize: 11.5, color: SUBTEXT }}>
            Escolha a orientação, adicione os sólidos retangulares com nome e cor, e ajuste as colunas de ruptura se necessário.
          </p>
        </div>

        {/* Seletor Horizontal (Piso) vs Vertical (Parede) */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => alterarDisposicao('piso')}
            style={{
              padding: '7px 12px',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              border: `1.5px solid ${modelo.disposicao === 'piso' ? PRIMARY : BORDER}`,
              background: modelo.disposicao === 'piso' ? PRIMARY : '#fff',
              color: modelo.disposicao === 'piso' ? '#fff' : TEXT,
            }}
          >
            Horizontal (Piso)
          </button>
          <button
            type="button"
            onClick={() => alterarDisposicao('parede')}
            style={{
              padding: '7px 12px',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              border: `1.5px solid ${modelo.disposicao === 'parede' ? PRIMARY : BORDER}`,
              background: modelo.disposicao === 'parede' ? PRIMARY : '#fff',
              color: modelo.disposicao === 'parede' ? '#fff' : TEXT,
            }}
          >
            Vertical (Parede)
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(240px, 320px)', gap: 18, alignItems: 'start' }}>
        {/* Lista de camadas (sólidos retangulares) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Camadas (da base/substrato até o acabamento)
          </span>

          {modelo.camadas.map((nome, idx) => {
            const corAtual = cores[idx];
            const posLabel = idx === 0
              ? '1ª (Base)'
              : idx === modelo.camadas.length - 1
              ? `${idx + 1}ª (Topo/Face)`
              : `${idx + 1}ª`;

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: '9px 10px',
                  background: '#fff',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: PRIMARY, minWidth: 78 }}>{posLabel}</span>

                  {/* Seletor de cor livre + input do nome da camada */}
                  <input
                    type="color"
                    value={corAtual}
                    onChange={e => alterarCorCamada(idx, e.target.value)}
                    title="Escolher cor personalizada do sólido"
                    style={{
                      width: 32,
                      height: 32,
                      padding: 2,
                      borderRadius: 6,
                      border: `1.5px solid ${BORDER}`,
                      background: '#fff',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  />

                  <input
                    list="sugestoes-camadas-aderencia"
                    style={{ ...inputStyle, padding: '7px 10px', fontSize: 13 }}
                    value={nome}
                    onChange={e => alterarNomeCamada(idx, e.target.value)}
                    placeholder="Nome da camada (ex: Substrato, Chapisco...)"
                  />

                  <button
                    type="button"
                    onClick={() => moverCamada(idx, -1)}
                    disabled={idx === 0}
                    title="Mover camada para antes (base)"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: `1px solid ${BORDER}`,
                      background: '#fff',
                      color: TEXT,
                      cursor: idx === 0 ? 'not-allowed' : 'pointer',
                      opacity: idx === 0 ? 0.35 : 1,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moverCamada(idx, 1)}
                    disabled={idx === modelo.camadas.length - 1}
                    title="Mover camada para depois (acabamento)"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: `1px solid ${BORDER}`,
                      background: '#fff',
                      color: TEXT,
                      cursor: idx === modelo.camadas.length - 1 ? 'not-allowed' : 'pointer',
                      opacity: idx === modelo.camadas.length - 1 ? 0.35 : 1,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removerCamada(idx)}
                    disabled={modelo.camadas.length <= 1}
                    title="Remover camada"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: `1px solid ${BORDER}`,
                      background: '#fff',
                      color: DANGER,
                      cursor: modelo.camadas.length <= 1 ? 'not-allowed' : 'pointer',
                      opacity: modelo.camadas.length <= 1 ? 0.35 : 1,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                </div>

                {/* Paleta rápida de cores padrão do relatório */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', paddingLeft: 86 }}>
                  <span style={{ fontSize: 10, color: SUBTEXT, marginRight: 2 }}>Cores padrão:</span>
                  {PALETA_CORES_CAMADAS.map(p => {
                    const ativa = corAtual.toUpperCase() === p.cor.toUpperCase();
                    return (
                      <button
                        key={p.cor}
                        type="button"
                        title={p.nome}
                        onClick={() => alterarCorCamada(idx, p.cor)}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          background: p.cor,
                          border: ativa ? `2px solid ${PRIMARY}` : '1px solid #9AA0AC',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Botão adicionar + atalhos de camadas comuns */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
            <button
              type="button"
              onClick={() => adicionarCamada('')}
              style={{
                padding: '7px 12px',
                borderRadius: 7,
                border: `1.5px dashed ${PRIMARY}`,
                background: '#EEF2FF',
                color: PRIMARY,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              + Adicionar sólido / camada
            </button>
            {['Substrato', 'Concreto', 'Contrapiso', 'Chapisco', 'Emboço', 'Argamassa Colante', 'Cerâmica', 'Gesso'].map(sug => (
              <button
                key={sug}
                type="button"
                onClick={() => adicionarCamada(sug)}
                style={{
                  padding: '5px 9px',
                  borderRadius: 6,
                  border: `1px solid ${BORDER}`,
                  background: '#fff',
                  color: SUBTEXT,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                + {sug}
              </button>
            ))}
          </div>
        </div>

        {/* Pré-visualização ao vivo do desenho */}
        <div
          style={{
            background: '#fff',
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            padding: '14px 12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 10.5, fontWeight: 800, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Pré-visualização do esquema
          </span>
          <div
            dangerouslySetInnerHTML={{ __html: svgEsquemaCamadas(modelo.camadas, modelo.disposicao, cores) }}
            style={{ lineHeight: 0, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '6px 0' }}
          />
          <span style={{ fontSize: 11, color: SUBTEXT, textAlign: 'center', lineHeight: 1.35 }}>
            O disco de tração (adesivo epóxi + placa metálica) é desenhado automaticamente sobre a última camada.
          </span>
        </div>
      </div>

      {/* Colunas de Forma de Ruptura (%) geradas automaticamente com edição manual */}
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Colunas de &ldquo;Forma de Ruptura (%)&rdquo; ({modelo.colunasFormaRuptura.length}/{MAX_COLUNAS_FORMA_RUPTURA})
            </span>
            <span style={{ fontSize: 11, color: SUBTEXT, marginLeft: 8 }}>
              {colunasManuais ? '(editadas manualmente)' : '(geradas automaticamente pelas camadas)'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {colunasManuais && (
              <button
                type="button"
                onClick={restaurarColunasAutomaticas}
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: `1px solid ${PRIMARY}`,
                  background: '#fff',
                  color: PRIMARY,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                ↻ Regerar automaticamente pelas camadas
              </button>
            )}
            <button
              type="button"
              onClick={adicionarColunaRuptura}
              disabled={modelo.colunasFormaRuptura.length >= MAX_COLUNAS_FORMA_RUPTURA}
              style={{
                padding: '5px 10px',
                borderRadius: 6,
                border: `1px solid ${BORDER}`,
                background: '#fff',
                color: PRIMARY,
                fontSize: 11,
                fontWeight: 700,
                cursor: modelo.colunasFormaRuptura.length >= MAX_COLUNAS_FORMA_RUPTURA ? 'not-allowed' : 'pointer',
                opacity: modelo.colunasFormaRuptura.length >= MAX_COLUNAS_FORMA_RUPTURA ? 0.4 : 1,
                fontFamily: 'inherit',
              }}
            >
              + Coluna
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {modelo.colunasFormaRuptura.map((col, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: '#fff',
                border: `1px solid ${BORDER}`,
                borderRadius: 7,
                padding: '4px 6px',
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, color: SUBTEXT }}>{idx + 1}.</span>
              <input
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  color: TEXT,
                  width: Math.max(64, (col.length + 1) * 7.5),
                  fontFamily: 'inherit',
                  background: 'transparent',
                }}
                value={col}
                onChange={e => editarColunaRuptura(idx, e.target.value)}
              />
              <button
                type="button"
                onClick={() => removerColunaRuptura(idx)}
                disabled={modelo.colunasFormaRuptura.length <= 1}
                title="Remover coluna"
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: DANGER,
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: modelo.colunasFormaRuptura.length <= 1 ? 'not-allowed' : 'pointer',
                  opacity: modelo.colunasFormaRuptura.length <= 1 ? 0.3 : 1,
                  padding: '0 2px',
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
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

// Envia a foto (JPEG já comprimido) para /api/ensaios/aderencia/foto. Retorna o `path` no Storage ou null se falhar.
async function enviarFotoStorage(foto: FotoAnexo): Promise<string | null> {
  try {
    const blob = await (await fetch(`data:${foto.contentType};base64,${foto.base64}`)).blob();
    const form = new FormData();
    form.append('foto', blob, 'foto.jpg');
    const res = await fetch('/api/ensaios/aderencia/foto', { method: 'POST', body: form });
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json.path === 'string' ? json.path : null;
  } catch {
    return null;
  }
}

function removerFotoStorage(path: string) {
  fetch(`/api/ensaios/aderencia/foto?path=${encodeURIComponent(path)}`, { method: 'DELETE' }).catch(() => {});
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
    let foto = await comprimirImagem(file);
    // Envia a foto comprimida ao Supabase Storage; na geração do laudo só o `path` viaja no POST
    // (evita estourar o limite de ~4,5 MB da Vercel). Se o envio falhar, mantém o base64 como fallback.
    const path = await enviarFotoStorage(foto);
    if (path) foto = { ...foto, path };
    const cp = situacao.corposDeProva[indice];
    const fotos: [FotoAnexo | null, FotoAnexo | null] = [...cp.fotos];
    fotos[slot] = foto;
    atualizarCP(indice, { ...cp, fotos });
  }

  function removerFoto(indice: number, slot: 0 | 1) {
    const cp = situacao.corposDeProva[indice];
    const antiga = cp.fotos[slot];
    if (antiga?.path) removerFotoStorage(antiga.path);
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
        <div dangerouslySetInnerHTML={{ __html: svgEsquemaCamadas(modelo.camadas, modelo.disposicao, modelo.coresCamadas) }} style={{ lineHeight: 0 }} />
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

function criarSituacaoVazia(numero: number, modeloId: string, modeloPersonalizado?: ModeloSistemaCamadas): SituacaoAderencia {
  const modelo = (modeloId === ID_MODELO_PERSONALIZADO ? modeloPersonalizado : obterModeloCamadas(modeloId)) ?? criarModeloPersonalizadoPadrao();
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
    ...(modeloId === ID_MODELO_PERSONALIZADO ? { modeloPersonalizado: modelo } : {}),
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
  const [modelosPersonalizados, setModelosPersonalizados] = useState<(ModeloSistemaCamadas | null)[]>([null]);
  const [colunasManuaisPorSituacao, setColunasManuaisPorSituacao] = useState<boolean[]>([false]);
  const [situacoes, setSituacoes] = useState<SituacaoAderencia[]>([]);
  const [situacaoAtual, setSituacaoAtual] = useState(0);
  const [salvoMsg, setSalvoMsg] = useState('');
  const [cabecalho, setCabecalho] = useState<AderenciaCabecalho>(CABECALHO_VAZIO);
  const [gerandoDocx, setGerandoDocx] = useState(false);
  const { userCrea, userAssinatura, userName, loaded, fetchUser } = useUserStore();

  useEffect(() => {
    if (!loaded) fetchUser();
  }, [loaded, fetchUser]);

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/login');
    });
  }, [router]);

  // Carrega o autosave uma única vez, ao montar.
  useEffect(() => {
    const s = carregarLocal();
    if (!s) return;
    setEtapa(s.etapa);
    setNumSituacoes(s.numSituacoes);
    setModeloPorSituacao(s.modeloPorSituacao);
    if (Array.isArray(s.modelosPersonalizados)) {
      setModelosPersonalizados(s.modelosPersonalizados);
    } else {
      setModelosPersonalizados(s.modeloPorSituacao.map((_, idx) => s.situacoes[idx]?.modeloPersonalizado ?? null));
    }
    if (Array.isArray(s.colunasManuaisPorSituacao)) {
      setColunasManuaisPorSituacao(s.colunasManuaisPorSituacao);
    } else {
      setColunasManuaisPorSituacao(s.modeloPorSituacao.map(() => false));
    }
    setSituacoes(s.situacoes);
    setSituacaoAtual(s.situacaoAtual);
    if (s.cabecalho) setCabecalho({ ...CABECALHO_VAZIO, ...s.cabecalho, normas: { ...CABECALHO_VAZIO.normas, ...s.cabecalho.normas } });
  }, []);

  // Autosave com debounce a cada mudança relevante (fotos são removidas antes de gravar).
  useEffect(() => {
    const t = setTimeout(() => {
      salvarLocal({
        etapa,
        numSituacoes,
        modeloPorSituacao,
        modelosPersonalizados,
        colunasManuaisPorSituacao,
        situacoes,
        situacaoAtual,
        cabecalho,
      });
      setSalvoMsg('Salvo');
      const t2 = setTimeout(() => setSalvoMsg(''), 1800);
      return () => clearTimeout(t2);
    }, 500);
    return () => clearTimeout(t);
  }, [etapa, numSituacoes, modeloPorSituacao, modelosPersonalizados, colunasManuaisPorSituacao, situacoes, situacaoAtual, cabecalho]);

  function alterarNumSituacoes(n: number) {
    const clamped = Math.max(MIN_SITUACOES, Math.min(MAX_SITUACOES, n));
    setNumSituacoes(clamped);
    setModeloPorSituacao(prev => {
      const next = [...prev];
      while (next.length < clamped) next.push(MODELOS_SISTEMA_CAMADAS[0].id);
      next.length = clamped;
      return next;
    });
    setModelosPersonalizados(prev => {
      const next = [...prev];
      while (next.length < clamped) next.push(null);
      next.length = clamped;
      return next;
    });
    setColunasManuaisPorSituacao(prev => {
      const next = [...prev];
      while (next.length < clamped) next.push(false);
      next.length = clamped;
      return next;
    });
  }

  function obterPersonalizadoOuPadrao(indice: number): ModeloSistemaCamadas {
    return modelosPersonalizados[indice] ?? criarModeloPersonalizadoPadrao('parede');
  }

  function selecionarModelo(indice: number, modeloId: string) {
    setModeloPorSituacao(prev => prev.map((id, i) => (i === indice ? modeloId : id)));
    if (modeloId === ID_MODELO_PERSONALIZADO && !modelosPersonalizados[indice]) {
      setModelosPersonalizados(prev => prev.map((m, i) => (i === indice ? criarModeloPersonalizadoPadrao('parede') : m)));
    }
  }

  function atualizarModeloPersonalizado(indice: number, nextModelo: ModeloSistemaCamadas, nextColunasManuais: boolean) {
    setModelosPersonalizados(prev => prev.map((m, i) => (i === indice ? nextModelo : m)));
    setColunasManuaisPorSituacao(prev => prev.map((v, i) => (i === indice ? nextColunasManuais : v)));
  }

  function confirmarConfiguracao() {
    setSituacoes(prev =>
      modeloPorSituacao.map((modeloId, i) => {
        const customModelo = modeloId === ID_MODELO_PERSONALIZADO ? obterPersonalizadoOuPadrao(i) : undefined;
        const existente = prev[i];
        if (existente && existente.modeloCamadasId === modeloId) {
          if (modeloId === ID_MODELO_PERSONALIZADO && customModelo) {
            // Sincroniza colunas dos CPs preservando valores já digitados nas colunas que permaneceram
            const cpsSincronizados = redimensionarCorposDeProva(
              existente.corposDeProva,
              existente.numCPs,
              customModelo.colunasFormaRuptura,
            ).map(cp => {
              const formaRuptura: Record<string, number> = {};
              customModelo.colunasFormaRuptura.forEach(c => {
                formaRuptura[c] = cp.formaRuptura?.[c] ?? 0;
              });
              return { ...cp, formaRuptura };
            });
            return {
              ...existente,
              modeloPersonalizado: customModelo,
              corposDeProva: cpsSincronizados,
            };
          }
          return existente;
        }
        return criarSituacaoVazia(i + 1, modeloId, customModelo);
      })
    );
    setSituacaoAtual(0);
    setEtapa('situacoes');
  }

  function atualizarSituacao(indice: number, next: SituacaoAderencia) {
    setSituacoes(prev => prev.map((s, i) => (i === indice ? next : s)));
  }

  function atualizarCabecalho<K extends keyof AderenciaCabecalho>(campo: K, valor: AderenciaCabecalho[K]) {
    setCabecalho(prev => ({ ...prev, [campo]: valor }));
  }

  async function gerarRelatorio() {
    if (!cabecalho.rltNumero.trim()) { alert('Informe o Nº do relatório (RLT) antes de gerar.'); setEtapa('config'); return; }
    setGerandoDocx(true);
    try {
      // O esquema (SVG) é rasterizado em PNG aqui no navegador, pois o DOCX não embute SVG de forma confiável.
      const situacoesPayload = await Promise.all(
        situacoes.map(async (s, idx) => {
          const modelo = resolverModeloSituacao(s) ?? (s.modeloCamadasId === ID_MODELO_PERSONALIZADO ? obterPersonalizadoOuPadrao(idx) : undefined);
          const esquema = modelo
            ? await svgParaPng(svgEsquemaCamadas(modelo.camadas, modelo.disposicao, modelo.coresCamadas))
            : null;
          return {
            ...s,
            ...(s.modeloCamadasId === ID_MODELO_PERSONALIZADO && modelo ? { modeloPersonalizado: modelo } : {}),
            esquema,
          };
        })
      );

      // Fotos já no Storage viajam só com `path` (sem base64) — o servidor baixa na geração.
      const situacoesLeves = situacoesPayload.map(s => ({
        ...s,
        corposDeProva: s.corposDeProva.map(cp => ({
          ...cp,
          fotos: cp.fotos.map(f => (f?.path ? { ...f, base64: '' } : f)),
        })),
      }));

      const res = await fetch('/api/ensaios/aderencia/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cabecalho,
          situacoes: situacoesLeves,
          respNome: userName,
          respCrea: userCrea,
          respAssinaturaUrl: userAssinatura || '',
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Erro ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cabecalho.rltNumero.trim() || 'laudo-aderencia'}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Erro ao gerar DOCX.');
    } finally {
      setGerandoDocx(false);
    }
  }

  return (
    <div style={{ backgroundColor: BG, minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <Header paginaAtiva="ensaios" />

      <main style={{ maxWidth: 1600, margin: '0 auto', padding: '24px 20px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, borderLeft: `4px solid ${GOLD}`, paddingLeft: 12, marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: TEXT }}>Resistência de Aderência à Tração</h1>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: SUBTEXT }}>
              {etapa === 'config' ? 'Configuração inicial do relatório' : `Situação ${numeroRomano(situacaoAtual + 1)} de ${numeroRomano(situacoes.length)}`}
            </p>
          </div>
          {salvoMsg && (
            <span style={{ fontSize: 12, color: SUCCESS, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, paddingTop: 3 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
              {salvoMsg}
            </span>
          )}
        </div>

        {etapa === 'config' && (
          <>
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 22px', marginBottom: 20 }}>
              <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 800, color: PRIMARY }}>Cabeçalho do relatório</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px 16px' }}>
                <Campo label="Nº RLT" htmlFor="ad-rlt"><input id="ad-rlt" style={inputStyle} value={cabecalho.rltNumero} onChange={e => atualizarCabecalho('rltNumero', e.target.value)} placeholder="Ex: 045" /></Campo>
                <Campo label="Cliente" htmlFor="ad-cliente"><input id="ad-cliente" style={inputStyle} value={cabecalho.cliente} onChange={e => atualizarCabecalho('cliente', e.target.value)} /></Campo>
                <Campo label="Obra" htmlFor="ad-obra"><input id="ad-obra" style={inputStyle} value={cabecalho.obra} onChange={e => atualizarCabecalho('obra', e.target.value)} /></Campo>
                <Campo label="Construtora" htmlFor="ad-construtora"><input id="ad-construtora" style={inputStyle} value={cabecalho.construtora} onChange={e => atualizarCabecalho('construtora', e.target.value)} /></Campo>
                <Campo label="Endereço" htmlFor="ad-endereco"><input id="ad-endereco" style={inputStyle} value={cabecalho.endereco} onChange={e => atualizarCabecalho('endereco', e.target.value)} /></Campo>
                <Campo label="Data de emissão" htmlFor="ad-data"><input id="ad-data" type="date" style={inputStyle} value={cabecalho.dataEmissao} onChange={e => atualizarCabecalho('dataEmissao', e.target.value)} /></Campo>
              </div>
              <p style={{ margin: '18px 0 8px', fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Norma(s) de referência</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {NORMAS_OPCOES.map(n => (
                  <label key={n.campo} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: TEXT, marginLeft: n.sub ? 24 : 0, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={cabecalho.normas[n.campo]}
                      onChange={e => atualizarCabecalho('normas', { ...cabecalho.normas, [n.campo]: e.target.checked })}
                    />
                    {n.label}
                  </label>
                ))}
              </div>
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

            {modeloPorSituacao.map((modeloId, i) => {
              const modeloCustom = obterPersonalizadoOuPadrao(i);
              const isCustom = modeloId === ID_MODELO_PERSONALIZADO;
              return (
                <div key={i} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '18px 22px', marginBottom: 16 }}>
                  <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 800, color: PRIMARY }}>Situação {numeroRomano(i + 1)} — Modelo de sistema de camadas</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                    {MODELOS_SISTEMA_CAMADAS.map(modelo => (
                      <ModeloCard key={modelo.id} modelo={modelo} selecionado={modeloId === modelo.id} onSelecionar={() => selecionarModelo(i, modelo.id)} />
                    ))}
                    <ModeloCard
                      modelo={modeloCustom}
                      selecionado={isCustom}
                      onSelecionar={() => selecionarModelo(i, ID_MODELO_PERSONALIZADO)}
                      personalizado
                    />
                  </div>
                  {isCustom && (
                    <EditorModeloPersonalizado
                      modelo={modeloCustom}
                      colunasManuais={colunasManuaisPorSituacao[i] ?? false}
                      onChange={(nextM, nextManuais) => atualizarModeloPersonalizado(i, nextM, nextManuais)}
                    />
                  )}
                </div>
              );
            })}

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
                modelo={
                  resolverModeloSituacao(situacoes[situacaoAtual]) ??
                  obterPersonalizadoOuPadrao(situacaoAtual)
                }
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
                  onClick={gerarRelatorio}
                  disabled={gerandoDocx}
                  style={{ padding: '11px 20px', borderRadius: 8, border: 'none', background: gerandoDocx ? BORDER : GOLD, color: gerandoDocx ? SUBTEXT : '#fff', fontSize: 13, fontWeight: 700, cursor: gerandoDocx ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                >
                  {gerandoDocx ? 'Gerando…' : 'Gerar relatório (.docx)'}
                </button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
