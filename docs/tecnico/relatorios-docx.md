# Relatórios DOCX — Padrão, Templates e Assinatura Dupla

Todos os laudos são gerados no servidor com `pizzip` + `docxtemplater` (`delimiters: { start: '[[', end: ']]' }`, `paragraphLoop: true`, `linebreaks: true`, `nullGetter: () => ''`).

## Identidade visual padrão (Página 1, Header, Margens)
A página 1 e o estilo do módulo **Aderência** são o padrão oficial para todos os módulos (prontos e futuros). Relatórios **não têm capa nem sumário**.

- **Header (`word/header1.xml`):** tabela 2 colunas `[1900, 3100]` com logo TECOMAT à esquerda e título do ensaio em caixa alta + `[[num_rlt]]` à direita, encostando na tabela `CLIENTE:`.
- **Margens (`<w:pgMar>`):** `top="1020" right="720" bottom="900" left="720" header="284" footer="227"`.
- **Footer:** paginação `X/Y` (em aderência inclui também revisão `RAAC - REV. 09 (02-01-26)` e endereço da TECOMAT).
- **Página 1:** tabela `CLIENTE / OBRA / ATT. + DATA DE EMISSÃO / ENDEREÇO` → quadro `NORMA(S) DE REFERÊNCIA` → faixa cinza `ENSAIO DE [[nome_ensaio]]` → conteúdo (`1. INTRODUÇÃO`, etc.) sem quebra de página. A linha antiga `[[segunda_data]]` ("Recife, ...") não é mais usada.
- **Fonte em runs injetados:** sempre definir `w:rFonts` explícito (`asciiTheme`/`hAnsiTheme="minorHAnsi"`, Calibri Corpo no template), senão estilos como `Legenda` caem em Times New Roman.

## Assinatura dupla padronizada
Todos os laudos encerram com o quadro final `NOTAS` + 2 assinaturas lado a lado (tabela `[2500, 2500]`, bordas externas médias e internas finas):
- Se `notas` preenchido (`[[#notas]]`): célula superior mesclada (`gridSpan="2"`) com `NOTAS:` + `[[notas]]` acima das 2 assinaturas. Se vazio (`[[^notas]]`): apenas a linha das 2 assinaturas com borda superior média.
- **Esquerda (fixa — gestor do setor/ARTs):** **João Ribeiro de Carvalho** — `Engenheiro Civil` — `CREA Nº49780 – PE`, com imagem embutida no template em `word/media/image6.jpeg` (não expor em `public/`).
- **Direita (dinâmica — engenheiro do ensaio):** `[[resp_assinatura]]` + `[[resp_nome]]` + `Engenheiro Civil` + `CREA Nº [[resp_crea]]`, baixada no servidor via `baixarAssinaturaDoUsuario(user)` ou recebida em base64 quando "Outro engenheiro responsável".

## Scripts de geração/manutenção de templates
- `scripts/build-modelo-aderencia.js`: gera `public/modelo_aderencia.docx` clonando `public/modelo_esclerometria.docx` (reaproveita `styles.xml`, tema, logo e `word/media/image6.jpeg` em `rId13`), remove mídia não usada e substitui `document.xml`, `header1.xml` e `footer1.xml`. Nunca editar `modelo_aderencia.docx` à mão no Word — editar o script e rodar `node scripts/build-modelo-aderencia.js`.
- `scripts/aplicar-pagina1-padrao.js`: aplica de forma idempotente o padrão de página 1, header, margens e quadro final de notas/assinaturas em `modelo_esclerometria.docx` e `modelo_resistividade.docx`, removendo capa/sumário e imagens órfãs.
  - Esclerometria: `NBR 7584:2026` no DOCX (observação: na tela/PDF client-side de `esclerometria/page.tsx` ainda consta `NBR 7584:2012`).
  - Resistividade: `AASHTO T 358`, `RILEM TC 154-EMC (2003)`, `CEB-192 (1989)`, `COST 509`, e `manterTabelaJunta` aplica `<w:cantSplit/>` + `<w:keepNext/>` na Tabela 1.

## Estado dos templates por módulo
- **Aderência:** `public/modelo_aderencia.docx` (`rId13 -> image6.jpeg`), rota `api/ensaios/aderencia/docx/route.ts` (ainda sem `export const maxDuration` — avaliar).
- **Esclerometria:** `public/modelo_esclerometria.docx` (`rId13 -> image6.jpeg`), rota `api/ensaios/esclerometria/docx/route.ts`.
- **Resistividade:** `public/modelo_resistividade.docx` (`rId11 -> image6.jpeg`), rota `api/ensaios/resistividade/docx/route.ts` (`maxDuration = 60`). Reutiliza `injetarCroqui` (imagem única) de `src/lib/docx/esclerometria.ts` — **não alterar a assinatura de `injetarCroqui`** sem migrar resistividade.
- **Pacometria e futuros** (`carbonatacao`, `ultrassom`, `potencial-corrosao`): ainda sem rota DOCX; ao implementar, iniciar já no padrão acima.
