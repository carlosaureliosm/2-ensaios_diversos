// src/modules/pacometria/imagemRapida.ts
//
// Compressão rápida de imagens no navegador usando createImageBitmap (decodificação fora da main thread)
// e canvas.toBlob (sem codificar o arquivo bruto em base64 antes de redimensionar).

export type ImagemComprimidaBlob = {
  file: File;
  width: number;
  height: number;
  contentType: string;
};

export type ImagemComprimidaBase64 = {
  base64: string;
  width: number;
  height: number;
  contentType: string;
};

const MAX_DIM = 800;
const JPEG_QUALITY = 0.65;

function calcularDimensoes(origW: number, origH: number, maxDim = MAX_DIM) {
  let width = origW;
  let height = origH;
  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }
  return { width: Math.max(1, width), height: Math.max(1, height) };
}

function canvasParaBlob(canvas: HTMLCanvasElement, quality = JPEG_QUALITY): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Falha ao gerar imagem comprimida.'))),
      'image/jpeg',
      quality,
    );
  });
}

function carregarHtmlImage(file: File): Promise<{ img: HTMLImageElement; cleanup: () => void }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, cleanup: () => URL.revokeObjectURL(objectUrl) });
    img.onerror = err => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    img.src = objectUrl;
  });
}

export async function comprimirImagemParaFile(
  file: File,
  maxDim = MAX_DIM,
): Promise<ImagemComprimidaBlob> {
  const canvas = document.createElement('canvas');

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      try {
        const { width, height } = calcularDimensoes(bitmap.width, bitmap.height, maxDim);
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
        const blob = await canvasParaBlob(canvas);
        return {
          file: new File([blob], 'foto.jpg', { type: 'image/jpeg' }),
          width,
          height,
          contentType: 'image/jpeg',
        };
      } finally {
        bitmap.close();
      }
    } catch {
      // Fallback para HTMLImageElement caso createImageBitmap falhe (ex.: formato exótico)
    }
  }

  const { img, cleanup } = await carregarHtmlImage(file);
  try {
    const { width, height } = calcularDimensoes(img.naturalWidth || img.width, img.naturalHeight || img.height, maxDim);
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
    const blob = await canvasParaBlob(canvas);
    return {
      file: new File([blob], 'foto.jpg', { type: 'image/jpeg' }),
      width,
      height,
      contentType: 'image/jpeg',
    };
  } finally {
    cleanup();
  }
}

export function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(new Error('Falha ao ler imagem.'));
    reader.readAsDataURL(blob);
  });
}

export async function comprimirImagemRapida(file: File): Promise<ImagemComprimidaBase64> {
  const { file: comprimido, width, height, contentType } = await comprimirImagemParaFile(file);
  const base64 = await blobParaBase64(comprimido);
  return { base64, width, height, contentType };
}

const urlsPrecarregadas = new Set<string>();

/** Pré-carrega miniaturas no cache do navegador sem bloquear a interface. */
export function precarregarImagens(urls: Array<string | null | undefined>) {
  if (typeof window === 'undefined') return;
  for (const url of urls) {
    if (!url || urlsPrecarregadas.has(url)) continue;
    urlsPrecarregadas.add(url);
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
  }
}
