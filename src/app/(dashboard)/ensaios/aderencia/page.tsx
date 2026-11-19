'use client';
// src/app/(dashboard)/ensaios/aderencia/page.tsx

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import { PlanilhaStyles, EnsaioCabecalho, EnsaioTabs } from '@/components/PlanilhaUI';
import { ResponsavelTecnicoPanel } from '@/components/ResponsavelTecnicoPanel';
import {
  MODELOS_SISTEMA_CAMADAS,
  ID_MODELO_PERSONALIZADO,
  MAX_COLUNAS_FORMA_RUPTURA,
  PALETA_CORES_CAMADAS,
  corCamada,
  svgEsquemaCamadas,
  svgGraficoResultado,
  tituloPadraoGrafico,
  numeroRomano,
  formatarRltAderencia,
  sugerirCriterioRa,
  obterLimitesCriterioRa,
  avaliarPanoRa,
  obterModeloCamadas,
  gerarColunasFormaRuptura,
  criarModeloPersonalizadoPadrao,
  resolverModeloSituacao,
  criarCorpoDeProva,
  redimensionarCorposDeProva,
  calcularTensaoRa,
  recalcularTensoes,
  calcularEstatisticasCPs,
  type ModeloSistemaCamadas,
  type SituacaoAderencia,
  type CorpoDeProva,
  type FotoAnexo,
  type AderenciaCabecalho,
  type AderenciaNormas,
  type CriterioRa,
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

function Campo({ label, htmlFor, children, compacto = true }: { label: string; htmlFor?: string; children: React.ReactNode; compacto?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compacto ? 2 : 4 }}>
      <label htmlFor={htmlFor} style={{ fontSize: compacto ? 10 : 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '5px 8px', borderRadius: 6, border: `1.5px solid ${BORDER}`,
  fontSize: 12.5, fontFamily: 'inherit', color: TEXT, background: '#fff',
  outline: 'none', width: '100%', boxSizing: 'border-box', height: 31,
};

const cellInputStyle: React.CSSProperties = {
  padding: '3px 4px', borderRadius: 5, border: `1.5px solid ${BORDER}`,
  fontSize: 12, fontFamily: 'inherit', color: TEXT, background: '#fff',
  outline: 'none', width: '100%', boxSizing: 'border-box', textAlign: 'center', height: 28,
};

const gridInputStyle: React.CSSProperties = {
  padding: '0 4px', border: 'none', borderRadius: 0,
  fontSize: 12, fontFamily: 'inherit', color: TEXT, background: 'transparent',
  outline: 'none', width: '100%', boxSizing: 'border-box', textAlign: 'center', height: 34,
};

const fichaInputStyle: React.CSSProperties = {
  padding: '2px 0', border: 'none', borderRadius: 0,
  fontSize: 12.5, fontFamily: 'inherit', fontWeight: 500, color: TEXT, background: 'transparent',
  outline: 'none', width: '100%', boxSizing: 'border-box', height: 24,
};

/**
 * Campo numérico decimal (texto, não `type="number"`): aceita só dígitos e uma vírgula como
 * separador decimal (padrão brasileiro), sem as setas nativas do navegador. Mantém um texto local
 * para não "engolir" a vírgula digitada (ex: "0,") enquanto o valor externo ainda é um number — só
 * resincroniza do valor externo quando ele muda por outro motivo (reset de linha, autosave, etc.).
 */
function NumeroInput({ value, onChange, style, placeholder, maxDecimais = 2, maxInteiros, maxValor, onKeyDown, dataCell }: {
  value: number | null; onChange: (v: number | null) => void; style?: React.CSSProperties; placeholder?: string;
  /** Casas após a vírgula (padrão 2; 0 = só inteiros). */ maxDecimais?: number;
  /** Máximo de dígitos antes da vírgula (sem limite se omitido). */ maxInteiros?: number;
  /** Valor máximo; acima disso o campo é limitado a ele (ex: 100 para porcentagem). */ maxValor?: number;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  dataCell?: string;
}) {
  const paraTexto = (v: number | null) => (v === null || v === undefined ? '' : String(v).replace('.', ','));
  const [texto, setTexto] = useState(paraTexto(value));

  useEffect(() => {
    const atual = texto === '' || texto === ',' ? null : Number(texto.replace(',', '.'));
    if (atual !== value && !(Number.isNaN(atual) && value === null)) setTexto(paraTexto(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let t = e.target.value.replace(maxDecimais > 0 ? /[^0-9,]/g : /[^0-9]/g, '');
    const partes = t.split(',');
    let inteiro = partes[0];
    const valorBruto = Number(
      (maxDecimais > 0 && partes.length > 1 ? `${inteiro}.${partes.slice(1).join('')}` : inteiro) || '0',
    );
    if (maxValor !== undefined && t !== '' && t !== ',' && valorBruto > maxValor) {
      t = String(maxValor).replace('.', ',');
    } else {
      if (maxInteiros !== undefined) inteiro = inteiro.slice(0, maxInteiros);
      t = inteiro;
      if (maxDecimais > 0 && partes.length > 1) t += ',' + partes.slice(1).join('').slice(0, maxDecimais);
    }
    setTexto(t);
    if (t === '' || t === ',') { onChange(null); return; }
    const num = Number(t.replace(',', '.'));
    if (!Number.isNaN(num)) onChange(num);
  }

  return (
    <input
      type="text"
      inputMode={maxDecimais === 0 ? 'numeric' : 'decimal'}
      pattern={maxDecimais === 0 ? '[0-9]*' : undefined}
      style={style}
      value={texto}
      placeholder={placeholder}
      onChange={handleChange}
      onKeyDown={onKeyDown}
      data-cell={dataCell}
    />
  );
}

const SUGESTOES_CAMADAS = [
  'Alvenaria',
  'Argamassa Colante',
  'Cerâmica',
  'Chapisco',
  'Concreto',
  'Contrapiso',
  'Emboço',
  'Gesso',
  'Pintura',
  'Porcelanato',
  'Reboco',
  'Regularização',
  'Substrato',
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
        dangerouslySetInnerHTML={{ __html: svgEsquemaCamadas(modelo.camadas, modelo.disposicao, modelo.coresCamadas, modelo.profundidadeCorte) }}
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
  const [novaColunaTexto, setNovaColunaTexto] = useState('');
  const cores = modelo.camadas.map((c, idx) => modelo.coresCamadas?.[idx] || corCamada(c));
  const ultimaCamada = (modelo.camadas[modelo.camadas.length - 1] ?? '').trim().toLowerCase();
  const acabamentoSemCortePadrao =
    ultimaCamada.includes('contrapiso') ||
    ultimaCamada.includes('emboço') ||
    ultimaCamada.includes('emboco');

  function aplicarCamadas(novasCamadas: string[], novasCores: string[], disp = modelo.disposicao) {
    const novasColunas = colunasManuais ? modelo.colunasFormaRuptura : gerarColunasFormaRuptura(novasCamadas);
    const novaUltima = (novasCamadas[novasCamadas.length - 1] ?? '').trim().toLowerCase();
    const mantemOpcaoCorte =
      novaUltima.includes('contrapiso') ||
      novaUltima.includes('emboço') ||
      novaUltima.includes('emboco');
    onChange(
      {
        ...modelo,
        disposicao: disp,
        camadas: novasCamadas,
        coresCamadas: novasCores,
        colunasFormaRuptura: novasColunas,
        profundidadeCorte: mantemOpcaoCorte ? modelo.profundidadeCorte : undefined,
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

  function selecionarCamadaDaLista(idx: number, nomeSelecionado: string) {
    if (!nomeSelecionado) return;
    const novasCamadas = modelo.camadas.map((c, i) => (i === idx ? nomeSelecionado : c));
    const novasCores = cores.map((c, i) => (i === idx ? corCamada(nomeSelecionado) : c));
    aplicarCamadas(novasCamadas, novasCores);
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

  function adicionarColunaRuptura(nomeInformado?: string) {
    if (modelo.colunasFormaRuptura.length >= MAX_COLUNAS_FORMA_RUPTURA) return;
    const cols = [...modelo.colunasFormaRuptura];
    const idxVazios = cols.findIndex(c => c.trim().toLowerCase() === 'vazios');
    const limpo = (nomeInformado ?? '').trim();
    const novaCol = limpo || `Col ${cols.length}`;
    if (idxVazios >= 0) cols.splice(idxVazios, 0, novaCol);
    else cols.push(novaCol);
    onChange({ ...modelo, colunasFormaRuptura: cols }, true);
    if (limpo) setNovaColunaTexto('');
  }

  function moverColunaRuptura(idx: number, direcao: -1 | 1) {
    const destino = idx + direcao;
    if (destino < 0 || destino >= modelo.colunasFormaRuptura.length) return;
    const novasCols = [...modelo.colunasFormaRuptura];
    [novasCols[idx], novasCols[destino]] = [novasCols[destino], novasCols[idx]];
    onChange({ ...modelo, colunasFormaRuptura: novasCols }, true);
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
    <div
      className="aderencia-editor"
      style={{
        marginTop: 16,
        padding: '14px 12px',
        background: BG,
        border: `1.5px solid ${PRIMARY}`,
        borderRadius: 12,
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <datalist id="sugestoes-camadas-aderencia">
        {SUGESTOES_CAMADAS.map(s => <option key={s} value={s} />)}
      </datalist>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div style={{ minWidth: 240, flex: '1 1 240px' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: PRIMARY }}>Construtor de esquema personalizado</p>
          <p style={{ margin: '2px 0 0', fontSize: 11.5, color: SUBTEXT, lineHeight: 1.35 }}>
            Escolha a orientação, adicione os sólidos retangulares com nome e cor, e ajuste as colunas de ruptura se necessário.
          </p>
        </div>

        {/* Seletor Horizontal (Piso) vs Vertical (Parede) */}
        <div style={{ display: 'flex', gap: 6, width: '100%', maxWidth: 340 }}>
          <button
            type="button"
            onClick={() => alterarDisposicao('piso')}
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              border: `1.5px solid ${modelo.disposicao === 'piso' ? PRIMARY : BORDER}`,
              background: modelo.disposicao === 'piso' ? PRIMARY : '#fff',
              color: modelo.disposicao === 'piso' ? '#fff' : TEXT,
              textAlign: 'center',
            }}
          >
            Horizontal (Piso)
          </button>
          <button
            type="button"
            onClick={() => alterarDisposicao('parede')}
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              border: `1.5px solid ${modelo.disposicao === 'parede' ? PRIMARY : BORDER}`,
              background: modelo.disposicao === 'parede' ? PRIMARY : '#fff',
              color: modelo.disposicao === 'parede' ? '#fff' : TEXT,
              textAlign: 'center',
            }}
          >
            Vertical (Parede)
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* Lista de camadas (sólidos retangulares) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, width: '100%' }}>
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
                  gap: 8,
                  padding: '10px 12px',
                  background: '#fff',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  boxSizing: 'border-box',
                  width: '100%',
                  minWidth: 0,
                }}
              >
                {/* Linha 1: Posição da camada e botões de ação */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: PRIMARY }}>{posLabel}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
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
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
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
                        fontSize: 14,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Linha 2: Seletor de cor personalizada + lista suspensa de camadas + input livre */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minWidth: 0 }}>
                    <input
                      type="color"
                      value={corAtual}
                      onChange={e => alterarCorCamada(idx, e.target.value)}
                      title="Escolher cor personalizada do sólido"
                      style={{
                        width: 42,
                        height: 40,
                        minWidth: 42,
                        minHeight: 40,
                        padding: 3,
                        borderRadius: 8,
                        border: `1.5px solid ${BORDER}`,
                        background: '#fff',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    />
                    <select
                      aria-label={`Selecionar camada ${idx + 1}`}
                      value={SUGESTOES_CAMADAS.find(s => s.toLowerCase() === nome.trim().toLowerCase()) ?? ''}
                      onChange={e => selecionarCamadaDaLista(idx, e.target.value)}
                      style={{
                        ...inputStyle,
                        flex: 1,
                        minWidth: 0,
                        width: '100%',
                        height: 'auto',
                        minHeight: 36,
                        padding: '7px 10px',
                        fontSize: 13,
                        lineHeight: 1.35,
                        background: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="">Selecionar camada da lista...</option>
                      {SUGESTOES_CAMADAS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    list="sugestoes-camadas-aderencia"
                    style={{
                      ...inputStyle,
                      width: '100%',
                      minWidth: 0,
                      height: 'auto',
                      minHeight: 36,
                      padding: '7px 10px',
                      fontSize: 13,
                      lineHeight: 1.35,
                    }}
                    value={nome}
                    onChange={e => alterarNomeCamada(idx, e.target.value)}
                    placeholder="Ou digite um nome personalizado (ex: Substrato, Chapisco...)"
                  />
                </div>

                {/* Linha 3: Paleta rápida de cores padrão do relatório */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 2 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: SUBTEXT }}>Cores padrão:</span>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${PALETA_CORES_CAMADAS.length}, minmax(0, 1fr))`, gap: 5, width: '100%' }}>
                    {PALETA_CORES_CAMADAS.map(p => {
                      const ativa = corAtual.toUpperCase() === p.cor.toUpperCase();
                      return (
                        <button
                          key={p.cor}
                          type="button"
                          title={p.nome}
                          onClick={() => alterarCorCamada(idx, p.cor)}
                          style={{
                            width: '100%',
                            height: 22,
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
              </div>
            );
          })}

          {/* Botão adicionar camada */}
          <div style={{ marginTop: 4 }}>
            <button
              type="button"
              onClick={() => adicionarCamada('')}
              style={{
                padding: '8px 14px',
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
              + Adicionar camada
            </button>
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
            minWidth: 0,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <span style={{ fontSize: 10.5, fontWeight: 800, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>
            Pré-visualização do esquema
          </span>
          <div
            dangerouslySetInnerHTML={{ __html: svgEsquemaCamadas(modelo.camadas, modelo.disposicao, cores, modelo.profundidadeCorte) }}
            style={{
              lineHeight: 0,
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '6px 0',
              overflow: 'hidden',
            }}
          />
          {acabamentoSemCortePadrao && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tipo de ensaio
              </span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                {([
                  { label: 'Superficial (sem corte)', valor: 0 },
                  { label: 'Profundo (com corte)', valor: 1 },
                ] as const).map(op => {
                  const ativo = op.valor === 1 ? modelo.profundidadeCorte === 1 : modelo.profundidadeCorte !== 1;
                  return (
                    <button
                      key={op.valor}
                      type="button"
                      onClick={() => onChange({ ...modelo, profundidadeCorte: op.valor }, colunasManuais)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 7,
                        border: `1.5px solid ${ativo ? PRIMARY : BORDER}`,
                        background: ativo ? PRIMARY : '#fff',
                        color: ativo ? '#fff' : TEXT,
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {op.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <span style={{ fontSize: 11, color: SUBTEXT, textAlign: 'center', lineHeight: 1.35 }}>
            O disco de tração (adesivo epóxi + placa metálica) é desenhado automaticamente sobre a última camada.
          </span>
        </div>
      </div>

      {/* Colunas de Forma de Ruptura (%) geradas automaticamente com edição manual */}
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Colunas de &ldquo;Forma de Ruptura (%)&rdquo; ({modelo.colunasFormaRuptura.length}/{MAX_COLUNAS_FORMA_RUPTURA})
            </span>
            <span style={{ fontSize: 11, color: SUBTEXT, display: 'block', marginTop: 2 }}>
              {colunasManuais ? '(editadas manualmente)' : '(geradas automaticamente pelas camadas)'}
            </span>
          </div>
          {colunasManuais && (
            <button
              type="button"
              onClick={restaurarColunasAutomaticas}
              style={{
                padding: '6px 10px',
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
              ↻ Regerar pelas camadas
            </button>
          )}
        </div>

        <div
          style={{
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            background: '#fff',
            overflow: 'hidden',
            width: '100%',
          }}
        >
          {modelo.colunasFormaRuptura.map((col, idx) => {
            const ehPrimeira = idx === 0;
            const ehUltima = idx === modelo.colunasFormaRuptura.length - 1;
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 10px',
                  borderBottom: ehUltima ? 'none' : '1px solid #F1F5F9',
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 99,
                    background: '#EEF2FF',
                    color: PRIMARY,
                    fontSize: 11,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </span>
                <input
                  aria-label={`Nome da coluna ${idx + 1}`}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: 'none',
                    outline: 'none',
                    fontSize: 13,
                    fontWeight: 700,
                    color: TEXT,
                    fontFamily: 'inherit',
                    background: 'transparent',
                    padding: '4px 0',
                  }}
                  value={col}
                  onChange={e => editarColunaRuptura(idx, e.target.value)}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => moverColunaRuptura(idx, -1)}
                    disabled={ehPrimeira}
                    title="Mover coluna para cima"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: `1px solid ${BORDER}`,
                      background: '#F8FAFC',
                      color: PRIMARY,
                      cursor: ehPrimeira ? 'not-allowed' : 'pointer',
                      opacity: ehPrimeira ? 0.3 : 1,
                      fontWeight: 800,
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moverColunaRuptura(idx, 1)}
                    disabled={ehUltima}
                    title="Mover coluna para baixo"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: `1px solid ${BORDER}`,
                      background: '#F8FAFC',
                      color: PRIMARY,
                      cursor: ehUltima ? 'not-allowed' : 'pointer',
                      opacity: ehUltima ? 0.3 : 1,
                      fontWeight: 800,
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removerColunaRuptura(idx)}
                    disabled={modelo.colunasFormaRuptura.length <= 1}
                    title="Remover coluna"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: '1px solid #FECACA',
                      background: '#FEF2F2',
                      color: DANGER,
                      fontWeight: 800,
                      fontSize: 14,
                      cursor: modelo.colunasFormaRuptura.length <= 1 ? 'not-allowed' : 'pointer',
                      opacity: modelo.colunasFormaRuptura.length <= 1 ? 0.3 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Barra de adição rápida no rodapé */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, width: '100%' }}>
          <input
            type="text"
            value={novaColunaTexto}
            onChange={e => setNovaColunaTexto(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                adicionarColunaRuptura(novaColunaTexto);
              }
            }}
            disabled={modelo.colunasFormaRuptura.length >= MAX_COLUNAS_FORMA_RUPTURA}
            placeholder="Nova coluna (ex: Sub/Emb)..."
            style={{
              ...inputStyle,
              flex: 1,
              minWidth: 0,
              height: 'auto',
              minHeight: 36,
              padding: '7px 10px',
              fontSize: 13,
            }}
          />
          <button
            type="button"
            onClick={() => adicionarColunaRuptura(novaColunaTexto)}
            disabled={modelo.colunasFormaRuptura.length >= MAX_COLUNAS_FORMA_RUPTURA}
            style={{
              padding: '8px 14px',
              borderRadius: 7,
              border: 'none',
              background: PRIMARY,
              color: '#fff',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: modelo.colunasFormaRuptura.length >= MAX_COLUNAS_FORMA_RUPTURA ? 'not-allowed' : 'pointer',
              opacity: modelo.colunasFormaRuptura.length >= MAX_COLUNAS_FORMA_RUPTURA ? 0.45 : 1,
              fontFamily: 'inherit',
              flexShrink: 0,
            }}
          >
            + Adicionar
          </button>
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
        const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1] ?? '';
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

function FotoSlot({ foto, onEscolher, onRemover, label, tamanho = 36, largura, altura }: { foto: FotoAnexo | null; onEscolher: (file: File) => void; onRemover: () => void; label: string; tamanho?: number; largura?: number | string; altura?: number }) {
  const id = `foto-${label}-${Math.random().toString(36).slice(2)}`;
  const w = largura ?? tamanho;
  const h = altura ?? tamanho;
  return (
    <div style={{ position: 'relative', width: w, height: h, flexShrink: 0 }}>
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
          <button type="button" onClick={onRemover} title="Remover foto" style={{ position: 'absolute', top: -5, right: -5, width: 15, height: 15, borderRadius: '50%', background: DANGER, color: '#fff', border: '1.5px solid #fff', fontSize: 9, lineHeight: '11px', cursor: 'pointer', padding: 0 }}>×</button>
        </div>
      ) : (
        <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', borderRadius: 8, border: `1.5px dashed ${BORDER}`, background: '#F8FAFC', cursor: 'pointer', color: SUBTEXT, fontSize: largura ? 12 : 9, fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>
          + {label}
        </label>
      )}
    </div>
  );
}

function useIsMobile(max = 720) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${max}px)`);
    const atualizar = () => setM(mq.matches);
    atualizar();
    mq.addEventListener('change', atualizar);
    return () => mq.removeEventListener('change', atualizar);
  }, [max]);
  return m;
}

const navCpBtn: React.CSSProperties = { width: 44, height: 40, borderRadius: 8, border: `1.5px solid ${BORDER}`, background: '#fff', fontSize: 20, fontWeight: 700, color: PRIMARY, cursor: 'pointer' };

// ── Formulário de uma Situação ──────────────────────────────────
function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

function formatarDataDigitada(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function SituacaoForm({
  situacao,
  modelo,
  normas,
  onChange,
}: {
  situacao: SituacaoAderencia;
  modelo: ModeloSistemaCamadas;
  normas: AderenciaNormas;
  onChange: (next: SituacaoAderencia) => void;
}) {
  const tabelaRef = useRef<HTMLTableElement>(null);

  function focarCelulaTabela(destino: string) {
    const el = tabelaRef.current?.querySelector<HTMLInputElement>(`input[data-cell="${destino}"]`);
    if (el) {
      el.focus();
      el.select();
    }
  }

  function aoPressionarEnterTabela(e: React.KeyboardEvent<HTMLInputElement>, destino: string) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    focarCelulaTabela(destino);
  }

  function aoNavegarFormaRuptura(
    e: React.KeyboardEvent<HTMLInputElement>,
    linha: number,
    colIdx: number,
    totalCols: number,
  ) {
    if (e.key === 'Enter' || e.key === 'ArrowRight') {
      e.preventDefault();
      const prox = colIdx + 1 < totalCols ? `rup-${linha}-${colIdx + 1}` : `rup-${linha + 1}-0`;
      focarCelulaTabela(prox);
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const ant = colIdx > 0 ? `rup-${linha}-${colIdx - 1}` : `rup-${linha - 1}-${totalCols - 1}`;
      focarCelulaTabela(ant);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focarCelulaTabela(`rup-${linha + 1}-${colIdx}`);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      focarCelulaTabela(`rup-${linha - 1}-${colIdx}`);
    }
  }

  const [numCPsTexto, setNumCPsTexto] = useState(String(situacao.numCPs));
  useEffect(() => {
    setNumCPsTexto(String(situacao.numCPs));
  }, [situacao.numero, situacao.numCPs]);

  function atualizar<K extends keyof SituacaoAderencia>(campo: K, valor: SituacaoAderencia[K]) {
    onChange({ ...situacao, [campo]: valor });
  }

  function alterarNumCPs(n: number) {
    const numCPs = Math.max(1, n || 1);
    const corposDeProva = redimensionarCorposDeProva(situacao.corposDeProva, numCPs, modelo.colunasFormaRuptura);
    onChange({ ...situacao, numCPs, corposDeProva });
  }

  function handleNumCPsChange(valor: string) {
    const digitos = somenteDigitos(valor);
    setNumCPsTexto(digitos);
    if (digitos !== '') {
      const n = Number(digitos);
      if (n >= 1) alterarNumCPs(n);
    }
  }

  function handleNumCPsBlur() {
    const n = Number(numCPsTexto);
    if (!numCPsTexto || Number.isNaN(n) || n < 1) {
      setNumCPsTexto('1');
      if (situacao.numCPs !== 1) alterarNumCPs(1);
    } else {
      setNumCPsTexto(String(n));
    }
  }

  function atualizarCP(indice: number, next: CorpoDeProva) {
    // Ra é calculado a partir da carga (kgf) e do formato da placa
    const comRa = next.cargaKgf !== undefined && next.cargaKgf !== null
      ? { ...next, tensaoRa: calcularTensaoRa(next.cargaKgf, situacao.formatoPlaca ?? 'circular') }
      : next.cargaKgf === null && situacao.corposDeProva[indice].cargaKgf != null ? { ...next, tensaoRa: null } : next;
    const corposDeProva = situacao.corposDeProva.map((cp, i) => (i === indice ? comRa : cp));
    onChange({ ...situacao, corposDeProva });
  }

  function alterarFormatoPlaca(formatoPlaca: 'circular' | 'quadrada') {
    onChange({ ...situacao, formatoPlaca, corposDeProva: recalcularTensoes(situacao.corposDeProva, formatoPlaca) });
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
  const mobile = useIsMobile();
  const [cpAtual, setCpAtual] = useState(0);
  const cpIdx = Math.min(cpAtual, Math.max(0, situacao.corposDeProva.length - 1));
  const cpSel = situacao.corposDeProva[cpIdx];
  const cpPreenchido = (cp: CorpoDeProva) => cp.tensaoRa !== null && cp.tensaoRa !== undefined;
  const criterioEfetivo = situacao.criterioRa ?? sugerirCriterioRa(normas, situacao.modeloCamadasId, situacao.tipoRevestimento);
  const limitesRa = obterLimitesCriterioRa(criterioEfetivo);
  const avaliacaoPano = avaliarPanoRa(situacao.corposDeProva, criterioEfetivo);

  return (
    <div style={{ minWidth: 0, maxWidth: '100%' }}>
      {/* 1. Ficha técnica da situação — mesmo padrão de grade contínua da tabela */}
      <div style={{ border: '1px solid #94A3B8', borderRadius: 8, overflow: 'hidden', background: '#fff', marginBottom: 14 }}>
        <div className="aderencia-sit-header" style={{ background: PRIMARY, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            DADOS DA SITUAÇÃO
          </span>
          <div className="aderencia-sit-controls">
            <label htmlFor="ad-criterio-ra" className="aderencia-sit-ctrl-label">Critério Ra:</label>
            <select
              id="ad-criterio-ra"
              className="aderencia-sit-select"
              value={criterioEfetivo}
              onChange={e => atualizar('criterioRa', e.target.value as CriterioRa)}
            >
              <option value="0.20" style={{ color: TEXT, background: '#fff' }}>≥ 0,20 MPa (Tabela 01)</option>
              <option value="0.30" style={{ color: TEXT, background: '#fff' }}>≥ 0,30 MPa (Tabela 01)</option>
              <option value="nbr13755" style={{ color: TEXT, background: '#fff' }}>NBR 13755 (0,30 / 0,50 MPa)</option>
            </select>
            <label htmlFor="ad-formato-placa" className="aderencia-sit-ctrl-label">Placa:</label>
            <select
              id="ad-formato-placa"
              className="aderencia-sit-select"
              value={situacao.formatoPlaca ?? 'circular'}
              onChange={e => alterarFormatoPlaca(e.target.value as 'circular' | 'quadrada')}
            >
              <option value="circular" style={{ color: TEXT, background: '#fff' }}>Circular Ø 5 cm</option>
              <option value="quadrada" style={{ color: TEXT, background: '#fff' }}>Quadrada 10×10 cm</option>
            </select>
          </div>
        </div>

        {/* 5 pares de 2 colunas */}
        <div className="aderencia-ficha-grid">
          <CelulaFicha label="Tipo de revestimento" borderRight>
            <input style={{ ...fichaInputStyle, textTransform: 'uppercase' }} value={situacao.tipoRevestimento} onChange={e => atualizar('tipoRevestimento', e.target.value.toUpperCase())} placeholder="EX: VERTICAL INTERNO" />
          </CelulaFicha>
          <CelulaFicha label="Data do ensaio">
            <input style={fichaInputStyle} inputMode="numeric" pattern="[0-9]*" maxLength={10} value={situacao.dataEnsaio} onChange={e => atualizar('dataEnsaio', formatarDataDigitada(e.target.value))} placeholder="DD/MM/AAAA" />
          </CelulaFicha>

          <CelulaFicha label="Nº de corpos de prova" borderRight>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              style={fichaInputStyle}
              value={numCPsTexto}
              onChange={e => handleNumCPsChange(e.target.value)}
              onBlur={handleNumCPsBlur}
            />
          </CelulaFicha>
          <CelulaFicha label="Data de aplicação">
            <input style={fichaInputStyle} inputMode="numeric" pattern="[0-9]*" maxLength={10} value={situacao.dataAplicacao} onChange={e => atualizar('dataAplicacao', formatarDataDigitada(e.target.value))} placeholder="DD/MM/AAAA" />
          </CelulaFicha>

          <CelulaFicha label="Substrato" borderRight>
            <input style={fichaInputStyle} value={situacao.substrato} onChange={e => atualizar('substrato', e.target.value)} />
          </CelulaFicha>
          <CelulaFicha label="Idade de ruptura (dias)">
            <input style={fichaInputStyle} inputMode="numeric" pattern="[0-9]*" value={situacao.idadeRupturaDias} onChange={e => atualizar('idadeRupturaDias', somenteDigitos(e.target.value))} placeholder="EX: 28" />
          </CelulaFicha>

          <CelulaFicha label="Chapisco" borderRight>
            <input style={fichaInputStyle} value={situacao.chapisco} onChange={e => atualizar('chapisco', e.target.value)} />
          </CelulaFicha>
          <CelulaFicha label="Traço (chapisco)">
            <input style={fichaInputStyle} value={situacao.chapiscoTraco} onChange={e => atualizar('chapiscoTraco', e.target.value)} />
          </CelulaFicha>

          <CelulaFicha label="Emboço" borderRight>
            <input style={fichaInputStyle} value={situacao.emboco} onChange={e => atualizar('emboco', e.target.value)} />
          </CelulaFicha>
          <CelulaFicha label="Traço (emboço)">
            <input style={fichaInputStyle} value={situacao.embocoTraco} onChange={e => atualizar('embocoTraco', e.target.value)} />
          </CelulaFicha>
        </div>

        {/* Faixa tripla: Argamassa colante | Revestimento | Dimensões (cm) */}
        <div className="aderencia-tripla-row">
          <CelulaFicha label="Argamassa colante" borderRight>
            <input style={fichaInputStyle} value={situacao.argamassaColante} onChange={e => atualizar('argamassaColante', e.target.value)} />
          </CelulaFicha>
          <CelulaFicha label="Revestimento" borderRight>
            <input style={fichaInputStyle} value={situacao.revestimento} onChange={e => atualizar('revestimento', e.target.value)} />
          </CelulaFicha>
          <CelulaFicha label="Dimensões (cm)">
            <input style={fichaInputStyle} value={situacao.dimensoesCm} onChange={e => atualizar('dimensoesCm', e.target.value)} placeholder="EX: 10X10" />
          </CelulaFicha>
        </div>

        {/* Esquema + Observações */}
        <div className="aderencia-esquema-sit">
          <div className="ficha-celula" style={{ padding: '10px 14px', background: '#F8FAFC', borderRight: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div dangerouslySetInnerHTML={{ __html: svgEsquemaCamadas(modelo.camadas, modelo.disposicao, modelo.coresCamadas, modelo.profundidadeCorte) }} style={{ lineHeight: 0 }} />
          </div>
          <CelulaFicha label="Observações do esquema" borderBottom={false}>
            <textarea
              style={{ ...fichaInputStyle, height: 'auto', minHeight: 74, resize: 'vertical', padding: '4px 0', lineHeight: 1.4 }}
              value={situacao.observacoesEsquema}
              onChange={e => atualizar('observacoesEsquema', e.target.value)}
              placeholder="Observações sobre o sistema de revestimento ensaiado..."
            />
          </CelulaFicha>
        </div>
      </div>

      {/* 3. Tabela RESULTADO DO ENSAIO (Opção 2 — Planilha Técnica Compacta) */}
      <div style={{ border: '1px solid #94A3B8', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        <div style={{ background: PRIMARY, padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            RESULTADO DO ENSAIO
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {avaliacaoPano && (
              <span style={{
                padding: '2px 8px', borderRadius: 10, fontSize: 10.5, fontWeight: 800,
                background: avaliacaoPano.status === 'aprovado' ? '#DCFCE7' : avaliacaoPano.status === 'atencao' ? '#FEF3C7' : '#FEE2E2',
                color: avaliacaoPano.status === 'aprovado' ? '#166534' : avaliacaoPano.status === 'atencao' ? '#B45309' : '#B91C1C',
              }}>
                {avaliacaoPano.texto}
              </span>
            )}
            {!mobile && (
              <span style={{ fontSize: 10.5, fontWeight: 500, color: '#BFDBFE' }}>
                Grade contínua · use Tab para avançar entre células
              </span>
            )}
          </div>
        </div>

        {mobile && cpSel ? (() => {
          const raBaixoSel = cpSel.tensaoRa !== null && cpSel.tensaoRa < limitesRa.minimo;
          const raAtencaoSel = cpSel.tensaoRa !== null && limitesRa.recomendado !== null && cpSel.tensaoRa >= limitesRa.minimo && cpSel.tensaoRa < limitesRa.recomendado;
          const somaRupSel = modelo.colunasFormaRuptura.reduce((acc, col) => acc + (cpSel.formaRuptura[col] ?? 0), 0);
          const totalCols = modelo.colunasFormaRuptura.length;
          return (
          <div style={{ padding: '14px' }}>
            {/* Navegação entre CPs */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <button type="button" onClick={() => setCpAtual(Math.max(0, cpIdx - 1))} disabled={cpIdx === 0} style={{ ...navCpBtn, opacity: cpIdx === 0 ? 0.4 : 1 }}>‹</button>
              <b style={{ fontSize: 15, color: PRIMARY }}>CP {cpSel.numero} de {situacao.corposDeProva.length}</b>
              <button type="button" onClick={() => setCpAtual(Math.min(situacao.corposDeProva.length - 1, cpIdx + 1))} disabled={cpIdx >= situacao.corposDeProva.length - 1} style={{ ...navCpBtn, opacity: cpIdx >= situacao.corposDeProva.length - 1 ? 0.4 : 1 }}>›</button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #E2E8F0' }}>
              {situacao.corposDeProva.map((cp, j) => (
                <button key={j} type="button" onClick={() => setCpAtual(j)} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', background: j === cpIdx ? PRIMARY : cpPreenchido(cp) ? '#bfe3c6' : '#e5e9f0', color: j === cpIdx ? '#fff' : TEXT }}>{cp.numero}</button>
              ))}
            </div>

            {/* Bloco 1: Identificação e medições do CP (grade simétrica) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <Campo label="Bloco (%)">
                <NumeroInput
                  style={{ ...inputStyle, textAlign: 'center' }}
                  maxDecimais={0}
                  maxValor={100}
                  value={cpSel.bloco === '' ? null : (Number.isNaN(Number(cpSel.bloco)) ? null : Number(cpSel.bloco))}
                  onChange={v => atualizarCP(cpIdx, { ...cpSel, bloco: v === null ? '' : String(v) })}
                />
              </Campo>
              <Campo label="Junta (%)">
                <NumeroInput
                  style={{ ...inputStyle, textAlign: 'center' }}
                  maxDecimais={0}
                  maxValor={100}
                  value={cpSel.junta === '' ? null : (Number.isNaN(Number(cpSel.junta)) ? null : Number(cpSel.junta))}
                  onChange={v => atualizarCP(cpIdx, { ...cpSel, junta: v === null ? '' : String(v) })}
                />
              </Campo>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
              <Campo label="Carga (kgf)">
                <NumeroInput style={{ ...inputStyle, textAlign: 'center' }} value={cpSel.cargaKgf ?? null} onChange={v => atualizarCP(cpIdx, { ...cpSel, cargaKgf: v })} />
              </Campo>
              <Campo label="Ra (MPa)">
                <div style={{
                  ...inputStyle,
                  minHeight: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: raBaixoSel ? '#FEF2F2' : raAtencaoSel ? '#FFFBEB' : '#F1F5F9',
                  borderColor: raBaixoSel ? '#FECACA' : raAtencaoSel ? '#FDE68A' : BORDER,
                  color: raBaixoSel ? '#B91C1C' : raAtencaoSel ? '#B45309' : PRIMARY,
                  fontWeight: 800,
                }}>
                  {cpSel.tensaoRa === null ? '—' : cpSel.tensaoRa.toFixed(2).replace('.', ',')}
                </div>
              </Campo>
              <Campo label="Prof. (mm)">
                <NumeroInput style={{ ...inputStyle, textAlign: 'center' }} value={cpSel.profRuptura} onChange={v => atualizarCP(cpIdx, { ...cpSel, profRuptura: v })} />
              </Campo>
            </div>

            <div style={{ marginBottom: 14 }}>
              <Campo label="Localização (ponto da amostra)">
                <input style={inputStyle} value={cpSel.localizacao} onChange={e => atualizarCP(cpIdx, { ...cpSel, localizacao: e.target.value })} />
              </Campo>
            </div>

            {/* Bloco 2: Forma de ruptura (%) */}
            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Forma de ruptura (%)
                </span>
                <span style={{
                  padding: '2px 8px', borderRadius: 10, fontSize: 10.5, fontWeight: 800,
                  background: somaRupSel === 100 ? '#DCFCE7' : somaRupSel > 0 ? '#FEF3C7' : '#F1F5F9',
                  color: somaRupSel === 100 ? '#166534' : somaRupSel > 0 ? '#B45309' : '#64748B',
                }}>
                  Soma: {somaRupSel}%
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, alignItems: 'end' }}>
                {modelo.colunasFormaRuptura.map((col, idx) => {
                  const val = cpSel.formaRuptura[col] ?? 0;
                  const ehUltimoImpar = totalCols % 2 === 1 && idx === totalCols - 1;
                  return (
                    <div key={col} style={{ gridColumn: ehUltimoImpar ? '1 / -1' : undefined, minWidth: 0 }}>
                      <Campo label={col}>
                        <NumeroInput
                          style={{
                            ...inputStyle,
                            textAlign: 'center',
                            fontWeight: val > 0 ? 800 : 500,
                            color: val > 0 ? PRIMARY : TEXT,
                            background: val > 0 ? '#EFF6FF' : '#fff',
                            borderColor: val > 0 ? '#93C5FD' : BORDER,
                          }}
                          maxDecimais={0}
                          maxValor={100}
                          value={val > 0 ? val : null}
                          onChange={v => atualizarCP(cpIdx, { ...cpSel, formaRuptura: { ...cpSel.formaRuptura, [col]: v ?? 0 } })}
                        />
                      </Campo>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bloco 3: Fotos do CP (2 colunas simétricas) */}
            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 12 }}>
              <p style={{ margin: '0 0 8px', fontSize: 10.5, fontWeight: 800, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fotos</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <FotoSlot largura="100%" altura={76} foto={cpSel.fotos[0]} label="Foto 1" onEscolher={f => escolherFoto(cpIdx, 0, f)} onRemover={() => removerFoto(cpIdx, 0)} />
                <FotoSlot largura="100%" altura={76} foto={cpSel.fotos[1]} label="Foto 2" onEscolher={f => escolherFoto(cpIdx, 1, f)} onRemover={() => removerFoto(cpIdx, 1)} />
              </div>
            </div>

            <button type="button" className="btn-gold" onClick={() => setCpAtual(Math.min(situacao.corposDeProva.length - 1, cpIdx + 1))} disabled={cpIdx >= situacao.corposDeProva.length - 1} style={{ marginTop: 14, width: '100%', padding: '11px 0', borderRadius: 8, border: 'none', background: GOLD, color: PRIMARY, fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: cpIdx >= situacao.corposDeProva.length - 1 ? 0.4 : 1 }}>Próximo CP ›</button>
          </div>
          );
        })() : (
        <div style={{ overflowX: 'auto' }}>
          <table ref={tabelaRef} style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 34 }} />
              <col style={{ width: 48 }} />
              <col style={{ width: 48 }} />
              <col style={{ width: 64 }} />
              <col style={{ width: 64 }} />
              <col style={{ width: 64 }} />
              {modelo.colunasFormaRuptura.map(col => <col key={col} style={{ width: 38 }} />)}
              <col style={{ width: 48 }} />
              <col style={{ minWidth: 110 }} />
              <col style={{ width: 86 }} />
            </colgroup>
            <thead>
              <tr style={{ background: '#F1F5F9' }}>
                <Th rowSpan={2}>CP</Th>
                <Th rowSpan={2} borderLeft="1px solid #E2E8F0">Bloco</Th>
                <Th rowSpan={2} borderLeft="1px solid #E2E8F0">Junta</Th>
                <Th rowSpan={2} borderLeft="1px solid #E2E8F0">Carga<br /><span style={{ fontSize: 8, fontWeight: 700, color: SUBTEXT }}>(kgf)</span></Th>
                <Th rowSpan={2} borderLeft="1px solid #E2E8F0">Ra<br /><span style={{ fontSize: 8, fontWeight: 700, color: SUBTEXT }}>(MPa)</span></Th>
                <Th rowSpan={2} borderLeft="1px solid #E2E8F0">Prof.<br /><span style={{ fontSize: 8, fontWeight: 700, color: SUBTEXT }}>(mm)</span></Th>
                <th
                  colSpan={modelo.colunasFormaRuptura.length + 1}
                  style={{
                    padding: '4px 6px', fontSize: 9.5, fontWeight: 800, color: PRIMARY,
                    textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center',
                    background: '#DBEAFE', borderLeft: '1.5px solid #94A3B8', borderBottom: '1px solid #93C5FD',
                  }}
                >
                  Forma de Ruptura (%)
                </th>
                <Th rowSpan={2} borderLeft="1.5px solid #94A3B8">Localização</Th>
                <Th rowSpan={2} borderLeft="1px solid #E2E8F0">Fotos</Th>
              </tr>
              <tr style={{ background: '#F1F5F9', borderBottom: '1px solid #94A3B8' }}>
                {modelo.colunasFormaRuptura.map((col, idx) => (
                  <Th key={col} vertical borderLeft={idx === 0 ? '1.5px solid #94A3B8' : '1px solid #E2E8F0'}>
                    {col}
                  </Th>
                ))}
                <Th borderLeft="1px solid #CBD5E1">Soma</Th>
              </tr>
            </thead>
            <tbody>
              {situacao.corposDeProva.map((cp, i) => {
                const raBaixo = cp.tensaoRa !== null && cp.tensaoRa < limitesRa.minimo;
                const raAtencao = cp.tensaoRa !== null && limitesRa.recomendado !== null && cp.tensaoRa >= limitesRa.minimo && cp.tensaoRa < limitesRa.recomendado;
                const somaRup = modelo.colunasFormaRuptura.reduce((acc, col) => acc + (cp.formaRuptura[col] ?? 0), 0);
                const rowBg = i % 2 === 1 ? '#F8FAFC' : '#FFFFFF';
                return (
                  <tr key={i} style={{ background: rowBg, borderTop: '1px solid #E2E8F0' }}>
                    <Td style={{ textAlign: 'center' }}><span style={{ fontWeight: 800, fontSize: 12, color: '#475569' }}>{cp.numero}</span></Td>
                    <Td editable borderLeft="1px solid #E2E8F0">
                      <NumeroInput
                        style={gridInputStyle}
                        dataCell={`bloco-${i}`}
                        maxDecimais={0}
                        maxValor={100}
                        value={cp.bloco === '' ? null : (Number.isNaN(Number(cp.bloco)) ? null : Number(cp.bloco))}
                        onChange={v => atualizarCP(i, { ...cp, bloco: v === null ? '' : String(v) })}
                        onKeyDown={e => aoPressionarEnterTabela(e, `bloco-${i + 1}`)}
                      />
                    </Td>
                    <Td editable borderLeft="1px solid #E2E8F0">
                      <NumeroInput
                        style={gridInputStyle}
                        dataCell={`junta-${i}`}
                        maxDecimais={0}
                        maxValor={100}
                        value={cp.junta === '' ? null : (Number.isNaN(Number(cp.junta)) ? null : Number(cp.junta))}
                        onChange={v => atualizarCP(i, { ...cp, junta: v === null ? '' : String(v) })}
                        onKeyDown={e => aoPressionarEnterTabela(e, `junta-${i + 1}`)}
                      />
                    </Td>
                    <Td editable borderLeft="1px solid #E2E8F0">
                      <NumeroInput
                        style={gridInputStyle}
                        dataCell={`carga-${i}`}
                        value={cp.cargaKgf ?? null}
                        onChange={v => atualizarCP(i, { ...cp, cargaKgf: v })}
                        onKeyDown={e => aoPressionarEnterTabela(e, `carga-${i + 1}`)}
                      />
                    </Td>
                    <Td borderLeft="1px solid #E2E8F0" style={{ textAlign: 'center', background: raBaixo ? '#FEF2F2' : raAtencao ? '#FFFBEB' : undefined }}>
                      <span style={{ fontWeight: 700, fontSize: 12, color: raBaixo ? '#B91C1C' : raAtencao ? '#B45309' : TEXT }}>
                        {cp.tensaoRa === null ? '—' : cp.tensaoRa.toFixed(2).replace('.', ',')}
                      </span>
                    </Td>
                    <Td editable borderLeft="1px solid #E2E8F0">
                      <NumeroInput
                        style={gridInputStyle}
                        dataCell={`prof-${i}`}
                        value={cp.profRuptura}
                        onChange={v => atualizarCP(i, { ...cp, profRuptura: v })}
                        onKeyDown={e => aoPressionarEnterTabela(e, `prof-${i + 1}`)}
                      />
                    </Td>
                    {modelo.colunasFormaRuptura.map((col, idx) => {
                      const val = cp.formaRuptura[col] ?? 0;
                      return (
                        <Td key={col} editable borderLeft={idx === 0 ? '1.5px solid #94A3B8' : '1px solid #E2E8F0'}>
                          <NumeroInput
                            style={{ ...gridInputStyle, fontWeight: val > 0 ? 800 : 400, color: val > 0 ? PRIMARY : TEXT }}
                            dataCell={`rup-${i}-${idx}`}
                            maxDecimais={0}
                            maxValor={100}
                            value={val > 0 ? val : null}
                            onChange={v => atualizarCP(i, { ...cp, formaRuptura: { ...cp.formaRuptura, [col]: v ?? 0 } })}
                            onKeyDown={e => aoNavegarFormaRuptura(e, i, idx, modelo.colunasFormaRuptura.length)}
                          />
                        </Td>
                      );
                    })}
                    <Td borderLeft="1px solid #CBD5E1" style={{ textAlign: 'center', padding: '0 3px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 5px', borderRadius: 10, fontSize: 10, fontWeight: 800,
                        background: somaRup === 100 ? '#DCFCE7' : somaRup > 0 ? '#FEF3C7' : '#F1F5F9',
                        color: somaRup === 100 ? '#166534' : somaRup > 0 ? '#B45309' : '#94A3B8',
                      }}>
                        {somaRup}%
                      </span>
                    </Td>
                    <Td editable borderLeft="1.5px solid #94A3B8">
                      <input
                        style={{ ...gridInputStyle, textAlign: 'left', padding: '0 8px' }}
                        data-cell={`loc-${i}`}
                        value={cp.localizacao}
                        onChange={e => atualizarCP(i, { ...cp, localizacao: e.target.value })}
                        onKeyDown={e => aoPressionarEnterTabela(e, `loc-${i + 1}`)}
                      />
                    </Td>
                    <Td borderLeft="1px solid #E2E8F0" style={{ padding: '3px 4px' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <FotoSlot foto={cp.fotos[0]} label="1" onEscolher={f => escolherFoto(i, 0, f)} onRemover={() => removerFoto(i, 0)} />
                        <FotoSlot foto={cp.fotos[1]} label="2" onEscolher={f => escolherFoto(i, 1, f)} onRemover={() => removerFoto(i, 1)} />
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}

        {/* 5. Rodapé em faixa única: estatísticas + Umidade/Espessura */}
        <div className="aderencia-rodape-unico" style={{ borderTop: '1px solid #94A3B8', background: '#F1F5F9' }}>
          <Estatistica label="Ra médio" valor={stats.raMedia} unidade="MPa" />
          <Estatistica label="DP (MPa)" valor={stats.dp} unidade="" borderLeft />
          <Estatistica label="CV (%)" valor={stats.cv} unidade="%" borderLeft />
          <div style={{ padding: '8px 10px', borderLeft: '1px solid #CBD5E1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Umidade média (%)</span>
            <NumeroInput
              style={{ ...cellInputStyle, width: 76, height: 24, fontWeight: 700, textAlign: 'center', background: '#fff' }}
              value={situacao.umidadeMedia}
              onChange={v => atualizar('umidadeMedia', v)}
              placeholder="-"
            />
          </div>
          <Estatistica label="Espessura média" valor={stats.profRupturaMedia} unidade="mm" borderLeft />
        </div>

        {/* 6. Gráfico de Resultado (por situação — vai após o anexo de fotos no relatório) */}
        <div style={{ borderTop: '1.5px solid #94A3B8', background: '#fff' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 14px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Gráfico de Resultado
            </span>
            <span style={{ fontSize: 11, color: SUBTEXT }}>
              Incluído no relatório após o anexo de fotos
            </span>
          </div>
          <CelulaFicha label="Título do gráfico (opcional)">
            <input
              id={`titulo-grafico-${situacao.numero}`}
              style={fichaInputStyle}
              value={situacao.tituloGrafico ?? ''}
              placeholder={tituloPadraoGrafico(situacao)}
              onChange={e => atualizar('tituloGrafico', e.target.value)}
            />
          </CelulaFicha>
          <div style={{ padding: mobile ? '10px 8px' : '14px 16px', display: 'flex', justifyContent: 'center', background: '#fff' }}>
            <div
              style={{ width: '100%', maxWidth: mobile ? 420 : 720, lineHeight: 0 }}
              dangerouslySetInnerHTML={{ __html: svgGraficoResultado(situacao, { criterioRa: criterioEfetivo, compacto: mobile }) }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Th({ children, vertical = false, rowSpan, borderLeft }: { children: React.ReactNode; vertical?: boolean; rowSpan?: number; borderLeft?: string }) {
  if (vertical) {
    return (
      <th
        rowSpan={rowSpan}
        title={typeof children === 'string' ? children : undefined}
        style={{ padding: '6px 2px', fontSize: 8.5, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'center', height: 84, borderLeft, borderBottom: '1px solid #94A3B8' }}
      >
        <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', display: 'inline-block' }}>{children}</span>
      </th>
    );
  }
  return (
    <th
      rowSpan={rowSpan}
      style={{ padding: '6px 4px', fontSize: 9.5, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'center', borderLeft, borderBottom: '1px solid #94A3B8' }}
    >
      {children}
    </th>
  );
}
function Td({ children, editable = false, borderLeft, style }: { children: React.ReactNode; editable?: boolean; borderLeft?: string; style?: React.CSSProperties }) {
  return (
    <td
      className={editable ? 'aderencia-grid-cell' : undefined}
      style={{ padding: 0, borderLeft, transition: 'background 0.1s', ...style }}
    >
      {children}
    </td>
  );
}
function Estatistica({ label, valor, unidade, borderLeft = false }: { label: string; valor: number | null; unidade: string; borderLeft?: boolean }) {
  return (
    <div style={{ padding: '8px 10px', borderLeft: borderLeft ? '1px solid #CBD5E1' : undefined, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 800, color: PRIMARY }}>{valor === null ? '—' : `${valor.toFixed(2)} ${unidade}`}</p>
    </div>
  );
}
/** Painel no padrão "planilha técnica": barra azul-escura de título + corpo em grade contínua. */
function PainelPlanilha({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #94A3B8', borderRadius: 8, overflow: 'hidden', background: '#fff', marginBottom: 14 }}>
      <div style={{ background: PRIMARY, padding: '8px 14px' }}>
        <span style={{ fontSize: 11.5, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{titulo}</span>
      </div>
      {children}
    </div>
  );
}
function CelulaFicha({ label, children, borderRight = false, borderBottom = true }: {
  label: string; children: React.ReactNode; borderRight?: boolean; borderBottom?: boolean;
}) {
  return (
    <div
      className={`aderencia-grid-cell${borderRight ? ' ficha-celula' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '7px 12px 5px',
        minWidth: 0,
        borderRight: borderRight ? '1px solid #E2E8F0' : undefined,
        borderBottom: borderBottom ? '1px solid #E2E8F0' : undefined,
        transition: 'background 0.1s',
      }}
    >
      <p style={{ margin: 0, fontSize: 9.5, fontWeight: 800, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.25 }}>
        {label}
      </p>
      {children}
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
    formatoPlaca: 'circular',
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
  const [outroResp, setOutroResp] = useState(false);
  const [outroRespNome, setOutroRespNome] = useState('');
  const [outroRespCrea, setOutroRespCrea] = useState('');
  const [outroRespFile, setOutroRespFile] = useState<File | null>(null);
  const [outroRespPreview, setOutroRespPreview] = useState<string | null>(null);
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

  function limparTudo() {
    if (!confirm('Apagar TODOS os dados e começar do zero?')) return;
    setEtapa('config');
    setNumSituacoes(1);
    setModeloPorSituacao([MODELOS_SISTEMA_CAMADAS[0].id]);
    setModelosPersonalizados([null]);
    setColunasManuaisPorSituacao([false]);
    setSituacoes([]);
    setSituacaoAtual(0);
    setCabecalho(CABECALHO_VAZIO);
    setOutroResp(false);
    setOutroRespNome('');
    setOutroRespCrea('');
    setOutroRespFile(null);
    setOutroRespPreview(null);
    localStorage.removeItem(LS_KEY);
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

  const lerOutroRespBase64 = (): Promise<string> =>
    new Promise((resolve) => {
      if (!outroRespFile || !(outroRespFile instanceof Blob)) { resolve(''); return; }
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(outroRespFile);
    });

  async function gerarRelatorio() {
    if (!cabecalho.rltNumero.trim()) { alert('Informe o Nº do relatório (RLT) antes de gerar.'); setEtapa('config'); return; }
    if (outroResp && !outroRespNome.trim()) { alert('Informe o nome do engenheiro responsável.'); setEtapa('config'); return; }
    setGerandoDocx(true);
    try {
      let respAssinaturaBase64 = '';
      let respAssinaturaContentType = 'image/png';
      if (outroResp && outroRespFile) {
        respAssinaturaBase64 = await lerOutroRespBase64();
        respAssinaturaContentType = outroRespFile.type || 'image/png';
      }
      const respNomeFinal = outroResp ? outroRespNome : userName;
      const respCreaFinal = outroResp ? outroRespCrea : userCrea;
      const respAssinaturaUrl = (!outroResp && userAssinatura) ? userAssinatura : '';

      // O esquema e o gráfico (SVGs) são rasterizados em PNG aqui no navegador, pois o DOCX não embute SVG de forma confiável.
      const situacoesPayload = await Promise.all(
        situacoes.map(async (s, idx) => {
          const modelo = resolverModeloSituacao(s) ?? (s.modeloCamadasId === ID_MODELO_PERSONALIZADO ? obterPersonalizadoOuPadrao(idx) : undefined);
          const [esquema, grafico] = await Promise.all([
            modelo
              ? svgParaPng(svgEsquemaCamadas(modelo.camadas, modelo.disposicao, modelo.coresCamadas, modelo.profundidadeCorte))
              : Promise.resolve(null),
            svgParaPng(svgGraficoResultado(s, { normas: cabecalho.normas }), 3),
          ]);
          return {
            ...s,
            ...(s.modeloCamadasId === ID_MODELO_PERSONALIZADO && modelo ? { modeloPersonalizado: modelo } : {}),
            esquema,
            grafico,
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
          respNome: respNomeFinal,
          respCrea: respCreaFinal,
          respAssinaturaUrl,
          respAssinaturaBase64,
          respAssinaturaContentType,
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
      a.download = `${formatarRltAderencia(cabecalho.rltNumero)}.docx`;
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
    <div style={{ backgroundColor: BG, minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif", width: '100%', maxWidth: '100vw', overflowX: 'clip' }}>
      <PlanilhaStyles />
      <style>{`
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
        .ficha-celula {
          min-width: 0;
        }
        .aderencia-sit-controls {
          display: flex;
          align-items: center;
          gap: 8px 10px;
          flex-wrap: wrap;
        }
        .aderencia-sit-ctrl-label {
          font-size: 10.5px;
          font-weight: 700;
          color: #BFDBFE;
          white-space: nowrap;
        }
        .aderencia-sit-select {
          background: rgba(255,255,255,0.14);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 11px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          outline: none;
        }
        .aderencia-ficha-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }
        .aderencia-esquema-sit {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
        }
        .aderencia-cab-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .aderencia-normas-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          grid-template-rows: repeat(4, auto);
          grid-auto-flow: column;
          gap: 6px 16px;
        }
        .aderencia-tripla-row {
          display: grid;
          grid-template-columns: 1.35fr 1fr 0.9fr;
        }
        .aderencia-esquema-row {
          display: grid;
          grid-template-columns: auto 1fr 1.6fr;
        }
        .aderencia-rodape-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }
        .aderencia-grid-cell:focus-within {
          background: #EFF6FF !important;
          box-shadow: inset 0 0 0 1.8px #2563EB;
        }
        .aderencia-rodape-unico {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }
        @media (max-width: 720px) {
          .aderencia-sit-header {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }
          .aderencia-sit-controls {
            display: grid !important;
            grid-template-columns: max-content minmax(0, 1fr) !important;
            align-items: center !important;
            gap: 8px 10px !important;
            width: 100%;
          }
          .aderencia-sit-select {
            width: 100% !important;
            padding: 6px 10px !important;
          }
          .aderencia-rodape-unico {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .aderencia-rodape-unico > :nth-child(3) {
            border-left: none !important;
          }
          .aderencia-rodape-unico > :nth-child(3),
          .aderencia-rodape-unico > :nth-child(4) {
            border-top: 1px solid #CBD5E1;
          }
          .aderencia-rodape-unico > :last-child {
            grid-column: 1 / -1;
            border-left: none !important;
            border-top: 1px solid #CBD5E1;
          }
          .aderencia-ficha-grid {
            grid-template-columns: 1fr !important;
          }
          .ficha-celula {
            border-right: none !important;
          }
          .aderencia-tripla-row, .aderencia-cab-grid, .aderencia-normas-grid {
            grid-template-columns: 1fr !important;
          }
          .aderencia-normas-grid {
            grid-template-rows: none !important;
            grid-auto-flow: row !important;
          }
          .aderencia-esquema-row, .aderencia-esquema-sit {
            grid-template-columns: 1fr !important;
          }
          .aderencia-rodape-row {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
        }
        html, body { overflow-x: hidden; max-width: 100%; }
        @media (max-width: 600px) {
          .header-root { padding: 0 12px !important; flex-wrap: nowrap !important; }
          .header-left { gap: 10px !important; flex-shrink: 1; min-width: 0; overflow: hidden; }
          .header-right { gap: 4px !important; flex-shrink: 0; }
          .header-user-name { max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .header-cargo, .header-divider { display: none !important; }
          .signout-text { display: none; }
          .sb-u { padding: 6px 8px !important; }
        }
        @media (max-width: 720px) {
          html, body { overflow-x: clip; touch-action: pan-y; overscroll-behavior-x: none; }
          .aderencia-main { width: 100%; min-width: 0; box-sizing: border-box; }
          .aderencia-main * { min-width: 0; }
          .aderencia-main input:not([type="color"]):not([type="checkbox"]), .aderencia-main textarea, .aderencia-main select {
            max-width: 100%;
            box-sizing: border-box;
            font-size: 16px !important;
            min-height: 36px;
            height: auto !important;
          }
        }
        .aderencia-main { overflow-x: clip; }
        @media (max-width: 640px) {
          .aderencia-esquema-sit { grid-template-columns: minmax(0, 1fr) !important; justify-items: center; }
          .aderencia-esquema-sit > :last-child { width: 100%; justify-self: stretch; }
          .aderencia-main {
            padding: 16px 10px 50px !important;
          }
          .aderencia-card {
            padding: 16px 12px !important;
            border-radius: 10px !important;
            margin-bottom: 14px !important;
          }
          .aderencia-editor {
            padding: 12px 10px !important;
          }
        }
      `}</style>
      <Header paginaAtiva="ensaios" />

      <main className="aderencia-main" style={{ maxWidth: 1060, margin: '0 auto', padding: '24px 20px 60px' }}>
        <EnsaioCabecalho
          breadcrumb="Resistência de Aderência à Tração"
          titulo="Resistência de Aderência à Tração"
          subtitulo={
            etapa === 'config'
              ? 'NBR 13528 — Configuração inicial do relatório'
              : `NBR 13528 — Situação ${numeroRomano(situacaoAtual + 1)} de ${numeroRomano(situacoes.length)}`
          }
          salvoMsg={salvoMsg}
          onLimparTudo={limparTudo}
          onGerarRelatorio={gerarRelatorio}
          gerandoDocx={gerandoDocx}
          podeGerar={situacoes.length > 0}
        />

        <EnsaioTabs
          abaAtiva={etapa}
          onChange={(id) => {
            if (id === 'situacoes') confirmarConfiguracao();
            else setEtapa('config');
          }}
          marginBottom={18}
          tabs={[
            {
              id: 'config',
              labelFull: '1. Configuração Inicial',
              labelShort: 'Configuração',
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              ),
            },
            {
              id: 'situacoes',
              labelFull: `2. Situações (${numSituacoes})`,
              labelShort: `Situações (${numSituacoes})`,
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              ),
            },
          ]}
        />

        {etapa === 'config' && (
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            <PainelPlanilha titulo="Cabeçalho do relatório">
              <div className="aderencia-cab-grid">
                <CelulaFicha label="Nº RLT" borderRight><input id="ad-rlt" inputMode="numeric" pattern="[0-9]*" style={fichaInputStyle} value={cabecalho.rltNumero} onChange={e => atualizarCabecalho('rltNumero', somenteDigitos(e.target.value))} placeholder="EX: 045" /></CelulaFicha>
                <CelulaFicha label="Cliente" borderRight><input id="ad-cliente" style={fichaInputStyle} value={cabecalho.cliente} onChange={e => atualizarCabecalho('cliente', e.target.value)} /></CelulaFicha>
                <CelulaFicha label="Obra"><input id="ad-obra" style={fichaInputStyle} value={cabecalho.obra} onChange={e => atualizarCabecalho('obra', e.target.value)} /></CelulaFicha>
                <CelulaFicha label="Construtora" borderRight><input id="ad-construtora" style={fichaInputStyle} value={cabecalho.construtora} onChange={e => atualizarCabecalho('construtora', e.target.value)} /></CelulaFicha>
                <CelulaFicha label="Endereço" borderRight><input id="ad-endereco" style={fichaInputStyle} value={cabecalho.endereco} onChange={e => atualizarCabecalho('endereco', e.target.value)} /></CelulaFicha>
                <CelulaFicha label="Data de emissão"><input id="ad-data" type="date" style={fichaInputStyle} value={cabecalho.dataEmissao} onChange={e => atualizarCabecalho('dataEmissao', e.target.value)} /></CelulaFicha>
              </div>
              <div style={{ padding: '8px 12px 10px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                <p style={{ margin: '0 0 6px', fontSize: 9.5, fontWeight: 800, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Norma(s) de referência</p>
                <div className="aderencia-normas-grid">
                  {NORMAS_OPCOES.map(n => (
                    <label key={n.campo} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: TEXT, marginLeft: n.sub ? 22 : 0, cursor: 'pointer' }}>
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
            </PainelPlanilha>

            <ResponsavelTecnicoPanel
              idPrefix="ad"
              userName={userName}
              userCrea={userCrea}
              userAssinatura={userAssinatura}
              outroResp={outroResp}
              onOutroRespChange={ativo => {
                setOutroResp(ativo);
                if (!ativo) {
                  setOutroRespNome('');
                  setOutroRespCrea('');
                  setOutroRespFile(null);
                  setOutroRespPreview(null);
                }
              }}
              outroRespNome={outroRespNome}
              onOutroRespNomeChange={setOutroRespNome}
              outroRespCrea={outroRespCrea}
              onOutroRespCreaChange={setOutroRespCrea}
              outroRespPreview={outroRespPreview}
              onOutroRespFileSelect={f => {
                setOutroRespFile(f);
                setOutroRespPreview(URL.createObjectURL(f));
              }}
              onOutroRespFileRemove={() => {
                setOutroRespFile(null);
                setOutroRespPreview(null);
              }}
            />

            <PainelPlanilha titulo="Número de situações">
              <div style={{ padding: '10px 14px', background: '#fff' }}>
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
                    inputMode="numeric"
                    pattern="[0-9]*"
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
              </div>
            </PainelPlanilha>

            {modeloPorSituacao.map((modeloId, i) => {
              const modeloCustom = obterPersonalizadoOuPadrao(i);
              const isCustom = modeloId === ID_MODELO_PERSONALIZADO;
              return (
                <PainelPlanilha key={i} titulo={`Situação ${numeroRomano(i + 1)} — Modelo de sistema de camadas`}>
                  <div style={{ padding: 12, background: '#fff' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
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
                </PainelPlanilha>
              );
            })}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                type="button"
                onClick={confirmarConfiguracao}
                className="btn-pri"
                style={{ padding: '11px 22px', borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Continuar →
              </button>
            </div>
          </div>
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

            <div className="aderencia-card" style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 22px', marginBottom: 20 }}>
              <SituacaoForm
                situacao={situacoes[situacaoAtual]}
                normas={cabecalho.normas}
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
                  className="btn-gold"
                  style={{ padding: '11px 20px', borderRadius: 8, border: 'none', background: gerandoDocx ? BORDER : GOLD, color: gerandoDocx ? SUBTEXT : PRIMARY, fontSize: 13, fontWeight: 700, cursor: gerandoDocx ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
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
