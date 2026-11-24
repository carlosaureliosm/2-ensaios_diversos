// src/app/api/ensaios/pacometria/obra/[id]/route.ts
//
// PATCH  /api/ensaios/pacometria/obra/[id] — atualiza nome e/ou amostras da obra (somente criador)
// DELETE /api/ensaios/pacometria/obra/[id] — remove a obra e todas as suas fotos (somente criador)

import { NextRequest, NextResponse } from 'next/server';
import { usuarioAtual } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  BUCKET_PACOMETRIA_OBRA,
  hidratarUrlsFotos,
  lerGrupoObra,
  removerArquivosGrupo,
  salvarGrupoObra,
  sanitizarAmostrasObra,
  validarFotoPath,
  validarGrupoId,
} from '@/lib/pacometriaObraStorage';
import type { AmostraObraSalva, ObraGrupoPacometria } from '@/modules/pacometria/types';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  const user = await usuarioAtual();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { id } = await context.params;
  if (!validarGrupoId(id)) {
    return NextResponse.json({ error: 'ID de obra inválido.' }, { status: 400 });
  }

  let body: { nome?: string; amostras?: AmostraObraSalva[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const existente = await lerGrupoObra(admin, id);
    if (!existente) {
      return NextResponse.json({ error: 'Obra não encontrada.' }, { status: 404 });
    }
    if (existente.createdBy !== user.id) {
      return NextResponse.json(
        { error: 'Somente o criador da obra pode alterar seus dados.' },
        { status: 403 },
      );
    }

    const novoNome =
      typeof body.nome === 'string' && body.nome.trim()
        ? body.nome.trim().slice(0, 160)
        : existente.nome;

    const novasAmostras = Array.isArray(body.amostras)
      ? sanitizarAmostrasObra(body.amostras, id)
      : existente.amostras;

    // Remove do Storage quaisquer fotos que deixaram de ser referenciadas
    const pathsNovos = new Set(
      novasAmostras.map(a => a.fotoPath).filter((p): p is string => Boolean(p)),
    );
    const fotosOrfas = existente.amostras
      .map(a => a.fotoPath)
      .filter((p): p is string => Boolean(p) && validarFotoPath(p, id) && !pathsNovos.has(p));

    const atualizado: ObraGrupoPacometria = {
      ...existente,
      nome: novoNome,
      amostras: novasAmostras,
      updatedAt: new Date().toISOString(),
    };

    await salvarGrupoObra(admin, atualizado);

    if (fotosOrfas.length > 0) {
      await admin.storage.from(BUCKET_PACOMETRIA_OBRA).remove(fotosOrfas);
    }

    const [hidratado] = await hidratarUrlsFotos(admin, [atualizado]);
    return NextResponse.json({ grupo: hidratado });
  } catch (err) {
    console.error('[pacometria obra PATCH] Erro:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao atualizar obra.' },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const user = await usuarioAtual();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { id } = await context.params;
  if (!validarGrupoId(id)) {
    return NextResponse.json({ error: 'ID de obra inválido.' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const existente = await lerGrupoObra(admin, id);
    if (!existente) {
      return NextResponse.json({ error: 'Obra não encontrada.' }, { status: 404 });
    }
    if (existente.createdBy !== user.id) {
      return NextResponse.json(
        { error: 'Somente o criador da obra pode apagar este registro.' },
        { status: 403 },
      );
    }

    const fotoPaths = existente.amostras
      .map(a => a.fotoPath)
      .filter((p): p is string => Boolean(p));

    await removerArquivosGrupo(admin, id, fotoPaths);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[pacometria obra DELETE] Erro:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao apagar obra.' },
      { status: 500 },
    );
  }
}
