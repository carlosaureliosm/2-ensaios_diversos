// src/app/api/ensaios/pacometria/obra/route.ts
//
// GET  /api/ensaios/pacometria/obra — lista todas as obras salvas (de todos os usuários), com URLs assinadas (1h) para fotos
// POST /api/ensaios/pacometria/obra — cria uma nova obra vinculada ao usuário autenticado

import { NextRequest, NextResponse } from 'next/server';
import { usuarioAtual } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  hidratarUrlsFotos,
  listarGruposObra,
  salvarGrupoObra,
} from '@/lib/pacometriaObraStorage';
import type { ObraGrupoPacometria } from '@/modules/pacometria/types';

export async function GET() {
  const user = await usuarioAtual();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  try {
    const admin = createAdminClient();
    const grupos = await listarGruposObra(admin);
    const hidratados = await hidratarUrlsFotos(admin, grupos);
    return NextResponse.json({ grupos: hidratados, currentUserId: user.id });
  } catch (err) {
    console.error('[pacometria obra GET] Erro:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao listar obras.' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await usuarioAtual();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  let body: { nome?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
  if (!nome || nome.length > 160) {
    return NextResponse.json(
      { error: 'Informe um nome válido para a obra (até 160 caracteres).' },
      { status: 400 },
    );
  }

  try {
    const admin = createAdminClient();
    const agora = new Date().toISOString();
    const meta = user.user_metadata ?? {};
    const grupo: ObraGrupoPacometria = {
      id: crypto.randomUUID(),
      nome,
      createdBy: user.id,
      createdByNome: meta.full_name || meta.name || user.email || 'Usuário',
      createdByEmail: user.email ?? '',
      createdAt: agora,
      updatedAt: agora,
      amostras: [],
    };
    await salvarGrupoObra(admin, grupo);
    return NextResponse.json({ grupo }, { status: 201 });
  } catch (err) {
    console.error('[pacometria obra POST] Erro:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao criar obra.' },
      { status: 500 },
    );
  }
}
