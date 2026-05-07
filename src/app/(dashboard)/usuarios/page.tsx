'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  cargo: string;
  role: 'admin' | 'user';
  banned: boolean;
  created_at: string;
};

type CurrentUser = {
  id: string;
  email: string;
  full_name: string;
  cargo: string;
  role: 'admin' | 'user';
};

type ModalMode = 'create' | 'edit' | 'self-edit' | null;

const PRIMARY  = '#1E3264';
const GOLD     = '#C8A020';
const DANGER   = '#C0392B';
const BG       = '#F8F9FA';
const BORDER   = '#E8EAF0';
const TEXT      = '#1A2340';
const SUBTEXT   = '#6B7490';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Badge({ role, banned }: { role: string; banned: boolean }) {
  if (banned)
    return (
      <span style={{
        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
        background: '#FFF0EE', color: DANGER, border: `1px solid #FADADD`,
      }}>
        Inativo
      </span>
    );
  if (role === 'admin')
    return (
      <span style={{
        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
        background: '#FDF8EC', color: '#8B6914', border: `1px solid #F0E0A0`,
      }}>
        Admin
      </span>
    );
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
      background: '#EEF1F8', color: '#4A5680', border: '1px solid #D4D9EA',
    }}>
      Usuário
    </span>
  );
}

