// src/app/api/ensaios/aderencia/foto/route.ts
//
// POST   /api/ensaios/aderencia/foto          — recebe UMA foto já comprimida (multipart, campo "foto") e grava no Storage
// DELETE /api/ensaios/aderencia/foto?path=... — remove uma foto do usuário
//
// Bucket privado "aderencia-fotos", criado automaticamente na primeira chamada (via service role).
// Cada usuário só grava/apaga dentro da própria pasta `<user.id>/`.
// O laudo (rota ../docx) baixa as fotos pelo `path`, então o POST da geração não carrega imagens em base64.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { BUCKET_FOTOS_ADERENCIA } from '@/lib/aderenciaStorage';

const MAX_SIZE = 3 * 1024 * 1024; // a foto já vem comprimida (~100 KB); 3 MB é só teto de segurança
const ALLOWED = ['image/jpeg', 'image/png'];

async function garantirBucket(admin: ReturnType<typeof createAdminClient>) {
  const { data } = await admin.storage.getBucket(BUCKET_FOTOS_ADERENCIA);
  if (data) return;
  const { error } = await admin.storage.createBucket(BUCKET_FOTOS_ADERENCIA, { public: false });
  // "already exists" em corrida entre duas requisições simultâneas não é erro
  if (error && !/already exists/i.test(error.message)) throw new Error(error.message);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 }); }

  const file = form.get('foto') as File | null;
  if (!file) return NextResponse.json({ error: 'Campo "foto" não encontrado.' }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Formato inválido (use JPEG ou PNG).' }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Foto muito grande.' }, { status: 400 });

  try {
    const admin = createAdminClient();
    await garantirBucket(admin);

    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await admin.storage
      .from(BUCKET_FOTOS_ADERENCIA)
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ path });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao enviar foto.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const path = req.nextUrl.searchParams.get('path') ?? '';
  if (!path.startsWith(`${user.id}/`) || path.includes('..')) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
  }

  await createAdminClient().storage.from(BUCKET_FOTOS_ADERENCIA).remove([path]);
  return NextResponse.json({ success: true });
}
