'use client';
// src/app/(dashboard)/ensaios/pacometria/page.tsx

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { buscarUrlAssinatura } from '@/lib/assinatura';
import {
  PainelPlanilha,
  CelulaFicha,
  PlanilhaStyles,
  EnsaioCabecalho,
  EnsaioTabs,
  fichaInputStyle,
  tabelaHeaderStyle,
  tabelaThTextStyle,
} from '@/components/PlanilhaUI';
import { ResponsavelTecnicoPanel } from '@/components/ResponsavelTecnicoPanel';
import {
  AmostraRow,
  Cabecalho,
  TIPO_LABELS,
  getResumoOpcao,
} from '@/modules/pacometria/types';
import { ModalAmostra } from '@/modules/pacometria/components/ModalAmostra';
import { gerarSvgEsquemaPacometria, gerarSvgsPerfisPacometria } from '@/modules/pacometria/svgRelatorio';
import { svgParaPng } from '@/modules/aderencia/svgParaPng';

// ── Constantes visuais ──────────────────────────────────────────
const PRIMARY     = '#1E3264';
const GOLD        = '#C8A020';
const BG          = '#F8F9FA';
const BORDER      = '#E8EAF0';
const TEXT        = '#1A2340';
const SUBTEXT     = '#6B7490';
const SUCCESS     = '#1A7A44';
const DANGER      = '#C0392B';

const LS_KEY = 'tecomat_pacometria_v1';

// ── Utilitários ─────────────────────────────────────────────────
function maskData(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
function salvarLocal(cab: Cabecalho, amostras: AmostraRow[]) {
  const sem = amostras.map(({ fotoFile: _f, fotoPreview: _p, ...rest }) => rest);
  try { localStorage.setItem(LS_KEY, JSON.stringify({ cab, amostras: sem })); } catch {}
}
function carregarLocal(): { cab: Cabecalho; amostras: AmostraRow[] } | null {
  try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}

function comprimirImagem(file: File): Promise<{ base64: string; width: number; height: number; contentType: string }> {
  return new Promise((resolve) => {
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
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 7, border: `1.5px solid ${BORDER}`,
  fontSize: 14, fontFamily: 'inherit', color: TEXT, background: '#fff',
  outline: 'none', width: '100%', boxSizing: 'border-box',
};

function Header({ displayName, initials, cargo, onSignOut }: { displayName: string; initials: string; cargo: string; onSignOut: () => void }) {
  return (
    <header className="header-root" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 60, padding: '0 28px', backgroundColor: PRIMARY, boxShadow: '0 2px 12px rgba(30,50,100,0.25)', position: 'sticky', top: 0, zIndex: 50 }}>
      <style>{`.sb-u:hover{background:rgba(255,255,255,0.12)!important}.nv-u:hover{color:#fff!important}`}</style>
      <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src="/logo_tecomat.png" alt="TECOMAT" style={{ height: 34, objectFit: 'contain' }} />
        </a>
        <nav style={{ display: 'flex', gap: 6 }}>
          <a href="/dashboard" className="nv-u" style={{ fontSize: 13, fontWeight: 600, color: '#fff', textDecoration: 'none', padding: '4px 10px', borderRadius: 6, borderBottom: `2px solid ${GOLD}`, paddingBottom: 5 }}>Ensaios</a>
          <a href="/usuarios" className="nv-u" style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.65)', textDecoration: 'none', padding: '4px 10px', borderRadius: 6 }}>Usuários</a>
        </nav>
      </div>
      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: GOLD, color: PRIMARY, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.25)', flexShrink: 0 }}>{initials}</div>
          <div>
            <p className="header-user-name" style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: 0 }}>{displayName}</p>
            {cargo && <p className="header-cargo" style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '2px 0 0' }}>{cargo}</p>}
          </div>
        </div>
        <div className="header-divider" style={{ width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.15)' }} />
        <button className="sb-u" onClick={onSignOut} aria-label="Sair" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span className="signout-text">Sair</span>
        </button>
      </div>
    </header>
  );
}

