// src/app/api/ensaios/pacometria/obra/[id]/foto/route.ts
//
// POST   /api/ensaios/pacometria/obra/[id]/foto          — envia foto comprimida para uma amostra da obra (somente criador)
// DELETE /api/ensaios/pacometria/obra/[id]/foto?path=... — remove foto específica da obra (somente criador)

import { NextRequest, NextResponse } from 'next/server';
import { usuarioAtual } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  BUCKET_PACOMETRIA_OBRA,
  garantirBucketObra,
  lerGrupoObra,
  validarFotoPath,
  validarGrupoId,
} from '@/lib/pacometriaObraStorage';

const MAX_SIZE = 3 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png'];

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const user = await usuarioAtual();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { id } = await context.params;
  if (!validarGrupoId(id)) {
    return NextResponse.json({ error: 'ID de obra inválido.' }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const file = form.get('foto') as File | null;
  if (!file) return NextResponse.json({ error: 'Campo "foto" não encontrado.' }, { status: 400 });
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Formato inválido (use JPEG ou PNG).' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Foto muito grande.' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const existente = await lerGrupoObra(admin, id);
    if (!existente) {
      return NextResponse.json({ error: 'Obra não encontrada.' }, { status: 404 });
    }
    if (existente.createdBy !== user.id) {
      return NextResponse.json(
        { error: 'Somente o criador da obra pode enviar fotos.' },
        { status: 403 },
      );
    }

    await garantirBucketObra(admin);
    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    const path = `fotos/${id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await admin.storage
      .from(BUCKET_PACOMETRIA_OBRA)
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: signed } = await admin.storage
      .from(BUCKET_PACOMETRIA_OBRA)
      .createSignedUrl(path, 3600);

    return NextResponse.json({ path, url: signed?.signedUrl ?? null });
  } catch (err) {
    console.error('[pacometria obra foto POST] Erro:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao enviar foto.' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const user = await usuarioAtual();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { id } = await context.params;
  const path = req.nextUrl.searchParams.get('path') ?? '';
  if (!validarGrupoId(id) || !validarFotoPath(path, id)) {
    return NextResponse.json({ error: 'Caminho de foto inválido.' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const existente = await lerGrupoObra(admin, id);
    if (!existente) {
      return NextResponse.json({ error: 'Obra não encontrada.' }, { status: 404 });
    }
    if (existente.createdBy !== user.id) {
      return NextResponse.json(
        { error: 'Somente o criador da obra pode remover fotos.' },
        { status: 403 },
      );
    }

    await admin.storage.from(BUCKET_PACOMETRIA_OBRA).remove([path]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[pacometria obra foto DELETE] Erro:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao remover foto.' },
      { status: 500 },
    );
  }
}
