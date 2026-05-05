import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function getCallerRole() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.user_metadata?.role ?? null;
}

// GET /api/users — lista todos os usuários
export async function GET() {
  const role = await getCallerRole();
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email,
    full_name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? '',
    cargo: u.user_metadata?.cargo ?? '',
    role: u.user_metadata?.role ?? 'user',
    banned: u.banned_until ? new Date(u.banned_until) > new Date() : false,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
  }));

  return NextResponse.json({ users });
}

// POST /api/users — cria novo usuário
export async function POST(request: Request) {
  const role = await getCallerRole();
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { email, password, full_name, cargo, userRole } = body;

  if (!email || !password) {
    return NextResponse.json({ error: 'Email e senha são obrigatórios.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, cargo, role: userRole ?? 'user' },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ user: data.user }, { status: 201 });
}
