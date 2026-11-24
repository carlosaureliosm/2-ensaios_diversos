// src/lib/pacometriaObraStorage.ts
//
// Armazenamento server-side do Modo Obra de Pacometria em bucket privado do Supabase Storage.
// Estrutura no bucket `pacometria-obra`:
//   - grupos/<grupoId>.json              -> dados do grupo (obra) e suas amostras
//   - fotos/<grupoId>/<fotoId>.<jpg|png> -> fotos comprimidas das amostras

import { createAdminClient } from '@/lib/supabase/admin';
import type { AmostraObraSalva, ObraGrupoPacometria } from '@/modules/pacometria/types';

export const BUCKET_PACOMETRIA_OBRA = 'pacometria-obra';
const PASTA_GRUPOS = 'grupos';
const PASTA_FOTOS = 'fotos';
const SIGNED_URL_TTL_SECONDS = 3600; // 1 hora

const GRUPO_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;
const FOTO_PATH_RE = /^fotos\/([a-zA-Z0-9_-]{8,64})\/[a-zA-Z0-9_-]{8,64}\.(jpg|png)$/;

export function validarGrupoId(id: string): boolean {
  return typeof id === 'string' && GRUPO_ID_RE.test(id) && !id.includes('..');
}

export function validarFotoPath(path: string, grupoId?: string): boolean {
  if (typeof path !== 'string' || path.includes('..')) return false;
  const match = FOTO_PATH_RE.exec(path);
  if (!match) return false;
  if (grupoId && match[1] !== grupoId) return false;
  return true;
}

export function caminhoGrupo(id: string): string {
  return `${PASTA_GRUPOS}/${id}.json`;
}

let bucketGarantido = false;

export async function garantirBucketObra(
  admin: ReturnType<typeof createAdminClient>,
): Promise<void> {
  if (bucketGarantido) return;
  const { data } = await admin.storage.getBucket(BUCKET_PACOMETRIA_OBRA);
  if (data) {
    bucketGarantido = true;
    return;
  }
  const { error } = await admin.storage.createBucket(BUCKET_PACOMETRIA_OBRA, { public: false });
  if (error && !/already exists/i.test(error.message)) {
    throw new Error(error.message);
  }
  bucketGarantido = true;
}

