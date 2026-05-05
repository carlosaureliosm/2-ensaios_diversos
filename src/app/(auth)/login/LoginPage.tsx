'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // TODO: substituir pelo Supabase Auth
      // const { error } = await supabase.auth.signInWithPassword({ email, password });
      // if (error) throw error;
      // router.push('/dashboard');
      console.log('Login:', { email, password });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: '#1E3264',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
  };

  return (
    <div style={{ backgroundColor: '#1E3264', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <style>{`
        .tecomat-input::placeholder { color: rgba(255,255,255,0.45); }
        .tecomat-input:focus { box-shadow: 0 0 0 2px #C8A020; }
        .tecomat-btn:hover { background-color: #152548 !important; }
        .tecomat-btn:active { transform: scale(0.98); }
      `}</style>

      <main style={{ backgroundColor: '#ffffff', width: '100%', maxWidth: '400px', borderRadius: '20px', boxShadow: '0 8px 40px rgba(0,0,0,0.22)', padding: '40px 36px' }}>

        {/* Header / Logo */}
        <header style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ position: 'relative', width: 32, height: 36, margin: '0 auto 12px' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 8, backgroundColor: '#1E3264' }} />
            <div style={{ position: 'absolute', top: 8, left: 10, width: 6, height: 28, backgroundColor: '#1E3264' }} />
            <div style={{ position: 'absolute', top: 8, left: 16, width: 6, height: 28, backgroundColor: '#C8A020' }} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '0.2em', color: '#1E3264', marginBottom: 2 }}>TECOMAT</h1>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', color: '#1E3264', marginBottom: 6 }}>ENGENHARIA</p>
          <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', color: '#1E3264', textTransform: 'uppercase', lineHeight: 1.7 }}>
            PRECISÃO E SOLUÇÕES INTEGRADAS<br />ENSAIOS &amp; LAUDOS
          </p>
          <div style={{ width: 40, height: 3, backgroundColor: '#C8A020', borderRadius: 99, margin: '12px auto 0' }} />
        </header>

        {/* Formulário */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1E3264', marginBottom: 6 }}>E-mail</label>
            <input
              className="tecomat-input"
              type="email"
              required
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1E3264', marginBottom: 6 }}>Senha</label>
            <input
              className="tecomat-input"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </div>

          {error && (
            <p style={{ fontSize: 13, color: '#ba1a1a', textAlign: 'center', marginBottom: 12 }}>{error}</p>
          )}

          <button
            className="tecomat-btn"
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              backgroundColor: '#1E3264',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 15,
              border: 'none',
              borderRadius: 8,
              padding: '13px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              marginTop: 4,
              opacity: loading ? 0.75 : 1,
              transition: 'background-color 0.15s',
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </main>
    </div>
  );
}
