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

const PRIMARY = '#1E3264';
const GOLD = '#C8A020';
const DANGER = '#ba1a1a';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Badge({ role, banned }: { role: string; banned: boolean }) {
  if (banned)
    return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(186,26,26,0.18)', color: '#ffb4ab', border: '1px solid rgba(186,26,26,0.35)' }}>Inativo</span>;
  if (role === 'admin')
    return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(200,160,32,0.18)', color: GOLD, border: `1px solid rgba(200,160,32,0.4)` }}>Admin</span>;
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.2)' }}>Usuário</span>;
}

// ── Modal ────────────────────────────────────────────────────────
function Modal({ mode, target, currentUser, onClose, onSuccess }: {
  mode: ModalMode; target: UserRow | null; currentUser: CurrentUser;
  onClose: () => void; onSuccess: () => void;
}) {
  const isCreate = mode === 'create';
  const isSelfEdit = mode === 'self-edit';
  const isAdmin = currentUser.role === 'admin';

  const [fullName, setFullName] = useState(target?.full_name ?? '');
  const [cargo, setCargo] = useState(target?.cargo ?? '');
  const [email, setEmail] = useState(target?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>(target?.role ?? 'user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fix: fechar modal apenas se mousedown iniciou no overlay (não ao arrastar para fora)
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
        // Sempre envia todos os campos — não apenas os alterados
        const body: Record<string, string> = {
          full_name: fullName,
          cargo,
          email,
        };
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
    width: '100%', backgroundColor: 'rgba(255,255,255,0.07)', color: '#fff',
    border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '10px 14px',
    fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.65)', marginBottom: 6,
    display: 'block', letterSpacing: '0.05em', textTransform: 'uppercase',
  };

  return (
    <div
      onMouseDown={(e) => { overlayMouseDownRef.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => { if (overlayMouseDownRef.current && e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{ backgroundColor: PRIMARY, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: '32px 28px', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
      >
        <style>{`.tm-input:focus{border-color:${GOLD}!important}.tm-input::placeholder{color:rgba(255,255,255,0.3)}`}</style>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

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
                  <button key={r} onClick={() => setRole(r)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', backgroundColor: role === r ? GOLD : 'rgba(255,255,255,0.07)', color: role === r ? PRIMARY : 'rgba(255,255,255,0.7)', border: `1px solid ${role === r ? GOLD : 'rgba(255,255,255,0.2)'}` }}>
                    {r === 'admin' ? 'Administrador' : 'Usuário Comum'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && <p style={{ fontSize: 13, color: '#ffb4ab', marginTop: 14, marginBottom: 0 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)' }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={loading} style={{ flex: 2, padding: '11px 0', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', backgroundColor: GOLD, color: PRIMARY, border: 'none', opacity: loading ? 0.75 : 1, transition: 'opacity 0.15s' }}>
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
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}
    >
      <div onMouseDown={(e) => e.stopPropagation()} style={{ backgroundColor: PRIMARY, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: '28px 24px', width: '100%', maxWidth: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        <p style={{ margin: '0 0 20px', fontSize: 15, color: '#fff', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)' }}>Cancelar</button>
          <button onClick={() => { onConfirm(); onClose(); }} style={{ flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', backgroundColor: danger ? DANGER : GOLD, color: '#fff', border: 'none' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── Header ───────────────────────────────────────────────────────
function Header({ displayName, initials, userCargo, onSignOut, isAdmin }: {
  displayName: string; initials: string; userCargo: string;
  onSignOut: () => void; isAdmin: boolean;
}) {
  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 56, padding: '0 20px', backgroundColor: PRIMARY, borderBottom: '1px solid rgba(255,255,255,0.15)', position: 'sticky', top: 0, zIndex: 50 }}>
      <style>{`.signout-btn-u:hover{background:rgba(186,26,26,0.2)!important;color:#ffb4ab!important}.nav-off-u:hover{color:rgba(255,255,255,0.9)!important}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <a href="/dashboard" style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-0.02em', color: '#fff', textDecoration: 'none', textTransform: 'uppercase' }}>TECOMAT</a>
        <nav style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <a href="/dashboard" className="nav-off-u" style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', transition: 'color 0.15s' }}>Ensaios</a>
          <a href="/usuarios" style={{ fontSize: 13, fontWeight: 600, color: '#fff', textDecoration: 'none', borderBottom: '2px solid #C8A020', paddingBottom: 2 }}>Usuários</a>
        </nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: GOLD, color: PRIMARY, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0 }}>{initials}</div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1, margin: 0 }}>{displayName}</p>
            {userCargo && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', margin: '2px 0 0' }}>{userCargo}</p>}
          </div>
        </div>
        <div style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.15)' }} />
        <button className="signout-btn-u" onClick={onSignOut} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.65)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s, color 0.15s' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sair
        </button>
      </div>
    </header>
  );
}

// ── ActionBtn ────────────────────────────────────────────────────
function ActionBtn({ children, title, color, onClick, disabled }: {
  children: React.ReactNode; title: string; color: string;
  onClick: () => void; disabled?: boolean;
}) {
  return (
    <button title={title} onClick={disabled ? undefined : onClick} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', backgroundColor: `${color}22`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'opacity 0.15s', opacity: disabled ? 0.35 : 1 }}>
      {children}
    </button>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px' }}>
      <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 14, color: '#fff', fontWeight: 600 }}>{value}</p>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────
export default function UsuariosPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [modalTarget, setModalTarget] = useState<UserRow | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void } | null>(null);
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

  const closeModal = () => { setModalMode(null); setModalTarget(null); };
  const onModalSuccess = () => { loadUsers(); loadCurrentUser(); closeModal(); };

  const isAdmin = currentUser?.role === 'admin';
  const adminCount = users.filter((u) => u.role === 'admin' && !u.banned).length;
  const initials = currentUser?.full_name ? getInitials(currentUser.full_name) : (currentUser?.email?.slice(0, 2).toUpperCase() ?? '··');
  const displayName = currentUser?.full_name || currentUser?.email || '...';

  const selfRow = (): UserRow => ({
    id: currentUser!.id, email: currentUser!.email, full_name: currentUser!.full_name,
    cargo: currentUser!.cargo, role: currentUser!.role, banned: false, created_at: '',
  });

  // ── Usuário comum ──
  if (currentUser && !isAdmin) {
    return (
      <div style={{ backgroundColor: PRIMARY, minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
        {modalMode && currentUser && (
          <Modal mode={modalMode} target={modalTarget} currentUser={currentUser} onClose={closeModal} onSuccess={onModalSuccess} />
        )}
        <Header displayName={displayName} initials={initials} userCargo={currentUser.cargo} onSignOut={handleSignOut} isAdmin={false} />
        <main style={{ maxWidth: 500, margin: '48px auto', padding: '0 20px' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 24 }}>Meu Perfil</h1>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '24px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: GOLD, color: PRIMARY, fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials}</div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: '#fff', fontSize: 15 }}>{currentUser.full_name || '—'}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{currentUser.email}</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <InfoItem label="Cargo" value={currentUser.cargo || '—'} />
              <InfoItem label="Nível" value="Usuário" />
            </div>
            <button onClick={() => { setModalTarget(selfRow()); setModalMode('self-edit'); }} style={{ width: '100%', padding: '11px 0', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', backgroundColor: GOLD, color: PRIMARY, border: 'none' }}>
              Editar Meus Dados
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── Admin ──
  return (
    <div style={{ backgroundColor: PRIMARY, minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`.usr-row:hover{background:rgba(255,255,255,0.05)!important}`}</style>

      {modalMode && currentUser && (
        <Modal mode={modalMode} target={modalTarget} currentUser={currentUser} onClose={closeModal} onSuccess={onModalSuccess} />
      )}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}

      {currentUser && (
        <Header displayName={displayName} initials={initials} userCargo={currentUser.cargo} onSignOut={handleSignOut} isAdmin />
      )}

      <main style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#fff' }}>Usuários</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{users.length} cadastrado{users.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => { setModalTarget(null); setModalMode('create'); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', backgroundColor: GOLD, color: PRIMARY, border: 'none' }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Novo Usuário
          </button>
        </div>

        {loading && <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 40 }}>Carregando…</p>}
        {error && <p style={{ color: '#ffb4ab', textAlign: 'center', marginTop: 40 }}>{error}</p>}

        {!loading && !error && (
          <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 130px 100px 100px', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              {['Nome', 'E-mail', 'Cargo', 'Nível', 'Ações'].map((h) => (
                <span key={h} style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
              ))}
            </div>

            {users.length === 0 && (
              <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', padding: '32px 0', margin: 0 }}>Nenhum usuário encontrado.</p>
            )}

            {users.map((u) => {
              const isLastAdmin = u.role === 'admin' && !u.banned && adminCount <= 1;
              const isSelf = u.id === currentUser?.id;
              return (
                <div key={u.id} className="usr-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 130px 100px 100px', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', alignItems: 'center', transition: 'background 0.15s', opacity: u.banned ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', backgroundColor: isSelf ? GOLD : 'rgba(255,255,255,0.12)', color: isSelf ? PRIMARY : '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {u.full_name ? getInitials(u.full_name) : u.email.slice(0, 2).toUpperCase()}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{u.full_name || '—'}</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{u.cargo || '—'}</span>
                  <Badge role={u.role} banned={u.banned} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <ActionBtn title="Editar" color={GOLD} onClick={() => { setModalTarget(u); setModalMode('edit'); }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </ActionBtn>

                    {!isSelf && (
                      u.banned
                        ? <ActionBtn title="Reativar" color="#4caf50" onClick={() => setConfirm({ message: `Reativar "${u.full_name || u.email}"?`, confirmLabel: 'Reativar', onConfirm: () => handleAction('unban', u.id) })}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
                          </ActionBtn>
                        : <ActionBtn title={isLastAdmin ? 'Último admin — não pode desativar' : 'Desativar'} color="#f59e0b" disabled={isLastAdmin} onClick={() => setConfirm({ message: `Desativar "${u.full_name || u.email}"? O acesso será bloqueado.`, confirmLabel: 'Desativar', danger: true, onConfirm: () => handleAction('ban', u.id) })}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                          </ActionBtn>
                    )}

                    {!isSelf && (
                      <ActionBtn title={isLastAdmin ? 'Último admin — não pode excluir' : 'Excluir'} color={DANGER} disabled={isLastAdmin} onClick={() => setConfirm({ message: `Excluir permanentemente "${u.full_name || u.email}"? Esta ação não pode ser desfeita.`, confirmLabel: 'Excluir', danger: true, onConfirm: () => handleAction('delete', u.id) })}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
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
