'use client';

import { useState } from 'react';
import Header from '@/components/Header';

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

export default function DashboardPage() {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  return (
    <div style={{ backgroundColor: '#F8F9FA', minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');

        * { box-sizing: border-box; }

        .nav-link-off { color: rgba(255,255,255,0.65) !important; transition: color 0.15s; }
        .nav-link-off:hover { color: #fff !important; }
        .nav-link-active { color: #fff; border-bottom: 2px solid #C8A020; padding-bottom: 3px; }

        .signout-btn:hover { background: rgba(255,255,255,0.12) !important; }

        /* ── Sem scroll horizontal ── */
        html, body { overflow-x: hidden; max-width: 100vw; }

        /* ── Mobile header ── */
        @media (max-width: 600px) {
          .header-root { padding: 0 12px !important; flex-wrap: nowrap !important; }
          .header-left { gap: 10px !important; flex-shrink: 1; min-width: 0; overflow: hidden; }
          .header-right { gap: 4px !important; flex-shrink: 0; }
          .header-user-name { max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .header-cargo { display: none !important; }
          .header-divider { display: none !important; }
          .signout-text { display: none; }
          .signout-btn { padding: 6px 8px !important; }
          .main-pad { padding: 20px 14px !important; }
        }

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

      <Header paginaAtiva="ensaios" />

      {/* Main */}
      <main className="main-pad" style={{ padding: '32px 28px', maxWidth: 960, margin: '0 auto' }}>
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