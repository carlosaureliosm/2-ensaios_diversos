'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/userStore';

const PRIMARY = '#1E3264';
const GOLD    = '#C8A020';

export default function Header({ paginaAtiva }: { paginaAtiva?: 'ensaios' | 'usuarios' }) {
  const router = useRouter();
  const { userName, userCargo, initials, loaded, fetchUser } = useUserStore();

  useEffect(() => {
    if (!loaded) fetchUser();
  }, [loaded, fetchUser]);

  const handleSignOut = async () => {
    const sb = createClient();
    await sb.auth.signOut();
    router.push('/login');
  };

  return (
    <header className="header-root" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 60, padding: '0 28px', backgroundColor: PRIMARY, boxShadow: '0 2px 12px rgba(30,50,100,0.25)', position: 'sticky', top: 0, zIndex: 50 }}>
      <style>{`.sb-u:hover{background:rgba(255,255,255,0.12)!important}.nv-u:hover{color:#fff!important}`}</style>
      <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: 32, flexShrink: 1, overflow: 'hidden' }}>
        <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src="/logo_tecomat.png" alt="TECOMAT" style={{ height: 34, objectFit: 'contain' }} />
        </a>
        <nav style={{ display: 'flex', gap: 6 }}>
          <a href="/dashboard" className="nv-u" style={{ fontSize: 13, fontWeight: 600, color: paginaAtiva === 'ensaios' ? '#fff' : 'rgba(255,255,255,0.65)', textDecoration: 'none', padding: '4px 10px', borderRadius: 6, borderBottom: paginaAtiva === 'ensaios' ? `2px solid ${GOLD}` : 'none', transition: 'color 0.15s' }}>Ensaios</a>
          <a href="/usuarios" className="nv-u" style={{ fontSize: 13, fontWeight: 600, color: paginaAtiva === 'usuarios' ? '#fff' : 'rgba(255,255,255,0.65)', textDecoration: 'none', padding: '4px 10px', borderRadius: 6, borderBottom: paginaAtiva === 'usuarios' ? `2px solid ${GOLD}` : 'none', transition: 'color 0.15s' }}>Usuários</a>
        </nav>
      </div>
      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: GOLD, color: PRIMARY, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.25)', flexShrink: 0 }}>{initials}</div>
          <div>
            <p className="header-user-name" style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: 0 }}>{userName}</p>
            {userCargo && <p className="header-cargo" style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '2px 0 0' }}>{userCargo}</p>}
          </div>
        </div>
        <div className="header-divider" style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.15)' }} />
        <button onClick={handleSignOut} className="sb-u" aria-label="Sair" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)', cursor: 'pointer', padding: '6px 8px', borderRadius: 6, fontFamily: 'inherit', transition: 'background 0.15s' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span className="signout-text">Sair</span>
        </button>
      </div>
    </header>
  );
}
