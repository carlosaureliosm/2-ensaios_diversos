// Teste ponta a ponta da geração do laudo de Aderência (rota real + template real).
// Define ADERENCIA_SAIDA=<caminho.docx> para gravar o arquivo gerado e abri-lo no Word.

import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
import PizZip from 'pizzip'
import fs from 'fs'
import { POST } from '@/app/api/ensaios/aderencia/docx/route'
import {
  MODELOS_SISTEMA_CAMADAS,
  ID_MODELO_PERSONALIZADO,
  gerarColunasFormaRuptura,
} from '@/modules/aderencia/modelosCamadas'
import { criarCorpoDeProva } from '@/modules/aderencia/calculos'
import type { FotoAnexo, ModeloSistemaCamadas, SituacaoAderencia } from '@/modules/aderencia/types'

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) } }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        download: async (p: string) =>
          p.startsWith('user-1/')
            ? { data: new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')]), error: null }
            : { data: null, error: { message: 'nf' } },
      }),
    },
  }),
}))

// PNG 1x1 válido
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const foto = (w: number, h: number): FotoAnexo => ({ base64: PNG_1X1, contentType: 'image/png', width: w, height: h })

function situacao(numero: number, modeloId: string, nCPs: number, comFotos: boolean): SituacaoAderencia & { esquema: FotoAnexo } {
  const modelo = MODELOS_SISTEMA_CAMADAS.find(m => m.id === modeloId)!
  const cps = Array.from({ length: nCPs }, (_, i) => {
    const cp = criarCorpoDeProva(i + 1, modelo.colunasFormaRuptura)
    cp.bloco = `B${i + 1}`
    cp.junta = i % 2 ? 'Sim' : 'Não'
    cp.tensaoRa = 0.25 + i * 0.07
    cp.profRuptura = 2 + i * 0.5
    cp.localizacao = `Pano ${i + 1} & "teste" <ok>`
    modelo.colunasFormaRuptura.forEach((c, k) => { cp.formaRuptura[c] = k === 0 ? 100 : 0 })
    if (comFotos) cp.fotos = [foto(800, 600), foto(600, 800)]
    return cp
  })
  return {
    numero, tipoRevestimento: 'Cerâmica', dataEnsaio: '2026-10-05', numCPs: nCPs, dataAplicacao: '2026-08-01',
    substrato: 'Alvenaria', idadeRupturaDias: '28', chapisco: 'Sim', chapiscoTraco: '1:3', emboco: 'Sim',
    embocoTraco: '1:2:8', argamassaColante: 'AC-III', revestimento: 'Porcelanato', dimensoesCm: '60x60',
    modeloCamadasId: modeloId, observacoesEsquema: 'Obs <1> & "2"', corposDeProva: cps,
    umidadeMedia: 3.2, espessuraMediaRevestimento: 25, esquema: foto(220, 160),
  }
}

