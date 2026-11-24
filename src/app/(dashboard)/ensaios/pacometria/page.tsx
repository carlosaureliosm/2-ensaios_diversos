'use client';
// src/app/(dashboard)/ensaios/pacometria/page.tsx

import { useState, useEffect, useRef, useCallback } from 'react';
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
} from '@/components/PlanilhaUI';
import { ResponsavelTecnicoPanel } from '@/components/ResponsavelTecnicoPanel';
import {
  AmostraObraSalva,
  AmostraRow,
  Cabecalho,
  ObraGrupoPacometria,
} from '@/modules/pacometria/types';
import { ModalAmostra } from '@/modules/pacometria/components/ModalAmostra';
import { ListaAmostrasPacometria } from '@/modules/pacometria/components/ListaAmostrasPacometria';
import { ModalImportarObra } from '@/modules/pacometria/components/ModalImportarObra';
import {
  blobParaBase64,
  comprimirImagemParaFile,
  comprimirImagemRapida,
  precarregarImagens,
} from '@/modules/pacometria/imagemRapida';
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
  const sem = amostras.map(({ fotoFile: _f, fotoPreview: _p, fotoPath: _fp, ...rest }) => rest);
  try { localStorage.setItem(LS_KEY, JSON.stringify({ cab, amostras: sem })); } catch {}
}
function carregarLocal(): { cab: Cabecalho; amostras: AmostraRow[] } | null {
  try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}

