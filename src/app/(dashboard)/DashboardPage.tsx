'use client';

import { useState } from 'react';

type Ensaio = { id: string; label: string; href: string };

const ENSAIOS: Ensaio[] = [
  { id: 'esclerometria',  label: 'Esclerometria',            href: '/ensaios/esclerometria' },
  { id: 'pacometria',     label: 'Pacometria',               href: '/ensaios/pacometria' },
  { id: 'resistividade',  label: 'Resistividade do Concreto',href: '/ensaios/resistividade' },
  { id: 'potencial',      label: 'Potencial de Corrosão',    href: '/ensaios/potencial-corrosao' },
  { id: 'carbonatacao',   label: 'Carbonatação',             href: '/ensaios/carbonatacao' },
  { id: 'ultrassom',      label: 'Ultrassom',                href: '/ensaios/ultrassom' },
];

export default function DashboardPage() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  return (
    <div style={{ backgroundColor: '#1E3264', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        .profile-btn:hover { background: rgba(255,255,255,0.1); }
        .nav-link-off:hover { color: rgba(255,255,255,0.9); }
        .dd-item:hover { background: rgba(255,255,255,0.1); }
        .dd-item-danger:hover { background: rgba(186,26,26,0.25); }
        .fab:hover { background: #b08c18 !important; }
      `}</style>

      {/* Navbar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 56, padding: '0 20px', backgroundColor: '#1E3264', borderBottom: '1px solid rgba(255,255,255,0.15)', position: 'sticky', top: 0, zIndex: 50 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff', textTransform: 'uppercase' }}>TECOMAT</span>
          <nav style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <a href="/dashboard" style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', textDecoration: 'none', borderBottom: '2px solid #C8A020', paddingBottom: 2 }}>Ensaios</a>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <a href="/usuarios" className="nav-link-off" style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', transition: 'color 0.15s' }}>Usuários</a>
              <span style={{ fontSize: 10, backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Admin</span>
            </span>
          </nav>
        </div>

        {/* Perfil */}
        <div style={{ position: 'relative' }}>
          <button
            className="profile-btn"
            onClick={() => setDropdownOpen((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 99, padding: '5px 5px 5px 10px', transition: 'background 0.15s' }}
          >
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', lineHeight: 1, margin: 0 }}>Engª. Maria Silva</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', margin: '2px 0 0' }}>Responsável Técnica</p>
            </div>
            <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: '#C8A020', color: '#1E3264', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.3)' }}>
              MS
            </div>
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', width: 210, backgroundColor: '#1E3264', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', padding: '6px 0', zIndex: 50 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', margin: 0 }}>Engª. Maria Silva</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: '2px 0 0' }}>maria.silva@tecomat.com.br</p>
              </div>
              <button className="dd-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: 13, color: 'rgba(255,255,255,0.85)', background: 'transparent', border: 'none', width: '100%', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', transition: 'background 0.15s' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                Meu Perfil
              </button>
              <button className="dd-item-danger" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: 13, color: '#ffb4ab', background: 'transparent', border: 'none', width: '100%', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', transition: 'background 0.15s' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffb4ab" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Sair
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Grid de ensaios */}
      <main style={{ padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {ENSAIOS.map((ensaio) => (
            <a
              key={ensaio.id}
              href={ensaio.href}
              onMouseEnter={() => setHoveredCard(ensaio.id)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: 88, textDecoration: 'none', textAlign: 'center', padding: 10,
                borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)',
                backgroundColor: hoveredCard === ensaio.id ? '#C8A020' : 'rgba(255,255,255,0.08)',
                borderColor: hoveredCard === ensaio.id ? '#C8A020' : 'rgba(255,255,255,0.2)',
                transition: 'background 0.15s, border-color 0.15s',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: hoveredCard === ensaio.id ? '#1E3264' : '#ffffff', lineHeight: 1.3, transition: 'color 0.15s' }}>
                {ensaio.label}
              </span>
            </a>
          ))}
        </div>
      </main>

      {/* FAB */}
      <button
        className="fab"
        title="Novo ensaio"
        style={{ position: 'fixed', bottom: 20, right: 20, width: 52, height: 52, borderRadius: '50%', backgroundColor: '#C8A020', color: '#1E3264', fontSize: 28, fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s', fontFamily: 'inherit' }}
      >
        +
      </button>
    </div>
  );
}
