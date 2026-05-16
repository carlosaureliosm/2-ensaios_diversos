import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import type { UserMetadata } from '@/types/user';

export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// GET /api/users — lista todos os usuários (admin only)
export async function GET() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: { user } }, { data, error }] = await Promise.all([
    supabase.auth.getUser(),
    admin.auth.admin.listUsers(),
  ]);

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }
  if (user.user_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const users = data.users.map((u) => {
    const meta = (u.user_metadata ?? {}) as UserMetadata;
    return {
      id: u.id,
      email: u.email,
      full_name: meta.full_name ?? '',
      cargo: meta.cargo ?? '',
      role: meta.role ?? 'user',
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (user.user_metadata?.role !== 'admin') {
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
    user_metadata: { full_name: full_name ?? '', cargo: cargo ?? '', crea: crea ?? '', role: role ?? 'user' },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ user: data.user }, { status: 201 });
}