// src/modules/aderencia/svgEsquema.ts
// Geração do esquema (croqui) em SVG do sistema de camadas, no mesmo padrão do
// svgOpcao/SvgSecao do módulo pacometria — sem upload manual de imagem.
//
// Estilo baseado nos croquis reais encontrados na aba IMAGENS da planilha de
// referência: um bloco de camadas + disco de tração metálico com haste, em dois
// layouts conforme a disposição do elemento ensaiado:
//   - 'piso'   (elemento horizontal): camadas empilhadas na vertical, disco puxado para cima.
//   - 'parede' (elemento vertical):   camadas lado a lado na horizontal, disco puxado para o lado.
//
// O disco de tração (adesivo epóxi + placa metálica) é sempre desenhado automaticamente
// sobre a última camada (acabamento) — não faz parte da lista `camadas` do modelo.

const PRIMARY = '#1E3264'
const TEXT = '#1A2340'
const METAL = '#6B7280'

export const PALETA_CORES_CAMADAS: { nome: string; cor: string }[] = [
  { nome: 'Verde (Substrato / Concreto)', cor: '#B7D8AE' },
  { nome: 'Areia claro (Contrapiso)', cor: '#D9D2C5' },
  { nome: 'Castanho médio (Chapisco)', cor: '#AB9F82' },
  { nome: 'Bege (Emboço / Reboco)', cor: '#C9BFA6' },
  { nome: 'Pardo (Argamassa Colante)', cor: '#A69A7E' },
  { nome: 'Azul acinzentado (Cerâmica / Porcelanato)', cor: '#8393A7' },
  { nome: 'Off-white (Gesso / Pintura)', cor: '#F2EFE9' },
  { nome: 'Terracota (Alvenaria / Bloco)', cor: '#E8B98A' },
  { nome: 'Cinza azulado (Genérico)', cor: '#DCE1EA' },
]

