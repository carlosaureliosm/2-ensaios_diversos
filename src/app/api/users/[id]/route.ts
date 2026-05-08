import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Conta admins ativos (não banidos)
async function getAdminCount(): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.listUsers();
  if (!data) return 0;
  return data.users.filter(
    (u) =>
      u.user_metadata?.role === 'admin' &&
      (!u.banned_until || new Date(u.banned_until) <= new Date())
  ).length;
}

// PATCH /api/users/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const isAdmin = currentUser.user_metadata?.role === 'admin';
  const isSelf = currentUser.id === id;

  if (!isAdmin && !isSelf) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
  }

  const body = await req.json();
  const { full_name, cargo, crea, role, email, password, action } = body;

  const admin = createAdminClient();

  // ── Ban / Unban ──────────────────────────────────────────────
  if (action === 'ban' || action === 'unban') {
    if (!isAdmin) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });

    if (action === 'ban') {
      const adminCount = await getAdminCount();
      const { data: targetData } = await admin.auth.admin.getUserById(id);
      if (targetData?.user?.user_metadata?.role === 'admin' && adminCount <= 1) {
        return NextResponse.json({ error: 'Não é possível desativar o último administrador.' }, { status: 400 });
      }
      const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: '876000h' });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    } else {
      const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: 'none' });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  }

  // ── Edição de dados ──────────────────────────────────────────

  // Busca metadados atuais do usuário alvo para fazer merge
  const { data: targetData, error: fetchError } = await admin.auth.admin.getUserById(id);
  if (fetchError || !targetData?.user) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }
  const existingMeta = targetData.user.user_metadata ?? {};

  // Monta novos metadados fazendo merge com os existentes
  const newMeta: Record<string, unknown> = { ...existingMeta };
  if (full_name !== undefined) newMeta.full_name = full_name;
  if (cargo !== undefined) newMeta.cargo = cargo;
  if (crea !== undefined) newMeta.crea = crea;

  if (role !== undefined) {
    if (!isAdmin) return NextResponse.json({ error: 'Sem permissão para alterar nível.' }, { status: 403 });
    if (role !== 'admin') {
      const adminCount = await getAdminCount();
      if (existingMeta.role === 'admin' && adminCount <= 1) {
        return NextResponse.json({ error: 'Não é possível rebaixar o último administrador.' }, { status: 400 });
      }
    }
    newMeta.role = role;
  }

  // Monta payload para o Supabase
  // CORREÇÃO: usar `user_metadata` em vez de `data` — o campo `data` não persiste
  // corretamente em todas as versões do @supabase/supabase-js
  const updates: Record<string, unknown> = { user_metadata: newMeta };
  if (email !== undefined && email !== '') updates.email = email;
  if (password !== undefined && password !== '') updates.password = password;

  const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(id, updates);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  return NextResponse.json({
    success: true,
    user: {
      id: updated.user.id,
      email: updated.user.email,
      full_name: updated.user.user_metadata?.full_name ?? '',
      cargo: updated.user.user_metadata?.cargo ?? '',
      role: updated.user.user_metadata?.role ?? 'user',
    },
  });
}

// DELETE /api/users/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (currentUser.user_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });
  }

  const admin = createAdminClient();
  const adminCount = await getAdminCount();
  const { data: targetData } = await admin.auth.admin.getUserById(id);
  if (targetData?.user?.user_metadata?.role === 'admin' && adminCount <= 1) {
    return NextResponse.json({ error: 'Não é possível excluir o último administrador.' }, { status: 400 });
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}