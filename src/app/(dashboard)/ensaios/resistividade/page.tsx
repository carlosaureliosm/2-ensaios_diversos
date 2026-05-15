'use client';
// src/app/(dashboard)/ensaios/resistividade/page.tsx

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// ── Constantes visuais ──────────────────────────────────────────
const PRIMARY     = '#1E3264';
const GOLD        = '#C8A020';
const BG          = '#F8F9FA';
const BORDER      = '#E8EAF0';
const TEXT        = '#1A2340';
const SUBTEXT     = '#6B7490';
const SUCCESS     = '#1A7A44';
const DANGER      = '#C0392B';
const EXCEL_BLUE  = '#002060';
const GREEN       = '#2E7D32';
const GREEN_LIGHT = '#F0F8F4';
const GREEN_BORDER = '#B8DFC8';

// ── Tipos ───────────────────────────────────────────────────────
type MedicaoRow = {
  id: string;
  item: number;
  elemento: string;
  posicao: string;
  leituras: string[];          // 5 leituras kΩ·cm
  media: number | null;
  desvioPadrao: number | null;
  classificacao: string;
  fotoFile?: File | null;
  fotoPreview?: string | null;
  fotoWidth?: number;
  fotoHeight?: number;
};

type Cabecalho = {
  rlt: string; data: string; cliente: string; obra: string;
  att: string; endereco: string; notas: string;
  aparMarca: string; aparModelo: string; aparSerie: string;
};

type ObraPonto = { id: string; elemento: string; posicao: string; leituras: string[]; };
type ObraGrupo = { id: string; nome: string; pontos: ObraPonto[]; savedAt: string; };

// ── Constantes ──────────────────────────────────────────────────
const LS_KEY      = 'tecomat_resistividade_v1';
const LS_OBRA_KEY = 'tecomat_resistividade_obra_v2';
const N_LEITURAS  = 5;

// ── Cálculo ─────────────────────────────────────────────────────
function classificar(media: number): string {
  if (media > 100) return 'Desprezível';
  if (media >= 50)  return 'Baixo';
  if (media >= 10)  return 'Moderado';
  return 'Alto';
}

function calcularMedicao(
  elemento: string, posicao: string, leituras: string[], item: number
): MedicaoRow {
  const id = typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Math.random());
  const vals = leituras.map(v => parseFloat(v.replace(',', '.'))).filter(v => !isNaN(v) && v > 0);
  if (vals.length === 0) {
    return { id, item, elemento, posicao, leituras, media: null, desvioPadrao: null, classificacao: '—' };
  }
  const media = vals.reduce((a, b) => a + b, 0) / vals.length;
  const desvioPadrao = vals.length < 2 ? 0
    : Math.sqrt(vals.reduce((acc, v) => acc + (v - media) ** 2, 0) / (vals.length - 1));
  return { id, item, elemento, posicao, leituras, media, desvioPadrao, classificacao: classificar(media) };
}

// ── Utilitários ─────────────────────────────────────────────────
function fmt(v: number | null, dec = 2): string { return v === null ? '—' : v.toFixed(dec); }
function salvarLocal(cab: Cabecalho, medicoes: MedicaoRow[]) {
  // Não salva File/preview no localStorage (não serializáveis)
  const medicoesSem = medicoes.map(({ fotoFile: _f, fotoPreview: _p, ...rest }) => rest);
  try { localStorage.setItem(LS_KEY, JSON.stringify({ cab, medicoes: medicoesSem })); } catch {}
}
function carregarLocal(): { cab: Cabecalho; medicoes: MedicaoRow[] } | null {
  try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function salvarGrupos(grupos: ObraGrupo[]) { try { localStorage.setItem(LS_OBRA_KEY, JSON.stringify(grupos)); } catch {} }
function carregarGrupos(): ObraGrupo[] { try { const r = localStorage.getItem(LS_OBRA_KEY); return r ? JSON.parse(r) : []; } catch { return []; } }
function newId() { return typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Math.random()); }
function onlyDecimal(v: string) { return v.replace(/[^\d,.']/g, ''); }
function onlyNumbers(v: string) { return v.replace(/\D/g, ''); }
function maskData(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function corClassificacao(c: string): string {
  if (c === 'Desprezível') return '#1A7A44';
  if (c === 'Baixo')       return '#2563EB';
  if (c === 'Moderado')    return '#B45309';
  if (c === 'Alto')        return '#C0392B';
  return SUBTEXT;
}

function lerImagemComDimensoes(file: File | null | undefined): Promise<{ base64: string; width: number; height: number; contentType: string }> {
  return new Promise((resolve) => {
    if (!file) { resolve({ base64: '', width: 800, height: 600, contentType: 'image/jpeg' }); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] ?? '';
      const img = new Image();
      img.onload = () => resolve({ base64, width: img.width, height: img.height, contentType: file.type });
      img.onerror = () => resolve({ base64, width: 800, height: 600, contentType: file.type });
      img.src = result;
    };
    reader.onerror = () => resolve({ base64: '', width: 800, height: 600, contentType: 'image/jpeg' });
    reader.readAsDataURL(file);
  });
}

// Comprime imagem antes do envio (max 1200px, JPEG 0.82)
function comprimirImagem(file: File): Promise<{ base64: string; width: number; height: number; contentType: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL('image/jpeg', 0.82).split(',')[1] ?? '';
        resolve({ base64, width, height, contentType: 'image/jpeg' });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ── Sub-componentes ─────────────────────────────────────────────
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
  fontSize: 14, fontFamily: 'inherit', color: TEXT, background: '#fff',
  outline: 'none', width: '100%', boxSizing: 'border-box', transition: 'border-color 0.15s',
};

function ClassBadge({ c }: { c: string }) {
  const color = corClassificacao(c);
  const bg = c === 'Desprezível' ? '#E8F5EE' : c === 'Baixo' ? '#EEF4FF' : c === 'Moderado' ? '#FFFBEB' : c === 'Alto' ? '#FFF0EE' : '#F0F2F8';
  const border = c === 'Desprezível' ? '#B8DFC8' : c === 'Baixo' ? '#BFDBFE' : c === 'Moderado' ? '#FDE68A' : c === 'Alto' ? '#FADADD' : BORDER;
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: bg, color, border: `1px solid ${border}`, whiteSpace: 'nowrap' }}>{c}</span>;
}

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
          <a href="/usuarios" className="nv-u" style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.65)', textDecoration: 'none', padding: '4px 10px', borderRadius: 6, transition: 'color 0.15s' }}>Usuários</a>
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
        <button className="sb-u" onClick={onSignOut} aria-label="Sair" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span className="signout-text">Sair</span>
        </button>
      </div>
    </header>
  );
}

