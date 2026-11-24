// src/app/api/users/[id]/assinatura/route.ts
//
// POST /api/users/[id]/assinatura  — upload da imagem de assinatura
// DELETE /api/users/[id]/assinatura — remove a imagem
//
// Setup Supabase (executar uma vez no SQL Editor):
//   CREATE POLICY "propria_assinatura" ON storage.objects
//     FOR ALL TO authenticated
//     USING (bucket_id = 'assinaturas' AND (storage.foldername(name))[1] = auth.uid()::text)
//     WITH CHECK (bucket_id = 'assinaturas' AND (storage.foldername(name))[1] = auth.uid()::text);

import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin as ehAdmin, usuarioAtual } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

const BUCKET        = 'assinaturas';
const MAX_SIZE      = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
// URL assinada de curta duração — nunca persistida. Antes era gerada uma URL válida por 10 anos e
// gravada em user_metadata.assinatura_url; como essa URL é devolvida pela listagem de usuários
// (GET /api/users) e nunca expira na prática, qualquer vazamento dela expõe a assinatura para
// sempre mesmo com o bucket privado. Agora só `assinatura_path` é persistido, e uma URL assinada
// nova (1h) é gerada sob demanda (aqui e em GET) sempre que a tela precisa exibir a prévia.
const URL_TTL_SEGUNDOS = 60 * 60;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const currentUser = await usuarioAtual();
  if (!currentUser) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const isAdmin = ehAdmin(currentUser);
  const isSelf  = currentUser.id === id;
  if (!isAdmin && !isSelf) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });

  const admin = createAdminClient();
  const { data: targetData } = await admin.auth.admin.getUserById(id);
  const storagePath = targetData?.user?.user_metadata?.assinatura_path;
  // user_metadata pode ser editado pelo próprio cliente com a anon key: restringir sempre à pasta do id alvo.
  if (typeof storagePath !== 'string' || !storagePath.startsWith(`${id}/`) || storagePath.includes('..')) {
    return NextResponse.json({ assinatura_url: null });
  }

  const { data: signed, error } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, URL_TTL_SEGUNDOS);
  if (error || !signed) return NextResponse.json({ assinatura_url: null });

  return NextResponse.json({ assinatura_url: signed.signedUrl });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const currentUser = await usuarioAtual();
  if (!currentUser) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const isAdmin = ehAdmin(currentUser);
  const isSelf  = currentUser.id === id;
  if (!isAdmin && !isSelf) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 }); }

  const file = formData.get('assinatura') as File | null;
  if (!file) return NextResponse.json({ error: 'Campo "assinatura" não encontrado.' }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'Formato inválido. Use PNG, JPEG ou WebP.' }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Arquivo muito grande. Máximo: 2 MB.' }, { status: 400 });

  const admin = createAdminClient();
  const ext   = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'webp';
  const storagePath = `${id}/assinatura.${ext}`;

  await Promise.all(['png', 'jpg', 'webp'].map(e => admin.storage.from(BUCKET).remove([`${id}/assinatura.${e}`])));

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, buffer, { contentType: file.type, upsert: true });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: targetData } = await admin.auth.admin.getUserById(id);
  const existingMeta = { ...(targetData?.user?.user_metadata ?? {}) };
  delete existingMeta.assinatura_url; // nunca mais persistir URL permanente — só o path.
  const { error: metaError } = await admin.auth.admin.updateUserById(id, {
    user_metadata: { ...existingMeta, assinatura_path: storagePath },
  });
  if (metaError) return NextResponse.json({ error: metaError.message }, { status: 500 });

  // URL de curta duração só para a prévia imediata na tela — nunca persistida.
  const { data: signed, error: signedError } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, URL_TTL_SEGUNDOS);
  if (signedError || !signed) return NextResponse.json({ error: 'Erro ao gerar URL.' }, { status: 500 });

  return NextResponse.json({ success: true, assinatura_url: signed.signedUrl });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const currentUser = await usuarioAtual();
  if (!currentUser) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const isAdmin = ehAdmin(currentUser);
  const isSelf  = currentUser.id === id;
  if (!isAdmin && !isSelf) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });

  const admin = createAdminClient();
  await Promise.all(['png', 'jpg', 'webp'].map(e => admin.storage.from(BUCKET).remove([`${id}/assinatura.${e}`])));

  const { data: targetData } = await admin.auth.admin.getUserById(id);
  const meta = { ...(targetData?.user?.user_metadata ?? {}) };
  delete meta.assinatura_url;
  delete meta.assinatura_path;
  await admin.auth.admin.updateUserById(id, { user_metadata: meta });

  return NextResponse.json({ success: true });
}
