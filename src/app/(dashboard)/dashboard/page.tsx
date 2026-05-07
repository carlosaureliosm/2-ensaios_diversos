'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Ensaio = { id: string; label: string; href: string; icon: string };

const ENSAIOS: Ensaio[] = [
  { id: 'esclerometria', label: 'Esclerometria',             href: '/ensaios/esclerometria',      icon: '⬡' },
  { id: 'pacometria',    label: 'Pacometria',                href: '/ensaios/pacometria',          icon: '⊕' },
  { id: 'resistividade', label: 'Resistividade do Concreto', href: '/ensaios/resistividade',       icon: '∿' },
  { id: 'potencial',     label: 'Potencial de Corrosão',     href: '/ensaios/potencial-corrosao',  icon: '⚡' },
  { id: 'carbonatacao',  label: 'Carbonatação',              href: '/ensaios/carbonatacao',        icon: '◈' },
  { id: 'ultrassom',     label: 'Ultrassom',                 href: '/ensaios/ultrassom',           icon: '◎' },
  { id: 'aderencia',     label: 'Aderência',                 href: '/ensaios/aderencia',           icon: '⬢' },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function DashboardPage() {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userCargo, setUserCargo] = useState('');
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserEmail(user.email ?? '');
      const meta = user.user_metadata ?? {};
      setUserName(meta.full_name ?? meta.name ?? user.email ?? '');
      setUserCargo(meta.cargo ?? '');
    });
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const initials = userName ? getInitials(userName) : '··';
  const displayName = userName || userEmail;

  return (
    <div style={{ backgroundColor: '#F8F9FA', minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');

        * { box-sizing: border-box; }

        .nav-link-off { color: rgba(255,255,255,0.65) !important; transition: color 0.15s; }
        .nav-link-off:hover { color: #fff !important; }
        .nav-link-active { color: #fff; border-bottom: 2px solid #C8A020; padding-bottom: 3px; }

        .signout-btn:hover { background: rgba(255,255,255,0.12) !important; }

        .ensaio-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: space-between;
          padding: 20px;
          border-radius: 12px;
          background: #fff;
          border: 1px solid #E8EAF0;
          box-shadow: 0 1px 3px rgba(30,50,100,0.06);
          text-decoration: none;
          cursor: pointer;
          transition: all 0.2s ease;
          min-height: 110px;
        }
        .ensaio-card:hover {
          border-color: #1E3264;
          box-shadow: 0 4px 16px rgba(30,50,100,0.14);
          transform: translateY(-2px);
        }
        .ensaio-card:hover .card-icon {
          color: #C8A020 !important;
        }
        .ensaio-card:hover .card-label {
          color: #1E3264 !important;
        }
        .ensaio-card:hover .card-arrow {
          opacity: 1 !important;
          transform: translateX(3px);
        }

        .fab:hover { background: #b08c18 !important; box-shadow: 0 6px 20px rgba(200,160,32,0.45) !important; }

        .page-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #9098B0;
          margin: 0 0 16px;
        }
      `}</style>

      {/* Header */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        height: 60, padding: '0 28px',
        backgroundColor: '#1E3264',
        boxShadow: '0 2px 12px rgba(30,50,100,0.25)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img
              src="/logo_tecomat.png"
              alt="TECOMAT Engenharia"
              style={{ height: 34, width: 'auto', objectFit: 'contain' }}
            />
          </a>
          <nav style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <a href="/dashboard" className="nav-link-active" style={{
              fontSize: 13, fontWeight: 600, textDecoration: 'none',
              padding: '4px 10px', borderRadius: 6,
              color: '#fff', borderBottom: '2px solid #C8A020',
            }}>
              Ensaios
            </a>
            <a href="/usuarios" className="nav-link-off" style={{
              fontSize: 13, fontWeight: 500, textDecoration: 'none',
              padding: '4px 10px', borderRadius: 6,
            }}>
              Usuários
            </a>
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              backgroundColor: '#C8A020', color: '#1E3264',
              fontSize: 12, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid rgba(255,255,255,0.25)',
            }}>{initials}</div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1, margin: 0 }}>
                {displayName || '...'}
              </p>
              {userCargo && (
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '2px 0 0' }}>
                  {userCargo}
                </p>
              )}
            </div>
          </div>

          <div style={{ width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.15)' }} />

          <button
            className="signout-btn"
            onClick={handleSignOut}
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

      {/* Main */}
      <main style={{ padding: '32px 28px', maxWidth: 960, margin: '0 auto' }}>
        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <p className="page-title">Módulos</p>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1E3264', letterSpacing: '-0.02em' }}>
              Ensaios Disponíveis
            </h1>
          </div>
          <div style={{
            fontSize: 12, fontWeight: 600, color: '#9098B0',
            background: '#fff', border: '1px solid #E8EAF0',
            padding: '6px 12px', borderRadius: 20,
          }}>
            {ENSAIOS.length} módulos
          </div>
        </div>

        {/* Gold accent line */}
        <div style={{ height: 3, width: 40, background: '#C8A020', borderRadius: 2, marginBottom: 28 }} />

        {/* Cards grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 14,
        }}>
          {ENSAIOS.map((ensaio) => (
            <a
              key={ensaio.id}
              href={ensaio.href}
              className="ensaio-card"
              onMouseEnter={() => setHoveredCard(ensaio.id)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <span
                className="card-icon"
                style={{ fontSize: 22, color: '#CBD2E0', transition: 'color 0.2s', lineHeight: 1, marginBottom: 12 }}
              >
                {ensaio.icon}
              </span>
              <div style={{ width: '100%' }}>
                <span
                  className="card-label"
                  style={{ fontSize: 14, fontWeight: 700, color: '#2C3A5C', lineHeight: 1.3, display: 'block' }}
                >
                  {ensaio.label}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: 10, gap: 4 }}>
                  <span style={{ fontSize: 11, color: '#C8A020', fontWeight: 700, letterSpacing: '0.05em' }}>
                    ACESSAR
                  </span>
                  <span
                    className="card-arrow"
                    style={{ fontSize: 11, color: '#C8A020', opacity: 0, transition: 'opacity 0.2s, transform 0.2s' }}
                  >
                    →
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </main>

      {/* FAB */}
      <button
        className="fab"
        title="Novo ensaio"
        style={{
          position: 'fixed', bottom: 24, right: 24,
          width: 52, height: 52, borderRadius: '50%',
          backgroundColor: '#C8A020', color: '#1E3264',
          fontSize: 28, fontWeight: 700,
          border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(200,160,32,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s, box-shadow 0.15s',
          fontFamily: 'inherit',
        }}
      >
        +
      </button>
    </div>
  );
}