// ── Página principal ────────────────────────────────────────────
export default function ResistividadePage() {
  const router = useRouter();

  // Auth / perfil
  const [userName, setUserName]       = useState('');
  const [userEmail, setUserEmail]     = useState('');
  const [userCargo, setUserCargo]     = useState('');
  const [userCrea, setUserCrea]       = useState('');
  const [userAssinatura, setUserAssinatura] = useState('');

  // Cabeçalho
  const [cab, setCab] = useState<Cabecalho>({
    rlt: '', data: '', cliente: '', obra: '', att: '', endereco: '', notas: '',
    aparMarca: '', aparModelo: '', aparSerie: '',
  });

  // Medições
  const [medicoes, setMedicoes] = useState<MedicaoRow[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  // Formulário nova medição
  const [elemento, setElemento]   = useState('');
  const [posicao, setPosicao]     = useState('Superior');
  const [leituras, setLeituras]   = useState<string[]>(Array(N_LEITURAS).fill(''));
  const leituraRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Foto da medição em edição/criação
  const [fotoFile, setFotoFile]       = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  // Responsável
  const [outroResp, setOutroResp]           = useState(false);
  const [outroRespNome, setOutroRespNome]   = useState('');
  const [outroRespCrea, setOutroRespCrea]   = useState('');
  const [outroRespFile, setOutroRespFile]   = useState<File | null>(null);
  const [outroRespPreview, setOutroRespPreview] = useState<string | null>(null);
  const outroAssinaturaRef = useRef<HTMLInputElement>(null);

  // Opções do relatório
  const [usaMotivacao,  setUsaMotivacao]  = useState(false);
  const [motivacao,     setMotivacao]     = useState('');
  const [usaFotoGeral,  setUsaFotoGeral]  = useState(false);
  const [fotoGeralFile, setFotoGeralFile] = useState<File | null>(null);
  const [usaCroqui,     setUsaCroqui]     = useState(false);
  const [croquiFile,    setCroquiFile]    = useState<File | null>(null);

  // Modo Obra
  const [grupos, setGrupos]               = useState<ObraGrupo[]>([]);
  const [grupoAtivoId, setGrupoAtivoId]   = useState<string | null>(null);
  const [novoGrupoNome, setNovoGrupoNome] = useState('');
  const [pontNome, setPontNome]           = useState('');
  const [pontPosicao, setPontPosicao]     = useState('Superior');
  const [pontLeituras, setPontLeituras]   = useState<string[]>(Array(N_LEITURAS).fill(''));
  const [pontEditId, setPontEditId]       = useState<string | null>(null);
  const [obraSalvoMsg, setObraSalvoMsg]   = useState('');
  const pontLeituraRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(new Set());
  const [modalObraPonto, setModalObraPonto] = useState<{ grupoId: string; ponto: ObraPonto } | null>(null);
  const [showImportar, setShowImportar]   = useState(false);

  // UI
  const [aba, setAba]           = useState<'cabecalho' | 'campo' | 'obra'>('cabecalho');
  const [salvoMsg, setSalvoMsg] = useState('');
  const [gerandoDocx, setGerandoDocx] = useState(false);

  // ── Efeitos ──────────────────────────────────────────────────

  // Auth
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      setUserEmail(user.email ?? '');
      const m = user.user_metadata ?? {};
      setUserName(m.full_name ?? m.name ?? user.email ?? '');
      setUserCargo(m.cargo ?? '');
      setUserCrea(m.crea ?? '');
      setUserAssinatura(m.assinatura_url ?? '');
    });
  }, [router]);

  // Carregar localStorage
  useEffect(() => {
    const saved = carregarLocal();
    if (saved) { setCab(saved.cab); setMedicoes(saved.medicoes); }
    setGrupos(carregarGrupos());
  }, []);

  // Autosave (debounce 500ms)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      salvarLocal(cab, medicoes);
      setSalvoMsg('Salvo');
      setTimeout(() => setSalvoMsg(''), 1800);
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [cab, medicoes]);

  // ── Handlers gerais ──────────────────────────────────────────
  const handleSignOut = async () => {
    const supabase = createClient();
    localStorage.removeItem(LS_KEY);
    await supabase.auth.signOut();
    router.push('/login');
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

  const respNomeFinal = outroResp ? outroRespNome : userName;
  const respCreaFinal = outroResp ? outroRespCrea : userCrea;

  // ── Medições ─────────────────────────────────────────────────
  const processarMedicao = () => {
    if (!elemento.trim()) return;
    const row = calcularMedicao(elemento.trim(), posicao, leituras, 0);
    row.fotoFile    = fotoFile;
    row.fotoPreview = fotoPreview;

    if (editandoId) {
      setMedicoes(prev => prev.map((m, i) => m.id === editandoId ? { ...row, id: editandoId, item: m.item, fotoFile, fotoPreview } : m));
      setEditandoId(null);
    } else {
      const item = medicoes.length > 0 ? medicoes[medicoes.length - 1].item + 1 : 1;
      setMedicoes(prev => [...prev, { ...row, item }]);
    }
    limparFormMedicao();
    leituraRefs.current[0]?.focus();
  };

  const limparFormMedicao = () => {
    setElemento(''); setPosicao('Superior'); setLeituras(Array(N_LEITURAS).fill(''));
    setFotoFile(null); setFotoPreview(null);
    if (fotoInputRef.current) fotoInputRef.current.value = '';
  };

  const carregarParaEdicao = (m: MedicaoRow) => {
    setElemento(m.elemento); setPosicao(m.posicao);
    setLeituras([...m.leituras, ...Array(N_LEITURAS).fill('')].slice(0, N_LEITURAS));
    setFotoFile(m.fotoFile ?? null); setFotoPreview(m.fotoPreview ?? null);
    setEditandoId(m.id); setAba('campo');
  };

  const apagarMedicao = (id: string) => {
    setMedicoes(prev => prev.filter(m => m.id !== id).map((m, i) => ({ ...m, item: i + 1 })));
    if (editandoId === id) { setEditandoId(null); limparFormMedicao(); }
  };

  // ── Modo Obra ─────────────────────────────────────────────────
  const toggleGrupo = (id: string) => {
    setGruposExpandidos(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const criarGrupo = () => {
    if (!novoGrupoNome.trim()) return;
    const g: ObraGrupo = { id: newId(), nome: novoGrupoNome.trim(), pontos: [], savedAt: new Date().toISOString() };
    const novos = [...grupos, g]; setGrupos(novos); salvarGrupos(novos);
    setGrupoAtivoId(g.id); setNovoGrupoNome('');
  };

  const removerGrupo = (id: string) => {
    const novos = grupos.filter(g => g.id !== id); setGrupos(novos); salvarGrupos(novos);
    if (grupoAtivoId === id) setGrupoAtivoId(null);
  };

  const atualizarGrupos = (novos: ObraGrupo[]) => { setGrupos(novos); salvarGrupos(novos); };

  const salvarPonto = () => {
    if (!grupoAtivoId || !pontNome.trim() || !pontLeituras.some(v => v.trim())) return;
    const novos = grupos.map(g => {
      if (g.id !== grupoAtivoId) return g;
      if (pontEditId) return { ...g, pontos: g.pontos.map(p => p.id === pontEditId ? { ...p, elemento: pontNome.trim(), posicao: pontPosicao, leituras: pontLeituras } : p) };
      return { ...g, pontos: [...g.pontos, { id: newId(), elemento: pontNome.trim(), posicao: pontPosicao, leituras: pontLeituras }] };
    });
    atualizarGrupos(novos);
    setPontNome(''); setPontLeituras(Array(N_LEITURAS).fill('')); setPontPosicao('Superior'); setPontEditId(null);
    setObraSalvoMsg(pontEditId ? 'Ponto atualizado!' : 'Ponto salvo!');
    setTimeout(() => setObraSalvoMsg(''), 2000);
    pontLeituraRefs.current[0]?.focus();
  };

  const editarPonto = (p: ObraPonto) => {
    setPontNome(p.elemento); setPontPosicao(p.posicao);
    setPontLeituras([...p.leituras, ...Array(N_LEITURAS).fill('')].slice(0, N_LEITURAS));
    setPontEditId(p.id);
  };

  const removerPonto = (grupoId: string, pontoId: string) => {
    const novos = grupos.map(g => g.id !== grupoId ? g : { ...g, pontos: g.pontos.filter(p => p.id !== pontoId) });
    atualizarGrupos(novos);
    if (pontEditId === pontoId) { setPontNome(''); setPontLeituras(Array(N_LEITURAS).fill('')); setPontEditId(null); }
  };

  const cancelarEdicaoPonto = () => { setPontNome(''); setPontLeituras(Array(N_LEITURAS).fill('')); setPontPosicao('Superior'); setPontEditId(null); };

  const importarGrupo = (g: ObraGrupo) => {
    if (g.pontos.length === 0) return;
    let proximoItem = medicoes.length > 0 ? medicoes[medicoes.length - 1].item + 1 : 1;
    const novas = g.pontos.map(p => { const r = calcularMedicao(p.elemento, p.posicao, p.leituras, proximoItem); proximoItem++; return r; });
    setMedicoes(prev => [...prev, ...novas]);
    setShowImportar(false); setAba('campo');
  };

  const limparTudo = () => {
    if (!confirm('Apagar TODOS os dados e começar do zero?')) return;
    setCab({ rlt: '', data: '', cliente: '', obra: '', att: '', endereco: '', notas: '', aparMarca: '', aparModelo: '', aparSerie: '' });
    setMedicoes([]); setElemento(''); setLeituras(Array(N_LEITURAS).fill('')); setPosicao('Superior');
    setEditandoId(null); setOutroResp(false); setOutroRespNome(''); setOutroRespCrea('');
    setOutroRespFile(null); setOutroRespPreview(null);
    localStorage.removeItem(LS_KEY);
  };

  // ── Gerar DOCX ────────────────────────────────────────────────
  const gerarDocx = async () => {
    if (medicoes.length === 0) { alert('Nenhuma medição na tabela.'); return; }
    if (outroResp && !outroRespNome.trim()) { alert('Informe o nome do responsável.'); return; }
    setGerandoDocx(true);
    try {
      let respAssinaturaBase64 = '';
      let respAssinaturaContentType = 'image/png';
      if (outroResp && outroRespFile) {
        const { base64, contentType } = await lerImagemComDimensoes(outroRespFile);
        respAssinaturaBase64 = base64; respAssinaturaContentType = contentType;
      }
      const respAssinaturaUrl = (!outroResp && userAssinatura) ? userAssinatura : '';

      // Comprime fotos antes do envio
      const medicoesPayload = await Promise.all(medicoes.map(async (m, i) => {
        let fotoBase64 = ''; let fotoContentType = 'image/jpeg'; let fotoWidth = 0; let fotoHeight = 0;
        if (m.fotoFile) {
          const comp = await comprimirImagem(m.fotoFile);
          fotoBase64 = comp.base64; fotoContentType = comp.contentType; fotoWidth = comp.width; fotoHeight = comp.height;
        }
        return {
          item: i + 1,
          elemento: m.elemento,
          posicao: m.posicao,
          l1: m.leituras[0] || '—',
          l2: m.leituras[1] || '—',
          l3: m.leituras[2] || '—',
          l4: m.leituras[3] || '—',
          l5: m.leituras[4] || '—',
          media: fmt(m.media),
          desvio: fmt(m.desvioPadrao),
          classificacao: m.classificacao,
          fotoBase64, fotoContentType, fotoWidth, fotoHeight,
        };
      }));

      // Foto geral — compressão antes do envio
      let fotoGeralBase64: string | null = null;
      let fotoGeralContentType: string | null = null;
      if (usaFotoGeral && fotoGeralFile) {
        const comp = await comprimirImagem(fotoGeralFile);
        fotoGeralBase64 = comp.base64;
        fotoGeralContentType = comp.contentType;
      }

      // Croqui
      let croquiBase64: string | null = null;
      let croquiContentType: string | null = null;
      let croquiWidth: number | null = null;
      let croquiHeight: number | null = null;
      if (usaCroqui && croquiFile) {
        const { base64, contentType, width, height } = await lerImagemComDimensoes(croquiFile);
        croquiBase64 = base64;
        croquiContentType = contentType;
        croquiWidth = width;
        croquiHeight = height;
      }

      const payload = {
        rlt: cab.rlt, data: cab.data, cliente: cab.cliente, obra: cab.obra,
        att: cab.att, endereco: cab.endereco, notas: cab.notas,
        aparMarca: cab.aparMarca, aparModelo: cab.aparModelo, aparSerie: cab.aparSerie,
        respNome: respNomeFinal, respCrea: respCreaFinal,
        respAssinaturaUrl, respAssinaturaBase64, respAssinaturaContentType,
        motivacao: usaMotivacao ? motivacao : null,
        fotoGeralBase64, fotoGeralContentType,
        croquiBase64, croquiContentType, croquiWidth, croquiHeight,
        medicoes: medicoesPayload,
      };

      const res = await fetch('/api/ensaios/resistividade/docx', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `Erro ${res.status}`); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${rltOficial}.docx`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Erro ao gerar DOCX.');
    } finally {
      setGerandoDocx(false);
    }
  };

  const fmtData = (iso: string) => { try { const d = new Date(iso); return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } };
  const totalPontos = grupos.reduce((s, g) => s + g.pontos.length, 0);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{ backgroundColor: BG, minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        input:focus, textarea:focus { outline: none; border-color: ${PRIMARY} !important; box-shadow: 0 0 0 3px rgba(30,50,100,0.07); }
        .tab-icon { display: none; }
        .tab-label-full { display: inline; }
        .tab-label-short { display: none; }
        .tab-btn { transition: all 0.15s; border: none; background: transparent; }
        .tab-btn:hover { opacity: 0.8; }
        .row-h:hover { background: #F3F5FB !important; }
        .icon-btn:hover { filter: brightness(0.88); }
        .btn-pri:hover { box-shadow: 0 4px 16px rgba(30,50,100,0.3) !important; }
        .btn-gold:hover { background: #b08c18 !important; }
        .num-in:focus { border-color: ${PRIMARY} !important; background: #F0F4FC !important; }
        .ponto-row:hover { background: #F3F5FB !important; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        html, body { overflow-x: hidden; max-width: 100vw; }

        @media (max-width: 600px) {
          .header-root { padding: 0 12px !important; flex-wrap: nowrap !important; }
          .header-left { gap: 10px !important; flex-shrink: 1; min-width: 0; overflow: hidden; }
          .header-right { gap: 4px !important; flex-shrink: 0; }
          .header-user-name { max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .header-cargo { display: none !important; }
          .header-divider { display: none !important; }
          .signout-text { display: none; }
          .sb-u { padding: 6px 8px !important; }
          .main-resist { padding: 16px 14px !important; }
          .page-title-row { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
          .page-action-btns { width: 100%; display: flex; gap: 8px; }
          .page-action-btns button { flex: 1; justify-content: center; }
          .tabs-row { background: #F1F3F8; padding: 6px 6px 0; gap: 4px !important; border-bottom: none !important; border-radius: 10px 10px 0 0; }
          .tab-btn { flex: 1; flex-direction: column !important; align-items: center !important; justify-content: center !important; gap: 4px !important; padding: 10px 4px 8px !important; font-size: 11px !important; white-space: nowrap; border-radius: 8px 8px 0 0 !important; background: rgba(255,255,255,0.6) !important; border-bottom: 3px solid transparent !important; margin-bottom: 0 !important; }
          .tab-btn.tab-ativo { background: #fff !important; opacity: 1 !important; border-bottom: 4px solid currentColor !important; }
          .tab-icon { display: block !important; }
          .tab-label-full { display: none !important; }
          .tab-label-short { display: block !important; }
          .section-pad { padding: 16px 14px !important; }
          .grid-rlt { grid-template-columns: 1fr 1fr !important; }
          .grid-aparat { grid-template-columns: 1fr !important; }
          .grid-outro-resp { grid-template-columns: 1fr !important; }
          .grid-med-id { grid-template-columns: 1fr !important; }
          .table-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .leituras-wrap input { width: 52px !important; }
          .medicoes-table-section { display: none !important; }
          .medicoes-cards-section { display: flex !important; }
          .obra-pontos-table { display: none !important; }
          .obra-pontos-cards { display: block !important; }
        }
        .medicoes-cards-section { display: none; flex-direction: column; gap: 10px; padding: 14px; }
        .obra-pontos-cards { display: none; }

        /* Modal bottom-sheet */
        .modal-overlay { position: fixed; inset: 0; background: rgba(30,50,100,0.35); backdrop-filter: blur(4px); display: flex; align-items: flex-end; justify-content: center; z-index: 300; padding: 0; }
        .modal-sheet { background: #fff; border-radius: 20px 20px 0 0; width: 100%; max-height: 85vh; overflow-y: auto; padding: 24px 20px; box-shadow: 0 -8px 40px rgba(30,50,100,0.18); }
        @media (min-width: 601px) {
          .modal-overlay { align-items: center; padding: 20px; }
          .modal-sheet { border-radius: 16px; max-width: 520px; max-height: 80vh; }
        }
      `}</style>

      <Header displayName={userName || userEmail} initials={initials} cargo={userCargo} onSignOut={handleSignOut} />

      {/* Modal bottom-sheet — ponto do Modo Obra */}
      {modalObraPonto && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModalObraPonto(null); }}>
          <div className="modal-sheet">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ borderLeft: `4px solid ${GREEN}`, paddingLeft: 12 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Modo Obra</p>
                <h3 style={{ margin: '3px 0 0', fontSize: 16, fontWeight: 800, color: TEXT }}>{modalObraPonto.ponto.elemento}</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: SUBTEXT }}>{modalObraPonto.ponto.posicao}</p>
              </div>
              <button onClick={() => setModalObraPonto(null)} aria-label="Fechar" style={{ background: '#F0F2F8', border: 'none', borderRadius: 8, cursor: 'pointer', padding: '6px 10px', fontSize: 16, color: SUBTEXT }}>✕</button>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Leituras (kΩ·cm)</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20 }}>
              {modalObraPonto.ponto.leituras.map((v, i) => (
                <div key={i} style={{ textAlign: 'center', padding: '10px 4px', background: v ? '#F0F4FC' : '#F8F9FA', borderRadius: 8, border: `1.5px solid ${v ? PRIMARY + '44' : BORDER}` }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: SUBTEXT, marginBottom: 4 }}>{i + 1}ª</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: v ? TEXT : '#C0C8D8' }}>{v || '—'}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { editarPonto(modalObraPonto.ponto); setGrupoAtivoId(modalObraPonto.grupoId); setModalObraPonto(null); }} style={{ flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: PRIMARY, color: '#fff', border: 'none' }}>✎ Editar</button>
              <button onClick={() => { if (confirm(`Apagar "${modalObraPonto.ponto.elemento}"?`)) { removerPonto(modalObraPonto.grupoId, modalObraPonto.ponto.id); setModalObraPonto(null); } }} style={{ flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#FFF0EE', color: DANGER, border: `1px solid #FADADD` }}>Apagar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Importar do Modo Obra */}
      {showImportar && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowImportar(false); }} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(30,50,100,0.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
          <div style={{ backgroundColor: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, padding: '28px 24px', width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(30,50,100,0.18)', maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ borderLeft: `4px solid ${GOLD}`, paddingLeft: 12, marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: TEXT }}>Importar do Modo Obra</h2>
            </div>
            {grupos.filter(g => g.pontos.length > 0).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: SUBTEXT }}>
                <p style={{ margin: 0, fontWeight: 600 }}>Nenhum grupo com pontos na fila</p>
              </div>
            ) : (
              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {grupos.filter(g => g.pontos.length > 0).map(g => (
                  <div key={g.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F8F9FA', borderBottom: `1px solid ${BORDER}` }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: TEXT }}>{g.nome}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: SUBTEXT }}>{g.pontos.length} ponto{g.pontos.length !== 1 ? 's' : ''} · {fmtData(g.savedAt)}</p>
                      </div>
                      <button onClick={() => importarGrupo(g)} style={{ padding: '8px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: PRIMARY, color: '#fff', border: 'none' }}>
                        Importar todos ({g.pontos.length}) →
                      </button>
                    </div>
                    {g.pontos.map((p, pi) => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', borderBottom: pi < g.pontos.length - 1 ? `1px solid ${BORDER}` : 'none', background: '#fff' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: SUBTEXT, width: 18, textAlign: 'center' }}>{pi + 1}</span>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: TEXT, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.elemento}</p>
                        <span style={{ fontSize: 11, color: SUBTEXT, flexShrink: 0 }}>{p.posicao} · {p.leituras.filter(v => v.trim()).length} leit.</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowImportar(false)} style={{ padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#F0F2F8', color: SUBTEXT, border: 'none' }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      <main className="main-resist" style={{ maxWidth: 1060, margin: '0 auto', padding: '24px 20px' }}>

        {/* Breadcrumb + título */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <a href="/dashboard" style={{ fontSize: 12, color: SUBTEXT, textDecoration: 'none' }}>Ensaios</a>
            <span style={{ fontSize: 12, color: SUBTEXT }}>›</span>
            <span style={{ fontSize: 12, color: PRIMARY, fontWeight: 700 }}>Resistividade Elétrica</span>
          </div>
          <div className="page-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ borderLeft: `4px solid ${GOLD}`, paddingLeft: 14 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Ensaio</p>
              <h1 style={{ margin: '3px 0 0', fontSize: 22, fontWeight: 800, color: TEXT }}>Resistividade Elétrica</h1>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: SUBTEXT }}>COST 509 / RILEM TC 154-EMC / CEB-192</p>
            </div>
            <div className="page-action-btns" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {salvoMsg && <span style={{ fontSize: 12, color: SUCCESS, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>{salvoMsg}</span>}
              <button onClick={limparTudo} style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#FFF0EE', color: DANGER, border: `1px solid #FADADD` }}>🗑 Limpar Tudo</button>
              <button onClick={gerarDocx} disabled={gerandoDocx || medicoes.length === 0} className="btn-gold" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: medicoes.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', backgroundColor: GOLD, color: PRIMARY, border: 'none', opacity: medicoes.length === 0 ? 0.5 : 1, transition: 'background 0.15s' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                {gerandoDocx ? 'Gerando…' : 'Gerar relatório'}
              </button>
            </div>
          </div>
        </div>

        {/* Abas */}
        <div className="tabs-row" style={{ display: 'flex', borderBottom: `2px solid ${BORDER}`, marginBottom: 0 }}>

          {/* Aba 1 */}
          <button className={`tab-btn${aba === 'cabecalho' ? ' tab-ativo' : ''}`} onClick={() => setAba('cabecalho')} style={{ padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: aba === 'cabecalho' ? PRIMARY : SUBTEXT, borderBottom: aba === 'cabecalho' ? `3px solid ${GOLD}` : '3px solid transparent', marginBottom: -2, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg className="tab-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: aba === 'cabecalho' ? PRIMARY : SUBTEXT }}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            <span className="tab-label-full">1. Cabeçalho e Aparelho</span>
            <span className="tab-label-short" style={{ color: aba === 'cabecalho' ? PRIMARY : SUBTEXT, fontWeight: 700, fontSize: 11 }}>Cabeçalho</span>
          </button>

          {/* Aba 2 */}
          <button className={`tab-btn${aba === 'campo' ? ' tab-ativo' : ''}`} onClick={() => setAba('campo')} style={{ padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: aba === 'campo' ? PRIMARY : SUBTEXT, borderBottom: aba === 'campo' ? `3px solid ${GOLD}` : '3px solid transparent', marginBottom: -2, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg className="tab-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: aba === 'campo' ? PRIMARY : SUBTEXT }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <span className="tab-label-full">2. Dados de Campo{medicoes.length > 0 ? ` (${medicoes.length})` : ''}</span>
            <span className="tab-label-short" style={{ color: aba === 'campo' ? PRIMARY : SUBTEXT, fontWeight: 700, fontSize: 11 }}>Dados</span>
          </button>

          {/* Aba 3 */}
          <button className={`tab-btn${aba === 'obra' ? ' tab-ativo' : ''}`} onClick={() => setAba('obra')} style={{ padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: aba === 'obra' ? GREEN : SUBTEXT, borderBottom: aba === 'obra' ? `3px solid ${GREEN}` : '3px solid transparent', marginBottom: -2, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg className="tab-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: aba === 'obra' ? GREEN : SUBTEXT }}><path d="M2 20h20"/><path d="M6 20v-4a6 6 0 0 1 12 0v4"/><path d="M12 4v4"/><path d="M4 12a8 8 0 0 1 16 0"/></svg>
            <span className="tab-label-full" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              3. Modo Obra{totalPontos > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', fontSize: 10, fontWeight: 800, background: aba === 'obra' ? GREEN : SUBTEXT, color: '#fff' }}>{totalPontos}</span>}
            </span>
            <span className="tab-label-short" style={{ color: aba === 'obra' ? GREEN : SUBTEXT, fontWeight: 700, fontSize: 11 }}>Obra{totalPontos > 0 ? ` (${totalPontos})` : ''}</span>
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* ABA 1 — Cabeçalho e Aparelho                          */}
        {/* ═══════════════════════════════════════════════════════ */}
        {aba === 'cabecalho' && (
          <div style={{ paddingTop: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Dados da Obra */}
            <section className="section-pad" style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(30,50,100,0.04)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 800, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Dados da Obra e Cliente</h3>
              <div className="grid-rlt" style={{ display: 'grid', gridTemplateColumns: '140px 150px 1fr', gap: '12px 16px', marginBottom: 12 }}>
                <Campo label="Nº do RLT" htmlFor="rlt-input"><input id="rlt-input" style={inputStyle} inputMode="numeric" value={cab.rlt} onChange={e => setCab(c => ({ ...c, rlt: onlyNumbers(e.target.value) }))} placeholder="Ex: 42" maxLength={6} /></Campo>
                <Campo label="Data de Emissão" htmlFor="data-input"><input id="data-input" style={inputStyle} inputMode="numeric" value={cab.data} onChange={e => setCab(c => ({ ...c, data: maskData(e.target.value) }))} placeholder="DD/MM/AAAA" maxLength={10} /></Campo>
                <Campo label="Cliente" htmlFor="cliente-input"><input id="cliente-input" style={{ ...inputStyle, textTransform: 'uppercase' }} value={cab.cliente} onChange={e => setCab(c => ({ ...c, cliente: e.target.value.toUpperCase() }))} placeholder="NOME DO CLIENTE" /></Campo>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: 12 }}>
                <Campo label="Obra" htmlFor="obra-input"><input id="obra-input" style={{ ...inputStyle, textTransform: 'uppercase' }} value={cab.obra} onChange={e => setCab(c => ({ ...c, obra: e.target.value.toUpperCase() }))} placeholder="DESCRIÇÃO DA OBRA" /></Campo>
                <Campo label="A/C (Att.)" htmlFor="att-input"><input id="att-input" style={{ ...inputStyle, textTransform: 'uppercase' }} value={cab.att} onChange={e => setCab(c => ({ ...c, att: e.target.value.toUpperCase() }))} placeholder="A/C DE…" /></Campo>
              </div>
              <Campo label="Endereço" htmlFor="end-input"><input id="end-input" style={{ ...inputStyle, textTransform: 'uppercase' }} value={cab.endereco} onChange={e => setCab(c => ({ ...c, endereco: e.target.value.toUpperCase() }))} placeholder="ENDEREÇO COMPLETO DA OBRA" /></Campo>
            </section>

            {/* Dados do Aparelho */}
            <section className="section-pad" style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(30,50,100,0.04)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 800, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Equipamento Utilizado</h3>
              <div className="grid-aparat" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px 16px' }}>
                <Campo label="Marca" htmlFor="apar-marca"><input id="apar-marca" style={inputStyle} value={cab.aparMarca} onChange={e => setCab(c => ({ ...c, aparMarca: e.target.value }))} placeholder="Ex: Proceq" /></Campo>
                <Campo label="Modelo" htmlFor="apar-modelo"><input id="apar-modelo" style={inputStyle} value={cab.aparModelo} onChange={e => setCab(c => ({ ...c, aparModelo: e.target.value }))} placeholder="Ex: Resipod" /></Campo>
                <Campo label="Nº de Série" htmlFor="apar-serie"><input id="apar-serie" style={inputStyle} value={cab.aparSerie} onChange={e => setCab(c => ({ ...c, aparSerie: e.target.value }))} placeholder="Ex: 12345" /></Campo>
              </div>
            </section>

            {/* Responsável técnico */}
            <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(30,50,100,0.04)' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Responsável Técnico</h3>
              {!outroResp ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F0F4FC', borderRadius: 8, border: `1px solid ${BORDER}` }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEXT }}>{userName || '—'}</p>
                    {userCrea && <p style={{ margin: '2px 0 0', fontSize: 12, color: SUBTEXT }}>CREA: {userCrea}</p>}
                    {userAssinatura && <p style={{ margin: '2px 0 0', fontSize: 11, color: SUCCESS, display: 'flex', alignItems: 'center', gap: 4 }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>Assinatura cadastrada</p>}
                  </div>
                  <button onClick={() => setOutroResp(true)} style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#EEF1F8', color: PRIMARY, border: `1px solid ${BORDER}` }}>Usar outro responsável</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <button onClick={() => { setOutroResp(false); setOutroRespNome(''); setOutroRespCrea(''); setOutroRespFile(null); setOutroRespPreview(null); }} style={{ alignSelf: 'flex-start', padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#F0F2F8', color: SUBTEXT, border: 'none' }}>← Voltar ao responsável do perfil</button>
                  <div className="grid-outro-resp" style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '12px 16px' }}>
                    <Campo label="Nome completo" htmlFor="outro-nome"><input id="outro-nome" style={inputStyle} value={outroRespNome} onChange={e => setOutroRespNome(e.target.value)} placeholder="Nome do engenheiro" /></Campo>
                    <Campo label="CREA" htmlFor="outro-crea"><input id="outro-crea" style={inputStyle} value={outroRespCrea} onChange={e => setOutroRespCrea(e.target.value)} placeholder="Nº CREA" /></Campo>
                  </div>
                  <Campo label="Imagem da Assinatura">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <input ref={outroAssinaturaRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (!f) return; setOutroRespFile(f); setOutroRespPreview(URL.createObjectURL(f)); }} />
                      <button onClick={() => outroAssinaturaRef.current?.click()} style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#EEF1F8', color: PRIMARY, border: `1px solid ${BORDER}` }}>{outroRespPreview ? '↻ Trocar imagem' : '📁 Selecionar assinatura'}</button>
                      {outroRespPreview && (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={outroRespPreview} alt="Prévia assinatura" style={{ maxHeight: 40, maxWidth: 160, objectFit: 'contain', border: `1px solid ${BORDER}`, borderRadius: 6, padding: 4, background: '#fff' }} />
                          <button onClick={() => { setOutroRespFile(null); setOutroRespPreview(null); if (outroAssinaturaRef.current) outroAssinaturaRef.current.value = ''; }} style={{ padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#FFF0EE', color: DANGER, border: `1px solid #FADADD` }}>Remover</button>
                        </>
                      )}
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: SUBTEXT }}>PNG com fundo transparente recomendado · não será salva no perfil</p>
                  </Campo>
                </div>
              )}
            </section>

            {/* Opções do Relatório */}
            <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(30,50,100,0.04)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 800, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Opções do Relatório</h3>

              {/* Motivação */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: TEXT }}>
                  <input type="checkbox" checked={usaMotivacao} onChange={e => setUsaMotivacao(e.target.checked)} />
                  Incluir motivação do ensaio
                </label>
                {usaMotivacao && (
                  <textarea
                    aria-label="Motivação do ensaio"
                    value={motivacao}
                    onChange={e => setMotivacao(e.target.value)}
                    placeholder="Descreva a motivação do ensaio..."
                    rows={3}
                    style={{ marginTop: 8, width: '100%', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${BORDER}`, fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                )}
              </div>

              {/* Foto geral */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: TEXT }}>
                  <input type="checkbox" checked={usaFotoGeral} onChange={e => setUsaFotoGeral(e.target.checked)} />
                  Incluir foto geral da estrutura
                </label>
                {usaFotoGeral && (
                  <input
                    type="file"
                    aria-label="Foto geral da estrutura"
                    accept="image/*"
                    onChange={e => setFotoGeralFile(e.target.files?.[0] ?? null)}
                    style={{ marginTop: 8, display: 'block', fontSize: 13 }}
                  />
                )}
              </div>

              {/* Croqui */}
              <div style={{ marginTop: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#1A2340' }}>
                  <input type="checkbox" checked={usaCroqui} onChange={e => setUsaCroqui(e.target.checked)} />
                  Incluir croqui com indicação dos elementos ensaiados
                </label>
                {usaCroqui && (
                  <input
                    type="file"
                    aria-label="Croqui dos elementos ensaiados"
                    accept="image/*"
                    onChange={e => setCroquiFile(e.target.files?.[0] ?? null)}
                    style={{ marginTop: 8, display: 'block', fontSize: 13 }}
                  />
                )}
              </div>
            </section>

            {/* Notas */}
            <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(30,50,100,0.04)' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 800, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Notas / Observações</h3>
              <textarea value={cab.notas} onChange={e => setCab(c => ({ ...c, notas: e.target.value }))} rows={3} placeholder="Observações gerais sobre o ensaio…" style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
            </section>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setAba('campo')} className="btn-pri" style={{ padding: '11px 28px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', backgroundColor: PRIMARY, color: '#fff', border: 'none', boxShadow: '0 2px 8px rgba(30,50,100,0.2)', transition: 'all 0.15s' }}>
                Avançar para Dados de Campo →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* ABA 2 — Dados de Campo                                */}
        {/* ═══════════════════════════════════════════════════════ */}
        {aba === 'campo' && (
          <div style={{ paddingTop: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Formulário inserção */}
            <section style={{ background: '#fff', border: `1px solid ${editandoId ? GOLD : BORDER}`, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(30,50,100,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, color: editandoId ? '#8B6914' : PRIMARY, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  {editandoId ? '✎  Editando Medição' : '+  Inserir Nova Medição'}
                </h3>
                {grupos.filter(g => g.pontos.length > 0).length > 0 && !editandoId && (
                  <button onClick={() => setShowImportar(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: GREEN_LIGHT, color: GREEN, border: `1.5px solid ${GREEN_BORDER}` }}>
                    Importar do Modo Obra ({grupos.reduce((s, g) => s + g.pontos.length, 0)})
                  </button>
                )}
              </div>

              {/* Identificação + posição */}
              <div className="grid-med-id" style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 16, marginBottom: 16 }}>
                <Campo label="Identificação do elemento (ex: P7 – 6º Andar)" htmlFor="elem-input">
                  <input id="elem-input" style={{ ...inputStyle, textTransform: 'uppercase' }} value={elemento} onChange={e => setElemento(e.target.value.toUpperCase())} placeholder="EX: P7 – 6º ANDAR, V3 – VIGA COBERTURA…" onKeyDown={e => e.key === 'Enter' && leituraRefs.current[0]?.focus()} />
                </Campo>
                <Campo label="Posição">
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['Superior', 'Inferior', 'Lateral'].map(p => (
                      <button key={p} onClick={() => setPosicao(p)} style={{ flex: 1, padding: '8px 4px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', backgroundColor: posicao === p ? PRIMARY : '#F0F2F8', color: posicao === p ? '#fff' : SUBTEXT, border: `2px solid ${posicao === p ? PRIMARY : 'transparent'}` }}>{p}</button>
                    ))}
                  </div>
                </Campo>
              </div>

              {/* 5 leituras */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Leituras de Resistividade (kΩ·cm) — mínimo 1, máximo 5
                </p>
                <div className="leituras-wrap" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {leituras.map((v, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: SUBTEXT }}>{i + 1}ª</span>
                      <input
                        ref={el => { leituraRefs.current[i] = el; }}
                        type="text" inputMode="decimal" value={v}
                        onChange={e => { const n = [...leituras]; n[i] = onlyDecimal(e.target.value); setLeituras(n); }}
                        onKeyDown={e => {
                          if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); const nx = leituraRefs.current[i + 1]; if (nx) nx.focus(); else processarMedicao(); }
                          else if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); leituraRefs.current[i - 1]?.focus(); }
                          else if (e.key === 'Enter') { e.preventDefault(); const nx = leituraRefs.current[i + 1]; if (nx) nx.focus(); else processarMedicao(); }
                        }}
                        placeholder="0,0"
                        style={{ width: 68, textAlign: 'center', padding: '9px 4px', border: `1.5px solid ${v ? PRIMARY + '55' : BORDER}`, borderRadius: 7, fontSize: 14, fontFamily: 'inherit', color: TEXT, background: v ? '#F0F4FC' : '#fff', outline: 'none', transition: 'all 0.1s' }}
                        className="num-in"
                        aria-label={`Leitura ${i + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Foto do ponto */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Foto do Ponto (memorial fotográfico)</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <input ref={fotoInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (!f) return; setFotoFile(f); setFotoPreview(URL.createObjectURL(f)); }} />
                  <button onClick={() => fotoInputRef.current?.click()} aria-label={fotoPreview ? 'Trocar foto do ponto' : 'Selecionar foto do ponto'} style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#EEF1F8', color: PRIMARY, border: `1px solid ${BORDER}` }}>
                    {fotoPreview ? '↻ Trocar foto' : '📷 Adicionar foto'}
                  </button>
                  {fotoPreview && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={fotoPreview} alt="Prévia da foto" style={{ maxHeight: 60, maxWidth: 120, objectFit: 'cover', borderRadius: 6, border: `1px solid ${BORDER}` }} />
                      <button onClick={() => { setFotoFile(null); setFotoPreview(null); if (fotoInputRef.current) fotoInputRef.current.value = ''; }} aria-label="Remover foto" style={{ padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#FFF0EE', color: DANGER, border: `1px solid #FADADD` }}>Remover</button>
                    </>
                  )}
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 11, color: SUBTEXT }}>A legenda será gerada automaticamente: "Foto {medicoes.length + 1} — {elemento || 'Elemento'} {posicao}"</p>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={processarMedicao} disabled={!elemento.trim()} className="btn-pri" style={{ padding: '10px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: elemento.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', backgroundColor: editandoId ? GOLD : PRIMARY, color: editandoId ? PRIMARY : '#fff', border: 'none', opacity: elemento.trim() ? 1 : 0.5 }}>
                  {editandoId ? '✓ Salvar Alterações' : '+ Calcular e Adicionar'}
                </button>
                {editandoId && <button onClick={() => { setEditandoId(null); limparFormMedicao(); }} style={{ padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#F0F2F8', color: SUBTEXT, border: 'none' }}>Cancelar</button>}
                <button onClick={limparFormMedicao} style={{ padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#F0F2F8', color: SUBTEXT, border: 'none' }}>Limpar Campos</button>
              </div>
            </section>

            {/* Tabela de resultados — desktop */}
            <section className="medicoes-table-section" style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(30,50,100,0.06)' }}>
              <div className="table-wrapper" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 100px 70px 70px 70px 70px 70px 78px 80px 120px 68px', padding: '11px 16px', background: EXCEL_BLUE, minWidth: 860 }}>
                  {['#', 'ELEMENTO', 'POSIÇÃO', 'L1', 'L2', 'L3', 'L4', 'L5', 'MÉDIA', 'DESV. PAD.', 'CLASSIFICAÇÃO', 'AÇÕES'].map(h => (
                    <span key={h} style={{ fontSize: 9.5, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>{h}</span>
                  ))}
                </div>
                {medicoes.length === 0 ? (
                  <div style={{ padding: '48px 0', textAlign: 'center', color: SUBTEXT }}>
                    <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.2 }}>∿</div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Nenhuma medição inserida</p>
                    <p style={{ margin: '4px 0 0', fontSize: 12 }}>Preencha o formulário acima para adicionar a primeira medição</p>
                  </div>
                ) : medicoes.map((m, idx) => {
                  const editing = editandoId === m.id;
                  return (
                    <div key={m.id} className="row-h" style={{ display: 'grid', gridTemplateColumns: '36px 1fr 100px 70px 70px 70px 70px 70px 78px 80px 120px 68px', padding: '10px 16px', borderBottom: idx < medicoes.length - 1 ? `1px solid ${BORDER}` : 'none', alignItems: 'center', background: editing ? '#FFFBEC' : idx % 2 === 1 ? '#F8F9FC' : '#fff', transition: 'background 0.1s', minWidth: 860 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: SUBTEXT, textAlign: 'center' }}>{m.item}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{m.elemento}</span>
                        {m.fotoPreview && <span title="Foto vinculada" style={{ fontSize: 14 }}>📷</span>}
                      </div>
                      <span style={{ fontSize: 12, color: SUBTEXT, textAlign: 'center' }}>{m.posicao}</span>
                      {m.leituras.map((l, li) => (
                        <span key={li} style={{ fontSize: 12, color: l ? TEXT : '#C0C8D8', textAlign: 'center', fontWeight: l ? 600 : 400 }}>{l || '—'}</span>
                      ))}
                      <span style={{ fontSize: 13, fontWeight: 800, color: PRIMARY, textAlign: 'center' }}>{fmt(m.media)}</span>
                      <span style={{ fontSize: 12, color: SUBTEXT, textAlign: 'center' }}>{fmt(m.desvioPadrao)}</span>
                      <div style={{ display: 'flex', justifyContent: 'center' }}><ClassBadge c={m.classificacao} /></div>
                      <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                        <button className="icon-btn" title="Editar" onClick={() => carregarParaEdicao(m)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#EEF1F8', color: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="icon-btn" title="Apagar" onClick={() => { if (confirm(`Apagar "${m.elemento} (${m.posicao})"?`)) apagarMedicao(m.id); }} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#FFF0EE', color: DANGER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Cards mobile — medições */}
            <div className="medicoes-cards-section">
              {medicoes.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: SUBTEXT }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Nenhuma medição inserida</p>
                </div>
              ) : medicoes.map(m => (
                <div key={m.id} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(30,50,100,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: SUBTEXT }}>#{m.item}</span>
                        {m.fotoPreview && <span title="Foto vinculada" style={{ fontSize: 13 }}>📷</span>}
                      </div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TEXT }}>{m.elemento}</p>
                      <p style={{ margin: '2px 0 4px', fontSize: 12, color: SUBTEXT }}>{m.posicao}</p>
                      <ClassBadge c={m.classificacao} />
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => carregarParaEdicao(m)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#EEF1F8', color: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={() => { if (confirm(`Apagar?`)) apagarMedicao(m.id); }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#FFF0EE', color: DANGER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginTop: 10 }}>
                    {m.leituras.map((l, li) => (
                      <div key={li} style={{ textAlign: 'center', padding: '7px 4px', background: l ? '#F0F4FC' : '#F8F9FA', borderRadius: 6, border: `1px solid ${l ? PRIMARY + '33' : BORDER}` }}>
                        <div style={{ fontSize: 9, color: SUBTEXT, marginBottom: 2 }}>{li + 1}ª</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: l ? TEXT : '#C0C8D8' }}>{l || '—'}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                    <div><span style={{ fontSize: 10, color: SUBTEXT }}>Média</span><p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 800, color: PRIMARY }}>{fmt(m.media)} kΩ·cm</p></div>
                    <div><span style={{ fontSize: 10, color: SUBTEXT }}>Desv. Pad.</span><p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: TEXT }}>{fmt(m.desvioPadrao)}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* ABA 3 — Modo Obra                                     */}
        {/* ═══════════════════════════════════════════════════════ */}
        {aba === 'obra' && (
          <div style={{ paddingTop: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Banner modo obra */}
            <div style={{ padding: '12px 18px', background: GREEN_LIGHT, border: `1.5px solid ${GREEN_BORDER}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h20"/><path d="M6 20v-4a6 6 0 0 1 12 0v4"/><path d="M12 4v4"/><path d="M4 12a8 8 0 0 1 16 0"/></svg>
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: GREEN }}>MODO OBRA — Coleta sem calcular</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#2E6B35' }}>Salve os pontos em campo. Importe para a aba Dados para calcular e gerar o relatório.</p>
              </div>
            </div>

            {/* Criar grupo */}
            <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 4px rgba(30,50,100,0.04)' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 800, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.07em' }}>+ Novo Grupo</h3>
              <div style={{ display: 'flex', gap: 10 }}>
                <input style={{ ...inputStyle, flex: 1 }} value={novoGrupoNome} onChange={e => setNovoGrupoNome(e.target.value)} onKeyDown={e => e.key === 'Enter' && criarGrupo()} placeholder="Ex: Bloco A — Pilares Térreo" />
                <button onClick={criarGrupo} disabled={!novoGrupoNome.trim()} style={{ padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: novoGrupoNome.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', background: GREEN, color: '#fff', border: 'none', opacity: novoGrupoNome.trim() ? 1 : 0.5, flexShrink: 0 }}>Criar Grupo</button>
              </div>
            </section>

            {/* Lista de grupos */}
            {grupos.map(g => {
              const ativo = grupoAtivoId === g.id;
              const expandido = gruposExpandidos.has(g.id);
              return (
                <section key={g.id} style={{ background: '#fff', border: `1.5px solid ${ativo ? GREEN : BORDER}`, borderRadius: 12, overflow: 'hidden', boxShadow: ativo ? `0 0 0 3px ${GREEN}22` : '0 1px 4px rgba(30,50,100,0.04)' }}>
                  {/* Header do grupo */}
                  <div className="grupo-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: ativo ? GREEN_LIGHT : '#FAFBFD', borderBottom: expandido ? `1px solid ${BORDER}` : 'none', cursor: 'pointer' }} onClick={() => toggleGrupo(g.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: expandido ? GREEN : SUBTEXT, transition: 'transform 0.2s', display: 'inline-block', transform: expandido ? 'rotate(90deg)' : 'none' }}>▶</span>
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: ativo ? GREEN : TEXT }}>{g.nome}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: SUBTEXT }}>{g.pontos.length} ponto{g.pontos.length !== 1 ? 's' : ''} · {fmtData(g.savedAt)}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => setGrupoAtivoId(ativo ? null : g.id)} style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: ativo ? GREEN : '#EEF1F8', color: ativo ? '#fff' : GREEN, border: `1.5px solid ${GREEN_BORDER}` }}>
                        {ativo ? '✓ Ativo' : 'Selecionar'}
                      </button>
                      <button onClick={() => { if (confirm(`Apagar grupo "${g.nome}"?`)) removerGrupo(g.id); }} aria-label="Apagar grupo" style={{ padding: '6px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', background: '#FFF0EE', color: DANGER, border: `1px solid #FADADD` }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                      </button>
                    </div>
                  </div>

                  {/* Conteúdo expandido */}
                  {expandido && (
                    <>
                      {/* Tabela pontos — desktop */}
                      {g.pontos.length > 0 && (
                        <div className="obra-pontos-table" style={{ overflowX: 'auto' }}>
                          {g.pontos.map((p, pi) => (
                            <div key={p.id} className="ponto-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 20px', borderBottom: pi < g.pontos.length - 1 ? `1px solid ${BORDER}` : 'none', background: '#fff' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: SUBTEXT, width: 22, textAlign: 'center', flexShrink: 0 }}>{pi + 1}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{p.elemento}</span>
                                <span style={{ fontSize: 11, color: SUBTEXT, marginLeft: 10 }}>{p.posicao}</span>
                                <span style={{ fontSize: 11, color: SUBTEXT, marginLeft: 10 }}>
                                  Leituras:{' '}
                                  <strong style={{ color: TEXT }}>
                                    {p.leituras.filter(v => v.trim()).map((v, i, arr) => (
                                      <span key={i}>{v}{i < arr.length - 1 && <span style={{ color: '#C8CEDF', margin: '0 3px' }}>|</span>}</span>
                                    ))}
                                  </strong>
                                  {' '}kΩ·cm
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                                <button onClick={() => { editarPonto(p); setGrupoAtivoId(g.id); }} aria-label="Editar ponto" style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#EEF1F8', color: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <button onClick={() => { if (confirm(`Apagar "${p.elemento}"?`)) removerPonto(g.id, p.id); }} aria-label="Apagar ponto" style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#FFF0EE', color: DANGER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Cards pontos — mobile */}
                      {g.pontos.length > 0 && (
                        <div className="obra-pontos-cards" style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {g.pontos.map((p, pi) => (
                            <div key={p.id} onClick={() => setModalObraPonto({ grupoId: g.id, ponto: p })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#F8F9FC', borderRadius: 10, border: `1px solid ${BORDER}`, cursor: 'pointer' }}>
                              <span style={{ fontSize: 11, fontWeight: 800, color: SUBTEXT, width: 20, textAlign: 'center', flexShrink: 0 }}>{pi + 1}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.elemento}</p>
                                <p style={{ margin: '2px 0 0', fontSize: 11, color: SUBTEXT }}>{p.posicao} · {p.leituras.filter(v => v.trim()).length} leituras</p>
                              </div>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={SUBTEXT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Formulário ponto (grupo ativo) */}
                      {ativo && (
                        <div style={{ padding: '18px 20px', background: '#FAFBFD', borderTop: g.pontos.length > 0 ? `1px solid ${BORDER}` : 'none' }}>
                          <h4 style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 800, color: pontEditId ? '#8B6914' : GREEN, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{pontEditId ? '✎ Editando Ponto' : '+ Novo Ponto'}</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 14, marginBottom: 14 }}>
                            <Campo label="Identificação do elemento" htmlFor="pont-nome">
                              <input id="pont-nome" style={{ ...inputStyle, textTransform: 'uppercase' }} value={pontNome} onChange={e => setPontNome(e.target.value.toUpperCase())} placeholder="EX: P7 – 6º ANDAR" onKeyDown={e => e.key === 'Enter' && pontLeituraRefs.current[0]?.focus()} />
                            </Campo>
                            <Campo label="Posição">
                              <div style={{ display: 'flex', gap: 6 }}>
                                {['Superior', 'Inferior', 'Lateral'].map(p => (
                                  <button key={p} onClick={() => setPontPosicao(p)} style={{ flex: 1, padding: '8px 4px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', backgroundColor: pontPosicao === p ? GREEN : '#F0F2F8', color: pontPosicao === p ? '#fff' : SUBTEXT, border: `2px solid ${pontPosicao === p ? GREEN : 'transparent'}` }}>{p}</button>
                                ))}
                              </div>
                            </Campo>
                          </div>
                          <div style={{ marginBottom: 14 }}>
                            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Leituras (kΩ·cm)</p>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                              {pontLeituras.map((v, i) => (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: SUBTEXT }}>{i + 1}ª</span>
                                  <input
                                    ref={el => { pontLeituraRefs.current[i] = el; }}
                                    type="text" inputMode="decimal" value={v}
                                    onChange={e => { const n = [...pontLeituras]; n[i] = onlyDecimal(e.target.value); setPontLeituras(n); }}
                                    onKeyDown={e => {
                                      if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); const nx = pontLeituraRefs.current[i + 1]; if (nx) nx.focus(); else salvarPonto(); }
                                      else if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); pontLeituraRefs.current[i - 1]?.focus(); }
                                      else if (e.key === 'Enter') { e.preventDefault(); const nx = pontLeituraRefs.current[i + 1]; if (nx) nx.focus(); else salvarPonto(); }
                                    }}
                                    placeholder="0,0"
                                    style={{ width: 68, textAlign: 'center', padding: '9px 4px', border: `1.5px solid ${v ? GREEN + '66' : BORDER}`, borderRadius: 7, fontSize: 14, fontFamily: 'inherit', color: TEXT, background: v ? GREEN_LIGHT : '#fff', outline: 'none', transition: 'all 0.1s' }}
                                    aria-label={`Leitura ${i + 1} (Modo Obra)`}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <button onClick={salvarPonto} disabled={!pontNome.trim() || !pontLeituras.some(v => v.trim())} style={{ padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: pontNome.trim() && pontLeituras.some(v => v.trim()) ? 'pointer' : 'not-allowed', fontFamily: 'inherit', background: pontEditId ? GOLD : GREEN, color: pontEditId ? PRIMARY : '#fff', border: 'none', opacity: pontNome.trim() && pontLeituras.some(v => v.trim()) ? 1 : 0.5 }}>
                              {pontEditId ? '✓ Salvar Edição' : '+ Salvar Ponto'}
                            </button>
                            {pontEditId && <button onClick={cancelarEdicaoPonto} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#F0F2F8', color: SUBTEXT, border: 'none' }}>Cancelar</button>}
                            <button onClick={() => { setPontNome(''); setPontLeituras(Array(N_LEITURAS).fill('')); setPontPosicao('Superior'); setPontEditId(null); }} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#F0F2F8', color: SUBTEXT, border: 'none' }}>Limpar</button>
                            {obraSalvoMsg && <span style={{ fontSize: 12, color: GREEN, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>{obraSalvoMsg}</span>}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </section>
              );
            })}

            {grupos.some(g => g.pontos.length > 0) && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowImportar(true); setAba('campo'); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 24px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: PRIMARY, color: '#fff', border: 'none', boxShadow: '0 2px 8px rgba(30,50,100,0.2)' }}>
                  Ir para Importação →
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}