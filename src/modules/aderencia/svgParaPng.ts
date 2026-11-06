// src/modules/aderencia/svgParaPng.ts
// Somente navegador: rasteriza o SVG do esquema (croqui) em PNG, pois o DOCX não embute SVG de forma confiável.

import type { FotoAnexo } from './types'

/** Rasteriza uma string SVG (com width/height/viewBox) em PNG base64 (sem prefixo data:), em escala `escala`x. */
export function svgParaPng(svg: string, escala = 3): Promise<FotoAnexo> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const w = Math.round((img.naturalWidth || 200) * escala)
      const h = Math.round((img.naturalHeight || 200) * escala)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas indisponível'))
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      resolve({
        base64: canvas.toDataURL('image/png').split(',')[1],
        contentType: 'image/png',
        width: w,
        height: h,
      })
    }
    img.onerror = () => reject(new Error('Falha ao rasterizar o esquema SVG'))
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  })
}