function formatarDataHora(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function revogarSeBlob(url?: string | null) {
  if (url && url.startsWith('blob:')) {
    try { URL.revokeObjectURL(url); } catch {}
  }
}

const SIGNED_URL_CACHE_MS = 45 * 60 * 1000; // 45 min (TTL no servidor é 60 min)

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
  const [userId, setUserId]         = useState('');
  const [userName, setUserName]     = useState('');
  const [userEmail, setUserEmail]   = useState('');
  const [userCargo, setUserCargo]   = useState('');
  const [userCrea, setUserCrea]     = useState('');
  const [userAssinatura, setUserAssinatura] = useState('');

  // Cabeçalho
  const [cab, setCab] = useState<Cabecalho>({
    rlt: '', data: '', cliente: '', obra: '', att: '', endereco: '', notas: '',
  });

  // Amostras (Dados de Campo)
  const [amostras, setAmostras] = useState<AmostraRow[]>([]);

  // Modal de amostra (compartilhado entre Dados de Campo e Modo Obra)
  const [modalAberto, setModalAberto] = useState(false);
  const [amostraEditando, setAmostraEditando] = useState<AmostraRow | null>(null);
  const [modalContexto, setModalContexto] = useState<'campo' | { tipo: 'obra'; grupoId: string }>('campo');

  // Modo Obra (sincronizado com servidor)
  const [obraGrupos, setObraGrupos] = useState<ObraGrupoPacometria[]>([]);
  const [obraCarregando, setObraCarregando] = useState(false);
  const [obraErro, setObraErro] = useState('');
  const [obraSalvandoId, setObraSalvandoId] = useState<string | null>(null);
  const [obraUploadingFotoId, setObraUploadingFotoId] = useState<string | null>(null);
  const [novoGrupoNome, setNovoGrupoNome] = useState('');
  const [criandoGrupo, setCriandoGrupo] = useState(false);
  const [grupoAtivoId, setGrupoAtivoId] = useState<string | null>(null);
  const [showImportarObra, setShowImportarObra] = useState(false);

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

  // Cache em memória de URLs assinadas por fotoPath para não invalidar o cache de imagem do navegador
  const signedUrlCacheRef = useRef<Map<string, { url: string; cachedAt: number }>>(new Map());
  // Fila sequencial de escrita por obra para evitar corrida entre PATCH de amostra e POST de foto
  const obraWriteQueueRef = useRef<Map<string, Promise<unknown>>>(new Map());
  const obraGruposRef = useRef<ObraGrupoPacometria[]>([]);
  obraGruposRef.current = obraGrupos;

  const enfileirarEscritaGrupo = useCallback(<T,>(grupoId: string, tarefa: () => Promise<T>): Promise<T> => {
    const anterior = obraWriteQueueRef.current.get(grupoId) ?? Promise.resolve();
    const proxima = anterior.catch(() => {}).then(tarefa);
    obraWriteQueueRef.current.set(grupoId, proxima);
    proxima.finally(() => {
      if (obraWriteQueueRef.current.get(grupoId) === proxima) {
        obraWriteQueueRef.current.delete(grupoId);
      }
    });
    return proxima;
  }, []);

  const aplicarCacheUrls = useCallback((grupos: ObraGrupoPacometria[]): ObraGrupoPacometria[] => {
    const agora = Date.now();
    const cache = signedUrlCacheRef.current;
    return grupos.map(g => ({
      ...g,
      amostras: g.amostras.map(a => {
        if (!a.fotoPath) return { ...a, fotoUrl: null };
        const existente = cache.get(a.fotoPath);
        if (existente && agora - existente.cachedAt < SIGNED_URL_CACHE_MS) {
          return { ...a, fotoUrl: existente.url };
        }
        if (a.fotoUrl) {
          cache.set(a.fotoPath, { url: a.fotoUrl, cachedAt: agora });
        }
        return a;
      }),
    }));
  }, []);

  // ── Efeitos ──────────────────────────────────────────────────
  const carregarGruposObra = useCallback(async (opts?: { silencioso?: boolean }) => {
    if (!opts?.silencioso) setObraCarregando(true);
    setObraErro('');
    try {
      // Se houver escrita pendente (ex.: upload de foto recém-enviado), aguarda concluir antes de recarregar
      if (obraWriteQueueRef.current.size > 0) {
        await Promise.allSettled(Array.from(obraWriteQueueRef.current.values()));
      }
      const res = await fetch('/api/ensaios/pacometria/obra', { cache: 'no-store' });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || 'Erro ao carregar obras do servidor.');
      }
      const data = await res.json();
      const rawGrupos: ObraGrupoPacometria[] = Array.isArray(data.grupos) ? data.grupos : [];
      const comCache = aplicarCacheUrls(rawGrupos);
      setObraGrupos(comCache);
      if (data.currentUserId) setUserId(data.currentUserId);
      // Pré-carrega miniaturas em segundo plano para abertura e importação instantâneas
      const urlsParaPrecarregar = comCache
        .slice(0, 5)
        .flatMap(g => g.amostras.map(a => a.fotoUrl));
      precarregarImagens(urlsParaPrecarregar);
    } catch (err) {
      setObraErro(err instanceof Error ? err.message : 'Erro ao carregar obras.');
    } finally {
      if (!opts?.silencioso) setObraCarregando(false);
    }
  }, [aplicarCacheUrls]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);
      setUserEmail(user.email ?? '');
      const m = user.user_metadata ?? {};
      setUserName(m.full_name ?? m.name ?? user.email ?? '');
      setUserCargo(m.cargo ?? '');
      setUserCrea(m.crea ?? '');
      setUserAssinatura(await buscarUrlAssinatura(user.id, m.assinatura_path));
      carregarGruposObra();
    });
  }, [router, carregarGruposObra]);

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

  const persistirAmostrasGrupo = async (
    grupoId: string,
    novasAmostras: AmostraObraSalva[],
    anterior: ObraGrupoPacometria,
  ) => {
    // Atualização otimista imediata (0 ms na tela)
    setObraGrupos(prev =>
      prev.map(g => (g.id === grupoId ? { ...g, amostras: novasAmostras, updatedAt: new Date().toISOString() } : g)),
    );
    await enfileirarEscritaGrupo(grupoId, async () => {
      setObraSalvandoId(grupoId);
      setObraErro('');
      try {
        // Garante que fotos já enviadas em paralelo não sejam perdidas ao salvar
        const atualEmMemoria = obraGruposRef.current.find(g => g.id === grupoId);
        const fotoPorId = new Map(
          (atualEmMemoria?.amostras ?? []).map(a => [a.id, a]),
        );
        const mescladas = novasAmostras.map(a => {
          const mem = fotoPorId.get(a.id);
          if (!a.fotoPath && mem?.fotoPath) {
            return { ...a, fotoPath: mem.fotoPath, fotoWidth: mem.fotoWidth, fotoHeight: mem.fotoHeight };
          }
          return a;
        });

        const res = await fetch(`/api/ensaios/pacometria/obra/${grupoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amostras: mescladas }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Erro ao salvar alterações na obra.');
        const [hidratado] = aplicarCacheUrls([data.grupo]);
        setObraGrupos(prev => prev.map(g => (g.id === grupoId ? hidratado : g)));
      } catch (err) {
        // Reverte estado em caso de erro no servidor
        setObraGrupos(prev => prev.map(g => (g.id === grupoId ? anterior : g)));
        alert(err instanceof Error ? err.message : 'Erro ao salvar alterações na obra.');
      } finally {
        setObraSalvandoId(null);
      }
    });
  };

  const criarGrupoObra = async () => {
    const nome = novoGrupoNome.trim();
    if (!nome || criandoGrupo) return;
    setCriandoGrupo(true);
    setObraErro('');
    try {
      const res = await fetch('/api/ensaios/pacometria/obra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Erro ao criar obra.');
      setObraGrupos(prev => [data.grupo, ...prev]);
      setGrupoAtivoId(data.grupo.id);
      setNovoGrupoNome('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao criar obra.');
    } finally {
      setCriandoGrupo(false);
    }
  };

  const apagarGrupoObra = async (g: ObraGrupoPacometria) => {
    if (!confirm(`Apagar a obra "${g.nome}" e todas as suas amostras e fotos do servidor?`)) return;
    setObraSalvandoId(g.id);
    try {
      const res = await fetch(`/api/ensaios/pacometria/obra/${g.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Erro ao apagar obra.');
      setObraGrupos(prev => prev.filter(x => x.id !== g.id));
      if (grupoAtivoId === g.id) setGrupoAtivoId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao apagar obra.');
    } finally {
      setObraSalvandoId(null);
    }
  };

  const salvarAmostra = async (a: AmostraRow) => {
    if (modalContexto === 'campo') {
      setAmostras(prev => {
        const idx = prev.findIndex(x => x.id === a.id);
        if (idx >= 0) {
          const next = [...prev]; next[idx] = a; return next;
        }
        return [...prev, { ...a, item: prev.length + 1 }];
      });
      setModalAberto(false);
      setAmostraEditando(null);
      return;
    }

    const grupo = obraGrupos.find(g => g.id === modalContexto.grupoId);
    if (!grupo) {
      setModalAberto(false);
      setAmostraEditando(null);
      return;
    }

    const { fotoFile: _ff, fotoPreview: _fp, ...limpa } = a;
    const idx = grupo.amostras.findIndex(x => x.id === a.id);
    const novas: AmostraObraSalva[] = idx >= 0
      ? grupo.amostras.map((x, i) =>
          i === idx
            ? { ...limpa, fotoPath: x.fotoPath ?? a.fotoPath ?? null, fotoUrl: x.fotoUrl ?? null }
            : x,
        )
      : [...grupo.amostras, { ...limpa, item: grupo.amostras.length + 1, fotoPath: null, fotoUrl: null }];

    setModalAberto(false);
    setAmostraEditando(null);
    await persistirAmostrasGrupo(grupo.id, novas, grupo);
  };

  const apagarAmostra = (id: string) => {
    if (!confirm('Apagar esta amostra?')) return;
    setAmostras(prev => {
      const alvo = prev.find(a => a.id === id);
      revogarSeBlob(alvo?.fotoPreview);
      return prev.filter(a => a.id !== id).map((a, i) => ({ ...a, item: i + 1 }));
    });
  };

  const editarAmostra = (a: AmostraRow) => {
    setModalContexto('campo');
    setAmostraEditando(a);
    setModalAberto(true);
  };

  const handleFoto = async (id: string, file: File) => {
    // Prévia instantânea + compressão em segundo plano para manter DOM leve e DOCX rápido
    const tempPreview = URL.createObjectURL(file);
    setAmostras(prev =>
      prev.map(a => {
        if (a.id !== id) return a;
        revogarSeBlob(a.fotoPreview);
        return { ...a, fotoFile: file, fotoPreview: tempPreview, fotoPath: null };
      }),
    );
    try {
      const comprimida = await comprimirImagemParaFile(file);
      const previewLeve = URL.createObjectURL(comprimida.file);
      setAmostras(prev =>
        prev.map(a => {
          if (a.id !== id || a.fotoPreview !== tempPreview) return a;
          revogarSeBlob(tempPreview);
          return {
            ...a,
            fotoFile: comprimida.file,
            fotoPreview: previewLeve,
            fotoWidth: comprimida.width,
            fotoHeight: comprimida.height,
          };
        }),
      );
    } catch {
      // Mantém arquivo original caso compressão falhe
    }
  };

  const removerFoto = (id: string) => {
    setAmostras(prev =>
      prev.map(a => {
        if (a.id !== id) return a;
        revogarSeBlob(a.fotoPreview);
        return { ...a, fotoFile: null, fotoPreview: null, fotoPath: null, fotoWidth: undefined, fotoHeight: undefined };
      }),
    );
  };

  const apagarAmostraObra = async (grupoId: string, amostraId: string) => {
    if (!confirm('Apagar esta amostra da obra?')) return;
    const grupo = obraGrupos.find(g => g.id === grupoId);
    if (!grupo) return;
    const novas = grupo.amostras
      .filter(a => a.id !== amostraId)
      .map((a, i) => ({ ...a, item: i + 1 }));
    await persistirAmostrasGrupo(grupoId, novas, grupo);
  };

  const anexarFotoObra = async (grupoId: string, amostraId: string, file: File) => {
    const grupoInicial = obraGruposRef.current.find(g => g.id === grupoId);
    if (!grupoInicial) return;
    const previewLocal = URL.createObjectURL(file);

    // Prévia otimista instantânea (0 ms) enquanto aguarda fila e envia em 1 única requisição
    setObraGrupos(prev =>
      prev.map(g =>
        g.id === grupoId
          ? {
              ...g,
              amostras: g.amostras.map(a => (a.id === amostraId ? { ...a, fotoUrl: previewLocal } : a)),
            }
          : g,
      ),
    );
    setObraUploadingFotoId(amostraId);

    // Comprime imediatamente (em paralelo a eventual PATCH pendente)
    let comprimida: Awaited<ReturnType<typeof comprimirImagemParaFile>>;
    try {
      comprimida = await comprimirImagemParaFile(file);
    } catch (err) {
      revogarSeBlob(previewLocal);
      setObraGrupos(prev => prev.map(g => (g.id === grupoId ? grupoInicial : g)));
      setObraUploadingFotoId(null);
      alert(err instanceof Error ? err.message : 'Erro ao processar foto.');
      return;
    }

    await enfileirarEscritaGrupo(grupoId, async () => {
      try {
        const form = new FormData();
        form.append('foto', comprimida.file);
        form.append('amostraId', amostraId);
        form.append('fotoWidth', String(comprimida.width));
        form.append('fotoHeight', String(comprimida.height));

        const res = await fetch(`/api/ensaios/pacometria/obra/${grupoId}/foto`, {
          method: 'POST',
          body: form,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.path) throw new Error(data?.error || 'Erro ao enviar foto.');

        const fotoPath = data.path as string;
        const urlFinal = (data.url as string | null) ?? previewLocal;
        if (data.url) {
          signedUrlCacheRef.current.set(fotoPath, { url: data.url as string, cachedAt: Date.now() });
          precarregarImagens([data.url as string]);
        }

        // Se o servidor não encontrou a amostra no JSON (fallback de segurança), persiste via PATCH agora
        if (!data.savedInGroup) {
          const grupoAtual = obraGruposRef.current.find(g => g.id === grupoId);
          if (grupoAtual) {
            const novas = grupoAtual.amostras.map(a =>
              a.id === amostraId
                ? { ...a, fotoPath, fotoWidth: comprimida.width, fotoHeight: comprimida.height }
                : a,
            );
            const patchRes = await fetch(`/api/ensaios/pacometria/obra/${grupoId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amostras: novas }),
            });
            if (!patchRes.ok) {
              const pj = await patchRes.json().catch(() => null);
              throw new Error(pj?.error || 'Foto enviada, mas falhou ao vincular na obra.');
            }
          }
        }

        setObraGrupos(prev =>
          prev.map(g =>
            g.id === grupoId
              ? {
                  ...g,
                  updatedAt: (data.updatedAt as string) || new Date().toISOString(),
                  amostras: g.amostras.map(a =>
                    a.id === amostraId
                      ? {
                          ...a,
                          fotoPath,
                          fotoUrl: urlFinal,
                          fotoWidth: comprimida.width,
                          fotoHeight: comprimida.height,
                        }
                      : a,
                  ),
                }
              : g,
          ),
        );
        if (data.url) {
          setTimeout(() => revogarSeBlob(previewLocal), 2000);
        }
      } catch (err) {
        revogarSeBlob(previewLocal);
        setObraGrupos(prev => prev.map(g => (g.id === grupoId ? grupoInicial : g)));
        alert(err instanceof Error ? err.message : 'Erro ao enviar foto.');
      } finally {
        setObraUploadingFotoId(null);
      }
    });
  };

  const removerFotoObra = async (grupoId: string, amostraId: string) => {
    const grupo = obraGrupos.find(g => g.id === grupoId);
    if (!grupo) return;
    const novas = grupo.amostras.map(a =>
      a.id === amostraId
        ? { ...a, fotoPath: null, fotoUrl: null, fotoWidth: undefined, fotoHeight: undefined }
        : a,
    );
    await persistirAmostrasGrupo(grupoId, novas, grupo);
  };

  const importarGrupoObra = (g: ObraGrupoPacometria, modo: 'adicionar' | 'substituir') => {
    const convertidas: AmostraRow[] = g.amostras.map(a => ({
      ...a,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${a.id}_${Date.now()}_${Math.random()}`,
      fotoFile: null,
      fotoPath: a.fotoPath ?? null,
      fotoPreview: a.fotoUrl ?? null,
    }));
    setAmostras(prev => {
      const base = modo === 'substituir' ? [] : prev;
      return [...base, ...convertidas].map((a, i) => ({ ...a, item: i + 1 }));
    });
    if (!cab.obra.trim()) {
      setCab(prev => ({ ...prev, obra: g.nome }));
    }
    setShowImportarObra(false);
  };

  const respNomeFinal = outroResp ? outroRespNome : userName;
  const respCreaFinal = outroResp ? outroRespCrea : userCrea;

  // ── Gerar DOCX ───────────────────────────────────────────────
  const gerarDocx = async () => {
    setGerandoDocx(true);
    try {
      // Comprimir fotos (reaproveitando as já comprimidas no anexo) e rasterizar esquemas + perfis
      const amostrasPayload = await Promise.all(amostras.map(async a => {
        let foto = null;
        if (a.fotoFile instanceof File) {
          if (a.fotoFile.type === 'image/jpeg' && a.fotoWidth && a.fotoHeight && a.fotoFile.size <= 350_000) {
            foto = {
              base64: await blobParaBase64(a.fotoFile),
              width: a.fotoWidth,
              height: a.fotoHeight,
              contentType: 'image/jpeg',
            };
          } else {
            foto = await comprimirImagemRapida(a.fotoFile);
          }
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
      if (usaFotoGeral && fotoGeralFile) fotoGeralPayload = await comprimirImagemRapida(fotoGeralFile);
      const croquisPayload = usaCroquiGeral && croquiFiles.length > 0
        ? await Promise.all(croquiFiles.map(f => comprimirImagemRapida(f)))
        : [];

      // Outro responsável
      let outroRespBase64 = '';
      let outroRespContentType = 'image/png';
      if (outroResp && outroRespFile instanceof File) {
        const r = await comprimirImagemRapida(outroRespFile);
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
              labelFull: `3. Modo Obra${obraGrupos.length > 0 ? ` (${obraGrupos.length})` : ''}`,
              labelShort: `Obra${obraGrupos.length > 0 ? ` (${obraGrupos.length})` : ''}`,
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
          <ListaAmostrasPacometria
            amostras={amostras}
            titulo="Resultado do Ensaio — Amostras de Pacometria"
            direitaExtra={
              <button
                onClick={() => { setShowImportarObra(true); carregarGruposObra({ silencioso: obraGrupos.length > 0 }); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 11px', borderRadius: 6, fontSize: 11.5, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: '#DCFCE7', color: '#166534', border: 'none',
                }}
              >
                Importar do Modo Obra{obraGrupos.length > 0 ? ` (${obraGrupos.length})` : ''}
              </button>
            }
            mobileAcoesExtra={
              <button
                onClick={() => { setShowImportarObra(true); carregarGruposObra({ silencioso: obraGrupos.length > 0 }); }}
                style={{
                  padding: '7px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC',
                }}
              >
                Importar Obra{obraGrupos.length > 0 ? ` (${obraGrupos.length})` : ''}
              </button>
            }
            onNovaAmostra={() => {
              setModalContexto('campo');
              setAmostraEditando(null);
              setModalAberto(true);
            }}
            onEditar={editarAmostra}
            onApagar={apagarAmostra}
            onAnexarFoto={handleFoto}
            onRemoverFoto={removerFoto}
          />
        )}

        {/* ── ABA 3: MODO OBRA ── */}
        {aba === 'obra' && (
          <div>
            {/* Banner informativo */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '10px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, marginBottom: 14 }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: SUCCESS }}>Modo Obra — Sincronizado no servidor</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#3F6E4A', lineHeight: 1.5 }}>
                  Registre amostras e fotos em campo. Todos os usuários podem visualizar e importar na aba <strong>Dados de Campo</strong>, mas somente quem criou a obra pode editar ou apagar.
                </p>
              </div>
              <button
                onClick={() => carregarGruposObra()}
                disabled={obraCarregando}
                style={{
                  padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                  cursor: obraCarregando ? 'wait' : 'pointer', fontFamily: 'inherit',
                  background: '#fff', color: SUCCESS, border: '1px solid #86EFAC', whiteSpace: 'nowrap',
                }}
              >
                {obraCarregando ? 'Atualizando…' : 'Atualizar lista'}
              </button>
            </div>

            {/* Criar nova obra */}
            <PainelPlanilha titulo="Nova Obra / Visita" corBarra={SUCCESS}>
              <div style={{ padding: '12px 14px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input
                  style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                  value={novoGrupoNome}
                  onChange={e => setNovoGrupoNome(e.target.value)}
                  placeholder="Ex: Edifício Central — Visita 24/11"
                  onKeyDown={e => e.key === 'Enter' && criarGrupoObra()}
                  disabled={criandoGrupo}
                />
                <button
                  onClick={criarGrupoObra}
                  disabled={!novoGrupoNome.trim() || criandoGrupo}
                  style={{
                    padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    cursor: novoGrupoNome.trim() && !criandoGrupo ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit', background: SUCCESS, color: '#fff', border: 'none',
                    opacity: novoGrupoNome.trim() && !criandoGrupo ? 1 : 0.5, whiteSpace: 'nowrap',
                  }}
                >
                  {criandoGrupo ? 'Criando…' : '+ Criar Obra'}
                </button>
              </div>
            </PainelPlanilha>

            {obraErro && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 12.5, marginBottom: 14 }}>
                {obraErro}
              </div>
            )}

            {/* Lista de obras */}
            {obraCarregando && obraGrupos.length === 0 ? (
              <div style={{ padding: '36px 0', textAlign: 'center', color: SUBTEXT, background: '#fff', border: '1px solid #94A3B8', borderRadius: 8 }}>
                <p style={{ margin: 0, fontSize: 13 }}>Carregando obras salvas no servidor…</p>
              </div>
            ) : obraGrupos.length === 0 ? (
              <div style={{ padding: '36px 0', textAlign: 'center', color: SUBTEXT, background: '#fff', border: '1px solid #94A3B8', borderRadius: 8 }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>Nenhuma obra registrada no servidor</p>
                <p style={{ margin: '4px 0 0', fontSize: 12 }}>Crie uma obra acima para começar a registrar amostras em campo</p>
              </div>
            ) : obraGrupos.map(g => {
              const ativo = grupoAtivoId === g.id;
              const ehCriador = g.createdBy === userId;
              const salvandoEste = obraSalvandoId === g.id;
              const qtdFotos = g.amostras.filter(a => Boolean(a.fotoPath)).length;
              const amostrasParaLista: AmostraRow[] = g.amostras.map(a => ({
                ...a,
                fotoFile: null,
                fotoPreview: a.fotoUrl ?? null,
              }));

              return (
                <section
                  key={g.id}
                  style={{
                    background: '#fff',
                    border: `1px solid ${ativo ? SUCCESS : '#94A3B8'}`,
                    borderRadius: 8,
                    overflow: 'hidden',
                    marginBottom: 14,
                  }}
                >
                  {/* Cabeçalho da obra */}
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
                      padding: '12px 16px',
                      background: ativo ? '#F0FDF4' : '#F8FAFC',
                      borderBottom: ativo ? `1px solid ${BORDER}` : 'none',
                    }}
                  >
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flex: 1, minWidth: 200 }}
                      onClick={() => setGrupoAtivoId(ativo ? null : g.id)}
                    >
                      <div style={{ width: 30, height: 30, borderRadius: 7, background: ativo ? SUCCESS : '#EEF1F8', color: ativo ? '#fff' : SUBTEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                        {ativo ? '▾' : '▸'}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: ativo ? SUCCESS : TEXT }}>{g.nome}</p>
                          <span
                            style={{
                              fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                              background: ehCriador ? '#DCFCE7' : '#EEF2FF',
                              color: ehCriador ? '#166534' : PRIMARY,
                            }}
                          >
                            {ehCriador ? 'Você' : `Criado por ${g.createdByNome}`}
                          </span>
                        </div>
                        <p style={{ margin: '2px 0 0', fontSize: 11.5, color: SUBTEXT }}>
                          {g.amostras.length} amostra{g.amostras.length !== 1 ? 's' : ''}
                          {qtdFotos > 0 ? ` · ${qtdFotos} foto${qtdFotos !== 1 ? 's' : ''}` : ''}
                          {' · '}{formatarDataHora(g.updatedAt || g.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={() => setGrupoAtivoId(ativo ? null : g.id)}
                        style={{
                          padding: '6px 13px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                          background: ativo ? SUCCESS : '#EEF1F8',
                          color: ativo ? '#fff' : PRIMARY,
                        }}
                      >
                        {ativo ? 'Fechar' : ehCriador ? 'Abrir / Editar' : 'Visualizar'}
                      </button>
                      {ehCriador && (
                        <button
                          aria-label="Apagar obra"
                          disabled={salvandoEste}
                          onClick={() => apagarGrupoObra(g)}
                          style={{
                            width: 30, height: 30, borderRadius: 6, border: 'none',
                            cursor: salvandoEste ? 'wait' : 'pointer',
                            background: '#FFF0EE', color: DANGER,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Corpo expandido: mesma experiência de Dados de Campo */}
                  {ativo && (
                    <div style={{ padding: '14px' }}>
                      {!ehCriador && (
                        <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 6, background: '#EEF2FF', color: PRIMARY, fontSize: 12, fontWeight: 600 }}>
                          Modo somente visualização — esta obra foi criada por <strong>{g.createdByNome}</strong>. Você pode importar os dados na aba <strong>2. Dados de Campo</strong>.
                        </div>
                      )}
                      <ListaAmostrasPacometria
                        amostras={amostrasParaLista}
                        titulo={`Amostras — ${g.nome}`}
                        corBarra={SUCCESS}
                        somenteLeitura={!ehCriador}
                        salvando={salvandoEste}
                        uploadingFotoId={obraUploadingFotoId}
                        onNovaAmostra={() => {
                          setModalContexto({ tipo: 'obra', grupoId: g.id });
                          setAmostraEditando(null);
                          setModalAberto(true);
                        }}
                        onEditar={a => {
                          setModalContexto({ tipo: 'obra', grupoId: g.id });
                          setAmostraEditando(a);
                          setModalAberto(true);
                        }}
                        onApagar={id => apagarAmostraObra(g.id, id)}
                        onAnexarFoto={(id, file) => anexarFotoObra(g.id, id, file)}
                        onRemoverFoto={id => removerFotoObra(g.id, id)}
                      />
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

      </main>

      {/* Modal de amostra (Dados de Campo e Modo Obra) */}
      {modalAberto && (
        <ModalAmostra
          amostraInicial={amostraEditando}
          onSalvar={salvarAmostra}
          onFechar={() => { setModalAberto(false); setAmostraEditando(null); }}
          itemNum={
            modalContexto === 'campo'
              ? amostras.length + 1
              : (obraGrupos.find(g => g.id === modalContexto.grupoId)?.amostras.length ?? 0) + 1
          }
        />
      )}

      {/* Modal de importação do Modo Obra */}
      {showImportarObra && (
        <ModalImportarObra
          grupos={obraGrupos}
          currentUserId={userId}
          amostrasAtuaisCount={amostras.length}
          carregando={obraCarregando}
          erro={obraErro}
          onAtualizar={() => carregarGruposObra()}
          onImportar={importarGrupoObra}
          onFechar={() => setShowImportarObra(false)}
        />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}