describe('geração DOCX de aderência (ponta a ponta)', () => {
  it('gera um laudo válido com 3 situações de modelos/colunas diferentes', async () => {
    const [m0, m1, m2] = [
      MODELOS_SISTEMA_CAMADAS.find(m => m.id === 'piso-contrapiso')!,
      MODELOS_SISTEMA_CAMADAS.find(m => m.disposicao === 'parede' && m.colunasFormaRuptura.length >= 7)!,
      MODELOS_SISTEMA_CAMADAS[1],
    ]
    const body = {
      cabecalho: {
        rltNumero: '45', cliente: 'Cliente & Cia', obra: 'Obra <X>', construtora: 'Construtora',
        endereco: 'Rua A, 1', dataEmissao: '2026-11-06',
        normas: { nbr13528_1: true, nbr13528_1_parte2: true, nbr13528_1_parte3: false, nbr13749: true, nbr13753: false, nbr13754: false, nbr13755: true },
      },
      situacoes: [situacao(1, m0.id, 4, true), situacao(2, m1.id, 12, true), situacao(3, m2.id, 6, false)],
      respNome: 'Eng. Fulano', respCrea: '12345',
    }

    const req = new NextRequest('http://localhost/api/ensaios/aderencia/docx', { method: 'POST', body: JSON.stringify(body) })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const buf = Buffer.from(await res.arrayBuffer())

    if (process.env.ADERENCIA_SAIDA) fs.writeFileSync(process.env.ADERENCIA_SAIDA, buf)

    const zip = new PizZip(buf)
    const xml = zip.file('word/document.xml')!.asText()

    // sem tags/marcadores sobrando
    expect(xml).not.toMatch(/\[\[|\]\]/)
    expect(xml).not.toMatch(/_PH_|PLACEHOLDER/)
    expect(xml).not.toContain('undefined')

    // XML bem-formado
    const pilha: string[] = []
    for (const m of xml.matchAll(/<(\/?)([\w:.-]+)(?:\s[^>]*?)?(\/?)>/g)) {
      if (m[3] === '/') continue
      if (m[1] === '/') expect(pilha.pop()).toBe(m[2])
      else pilha.push(m[2])
    }
    expect(pilha).toEqual([])

    // 3 situações → 3 headings "SITUAÇÃO I/II/III"
    expect(xml).toContain('SITUAÇÃO I')
    expect(xml).toContain('SITUAÇÃO II')
    expect(xml).toContain('SITUAÇÃO III')

    // imagens: 3 esquemas + (4+12)*2 fotos = 35 drawings
    expect((xml.match(/<w:drawing>/g) ?? []).length).toBe(35)
    const media = Object.keys(zip.files).filter(f => f.startsWith('word/media/aderencia_img_'))
    expect(media.length).toBe(35)

    // escape de XML preservado
    expect(xml).toContain('Cliente &amp; Cia')
    expect(xml).toContain('Obra &lt;X&gt;')

    // nenhuma <w:r> solta direto em <w:tr> / <w:tbl> (violaria o schema OOXML)
    expect(xml).not.toMatch(/<w:tr(?:\s[^>]*)?>(?:<w:trPr>.*?<\/w:trPr>)?<w:r[ >]/)
    expect(xml).not.toMatch(/<\/w:tc><w:r[ >]/)

    // colunas de forma de ruptura de cada modelo aparecem
    for (const m of [m0, m1, m2]) m.colunasFormaRuptura.forEach(c => expect(xml).toContain(c.replace(/&/g, '&amp;')))

    // checkboxes: parte2 marcada, parte3 desmarcada
    expect(xml).toContain('☒')
    expect(xml).toContain('☐')

    // rels e content types registrados
    expect(zip.file('word/_rels/document.xml.rels')!.asText()).toContain('media/aderencia_img_35.png')
    expect(zip.file('[Content_Types].xml')!.asText()).toContain('Extension="png"')
  })

  it('baixa fotos enviadas só com path do Storage e rejeita pasta de outro usuário', async () => {
    const mk = (path: string) => {
      const s = situacao(1, 'piso-contrapiso', 2, false)
      s.corposDeProva.forEach(cp => { cp.fotos = [{ base64: '', path, contentType: 'image/jpeg', width: 800, height: 600 }, null] })
      return s
    }
    const corpo = (path: string) => ({
      cabecalho: { rltNumero: '1', cliente: '', obra: '', construtora: '', endereco: '', dataEmissao: '', normas: { nbr13528_1: false, nbr13528_1_parte2: false, nbr13528_1_parte3: false, nbr13749: false, nbr13753: false, nbr13754: false, nbr13755: false } },
      situacoes: [mk(path)],
    })
    const chamar = (b: unknown) => POST(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify(b) }))

    const ok = await chamar(corpo('user-1/a.jpg'))
    expect(ok.status).toBe(200)
    const xml = new PizZip(Buffer.from(await ok.arrayBuffer())).file('word/document.xml')!.asText()
    expect((xml.match(/<w:drawing>/g) ?? []).length).toBe(3) // esquema + 2 fotos

    const negado = await chamar(corpo('outro-usuario/a.jpg'))
    expect(negado.status).toBe(500)
  })

  it('gera laudo com modelo personalizado (camadas, cores e colunas de ruptura customizadas)', async () => {
    const camadas = ['Substrato Especial', 'Chapisco Rolado', 'Massa Única']
    const colunasAuto = gerarColunasFormaRuptura(camadas)
    expect(colunasAuto).toEqual([
      'Sub Esp',
      'Sub Esp/Cha Rol',
      'Cha Rol',
      'Cha Rol/Mas Úni',
      'Massa Única',
      'Vazios',
    ])

    const modeloPersonalizado: ModeloSistemaCamadas = {
      id: ID_MODELO_PERSONALIZADO,
      nome: 'Personalizado',
      disposicao: 'parede',
      camadas,
      coresCamadas: ['#A1B2C3', '#FFAA00', '#DDEEFF'],
      colunasFormaRuptura: [...colunasAuto.slice(0, -1), 'Sub/Massa', 'Vazios'],
    }

    const cp = criarCorpoDeProva(1, modeloPersonalizado.colunasFormaRuptura)
    cp.tensaoRa = 0.42
    cp.profRuptura = 3.5
    cp.formaRuptura['Sub/Massa'] = 100

    const sitCustom: SituacaoAderencia & { esquema: FotoAnexo } = {
      numero: 1,
      tipoRevestimento: 'PERSONALIZADO',
      dataEnsaio: '2026-11-09',
      numCPs: 1,
      dataAplicacao: '2026-09-01',
      substrato: 'Substrato Especial',
      idadeRupturaDias: '28',
      chapisco: 'Chapisco Rolado',
      chapiscoTraco: '1:3',
      emboco: 'Massa Única',
      embocoTraco: '1:2:8',
      argamassaColante: '-',
      revestimento: '-',
      dimensoesCm: '10x10',
      modeloCamadasId: ID_MODELO_PERSONALIZADO,
      modeloPersonalizado,
      observacoesEsquema: 'Esquema personalizado',
      corposDeProva: [cp],
      umidadeMedia: 2.5,
      espessuraMediaRevestimento: 20,
      esquema: foto(220, 160),
    }

    const body = {
      cabecalho: {
        rltNumero: '99',
        cliente: 'Cliente Custom',
        obra: 'Obra Custom',
        construtora: 'Construtora',
        endereco: 'Rua B, 2',
        dataEmissao: '2026-11-09',
        normas: {
          nbr13528_1: true,
          nbr13528_1_parte2: false,
          nbr13528_1_parte3: false,
          nbr13749: false,
          nbr13753: false,
          nbr13754: false,
          nbr13755: false,
        },
      },
      situacoes: [sitCustom],
    }

    const res = await POST(new NextRequest('http://localhost/api/ensaios/aderencia/docx', { method: 'POST', body: JSON.stringify(body) }))
    expect(res.status).toBe(200)
    const xml = new PizZip(Buffer.from(await res.arrayBuffer())).file('word/document.xml')!.asText()

    expect(xml).toContain('SUBSTRATO ESPECIAL')
    expect(xml).toContain('CHAPISCO ROLADO')
    expect(xml).toContain('MASSA ÚNICA')
    expect(xml).toContain('Sub/Massa')
    expect(xml).toContain('w:fill="FFAA00"')
    expect(xml).not.toMatch(/QUAD_COR_/)
  })
})
