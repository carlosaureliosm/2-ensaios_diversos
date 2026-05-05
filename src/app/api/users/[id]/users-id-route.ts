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

// PATCH /api/users/[id] — edita usuário
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = await getCallerRole();
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { full_name, cargo, userRole, email } = body;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.updateUserById(id, {
    ...(email ? { email } : {}),
    user_metadata: { full_name, cargo, role: userRole },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ user: data.user });
}

// DELETE /api/users/[id] — desativa (ban) ou exclui usuário
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = await getCallerRole();
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { action } = await request.json(); // action: 'ban' | 'delete' | 'unban'

  const admin = createAdminClient();

  if (action === 'delete') {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ deleted: true });
  }

  if (action === 'ban') {
    const { error } = await admin.auth.admin.updateUserById(id, {
      ban_duration: '876000h', // ~100 anos
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ banned: true });
  }

  if (action === 'unban') {
    const { error } = await admin.auth.admin.updateUserById(id, {
      ban_duration: 'none',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ unbanned: true });
  }

  return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
}
