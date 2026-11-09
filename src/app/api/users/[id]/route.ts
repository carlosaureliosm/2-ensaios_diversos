import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin as ehAdmin, roleDe, usuarioAtual } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import type { UserMetadata } from '@/types/user';
import type { User } from '@supabase/supabase-js';

// Conta admins ativos (não banidos). O papel vem de app_metadata (só a service role grava).
async function getAdminCount(): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error || !data) return 0;
  const users = (data as { users: User[] }).users;
  return users.filter((u) => {
    const banned = u.banned_until;
    return roleDe(u) === 'admin' && (!banned || new Date(banned) <= new Date());
  }).length;
}

// PATCH /api/users/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const currentUser = await usuarioAtual();
  if (!currentUser) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const isAdmin = ehAdmin(currentUser);
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
      if (roleDe(targetData?.user) === 'admin' && adminCount <= 1) {
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
  const existingMeta = (targetData.user.user_metadata ?? {}) as UserMetadata & Record<string, unknown>;

  // Monta novos metadados fazendo merge com os existentes.
  // `role` nunca fica em user_metadata (o usuário conseguiria alterá-lo pelo navegador).
  const newMeta: Record<string, unknown> = { ...existingMeta };
  delete newMeta.role;
  if (full_name !== undefined) newMeta.full_name = full_name;
  if (cargo !== undefined) newMeta.cargo = cargo;
  if (crea !== undefined) newMeta.crea = crea;

  const updates: Record<string, unknown> = { user_metadata: newMeta };

  if (role !== undefined) {
    if (!isAdmin) return NextResponse.json({ error: 'Sem permissão para alterar nível.' }, { status: 403 });
    const novoRole = role === 'admin' ? 'admin' : 'user';
    if (novoRole !== 'admin') {
      const adminCount = await getAdminCount();
      if (roleDe(targetData.user) === 'admin' && adminCount <= 1) {
        return NextResponse.json({ error: 'Não é possível rebaixar o último administrador.' }, { status: 400 });
      }
    }
    updates.app_metadata = { ...(targetData.user.app_metadata ?? {}), role: novoRole };
  }

  // A API admin troca o e-mail sem confirmação — por isso só administradores podem mudar e-mail.
  if (email !== undefined && email !== '' && email !== targetData.user.email) {
    if (!isAdmin) {
      return NextResponse.json({ error: 'Para alterar o e-mail, peça a um administrador.' }, { status: 403 });
    }
    updates.email = email;
  }
  if (password !== undefined && password !== '') updates.password = password;

  const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(id, updates);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  const updatedMeta = (updated.user.user_metadata ?? {}) as UserMetadata;
  return NextResponse.json({
    success: true,
    user: {
      id: updated.user.id,
      email: updated.user.email,
      full_name: updatedMeta.full_name ?? '',
      cargo: updatedMeta.cargo ?? '',
      role: roleDe(updated.user),
    },
  });
}

// DELETE /api/users/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const currentUser = await usuarioAtual();
  if (!currentUser) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (!ehAdmin(currentUser)) {
    return NextResponse.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });
  }

  const admin = createAdminClient();
  const adminCount = await getAdminCount();
  const { data: targetData } = await admin.auth.admin.getUserById(id);
  if (roleDe(targetData?.user) === 'admin' && adminCount <= 1) {
    return NextResponse.json({ error: 'Não é possível excluir o último administrador.' }, { status: 400 });
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
