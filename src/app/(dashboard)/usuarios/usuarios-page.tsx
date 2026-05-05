'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type User = {
  id: string;
  email: string;
  full_name: string;
  cargo: string;
  role: 'admin' | 'user';
  banned: boolean;
  created_at: string;
  last_sign_in_at: string | null;
};

type ModalMode = 'create' | 'edit' | null;

function getInitials(name: string, email: string): string {
  const src = name || email;
  const parts = src.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

const EMPTY_FORM = { full_name: '', email: '', cargo: '', userRole: 'user' as 'admin' | 'user', password: '' };

export default function UsuariosPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [currentUserId, setCurrentUserId] = useState('');

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/users');
    if (res.status === 403) { router.push('/dashboard'); return; }
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      if (user.user_metadata?.role !== 'admin') { router.push('/dashboard'); return; }
      setCurrentUserId(user.id);
      fetchUsers();
    });
  }, [router, fetchUsers]);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.cargo.toLowerCase().includes(q)
    );
  });

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError('');
    setSelectedUser(null);
    setModalMode('create');
  }

  function openEdit(u: User) {
    setForm({ full_name: u.full_name, email: u.email, cargo: u.cargo, userRole: u.role, password: '' });
    setFormError('');
    setSelectedUser(u);
    setModalMode('edit');
  }

  async function handleSubmit() {
    setFormError('');
    if (!form.email) { setFormError('E-mail é obrigatório.'); return; }
    if (modalMode === 'create' && !form.password) { setFormError('Senha é obrigatória.'); return; }

    setFormLoading(true);
    try {
      if (modalMode === 'create') {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) { setFormError(data.error); return; }
        showToast('Usuário criado com sucesso.');
      } else if (modalMode === 'edit' && selectedUser) {
        const res = await fetch(`/api/users/${selectedUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) { setFormError(data.error); return; }
        showToast('Usuário atualizado.');
      }
      setModalMode(null);
      fetchUsers();
    } finally {
      setFormLoading(false);
    }
  }

  async function handleToggleBan(u: User) {
    const action = u.banned ? 'unban' : 'ban';
    const res = await fetch(`/api/users/${u.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      showToast(u.banned ? 'Usuário reativado.' : 'Usuário desativado.');
      fetchUsers();
    }
  }

  async function handleDelete(u: User) {
    const res = await fetch(`/api/users/${u.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete' }),
    });
    if (res.ok) { showToast('Usuário excluído.'); fetchUsers(); }
    else { showToast('Erro ao excluir.', 'err'); }
    setConfirmDelete(null);
  }

  const inp: React.CSSProperties = {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.07)', color: '#fff',
    border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, padding: '10px 14px',
    fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ backgroundColor: '#1E3264', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', color: '#fff' }}>
      <style>{`
        .u-row:hover { background: rgba(255,255,255,0.05); }
        .u-btn:hover { opacity: 0.8; }
        .inp-focus:focus { box-shadow: 0 0 0 2px #C8A020; border-color: #C8A020; }
        .modal-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px; }
      `}</style>

      {/* HEADER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 56, padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.15)', position: 'sticky', top: 0, backgroundColor: '#1E3264', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>TECOMAT</span>
          <nav style={{ display: 'flex', gap: 24 }}>
            <a href="/dashboard" style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Ensaios</a>
            <a href="/usuarios" style={{ fontSize: 13, fontWeight: 600, color: '#fff', textDecoration: 'none', borderBottom: '2px solid #C8A020', paddingBottom: 2 }}>Usuários</a>
          </nav>
        </div>
        <a href="/dashboard" style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>← Voltar</a>
      </header>

      <main style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto' }}>
        {/* TOP BAR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Usuários</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', margin: '4px 0 0' }}>{users.length} cadastrado{users.length !== 1 ? 's' : ''}</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="inp-focus"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inp, width: 200 }}
            />
            <button
              onClick={openCreate}
              style={{ backgroundColor: '#C8A020', color: '#1E3264', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 8, padding: '10px 18px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
            >
              + Novo usuário
            </button>
          </div>
        </div>

        {/* TABLE */}
        {loading ? (
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', paddingTop: 60 }}>Carregando...</p>
        ) : filtered.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', paddingTop: 60 }}>Nenhum usuário encontrado.</p>
        ) : (
          <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)' }}>
            {/* thead */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 80px 90px 90px', gap: 0, backgroundColor: 'rgba(255,255,255,0.06)', padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              <span>Nome</span><span>E-mail</span><span>Cargo</span><span>Role</span><span>Criado</span><span style={{ textAlign: 'right' }}>Ações</span>
            </div>
            {/* rows */}
            {filtered.map((u) => (
              <div
                key={u.id}
                className="u-row"
                style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 80px 90px 90px', gap: 0, padding: '12px 16px', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', transition: 'background 0.15s', opacity: u.banned ? 0.5 : 1 }}
              >
                {/* nome */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: u.role === 'admin' ? '#C8A020' : 'rgba(255,255,255,0.15)', color: u.role === 'admin' ? '#1E3264' : '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {getInitials(u.full_name, u.email)}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{u.full_name || '—'}</p>
                    {u.banned && <span style={{ fontSize: 10, color: '#ffb4ab', fontWeight: 700 }}>DESATIVADO</span>}
                    {u.id === currentUserId && <span style={{ fontSize: 10, color: '#C8A020', fontWeight: 700 }}> VOCÊ</span>}
                  </div>
                </div>
                {/* email */}
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</span>
                {/* cargo */}
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{u.cargo || '—'}</span>
                {/* role badge */}
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, backgroundColor: u.role === 'admin' ? 'rgba(200,160,32,0.2)' : 'rgba(255,255,255,0.1)', color: u.role === 'admin' ? '#C8A020' : 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em', justifySelf: 'start' }}>
                  {u.role}
                </span>
                {/* criado */}
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{fmtDate(u.created_at)}</span>
                {/* ações */}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button className="u-btn" onClick={() => openEdit(u)} title="Editar" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', transition: 'opacity 0.15s' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  {u.id !== currentUserId && (
                    <>
                      <button className="u-btn" onClick={() => handleToggleBan(u)} title={u.banned ? 'Reativar' : 'Desativar'} style={{ background: u.banned ? 'rgba(100,200,100,0.15)' : 'rgba(255,180,0,0.15)', border: 'none', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: u.banned ? '#90ee90' : '#ffcc44', transition: 'opacity 0.15s' }}>
                        {u.banned
                          ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                        }
                      </button>
                      <button className="u-btn" onClick={() => setConfirmDelete(u)} title="Excluir" style={{ background: 'rgba(186,26,26,0.15)', border: 'none', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffb4ab', transition: 'opacity 0.15s' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL CRIAR / EDITAR */}
      {modalMode && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModalMode(null); }}>
          <div style={{ backgroundColor: '#1a2d5a', borderRadius: 16, padding: '32px 28px', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 24px' }}>{modalMode === 'create' ? 'Novo usuário' : 'Editar usuário'}</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Nome completo', key: 'full_name', type: 'text', placeholder: 'João da Silva' },
                { label: 'E-mail', key: 'email', type: 'email', placeholder: 'joao@tecomat.com.br' },
                { label: 'Cargo', key: 'cargo', type: 'text', placeholder: 'Engenheiro Civil' },
                ...(modalMode === 'create' ? [{ label: 'Senha', key: 'password', type: 'password', placeholder: '••••••••' }] : []),
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
                  <input
                    className="inp-focus"
                    type={type}
                    placeholder={placeholder}
                    value={(form as Record<string, string>)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    style={{ ...inp }}
                  />
                </div>
              ))}

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Permissão</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['user', 'admin'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setForm((f) => ({ ...f, userRole: r }))}
                      style={{ flex: 1, padding: '10px', borderRadius: 8, border: `1px solid ${form.userRole === r ? '#C8A020' : 'rgba(255,255,255,0.2)'}`, backgroundColor: form.userRole === r ? 'rgba(200,160,32,0.2)' : 'transparent', color: form.userRole === r ? '#C8A020' : 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize', transition: 'all 0.15s' }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {formError && <p style={{ fontSize: 13, color: '#ffb4ab', marginTop: 12, marginBottom: 0 }}>{formError}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setModalMode(null)} style={{ flex: 1, padding: '11px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
              <button onClick={handleSubmit} disabled={formLoading} style={{ flex: 2, padding: '11px', borderRadius: 8, border: 'none', backgroundColor: '#C8A020', color: '#1E3264', fontWeight: 800, fontSize: 14, cursor: formLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: formLoading ? 0.75 : 1 }}>
                {formLoading ? 'Salvando...' : modalMode === 'create' ? 'Criar usuário' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAÇÃO EXCLUSÃO */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setConfirmDelete(null); }}>
          <div style={{ backgroundColor: '#1a2d5a', borderRadius: 16, padding: '32px 28px', width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: 'rgba(186,26,26,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffb4ab" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 8px' }}>Excluir usuário?</h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '0 0 24px' }}>
              <strong style={{ color: '#fff' }}>{confirmDelete.full_name || confirmDelete.email}</strong> será removido permanentemente. Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: '11px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', backgroundColor: '#ba1a1a', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', backgroundColor: toast.type === 'ok' ? '#1a3a1a' : '#3a1a1a', border: `1px solid ${toast.type === 'ok' ? '#4caf50' : '#ba1a1a'}`, color: toast.type === 'ok' ? '#90ee90' : '#ffb4ab', padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600, zIndex: 200, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