async function baixarGrupoPorUrl(signedUrl: string): Promise<ObraGrupoPacometria | null> {
  try {
    const res = await fetch(signedUrl, { cache: 'no-store' });
    if (!res.ok) return null;
    const parsed = (await res.json()) as ObraGrupoPacometria;
    if (!parsed || typeof parsed.id !== 'string' || !Array.isArray(parsed.amostras)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function lerGrupoObra(
  admin: ReturnType<typeof createAdminClient>,
  id: string,
): Promise<ObraGrupoPacometria | null> {
  if (!validarGrupoId(id)) return null;
  // Signed URL única + cache: 'no-store' evita leitura defasada do CDN do Supabase Storage após upsert
  const { data: signed, error } = await admin.storage
    .from(BUCKET_PACOMETRIA_OBRA)
    .createSignedUrl(caminhoGrupo(id), 60);
  if (error || !signed?.signedUrl) return null;
  return baixarGrupoPorUrl(signed.signedUrl);
}

export async function salvarGrupoObra(
  admin: ReturnType<typeof createAdminClient>,
  grupo: ObraGrupoPacometria,
): Promise<void> {
  await garantirBucketObra(admin);
  // Nunca persistir URLs assinadas temporárias no JSON
  const limpo: ObraGrupoPacometria = {
    ...grupo,
    amostras: grupo.amostras.map(({ fotoUrl: _u, ...rest }) => rest),
  };
  const payload = Buffer.from(JSON.stringify(limpo), 'utf-8');
  const { error } = await admin.storage
    .from(BUCKET_PACOMETRIA_OBRA)
    .upload(caminhoGrupo(grupo.id), payload, {
      contentType: 'application/json',
      cacheControl: '0',
      upsert: true,
    });
  if (error) throw new Error(error.message);
}

export async function listarGruposObra(
  admin: ReturnType<typeof createAdminClient>,
): Promise<ObraGrupoPacometria[]> {
  await garantirBucketObra(admin);
  const { data: arquivos, error } = await admin.storage
    .from(BUCKET_PACOMETRIA_OBRA)
    .list(PASTA_GRUPOS, { limit: 200, sortBy: { column: 'updated_at', order: 'desc' } });

  if (error || !arquivos || arquivos.length === 0) return [];

  const paths = arquivos
    .map(f => f.name)
    .filter(name => name.endsWith('.json'))
    .map(name => name.slice(0, -5))
    .filter(validarGrupoId)
    .map(caminhoGrupo);

  if (paths.length === 0) return [];

  // Uma única chamada em lote para assinar todos os JSONs e baixar sempre a versão mais recente (sem cache)
  const { data: signed } = await admin.storage
    .from(BUCKET_PACOMETRIA_OBRA)
    .createSignedUrls(paths, 60);

  if (!Array.isArray(signed) || signed.length === 0) return [];

  const resultados = await Promise.all(
    signed.map(item => (item.signedUrl ? baixarGrupoPorUrl(item.signedUrl) : Promise.resolve(null))),
  );
  return resultados
    .filter((g): g is ObraGrupoPacometria => g !== null)
    .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
}

export async function hidratarUrlsFotos(
  admin: ReturnType<typeof createAdminClient>,
  grupos: ObraGrupoPacometria[],
): Promise<ObraGrupoPacometria[]> {
  const paths = new Set<string>();
  for (const g of grupos) {
    for (const a of g.amostras) {
      if (a.fotoPath && validarFotoPath(a.fotoPath, g.id)) {
        paths.add(a.fotoPath);
      }
    }
  }
  if (paths.size === 0) {
    return grupos.map(g => ({
      ...g,
      amostras: g.amostras.map(a => ({ ...a, fotoUrl: null })),
    }));
  }

  const listaPaths = Array.from(paths);
  const { data: signed } = await admin.storage
    .from(BUCKET_PACOMETRIA_OBRA)
    .createSignedUrls(listaPaths, SIGNED_URL_TTL_SECONDS);

  const urlPorPath = new Map<string, string>();
  if (Array.isArray(signed)) {
    for (const item of signed) {
      if (item.path && item.signedUrl) {
        urlPorPath.set(item.path, item.signedUrl);
      }
    }
  }

  return grupos.map(g => ({
    ...g,
    amostras: g.amostras.map(a => ({
      ...a,
      fotoUrl: a.fotoPath ? (urlPorPath.get(a.fotoPath) ?? null) : null,
    })),
  }));
}

export async function removerArquivosGrupo(
  admin: ReturnType<typeof createAdminClient>,
  grupoId: string,
  fotoPathsConhecidos: string[],
): Promise<void> {
  const pathsParaRemover = new Set<string>([caminhoGrupo(grupoId)]);
  for (const p of fotoPathsConhecidos) {
    if (validarFotoPath(p, grupoId)) pathsParaRemover.add(p);
  }
  // Também lista a pasta de fotos do grupo para remover eventuais órfãs
  const { data: fotosPasta } = await admin.storage
    .from(BUCKET_PACOMETRIA_OBRA)
    .list(`${PASTA_FOTOS}/${grupoId}`, { limit: 500 });
  if (Array.isArray(fotosPasta)) {
    for (const f of fotosPasta) {
      const full = `${PASTA_FOTOS}/${grupoId}/${f.name}`;
      if (validarFotoPath(full, grupoId)) pathsParaRemover.add(full);
    }
  }
  await admin.storage.from(BUCKET_PACOMETRIA_OBRA).remove(Array.from(pathsParaRemover));
}

export function sanitizarAmostrasObra(
  amostras: AmostraObraSalva[],
  grupoId: string,
): AmostraObraSalva[] {
  return amostras.map((a, idx) => {
    const { fotoUrl: _u, ...rest } = a as AmostraObraSalva & {
      fotoFile?: unknown;
      fotoPreview?: unknown;
    };
    delete (rest as Record<string, unknown>).fotoFile;
    delete (rest as Record<string, unknown>).fotoPreview;
    const fotoPathValido =
      typeof rest.fotoPath === 'string' && validarFotoPath(rest.fotoPath, grupoId)
        ? rest.fotoPath
        : null;
    return {
      ...rest,
      item: idx + 1,
      fotoPath: fotoPathValido,
    };
  });
}

export async function baixarFotoObra(
  fotoPath: string,
): Promise<{ base64: string; contentType: string } | null> {
  if (!validarFotoPath(fotoPath)) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET_PACOMETRIA_OBRA)
    .download(fotoPath);
  if (error || !data) return null;
  const contentType = fotoPath.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const base64 = Buffer.from(await data.arrayBuffer()).toString('base64');
  return { base64, contentType };
}
