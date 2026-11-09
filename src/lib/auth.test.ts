import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Sem usuário logado: getUser devolve null.
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}))
const fetchSpy = vi.fn()
vi.stubGlobal('fetch', fetchSpy)

import { roleDe, isAdmin } from '@/lib/auth'
import { POST as docxResistividade } from '@/app/api/ensaios/resistividade/docx/route'
import { POST as docxEsclerometria } from '@/app/api/ensaios/esclerometria/docx/route'
import { POST as docxAderencia } from '@/app/api/ensaios/aderencia/docx/route'
import { POST as mapa } from '@/app/api/maps/static/route'

describe('roleDe / isAdmin', () => {
  it('ignora user_metadata.role (gravável pelo próprio usuário)', () => {
    const u = { app_metadata: {}, user_metadata: { role: 'admin' } }
    expect(roleDe(u)).toBe('user')
    expect(isAdmin(u)).toBe(false)
  })
  it('usa app_metadata.role', () => {
    expect(isAdmin({ app_metadata: { role: 'admin' } })).toBe(true)
    expect(roleDe(null)).toBe('user')
  })
})

describe('rotas exigem login e não buscam URL do cliente', () => {
  const req = (url: string, body: unknown) =>
    new NextRequest(url, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
  const ssrf = { respAssinaturaUrl: 'http://169.254.169.254/latest/meta-data/', latitude: 1, longitude: 1 }

  it.each([
    ['resistividade', docxResistividade],
    ['esclerometria', docxEsclerometria],
    ['aderencia', docxAderencia],
    ['maps', mapa],
  ])('%s responde 401 sem usuário', async (nome, handler) => {
    const res = await handler(req(`http://localhost/api/${nome}`, ssrf))
    expect(res.status).toBe(401)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