// ── Página principal ────────────────────────────────────────────
export default function PacometriaPage() {
  const router = useRouter();

  // Auth
  const [userName, setUserName]     = useState('');
  const [userEmail, setUserEmail]   = useState('');
  const [userCargo, setUserCargo]   = useState('');
  const [userCrea, setUserCrea]     = useState('');
  const [userAssinatura, setUserAssinatura] = useState('');

  // Cabeçalho
  const [cab, setCab] = useState<Cabecalho>({
    rlt: '', data: '', cliente: '', obra: '', att: '', endereco: '', notas: '',
  });

  // Amostras
  const [amostras, setAmostras] = useState<AmostraRow[]>([]);

  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [amostraEditando, setAmostraEditando] = useState<AmostraRow | null>(null);

  // Foto por linha (input ref por id)
  const fotoRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Responsável
  const [outroResp, setOutroResp]         = useState(false);
  const [outroRespNome, setOutroRespNome] = useState('');
  const [outroRespCrea, setOutroRespCrea] = useState('');
  const [outroRespFile, setOutroRespFile] = useState<File | null>(null);
  const [outroRespPreview, setOutroRespPreview] = useState<string | null>(null);

  // Opções relatório
  const [usaMotivacao, setUsaMotivacao]   = useState(false);
  const [motivacao, setMotivacao]         = useState('');
  const [usaFotoGeral, setUsaFotoGeral]   = useState(false);
  const [fotoGeralFile, setFotoGeralFile] = useState<File | null>(null);
  const [usaCroquiGeral, setUsaCroquiGeral] = useState(false);
  const [croquiFiles, setCroquiFiles]     = useState<File[]>([]);
  const [quebraPaginaPorElemento, setQuebraPaginaPorElemento] = useState(false);
  const [usaConclusao, setUsaConclusao]   = useState(true);
  const [conclusao, setConclusao]         = useState('');

  // UI
  const [aba, setAba]           = useState<'cabecalho' | 'campo' | 'obra'>('cabecalho');
  const [salvoMsg, setSalvoMsg] = useState('');
  const [gerandoDocx, setGerandoDocx] = useState(false);

  // ── Efeitos ──────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      setUserEmail(user.email ?? '');
      const m = user.user_metadata ?? {};
      setUserName(m.full_name ?? m.name ?? user.email ?? '');
      setUserCargo(m.cargo ?? '');
      setUserCrea(m.crea ?? '');
      setUserAssinatura(await buscarUrlAssinatura(user.id, m.assinatura_path));
    });
  }, [router]);

  useEffect(() => {
    const saved = carregarLocal();
    if (saved) { setCab(saved.cab); setAmostras(saved.amostras); }
  }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      salvarLocal(cab, amostras);
      setSalvoMsg('Salvo');
      setTimeout(() => setSalvoMsg(''), 1800);
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [cab, amostras]);

  // ── Handlers ─────────────────────────────────────────────────
  const handleSignOut = async () => {
    const supabase = createClient();
    localStorage.removeItem(LS_KEY);
    await supabase.auth.signOut();
    router.push('/login');
  };

  const limparTudo = () => {
    if (!confirm('Apagar TODOS os dados e começar do zero?')) return;
    setCab({ rlt: '', data: '', cliente: '', obra: '', att: '', endereco: '', notas: '' });
    setAmostras([]);
    setOutroResp(false); setOutroRespNome(''); setOutroRespCrea('');
    setOutroRespFile(null); setOutroRespPreview(null);
    setUsaMotivacao(false); setMotivacao('');
    setUsaFotoGeral(false); setFotoGeralFile(null);
    setUsaCroquiGeral(false); setCroquiFiles([]);
    setQuebraPaginaPorElemento(false);
    setUsaConclusao(true); setConclusao('');
    localStorage.removeItem(LS_KEY);
  };

  const initials = (() => {
    if (!userName) return userEmail.slice(0, 2).toUpperCase();
    const p = userName.trim().split(/\s+/);
    return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
  })();

  const rltOficial = (() => {
    const n = cab.rlt.trim();
    if (!n) return 'RLT.LAU-XXX.26-00';
    if (/^\d+$/.test(n)) return `RLT.LAU-${n.padStart(3, '0')}.26-00`;
    return `RLT.LAU-${n}.26-00`;
  })();

  const salvarAmostra = (a: AmostraRow) => {
    setAmostras(prev => {
      const idx = prev.findIndex(x => x.id === a.id);
      if (idx >= 0) {
        const next = [...prev]; next[idx] = a; return next;
      }
      return [...prev, { ...a, item: prev.length + 1 }];
    });
    setModalAberto(false);
    setAmostraEditando(null);
  };

  const apagarAmostra = (id: string) => {
    if (!confirm('Apagar esta amostra?')) return;
    setAmostras(prev => prev.filter(a => a.id !== id).map((a, i) => ({ ...a, item: i + 1 })));
  };

  const editarAmostra = (a: AmostraRow) => {
    setAmostraEditando(a);
    setModalAberto(true);
  };

  const handleFoto = async (id: string, file: File) => {
    const preview = URL.createObjectURL(file);
    setAmostras(prev => prev.map(a => a.id === id ? { ...a, fotoFile: file, fotoPreview: preview } : a));
  };

  const removerFoto = (id: string) => {
    setAmostras(prev => prev.map(a => a.id === id ? { ...a, fotoFile: null, fotoPreview: null } : a));
    if (fotoRefs.current[id]) fotoRefs.current[id]!.value = '';
  };

  const respNomeFinal = outroResp ? outroRespNome : userName;
  const respCreaFinal = outroResp ? outroRespCrea : userCrea;

  // ── Gerar DOCX ───────────────────────────────────────────────
  const gerarDocx = async () => {
    setGerandoDocx(true);
    try {
      // Comprimir fotos e rasterizar esquemas + perfis de elevação por face das amostras
      const amostrasPayload = await Promise.all(amostras.map(async a => {
        let foto = null;
        if (a.fotoFile instanceof File) {
          foto = await comprimirImagem(a.fotoFile);
        }
        let esquema = null;
        try {
          const svg = gerarSvgEsquemaPacometria(a);
          esquema = await svgParaPng(svg, 3);
        } catch {
          esquema = null;
        }
        const perfisSvgs = gerarSvgsPerfisPacometria(a);
        const perfis: Array<{
          face: string;
          faceLabel: string;
          imagem: { base64: string; width: number; height: number; contentType: string };
          larguraTotal?: boolean;
        }> = [];
        for (const p of perfisSvgs) {
          try {
            const imagem = await svgParaPng(p.svg, 3);
            perfis.push({ face: p.face, faceLabel: p.faceLabel, imagem, larguraTotal: p.larguraTotal });
          } catch {
            // ignora perfil se falhar rasterização
          }
        }
        return {
          ...a,
          fotoFile: undefined,
          fotoPreview: undefined,
          foto,
          esquema,
          perfis,
        };
      }));

      // Foto geral e múltiplos croquis
      let fotoGeralPayload = null;
      if (usaFotoGeral && fotoGeralFile) fotoGeralPayload = await comprimirImagem(fotoGeralFile);
      const croquisPayload = usaCroquiGeral && croquiFiles.length > 0
        ? await Promise.all(croquiFiles.map(f => comprimirImagem(f)))
        : [];

      // Outro responsável
      let outroRespBase64 = '';
      let outroRespContentType = 'image/png';
      if (outroResp && outroRespFile instanceof File) {
        const r = await comprimirImagem(outroRespFile);
        outroRespBase64 = r.base64;
        outroRespContentType = r.contentType;
      }

      const body = {
        cab, amostras: amostrasPayload, rltOficial,
        respNome: respNomeFinal, respCrea: respCreaFinal,
        assinaturaUrl: outroResp ? '' : userAssinatura,
        outroRespBase64,
        outroRespContentType,
        usaMotivacao, motivacao,
        usaFotoGeral, fotoGeral: fotoGeralPayload,
        usaCroquiGeral, croquis: croquisPayload,
        quebraPaginaPorElemento,
        usaConclusao, conclusao,
      };

      const res = await fetch('/api/ensaios/pacometria/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const erroJson = await res.json().catch(() => null);
        throw new Error(erroJson?.error || 'Erro ao gerar DOCX');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${rltOficial}.docx`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao gerar o relatório. Tente novamente.');
    } finally {
      setGerandoDocx(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box}
        html,body{overflow-x:hidden}
        @media(max-width:600px){
          .header-user-name,.header-cargo,.header-divider{display:none!important}
          .signout-text{display:none!important}
          .main-pacometria{padding:16px 14px!important}
          .amostras-table-section{display:none!important}
          .amostras-cards-section{display:flex!important}
        }
        @media(min-width:601px){
          .amostras-cards-section{display:none!important}
        }
      `}</style>

      <PlanilhaStyles />
      <Header displayName={userName} initials={initials} cargo={userCargo} onSignOut={handleSignOut} />

      <main className="main-pacometria" style={{ maxWidth: 1060, margin: '0 auto', padding: '24px 20px' }}>
        <EnsaioCabecalho
          breadcrumb="Pacometria"
          titulo="Pacometria"
          subtitulo="Localização de armaduras e cobrimento do concreto"
          salvoMsg={salvoMsg}
          onLimparTudo={limparTudo}
          onGerarRelatorio={gerarDocx}
          gerandoDocx={gerandoDocx}
          podeGerar={amostras.length > 0}
        />

        <EnsaioTabs
          abaAtiva={aba}
          onChange={setAba}
          marginBottom={18}
          tabs={[
            {
              id: 'cabecalho',
              labelFull: '1. Cabeçalho e Aparelho',
              labelShort: 'Cabeçalho',
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              ),
            },
            {
              id: 'campo',
              labelFull: `2. Dados de Campo${amostras.length > 0 ? ` (${amostras.length})` : ''}`,
              labelShort: 'Dados',
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              ),
            },
            {
              id: 'obra',
              variante: 'obra',
              labelFull: '3. Modo Obra',
              labelShort: 'Obra',
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 20h20" /><path d="M6 20v-4a6 6 0 0 1 12 0v4" /><path d="M12 4v4" /><path d="M4 12a8 8 0 0 1 16 0" />
                </svg>
              ),
            },
          ]}
        />

        {/* ── ABA 1: CABEÇALHO ── */}
        {aba === 'cabecalho' && (
          <div>
            {/* Identificação */}
            <PainelPlanilha titulo="Identificação do Relatório">
              <div className="planilha-grid-3">
                <CelulaFicha label="Nº do Relatório" htmlFor="rlt" borderRight>
                  <input id="rlt" style={fichaInputStyle} inputMode="numeric" pattern="[0-9]*" value={cab.rlt} onChange={e => setCab(p => ({ ...p, rlt: e.target.value }))} placeholder="Ex: 042" />
                </CelulaFicha>
                <CelulaFicha label="Data de Emissão" htmlFor="data" borderRight>
                  <input id="data" style={fichaInputStyle} inputMode="numeric" pattern="[0-9]*" value={cab.data} onChange={e => setCab(p => ({ ...p, data: maskData(e.target.value) }))} placeholder="DD/MM/AAAA" maxLength={10} />
                </CelulaFicha>
                <CelulaFicha label="Cliente" htmlFor="cliente">
                  <input id="cliente" style={fichaInputStyle} value={cab.cliente} onChange={e => setCab(p => ({ ...p, cliente: e.target.value }))} />
                </CelulaFicha>
              </div>
              <div className="planilha-grid-3">
                <CelulaFicha label="Obra" htmlFor="obra" borderRight borderBottom={false}>
                  <input id="obra" style={fichaInputStyle} value={cab.obra} onChange={e => setCab(p => ({ ...p, obra: e.target.value }))} />
                </CelulaFicha>
                <CelulaFicha label="A/T (Att.)" htmlFor="att" borderRight borderBottom={false}>
                  <input id="att" style={fichaInputStyle} value={cab.att} onChange={e => setCab(p => ({ ...p, att: e.target.value }))} />
                </CelulaFicha>
                <CelulaFicha label="Endereço" htmlFor="end" borderBottom={false}>
                  <input id="end" style={fichaInputStyle} value={cab.endereco} onChange={e => setCab(p => ({ ...p, endereco: e.target.value }))} />
                </CelulaFicha>
              </div>
            </PainelPlanilha>

            {/* Opções do relatório */}
            <PainelPlanilha titulo="Opções do Relatório">
              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Motivação */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: usaMotivacao ? PRIMARY : SUBTEXT }}>
                    <input type="checkbox" checked={usaMotivacao} onChange={e => setUsaMotivacao(e.target.checked)} style={{ width: 16, height: 16, accentColor: PRIMARY, cursor: 'pointer' }} />
                    Incluir motivação / contexto do ensaio
                  </label>
                  {usaMotivacao && <textarea rows={3} style={{ ...inputStyle, marginTop: 8, resize: 'vertical' }} value={motivacao} onChange={e => setMotivacao(e.target.value)} placeholder="Descreva a motivação do ensaio..." />}
                </div>
                {/* Foto geral */}
                <div style={{ paddingTop: 12, borderTop: '1px solid #E2E8F0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: usaFotoGeral ? PRIMARY : SUBTEXT }}>
                    <input type="checkbox" checked={usaFotoGeral} onChange={e => setUsaFotoGeral(e.target.checked)} style={{ width: 16, height: 16, accentColor: PRIMARY, cursor: 'pointer' }} />
                    Incluir foto geral da estrutura
                  </label>
                  {usaFotoGeral && (
                    <div style={{ marginTop: 8 }}>
                      <input type="file" accept="image/*" onChange={e => { if (e.target.files?.[0]) setFotoGeralFile(e.target.files[0]); }} style={{ fontSize: 12 }} />
                    </div>
                  )}
                </div>
                {/* Croqui geral (múltiplas imagens) */}
                <div style={{ paddingTop: 12, borderTop: '1px solid #E2E8F0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: usaCroquiGeral ? PRIMARY : SUBTEXT }}>
                    <input type="checkbox" checked={usaCroquiGeral} onChange={e => setUsaCroquiGeral(e.target.checked)} style={{ width: 16, height: 16, accentColor: PRIMARY, cursor: 'pointer' }} />
                    Incluir croqui(s) de localização dos elementos
                  </label>
                  {usaCroquiGeral && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={e => {
                          const novos = Array.from(e.target.files ?? []);
                          if (novos.length > 0) setCroquiFiles(prev => [...prev, ...novos]);
                          e.target.value = '';
                        }}
                        style={{ fontSize: 12 }}
                      />
                      {croquiFiles.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {croquiFiles.map((f, idx) => (
                            <span key={`${f.name}-${idx}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, background: '#EEF2FF', color: PRIMARY, padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
                              Croqui {idx + 1}: {f.name}
                              <button
                                type="button"
                                onClick={() => setCroquiFiles(prev => prev.filter((_, i) => i !== idx))}
                                aria-label="Remover croqui"
                                style={{ background: 'none', border: 'none', color: DANGER, cursor: 'pointer', fontWeight: 800, padding: 0, lineHeight: 1 }}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {/* Paginação por elemento */}
                <div style={{ paddingTop: 12, borderTop: '1px solid #E2E8F0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: quebraPaginaPorElemento ? PRIMARY : SUBTEXT }}>
                    <input type="checkbox" checked={quebraPaginaPorElemento} onChange={e => setQuebraPaginaPorElemento(e.target.checked)} style={{ width: 16, height: 16, accentColor: PRIMARY, cursor: 'pointer' }} />
                    Iniciar cada elemento em uma nova página (controle de paginação)
                  </label>
                </div>
                {/* Resumo Executivo e Conclusão */}
                <div style={{ paddingTop: 12, borderTop: '1px solid #E2E8F0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: usaConclusao ? PRIMARY : SUBTEXT }}>
                    <input type="checkbox" checked={usaConclusao} onChange={e => setUsaConclusao(e.target.checked)} style={{ width: 16, height: 16, accentColor: PRIMARY, cursor: 'pointer' }} />
                    Incluir seção de Resumo Executivo e Conclusão
                  </label>
                  {usaConclusao && (
                    <div style={{ marginTop: 8 }}>
                      <textarea
                        rows={3}
                        style={{ ...inputStyle, resize: 'vertical' }}
                        value={conclusao}
                        onChange={e => setConclusao(e.target.value)}
                        placeholder="Opcional: escreva as considerações finais. Se ficar em branco, será gerado automaticamente um resumo executivo com os dados globais do ensaio."
                      />
                    </div>
                  )}
                </div>
              </div>
            </PainelPlanilha>

            {/* Responsável */}
            <ResponsavelTecnicoPanel
              idPrefix="pac"
              userName={userName}
              userCrea={userCrea}
              userCargo={userCargo}
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

            {/* Notas */}
            <PainelPlanilha titulo="Notas do Relatório">
              <CelulaFicha label="Observações gerais" borderBottom={false}>
                <textarea rows={3} style={{ ...fichaInputStyle, height: 'auto', minHeight: 64, resize: 'vertical', lineHeight: 1.5, padding: '4px 0' }} value={cab.notas} onChange={e => setCab(p => ({ ...p, notas: e.target.value }))} placeholder="Observações gerais, condições de ensaio..." />
              </CelulaFicha>
            </PainelPlanilha>
          </div>
        )}

        {/* ── ABA 2: DADOS DE CAMPO ── */}
        {aba === 'campo' && (
          <div>
            {/* Tabela — desktop */}
            <div className="amostras-table-section">
              <PainelPlanilha
                titulo="Resultado do Ensaio — Amostras de Pacometria"
                direita={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: '#BFDBFE' }}>{amostras.length} amostra{amostras.length !== 1 ? 's' : ''}</span>
                    <button onClick={() => { setAmostraEditando(null); setModalAberto(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: GOLD, color: '#fff', border: 'none' }}>
                      + Nova Amostra
                    </button>
                  </div>
                }
              >
                {amostras.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: SUBTEXT }}>
                    <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>Nenhuma amostra registrada</p>
                    <p style={{ margin: '4px 0 0', fontSize: 12 }}>Clique em &ldquo;+ Nova Amostra&rdquo; para começar</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={tabelaHeaderStyle}>
                        {['Item', 'Elemento', 'Tipo / Opção', 'Médio', 'Mínimo', 'Máximo', 'Desv. Padrão', 'CV (%)', 'Moda', 'Foto', 'Ações'].map((h, hi) => (
                          <th key={h} style={{ ...tabelaThTextStyle, padding: '8px 10px', textAlign: hi === 1 || hi === 2 ? 'left' : 'center', borderLeft: hi > 0 ? '1px solid #E2E8F0' : undefined, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {amostras.map((a, i) => (
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
                                  <img src={a.fotoPreview} alt="foto" style={{ width: 34, height: 34, borderRadius: 4, objectFit: 'cover', border: `1px solid ${BORDER}` }} />
                                  <button onClick={() => removerFoto(a.id)} aria-label="Remover foto" style={{ width: 22, height: 22, borderRadius: 4, border: 'none', background: '#FFF0EE', color: DANGER, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <input ref={el => { fotoRefs.current[a.id] = el; }} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleFoto(a.id, e.target.files[0]); }} />
                                  <button onClick={() => fotoRefs.current[a.id]?.click()} aria-label="Anexar foto" style={{ width: 30, height: 30, borderRadius: 6, border: `1px dashed ${BORDER}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUBTEXT }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                          {/* Ações */}
                          <td style={{ padding: '8px 10px', borderLeft: '1px solid #E2E8F0' }}>
                            <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                              <button onClick={() => editarAmostra(a)} aria-label="Editar amostra" style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#EEF1F8', color: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <button onClick={() => apagarAmostra(a.id)} aria-label="Apagar amostra" style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#FFF0EE', color: DANGER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </PainelPlanilha>
            </div>

            {/* Cards — mobile */}
            <div className="amostras-cards-section" style={{ flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: SUBTEXT }}>{amostras.length} amostra{amostras.length !== 1 ? 's' : ''}</span>
                <button onClick={() => { setAmostraEditando(null); setModalAberto(true); }} style={{ padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: PRIMARY, color: '#fff', border: 'none' }}>
                  + Nova Amostra
                </button>
              </div>
              {amostras.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: SUBTEXT, background: '#fff', border: '1px solid #94A3B8', borderRadius: 8 }}>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>Nenhuma amostra registrada</p>
                </div>
              ) : amostras.map(a => (
                <div key={a.id} style={{ background: '#fff', borderRadius: 8, border: '1px solid #94A3B8', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: SUBTEXT }}>#{a.item}</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: TEXT }}>{a.elemento}</span>
                        <span style={{ fontSize: 10, background: '#EEF2FF', color: PRIMARY, borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>
                          {TIPO_LABELS[a.tipo] ?? a.tipo} · {getResumoOpcao(a)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button onClick={() => editarAmostra(a)} aria-label="Editar" style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: '#EEF1F8', color: PRIMARY, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onClick={() => apagarAmostra(a.id)} aria-label="Apagar" style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: '#FFF0EE', color: DANGER, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                        </button>
                      </div>
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
                          <img src={a.fotoPreview} alt="foto" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', border: `1px solid ${BORDER}` }} />
                          <button onClick={() => removerFoto(a.id)} style={{ fontSize: 11, color: DANGER, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Remover foto</button>
                        </>
                      ) : (
                        <>
                          <input ref={el => { fotoRefs.current[a.id + '_m'] = el; }} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleFoto(a.id, e.target.files[0]); }} />
                          <button onClick={() => fotoRefs.current[a.id + '_m']?.click()} style={{ fontSize: 11, color: PRIMARY, background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                            Anexar foto
                          </button>
                        </>
                      )}
                    </div>
                  </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ABA 3: MODO OBRA ── */}
        {aba === 'obra' && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: SUBTEXT }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={BORDER} strokeWidth="1.5" style={{ marginBottom: 12 }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Modo Obra</p>
            <p style={{ margin: '4px 0 0', fontSize: 12 }}>A ser implementado seguindo o padrão dos outros módulos</p>
          </div>
        )}

      </main>

      {/* Modal de amostra */}
      {modalAberto && (
        <ModalAmostra
          amostraInicial={amostraEditando}
          onSalvar={salvarAmostra}
          onFechar={() => { setModalAberto(false); setAmostraEditando(null); }}
          itemNum={amostras.length + 1}
        />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}