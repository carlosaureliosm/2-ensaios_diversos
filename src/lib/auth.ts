// src/lib/auth.ts
//
// Helpers de autenticação/autorização para as rotas de API.
//
// IMPORTANTE: o papel (admin/user) fica em `app_metadata.role`, que só a service role consegue gravar.
// NÃO usar `user_metadata.role` para autorização — o próprio usuário pode alterar `user_metadata`
// pelo navegador com `supabase.auth.updateUser({ data })` usando a anon key pública.

import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type Role = 'admin' | 'user';

/** Papel do usuário, lido apenas de `app_metadata` (gravável só pelo servidor). */
export function roleDe(user: Pick<User, 'app_metadata'> | null | undefined): Role {
  return user?.app_metadata?.role === 'admin' ? 'admin' : 'user';
}

export function isAdmin(user: Pick<User, 'app_metadata'> | null | undefined): boolean {
  return roleDe(user) === 'admin';
}

/** Usuário autenticado da requisição (validado no servidor do Supabase via `getUser`), ou `null`. */
export async function usuarioAtual(): Promise<User | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

const BUCKET_ASSINATURAS = 'assinaturas';

/**
 * Baixa a assinatura do próprio usuário direto do Storage (caminho salvo em `user_metadata.assinatura_path`).
 * Substitui o antigo `fetch(body.respAssinaturaUrl)`, que aceitava qualquer URL vinda do cliente (SSRF).
 * Só aceita caminhos dentro da pasta do usuário.
 */
export async function baixarAssinaturaDoUsuario(
  user: User,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const caminho = user.user_metadata?.assinatura_path;
  if (typeof caminho !== 'string' || !caminho.startsWith(`${user.id}/`) || caminho.includes('..')) return null;
  const { data, error } = await createAdminClient().storage.from(BUCKET_ASSINATURAS).download(caminho);
  if (error || !data) return null;
  const contentType = caminho.endsWith('.jpg') ? 'image/jpeg' : caminho.endsWith('.webp') ? 'image/webp' : 'image/png';
  return { buffer: Buffer.from(await data.arrayBuffer()), contentType };
}