// ── Modal ────────────────────────────────────────────────────────
function Modal({ mode, target, currentUser, onClose, onSuccess }: {
  mode: ModalMode; target: UserRow | null; currentUser: CurrentUser;
  onClose: () => void; onSuccess: () => void;
}) {
  const isCreate   = mode === 'create';
  const isSelfEdit = mode === 'self-edit';
  const isAdmin    = currentUser.role === 'admin';

  const [fullName, setFullName] = useState(target?.full_name ?? '');
  const [cargo,    setCargo]    = useState(target?.cargo ?? '');
  const [email,    setEmail]    = useState(target?.email ?? '');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState<'admin' | 'user'>(target?.role ?? 'user');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const overlayMouseDownRef = useRef(false);

  const title = isCreate ? 'Novo Usuário' : isSelfEdit ? 'Meu Perfil' : 'Editar Usuário';

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      if (isCreate) {
        if (!email || !password) throw new Error('E-mail e senha são obrigatórios.');
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, full_name: fullName, cargo, role }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
      } else {
        const body: Record<string, string> = { full_name: fullName, cargo, email };
        if (password) body.password = password;
        if (isAdmin && !isSelfEdit) body.role = role;

        const res = await fetch(`/api/users/${target!.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
      }
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', backgroundColor: '#F8F9FA', color: TEXT,
    border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px',
    fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color: SUBTEXT, marginBottom: 6,
    display: 'block', letterSpacing: '0.05em', textTransform: 'uppercase',
  };

  return (
    <div
      onMouseDown={(e) => { overlayMouseDownRef.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => { if (overlayMouseDownRef.current && e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(30,50,100,0.35)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: 20,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#fff',
          border: `1px solid ${BORDER}`,
          borderRadius: 16,
          padding: '32px 28px',
          width: '100%', maxWidth: 440,
          boxShadow: '0 20px 60px rgba(30,50,100,0.18)',
        }}
      >
        <style>{`.tm-input:focus{border-color:${PRIMARY}!important;background:#fff!important}.tm-input::placeholder{color:#BFC5D6}`}</style>

        {/* Modal header with gold accent */}
        <div style={{ borderLeft: `4px solid ${GOLD}`, paddingLeft: 12, marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: TEXT }}>{title}</h2>
        </div>

        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 20, right: 20,
            background: 'none', border: 'none',
            color: SUBTEXT, fontSize: 22, cursor: 'pointer', lineHeight: 1,
          }}
        >×</button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Nome Completo</label>
            <input className="tm-input" style={inputStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nome completo" />
          </div>
          <div>
            <label style={labelStyle}>E-mail</label>
            <input className="tm-input" style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@tecomat.com.br" />
          </div>
          <div>
            <label style={labelStyle}>{isCreate ? 'Senha' : 'Nova Senha'}</label>
            <input className="tm-input" style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isCreate ? 'Senha inicial' : 'Deixe em branco para não alterar'} />
          </div>
          <div>
            <label style={labelStyle}>Cargo / Função</label>
            <input className="tm-input" style={inputStyle} value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex: Engenheiro, Técnico…" />
          </div>
          {isAdmin && !isSelfEdit && (
            <div>
              <label style={labelStyle}>Nível de Acesso</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['user', 'admin'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    style={{
                      flex: 1, padding: '9px 0', borderRadius: 8,
                      fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all 0.15s',
                      backgroundColor: role === r ? PRIMARY : '#F0F2F8',
                      color: role === r ? '#fff' : SUBTEXT,
                      border: `2px solid ${role === r ? PRIMARY : 'transparent'}`,
                    }}
                  >
                    {r === 'admin' ? 'Administrador' : 'Usuário Comum'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <p style={{ fontSize: 13, color: DANGER, marginTop: 14, marginBottom: 0, padding: '8px 12px', background: '#FFF0EE', borderRadius: 6 }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 8,
              fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              background: '#F0F2F8', color: SUBTEXT, border: 'none',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              flex: 2, padding: '11px 0', borderRadius: 8,
              fontSize: 14, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              backgroundColor: PRIMARY, color: '#fff', border: 'none',
              opacity: loading ? 0.75 : 1, transition: 'opacity 0.15s',
            }}
          >
            {loading ? 'Salvando…' : isCreate ? 'Criar Usuário' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Dialog ───────────────────────────────────────────────
function ConfirmDialog({ message, confirmLabel, danger, onConfirm, onClose }: {
  message: string; confirmLabel: string; danger?: boolean;
  onConfirm: () => void; onClose: () => void;
}) {
  const overlayMouseDownRef = useRef(false);
  return (
    <div
      onMouseDown={(e) => { overlayMouseDownRef.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => { if (overlayMouseDownRef.current && e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(30,50,100,0.35)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 300, padding: 20,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#fff', border: `1px solid ${BORDER}`,
          borderRadius: 16, padding: '28px 24px',
          width: '100%', maxWidth: 360,
          boxShadow: '0 20px 60px rgba(30,50,100,0.18)',
        }}
      >
        <p style={{ margin: '0 0 20px', fontSize: 15, color: TEXT, lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8,
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              background: '#F0F2F8', color: SUBTEXT, border: 'none',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8,
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              backgroundColor: danger ? DANGER : PRIMARY, color: '#fff', border: 'none',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Header ───────────────────────────────────────────────────────
function Header({ displayName, initials, userCargo, onSignOut }: {
  displayName: string; initials: string; userCargo: string;
  onSignOut: () => void; isAdmin: boolean;
}) {
  return (
    <header style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      height: 60, padding: '0 28px',
      backgroundColor: PRIMARY,
      boxShadow: '0 2px 12px rgba(30,50,100,0.25)',
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      <style>{`.signout-btn-u:hover{background:rgba(255,255,255,0.12)!important}.nav-off-u:hover{color:#fff!important}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img
              src="/logo_tecomat.png"
              alt="TECOMAT Engenharia"
              style={{ height: 34, width: 'auto', objectFit: 'contain' }}
            />
          </a>
        <nav style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <a href="/dashboard" className="nav-off-u" style={{
            fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.65)',
            textDecoration: 'none', padding: '4px 10px', borderRadius: 6, transition: 'color 0.15s',
          }}>
            Ensaios
          </a>
          <a href="/usuarios" style={{
            fontSize: 13, fontWeight: 600, color: '#fff',
            textDecoration: 'none', padding: '4px 10px', borderRadius: 6,
            borderBottom: `2px solid ${GOLD}`, paddingBottom: 5,
          }}>
            Usuários
          </a>
        </nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            backgroundColor: GOLD, color: PRIMARY,
            fontSize: 12, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid rgba(255,255,255,0.25)',
          }}>{initials}</div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1, margin: 0 }}>{displayName}</p>
            {userCargo && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '2px 0 0' }}>{userCargo}</p>}
          </div>
        </div>
        <div style={{ width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.15)' }} />
        <button
          className="signout-btn-u"
          onClick={onSignOut}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 7,
            fontSize: 13, fontWeight: 600,
            color: 'rgba(255,255,255,0.7)',
            background: 'transparent', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'background 0.15s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sair
        </button>
      </div>
    </header>
  );
}

// ── Action Button ────────────────────────────────────────────────
function ActionBtn({ children, title, color, bg, onClick, disabled }: {
  children: React.ReactNode; title: string; color: string; bg?: string;
  onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={disabled ? undefined : onClick}
      style={{
        width: 30, height: 30, borderRadius: 7,
        border: `1px solid ${disabled ? '#E8EAF0' : bg ?? color + '30'}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: bg ?? (color + '12'),
        color: disabled ? '#C8CEDF' : color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'all 0.15s',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ backgroundColor: BG, borderRadius: 8, padding: '10px 14px', border: `1px solid ${BORDER}` }}>
      <p style={{ margin: 0, fontSize: 11, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 14, color: TEXT, fontWeight: 600 }}>{value}</p>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────
export default function UsuariosPage() {
  const [users,        setUsers]        = useState<UserRow[]>([]);
  const [currentUser,  setCurrentUser]  = useState<CurrentUser | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [modalMode,    setModalMode]    = useState<ModalMode>(null);
  const [modalTarget,  setModalTarget]  = useState<UserRow | null>(null);
  const [confirm,      setConfirm]      = useState<{ message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void } | null>(null);
  const router = useRouter();

  const loadCurrentUser = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return undefined; }
    const cu: CurrentUser = {
      id: user.id,
      email: user.email ?? '',
      full_name: user.user_metadata?.full_name ?? '',
      cargo: user.user_metadata?.cargo ?? '',
      role: user.user_metadata?.role ?? 'user',
    };
    setCurrentUser(cu);
    return cu;
  }, [router]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/users');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setUsers(json.users);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCurrentUser().then((cu) => {
      if (cu?.role === 'admin') loadUsers();
      else setLoading(false);
    });
  }, [loadCurrentUser, loadUsers]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleAction = async (action: string, userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: action === 'delete' ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        ...(action !== 'delete' && { body: JSON.stringify({ action }) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      loadUsers();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro.');
    }
  };

  const closeModal    = () => { setModalMode(null); setModalTarget(null); };
  const onModalSuccess = () => { loadUsers(); loadCurrentUser(); closeModal(); };

  const isAdmin    = currentUser?.role === 'admin';
  const adminCount = users.filter((u) => u.role === 'admin' && !u.banned).length;
  const initials   = currentUser?.full_name ? getInitials(currentUser.full_name) : (currentUser?.email?.slice(0, 2).toUpperCase() ?? '··');
  const displayName = currentUser?.full_name || currentUser?.email || '...';

  const selfRow = (): UserRow => ({
    id: currentUser!.id, email: currentUser!.email, full_name: currentUser!.full_name,
    cargo: currentUser!.cargo, role: currentUser!.role, banned: false, created_at: '',
  });

  // ── Non-admin view ──
  if (currentUser && !isAdmin) {
    return (
      <div style={{ backgroundColor: BG, minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');`}</style>
        {modalMode && currentUser && (
          <Modal mode={modalMode} target={modalTarget} currentUser={currentUser} onClose={closeModal} onSuccess={onModalSuccess} />
        )}
        <Header displayName={displayName} initials={initials} userCargo={currentUser.cargo} onSignOut={handleSignOut} isAdmin={false} />
        <main style={{ maxWidth: 520, margin: '48px auto', padding: '0 24px' }}>
          <div style={{ borderLeft: `4px solid ${GOLD}`, paddingLeft: 14, marginBottom: 28 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Conta</p>
            <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: TEXT }}>Meu Perfil</h1>
          </div>
          <div style={{ backgroundColor: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '24px 20px', boxShadow: '0 2px 8px rgba(30,50,100,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                backgroundColor: PRIMARY, color: '#fff',
                fontSize: 16, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{initials}</div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: TEXT, fontSize: 15 }}>{currentUser.full_name || '—'}</p>
                <p style={{ margin: 0, fontSize: 12, color: SUBTEXT }}>{currentUser.email}</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <InfoItem label="Cargo" value={currentUser.cargo || '—'} />
              <InfoItem label="Nível" value="Usuário" />
            </div>
            <button
              onClick={() => { setModalTarget(selfRow()); setModalMode('self-edit'); }}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 8,
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                backgroundColor: PRIMARY, color: '#fff', border: 'none',
              }}
            >
              Editar Meus Dados
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── Admin view ──
  return (
    <div style={{ backgroundColor: BG, minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        .usr-row:hover { background: #F4F6FC !important; }
        .action-btn:hover { filter: brightness(0.92); }
      `}</style>

      {modalMode && currentUser && (
        <Modal mode={modalMode} target={modalTarget} currentUser={currentUser} onClose={closeModal} onSuccess={onModalSuccess} />
      )}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}

      {currentUser && (
        <Header displayName={displayName} initials={initials} userCargo={currentUser.cargo} onSignOut={handleSignOut} isAdmin />
      )}

      <main style={{ padding: '32px 28px', maxWidth: 960, margin: '0 auto' }}>
        {/* Page header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <div style={{ borderLeft: `4px solid ${GOLD}`, paddingLeft: 14 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Gerenciamento
              </p>
              <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: TEXT }}>
                Usuários
              </h1>
            </div>
            <p style={{ margin: '8px 0 0 18px', fontSize: 13, color: SUBTEXT }}>
              {users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}
            </p>
          </div>

          <button
            onClick={() => { setModalTarget(null); setModalMode('create'); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 8,
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              backgroundColor: PRIMARY, color: '#fff', border: 'none',
              boxShadow: '0 2px 8px rgba(30,50,100,0.2)',
              transition: 'box-shadow 0.15s',
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
            Novo Usuário
          </button>
        </div>

        {loading && (
          <p style={{ color: SUBTEXT, textAlign: 'center', marginTop: 60 }}>Carregando…</p>
        )}
        {error && (
          <p style={{ color: DANGER, textAlign: 'center', marginTop: 60, padding: '12px 20px', background: '#FFF0EE', borderRadius: 8 }}>
            {error}
          </p>
        )}

        {!loading && !error && (
          <div style={{
            backgroundColor: '#fff',
            border: `1px solid ${BORDER}`,
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(30,50,100,0.06)',
          }}>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 140px 110px 110px',
              padding: '12px 20px',
              borderBottom: `2px solid ${BORDER}`,
              backgroundColor: '#F8F9FA',
            }}>
              {['Nome', 'E-mail', 'Cargo', 'Nível', 'Ações'].map((h) => (
                <span key={h} style={{
                  fontSize: 11, fontWeight: 700,
                  color: PRIMARY,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                  {h}
                </span>
              ))}
            </div>

            {users.length === 0 && (
              <p style={{
                textAlign: 'center', color: SUBTEXT,
                padding: '48px 0', margin: 0, fontSize: 14,
              }}>
                Nenhum usuário encontrado.
              </p>
            )}

            {users.map((u, idx) => {
              const isLastAdmin = u.role === 'admin' && !u.banned && adminCount <= 1;
              const isSelf      = u.id === currentUser?.id;
              return (
                <div
                  key={u.id}
                  className="usr-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 140px 110px 110px',
                    padding: '14px 20px',
                    borderBottom: idx < users.length - 1 ? `1px solid ${BORDER}` : 'none',
                    alignItems: 'center',
                    transition: 'background 0.15s',
                    opacity: u.banned ? 0.65 : 1,
                    background: '#fff',
                  }}
                >
                  {/* Name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      backgroundColor: isSelf ? GOLD : PRIMARY,
                      color: isSelf ? PRIMARY : '#fff',
                      fontSize: 11, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {u.full_name ? getInitials(u.full_name) : u.email.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>
                        {u.full_name || '—'}
                      </span>
                      {isSelf && (
                        <span style={{
                          marginLeft: 6, fontSize: 10, fontWeight: 700,
                          color: GOLD, background: '#FDF8EC',
                          padding: '1px 6px', borderRadius: 10,
                          border: '1px solid #F0E0A0',
                        }}>
                          você
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Email */}
                  <span style={{
                    fontSize: 12, color: SUBTEXT,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {u.email}
                  </span>

                  {/* Cargo */}
                  <span style={{ fontSize: 12, color: SUBTEXT }}>{u.cargo || '—'}</span>

                  {/* Badge */}
                  <Badge role={u.role} banned={u.banned} />

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <ActionBtn
                      title="Editar"
                      color={PRIMARY}
                      onClick={() => { setModalTarget(u); setModalMode('edit'); }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </ActionBtn>

                    {!isSelf && (
                      u.banned
                        ? (
                          <ActionBtn
                            title="Reativar"
                            color="#1A7A44"
                            onClick={() => setConfirm({
                              message: `Reativar "${u.full_name || u.email}"?`,
                              confirmLabel: 'Reativar',
                              onConfirm: () => handleAction('unban', u.id),
                            })}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9 12l2 2 4-4"/>
                              <circle cx="12" cy="12" r="10"/>
                            </svg>
                          </ActionBtn>
                        ) : (
                          <ActionBtn
                            title={isLastAdmin ? 'Último admin — não pode desativar' : 'Desativar'}
                            color="#B06A00"
                            disabled={isLastAdmin}
                            onClick={() => setConfirm({
                              message: `Desativar "${u.full_name || u.email}"? O acesso será bloqueado.`,
                              confirmLabel: 'Desativar',
                              danger: true,
                              onConfirm: () => handleAction('ban', u.id),
                            })}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/>
                              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                            </svg>
                          </ActionBtn>
                        )
                    )}

                    {!isSelf && (
                      <ActionBtn
                        title={isLastAdmin ? 'Último admin — não pode excluir' : 'Excluir'}
                        color={DANGER}
                        disabled={isLastAdmin}
                        onClick={() => setConfirm({
                          message: `Excluir permanentemente "${u.full_name || u.email}"? Esta ação não pode ser desfeita.`,
                          confirmLabel: 'Excluir',
                          danger: true,
                          onConfirm: () => handleAction('delete', u.id),
                        })}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14H6L5 6"/>
                          <path d="M10 11v6"/>
                          <path d="M14 11v6"/>
                          <path d="M9 6V4h6v2"/>
                        </svg>
                      </ActionBtn>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}