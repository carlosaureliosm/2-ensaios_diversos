import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetUserById = vi.fn();
const mockCreateSignedUrl = vi.fn();
const mockUsuarioAtual = vi.fn();
const fetchSpy = vi.fn();

vi.mock('@/lib/auth', () => ({
  usuarioAtual: (...args: unknown[]) => mockUsuarioAtual(...args),
  isAdmin: (u: { app_metadata?: { role?: string } } | null) => u?.app_metadata?.role === 'admin',
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: { admin: { getUserById: (...args: unknown[]) => mockGetUserById(...args) } },
    storage: {
      from: () => ({
        createSignedUrl: (...args: unknown[]) => mockCreateSignedUrl(...args),
      }),
    },
  }),
}));

vi.stubGlobal('fetch', fetchSpy);

import { GET as getAssinatura } from '@/app/api/users/[id]/assinatura/route';
import { POST as postMapsStatic } from '@/app/api/maps/static/route';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GOOGLE_MAPS_API_KEY = 'fake-test-key';
});

describe('GET /api/users/[id]/assinatura — proteção contra IDOR via user_metadata', () => {
  const userId = 'user-111';

  it('rejeita assinatura_path fora da pasta do usuário alvo (ex: alterado via anon key)', async () => {
    mockUsuarioAtual.mockResolvedValue({ id: userId, app_metadata: { role: 'user' } });
    mockGetUserById.mockResolvedValue({
      data: { user: { id: userId, user_metadata: { assinatura_path: 'outro-user/assinatura.png' } } },
    });

    const req = new NextRequest(`http://localhost/api/users/${userId}/assinatura`);
    const res = await getAssinatura(req, { params: Promise.resolve({ id: userId }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ assinatura_url: null });
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  it('rejeita path traversal com .. em assinatura_path', async () => {
    mockUsuarioAtual.mockResolvedValue({ id: userId, app_metadata: { role: 'user' } });
    mockGetUserById.mockResolvedValue({
      data: { user: { id: userId, user_metadata: { assinatura_path: `${userId}/../vitima/assinatura.png` } } },
    });

    const req = new NextRequest(`http://localhost/api/users/${userId}/assinatura`);
    const res = await getAssinatura(req, { params: Promise.resolve({ id: userId }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ assinatura_url: null });
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  it('gera URL assinada quando assinatura_path pertence à pasta do usuário', async () => {
    mockUsuarioAtual.mockResolvedValue({ id: userId, app_metadata: { role: 'user' } });
    mockGetUserById.mockResolvedValue({
      data: { user: { id: userId, user_metadata: { assinatura_path: `${userId}/assinatura.png` } } },
    });
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://supabase.local/signed-1h' },
      error: null,
    });

    const req = new NextRequest(`http://localhost/api/users/${userId}/assinatura`);
    const res = await getAssinatura(req, { params: Promise.resolve({ id: userId }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ assinatura_url: 'https://supabase.local/signed-1h' });
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(`${userId}/assinatura.png`, 3600);
  });
});

describe('POST /api/maps/static — validação de coordenadas', () => {
  const mkReq = (body: unknown) =>
    new NextRequest('http://localhost/api/maps/static', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });

  it('rejeita injeção de modificadores no parâmetro markers e valores fora de faixa', async () => {
    mockUsuarioAtual.mockResolvedValue({ id: 'u1', app_metadata: { role: 'user' } });

    const r1 = await postMapsStatic(mkReq({ latitude: '-8.05|icon:http://evil.com/x', longitude: -34.9 }));
    expect(r1.status).toBe(400);

    const r2 = await postMapsStatic(mkReq({ latitude: 95, longitude: -34.9 }));
    expect(r2.status).toBe(400);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('aceita coordenada 0 válida', async () => {
    mockUsuarioAtual.mockResolvedValue({ id: 'u1', app_metadata: { role: 'user' } });
    fetchSpy.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });

    const res = await postMapsStatic(mkReq({ latitude: 0, longitude: 0 }));
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchSpy.mock.calls[0][0]);
    expect(calledUrl).toContain('center=0%2C0');
  });
});
