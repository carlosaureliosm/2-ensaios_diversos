import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin, roleDe, usuarioAtual } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import type { UserMetadata } from '@/types/user';

export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// GET /api/users — lista todos os usuários (admin only)
export async function GET() {
  const user = await usuarioAtual();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }
  if (!isAdmin(user)) {
    return NextResponse.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });
  }

  const { data, error } = await createAdminClient().auth.admin.listUsers({ perPage: 1000 });
  if (error) return NextResponse.json({ error: 'Erro ao listar usuários.' }, { status: 500 });

  const users = data.users.map((u) => {
    const meta = (u.user_metadata ?? {}) as UserMetadata;
    return {
      id: u.id,
      email: u.email,
      full_name: meta.full_name ?? '',
      cargo: meta.cargo ?? '',
      role: roleDe(u),
      banned: !!u.banned_until && new Date(u.banned_until) > new Date(),
      created_at: u.created_at,
      crea: meta.crea ?? '',
      assinatura_url: meta.assinatura_url ?? null,
    };
  });

  return NextResponse.json({ users }, {
    headers: {
      'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
    },
  });
}

// POST /api/users — cria novo usuário (admin only)
export async function POST(req: NextRequest) {
  const user = await usuarioAtual();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (!isAdmin(user)) {
    return NextResponse.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });
  }

  const body = await req.json();
  const { email, password, full_name, cargo, crea, role } = body;

  if (!email || !password) {
    return NextResponse.json({ error: 'E-mail e senha são obrigatórios.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name ?? '', cargo: cargo ?? '', crea: crea ?? '' },
    // Papel em app_metadata: só a service role grava (o usuário não consegue se promover).
    app_metadata: { role: role === 'admin' ? 'admin' : 'user' },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ user: { id: data.user.id, email: data.user.email } }, { status: 201 });
}