export function corCamada(nome: string): string {
  const n = nome.toLowerCase()
  if (n.includes('cerâmic') || n.includes('ceramic') || n.includes('porcelanato')) return '#8393A7'
  if (n.includes('colante')) return '#A69A7E'
  if (n.includes('gesso')) return '#F2EFE9'
  if (n.includes('emboço') || n.includes('emboco')) return '#C9BFA6'
  if (n.includes('chapisco')) return '#AB9F82'
  if (n.includes('contrapiso')) return '#D9D2C5'
  if (n.includes('alvenaria') || n.includes('bloco')) return '#E8B98A'
  if (n.includes('concreto') || n.includes('substrato')) return '#B7D8AE'
  return '#DCE1EA'
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function camadasDeCorte(camadas: string[]): number {
  if (camadas.length === 0) return 0
  const acabamento = camadas[camadas.length - 1].trim().toLowerCase()
  if (acabamento.includes('contrapiso') || acabamento.includes('emboço') || acabamento.includes('emboco')) {
    return 0
  }
  const penultima = camadas.length >= 2 ? camadas[camadas.length - 2].trim().toLowerCase() : ''
  return penultima.includes('colante') ? 2 : 1
}

const DEFS = `<defs>
  <pattern id="hxMetal" width="4" height="4" patternUnits="userSpaceOnUse">
    <line x1="0" y1="0" x2="0" y2="4" stroke="${METAL}" stroke-width="2"/>
  </pattern>
</defs>`

/**
 * Gera o SVG do esquema de camadas de uma Situação, a partir da lista de camadas do
 * modelo escolhido (substrato → acabamento), da disposição do elemento ensaiado e das cores opcionais.
 */
export function svgEsquemaCamadas(camadas: string[], disposicao: 'piso' | 'parede', coresCamadas?: string[]): string {
  const lista = camadas.length > 0 ? camadas : ['Camada']
  return disposicao === 'piso' ? svgPiso(lista, coresCamadas) : svgParede(lista, coresCamadas)
}

// ── PISO: camadas empilhadas na vertical, disco puxado para cima ──────────────
function svgPiso(camadas: string[], coresCamadas?: string[]): string {
  const bandW = 170
  const bandH = 22
  const ox = 10
  const discoW = 34
  const rodH = 20
  const H_topo = rodH + 6
  const W = bandW + ox * 2
  const H = H_topo + camadas.length * bandH + 10

  const oy = H_topo
  let bands = ''
  let labels = ''

  // camadas[0] = base (ex.: concreto), desenhada embaixo; a última fica no topo (acabamento).
  camadas.forEach((nome, i) => {
    const idxFromTop = camadas.length - 1 - i
    const y = oy + idxFromTop * bandH
    const fill = coresCamadas?.[i] || corCamada(nome)
    bands += `<rect x="${ox}" y="${y}" width="${bandW}" height="${bandH}" fill="${escapeXml(fill)}" stroke="${PRIMARY}" stroke-width="1"/>`
    const ly = y + bandH / 2 + 3
    labels += `<text x="${ox + bandW / 2}" y="${ly}" text-anchor="middle" font-size="8" fill="${TEXT}" font-family="sans-serif">${escapeXml(nome.toUpperCase())}</text>`
  })

  const topoY = oy
  const cx = ox + bandW / 2
  const nCortes = camadasDeCorte(camadas)

  // dois cortes paralelos finos ao lado da placa (até o fundo da argamassa colante ou só na camada de gesso)
  const corteW = 3
  const xEsq = cx - discoW / 2
  const xDir = cx + discoW / 2
  const corteH = nCortes * bandH
  const cortes = nCortes > 0
    ? `<rect x="${xEsq - corteW}" y="${topoY - 0.6}" width="${corteW}" height="${corteH + 0.6}" fill="#FFFFFF"/>
    <polyline points="${xEsq - corteW},${topoY} ${xEsq - corteW},${topoY + corteH} ${xEsq},${topoY + corteH} ${xEsq},${topoY}" fill="none" stroke="${PRIMARY}" stroke-width="0.8"/>
    <rect x="${xDir}" y="${topoY - 0.6}" width="${corteW}" height="${corteH + 0.6}" fill="#FFFFFF"/>
    <polyline points="${xDir},${topoY} ${xDir},${topoY + corteH} ${xDir + corteW},${topoY + corteH} ${xDir + corteW},${topoY}" fill="none" stroke="${PRIMARY}" stroke-width="0.8"/>`
    : ''

  // disco metálico + haste de tração sobre a superfície da última camada
  const discoY = topoY - 6
  const disco = `<rect x="${xEsq}" y="${discoY}" width="${discoW}" height="6" fill="url(#hxMetal)" stroke="${PRIMARY}" stroke-width="1"/>
    <line x1="${cx}" y1="${discoY - rodH + 6}" x2="${cx}" y2="${discoY}" stroke="${METAL}" stroke-width="2.4"/>
    <circle cx="${cx}" cy="${discoY - rodH + 6}" r="3.2" fill="${METAL}"/>`

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="width: 100%; max-width: ${Math.round(W * 1.25)}px; height: auto; display: block;" xmlns="http://www.w3.org/2000/svg">
    ${DEFS}
    ${bands}
    ${cortes}
    ${disco}
    ${labels}
  </svg>`
}

// ── PAREDE: camadas lado a lado na horizontal, disco puxado para o lado ───────
function svgParede(camadas: string[], coresCamadas?: string[]): string {
  const bandW = 26
  const bandH = 150
  const oy = 20
  const discoH = 30
  const rodW = 24
  const W_direita = rodW + 10
  const ox = 12
  const W = ox + camadas.length * bandW + W_direita
  const H = oy + bandH + 14

  let bands = ''
  let labels = ''

  // camadas[0] = base (ex.: substrato/alvenaria), desenhada à esquerda; a última = acabamento, à direita.
  camadas.forEach((nome, i) => {
    const x = ox + i * bandW
    const fill = coresCamadas?.[i] || corCamada(nome)
    bands += `<rect x="${x}" y="${oy}" width="${bandW}" height="${bandH}" fill="${escapeXml(fill)}" stroke="${PRIMARY}" stroke-width="1"/>`
    const lx = x + bandW / 2 + 3
    labels += `<text x="${lx}" y="${oy + bandH / 2}" text-anchor="middle" font-size="7.5" fill="${TEXT}" font-family="sans-serif" transform="rotate(-90,${lx},${oy + bandH / 2})">${escapeXml(nome.toUpperCase())}</text>`
  })

  const faceX = ox + camadas.length * bandW
  const cy = oy + bandH / 2
  const nCortes = camadasDeCorte(camadas)

  // dois cortes paralelos finos ao lado da placa (até o fundo da argamassa colante ou só na camada de gesso)
  const corteH = 3
  const yCima = cy - discoH / 2
  const yBaixo = cy + discoH / 2
  const corteW = nCortes * bandW
  const corteX = faceX - corteW
  const cortes = nCortes > 0
    ? `<rect x="${corteX}" y="${yCima - corteH}" width="${corteW + 0.6}" height="${corteH}" fill="#FFFFFF"/>
    <polyline points="${faceX},${yCima - corteH} ${corteX},${yCima - corteH} ${corteX},${yCima} ${faceX},${yCima}" fill="none" stroke="${PRIMARY}" stroke-width="0.8"/>
    <rect x="${corteX}" y="${yBaixo}" width="${corteW + 0.6}" height="${corteH}" fill="#FFFFFF"/>
    <polyline points="${faceX},${yBaixo} ${corteX},${yBaixo} ${corteX},${yBaixo + corteH} ${faceX},${yBaixo + corteH}" fill="none" stroke="${PRIMARY}" stroke-width="0.8"/>`
    : ''

  // disco metálico + haste de tração sobre a face da última camada
  const discoX = faceX
  const disco = `<rect x="${discoX}" y="${yCima}" width="6" height="${discoH}" fill="url(#hxMetal)" stroke="${PRIMARY}" stroke-width="1"/>
    <line x1="${discoX + 6}" y1="${cy}" x2="${discoX + rodW}" y2="${cy}" stroke="${METAL}" stroke-width="2.4"/>
    <circle cx="${discoX + rodW}" cy="${cy}" r="3.2" fill="${METAL}"/>`

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="width: 100%; max-width: ${Math.round(W * 1.25)}px; height: auto; display: block;" xmlns="http://www.w3.org/2000/svg">
    ${DEFS}
    ${bands}
    ${cortes}
    ${disco}
    ${labels}
  </svg>`
}
