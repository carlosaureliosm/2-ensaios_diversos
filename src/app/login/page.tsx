'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push('/dashboard');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao entrar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      backgroundColor: '#0F1E48',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        /* Background geometric pattern */
        .bg-pattern {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(200,160,32,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(200,160,32,0.06) 1px, transparent 1px);
          background-size: 48px 48px;
        }

        /* Gradient overlay */
        .bg-overlay {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 30% 50%, rgba(30,50,100,0.6) 0%, transparent 70%),
                      radial-gradient(ellipse at 80% 20%, rgba(200,160,32,0.08) 0%, transparent 50%);
        }

        /* Blueprint circles decoration */
        .blueprint-circle {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(200,160,32,0.12);
        }

        .login-input {
          width: 100%;
          padding: 12px 16px;
          border-radius: 8px;
          border: 1.5px solid #D8DCE8;
          background: #F8F9FA;
          color: #1A2340;
          font-size: 15px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .login-input:focus {
          border-color: #1E3264;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(30,50,100,0.08);
        }
        .login-input::placeholder {
          color: #A8AEBF;
        }

        .login-btn {
          width: 100%;
          padding: 13px;
          border-radius: 8px;
          border: none;
          background: #1E3264;
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
          position: relative;
          overflow: hidden;
        }
        .login-btn:hover:not(:disabled) {
          background: #162650;
          box-shadow: 0 4px 16px rgba(30,50,100,0.35);
        }
        .login-btn:active:not(:disabled) {
          transform: scale(0.99);
        }
        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        /* Gold shimmer on button */
        .login-btn::after {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 60%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(200,160,32,0.15), transparent);
          transform: skewX(-20deg);
          transition: left 0.5s;
        }
        .login-btn:hover::after {
          left: 150%;
        }
      `}</style>

      {/* Left panel — brand / decoration */}
      <div style={{
        flex: '0 0 55%',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 64px',
      }}>
        {/* Dark blue base + pattern */}
        <div className="bg-pattern" />
        <div className="bg-overlay" />

        {/* Decorative circles */}
        <div className="blueprint-circle" style={{ width: 500, height: 500, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
        <div className="blueprint-circle" style={{ width: 340, height: 340, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
        <div className="blueprint-circle" style={{ width: 180, height: 180, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />

        {/* Crosshair center */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 40, height: 40,
          zIndex: 1,
        }}>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(200,160,32,0.35)' }} />
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(200,160,32,0.35)' }} />
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 6, height: 6, borderRadius: '50%', background: '#C8A020' }} />
        </div>

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          {/* Logo */}
          <div style={{ marginBottom: 48 }}>
            <img
              src="/logo_tecomat.png"
              alt="TECOMAT Engenharia"
              style={{ height: 96, width: 'auto', objectFit: 'contain', display: 'block', marginBottom: 0 }}
            />
          </div>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'Gestão de ensaios não destrutivos', icon: '◈' },
              { label: 'Relatórios técnicos automatizados', icon: '⬡' },
              { label: 'Controle de equipe e acessos', icon: '◎' },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: 'rgba(200,160,32,0.12)',
                  border: '1px solid rgba(200,160,32,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#C8A020', fontSize: 16, flexShrink: 0,
                }}>
                  {item.icon}
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom label */}
        <div style={{
          position: 'absolute', bottom: 32, left: 64,
          zIndex: 2,
          fontSize: 11, fontWeight: 600,
          color: 'rgba(255,255,255,0.25)',
          letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          Tecnologia em Concreto
        </div>
      </div>

      {/* Right panel — login form */}
      <div style={{
        flex: 1,
        backgroundColor: '#F8F9FA',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 48px',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Form header */}
          <div style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 3, height: 22, background: '#C8A020', borderRadius: 2 }} />
              <h1 style={{
                fontSize: 24, fontWeight: 800,
                color: '#1A2340', letterSpacing: '-0.02em',
              }}>
                Entrar
              </h1>
            </div>
            <p style={{ fontSize: 14, color: '#6B7490', paddingLeft: 11 }}>
              Acesse a plataforma TECOMAT
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{
                display: 'block', marginBottom: 7,
                fontSize: 12, fontWeight: 700,
                color: '#6B7490', textTransform: 'uppercase', letterSpacing: '0.07em',
              }}>
                E-mail
              </label>
              <input
                className="login-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label style={{
                display: 'block', marginBottom: 7,
                fontSize: 12, fontWeight: 700,
                color: '#6B7490', textTransform: 'uppercase', letterSpacing: '0.07em',
              }}>
                Senha
              </label>
              <input
                className="login-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div style={{
                padding: '10px 14px',
                background: '#FFF0EE',
                border: '1px solid #FADADD',
                borderRadius: 8,
                fontSize: 13, color: '#C0392B', fontWeight: 500,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="login-btn"
              disabled={loading}
              style={{ marginTop: 4 }}
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          {/* Footer */}
          <p style={{
            marginTop: 32, fontSize: 12,
            color: '#A8AEBF', textAlign: 'center',
            lineHeight: 1.5,
          }}>
            Acesso restrito a usuários cadastrados.<br />
            Contate um administrador para criar sua conta.
          </p>
        </div>
      </div>
    </div>
  );
}