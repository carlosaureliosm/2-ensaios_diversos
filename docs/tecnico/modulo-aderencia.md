# Módulo Aderência (RAAC)

Arquivos principais: `src/app/(dashboard)/ensaios/aderencia/page.tsx`, `src/modules/aderencia/*`, `src/lib/docx/aderencia.ts`, `src/lib/aderenciaStorage.ts`, `src/app/api/ensaios/aderencia/{docx,foto}/route.ts`, `scripts/build-modelo-aderencia.js`.

## Decisões de arquitetura e domínio
- **Situações:** quantidade fixa (1–10) escolhida na configuração inicial; abas `I`, `II`, `III`... em `SituacaoForm`.
- **8 modelos pré-configurados + Personalizado (`src/modules/aderencia/modelosCamadas.ts`):**
  - 4 `piso` (horizontal, camadas empilhadas na vertical, disco puxado pra cima) e 4 `parede` (vertical, camadas lado a lado, disco puxado pro lado), incluindo variantes superficiais (`profundidadeCorte: 0`) e com corte (`profundidadeCorte: 1`, ex: `piso-contrapiso-corte`, `parede-reboco-corte`).
  - Lista de colunas de `Forma de Ruptura (%)` por modelo é **explícita** (não derivada automaticamente — ex.: parede com cerâmica tem `Sub/Emb` pulando o chapisco).
  - **Personalizado (`ID_MODELO_PERSONALIZADO = 'personalizado'`):** `EditorModeloPersonalizado` permite escolher piso/parede, superficial/profundo (quando acabamento é contrapiso/emboço), camadas + cores (paleta 9 cores + `<input type="color">`) e edição completa das colunas de ruptura (`gerarColunasFormaRuptura`, até 10 subcolunas).
- **Cálculo de Tensão Ra (`src/modules/aderencia/calculos.ts`):**
  - Usuário digita a **carga em kgf** (`CorpoDeProva.cargaKgf`) e escolhe o **formato da placa** por situação (`circular` Ø 5 cm padrão ou `quadrada` 10×10 cm).
  - `tensaoRa` (MPa) = `kgf × 9,80665 ÷ área(m²) ÷ 10⁶`, **arredondada em 2 casas** (decisão do usuário: 60 kgf na circular dá `0,30` e passa no limite `>= 0,30`). Trocar formato recalcula todos os CPs; CPs antigos sem carga mantêm o `tensaoRa` salvo.
  - `calcularEstatisticasCPs` usa DP amostral (`n - 1`). **Espessura média** é calculada automaticamente pela média de `Prof. (mm)` (`stats.profRupturaMedia`), somente leitura na tela e no DOCX.
- **Critério normativo de Ra (`src/modules/aderencia/utils.ts`):**
  - `CriterioRa`: `'0.20' | '0.30' | 'nbr13755'`, com sugestão automática por normas + modelo + tipo (`sugerirCriterioRa`), seletor por situação, avaliação ao vivo do pano (`avaliarPanoRa`), destaque vermelho (`#C00000`) / âmbar na tabela e corte dinâmico no DOCX.
  - `formatarRltAderencia` gera `RLT.LAU-XXX.AA-00` com ano dinâmico (cabeçalho DOCX e nome do arquivo baixado).

## Croqui SVG e Gráfico de Resultado
- **Esquema SVG (`src/modules/aderencia/svgEsquema.ts`):** gerado dinamicamente; "Adesivo (Base Epóxi)" + "Placa Metálica" são elementos fixos desenhados na face externa da última camada (não configuráveis), com cortes paralelos finos (`3 px`) atravessando 0, 1 ou 2 camadas conforme `profundidadeCorte`.
- **Gráfico de Resultado (`src/modules/aderencia/svgGraficoResultado.ts`):** barras horizontais `#5B9BD5` por amostra, escala automática a partir de `0,00`, linha(s) vertical(is) vermelha(s) `#C00000` conforme critério normativo (`0,20`, `0,30` ou dupla `0,30` sólida + `0,50` tracejada na NBR 13755) e título editável (`SituacaoAderencia.tituloGrafico`). Aceita `compacto: true` (`width: 360`) no mobile e `width: 720` no desktop/DOCX.
- **Rasterização:** tanto o esquema quanto o gráfico são convertidos para PNG 3x no navegador via `src/modules/aderencia/svgParaPng.ts` antes do POST para o DOCX (evita `sharp` no servidor).

## UX da tela e autosave
- Autosave em `localStorage` (`tecomat_aderencia_v1`, debounce 500ms); **fotos nunca são persistidas** (removidas no save, zeradas no load).
- Tabela `RESULTADO DO ENSAIO`: `tableLayout: 'fixed'` + `<colgroup>` sem rolagem horizontal no desktop; em `<= 720px` (`useIsMobile`) vira modo 1 CP por vez (stepper com bolinhas).
- `NumeroInput`: vírgula decimal, `maxDecimais` (padrão 2), `maxInteiros`, `maxValor` (`100` em `Bloco`, `Junta` e `Forma de Ruptura (%)`). Sem "0" fantasma nas colunas de ruptura.
- Navegação por teclado na tabela: `Enter` desce na mesma coluna em `Bloco`, `Junta`, `Carga`, `Prof.`, `Localização`; nas colunas de `Forma de Ruptura (%)` avança para o lado (e suporta as 4 setas).

## Fotos no Supabase Storage (contorna limite de 4,5 MB da Vercel)
- Cada CP aceita 1 ou 2 fotos; navegador comprime (máx. 800 px, JPEG q=0.85) e envia para `POST /api/ensaios/aderencia/foto` → bucket privado `aderencia-fotos` (`<userId>/<uuid>.jpg`), retornando `FotoAnexo.path`.
- Na geração do DOCX, o front envia apenas `path` (`base64: ''`) e a rota baixa do Storage (`resolverFotosDoStorage`).

## Estrutura do DOCX (`src/lib/docx/aderencia.ts`)
- Capítulos em ordem: Página 1 + Tabelas 01/02 → **Cap. 4 (`4.1 SITUAÇÃO I`...)** com esquema + legenda colorida + tabela 10 subcolunas verticais (`btLr`, `col1..col10` / `v1..v10`) → **Cap. 5 (`Anexo - Imagens`, 1 ou 2 fotos por CP em grade 2 colunas, legenda `001 - <localizacao>`)** → **Cap. 6 (`Gráficos de Resultado`)** → quadro final `NOTAS:` + assinatura dupla.
- Marcadores pós-render (com `_END` para evitar colisão de prefixo): `ESQUEMA_PH_<sit>_END` (4,4×3,4 cm), `FOTO_PH_<sit>_<cp>_<1|2>_END` (7,4×5,0 cm proporcional), `GRAFICO_PH_<sit>_END` e `QUAD_COR_<HEX>_END`. IDs de `rId`/`docPrId` começam em `2000` (não colidem com `901–9xx` de esclerometria).
- Testes: `src/modules/aderencia/calculos.test.ts`, `src/modules/aderencia/svgGraficoResultado.test.ts`, `src/app/api/ensaios/aderencia/docx/route.test.ts`.
