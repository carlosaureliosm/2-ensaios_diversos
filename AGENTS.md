# TECOMAT — Ensaios Diversos

Sistema web para geração de laudos de ensaios de inspeção predial.

## Regra de sincronização de contexto (OBRIGATÓRIA)

Este projeto é trabalhado em mais de uma ferramenta (Claude Code e Antigravity). Os arquivos `CLAUDE.md` e `AGENTS.md` na raiz devem ter **conteúdo idêntico**. Sempre que algo for registrado (decisões, mudanças, progresso de etapas, bugs, convenções), registre **nos dois arquivos**, com o mesmo texto, na mesma alteração. Ao terminar, confirme que os dois continuam iguais.

## Stack

- Next.js 15 + TypeScript
- Supabase (Auth + Storage)
- Vercel (deploy) — conta no plano **Hobby** (verificado em 2026-11-09 via plugin Vercel; projeto `2-ensaios-diversos`, equipe `carlosaureliosms-projects`, Node 24.x, 1 build simultâneo, deploy automático da `main`)
- Zustand (estado global)
- pizzip + docxtemplater (geração DOCX)

## Estrutura principal

- `src/app/(dashboard)/ensaios/` — módulos de ensaio
- `src/app/api/` — rotas de API
- `src/components/` — componentes compartilhados (Header)
- `src/store/` — estado global (Zustand)
- `src/lib/` — lógica de negócio e utilitários
- `src/types/` — tipos TypeScript compartilhados
- `public/` — assets e templates DOCX

## Vercel — plano e limites

- Plano **Hobby**. Limite de ~4,5 MB por corpo de requisição em funções (por isso as fotos do módulo Aderência vão pelo Supabase Storage, não em base64 no POST).
- Cada falha de `npm run build` mantém no ar o deploy anterior e dispara e-mail de erro; em 2026-11-06 três commits seguidos (`b366216`, `654292e`, `2fd6d6a`) falharam por erro de tipo que só o `next build` detecta (corrigido em `3d089b8`). **Antes de todo push, rodar `npx next build`.**
- A rota `api/ensaios/aderencia/docx` ainda não define `export const maxDuration` (a de resistividade define 60). Pendente avaliar, pois a geração baixa muitas fotos do Storage; o limite de duração do Hobby não foi confirmado.

## Variáveis de ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_MAPS_API_KEY=
```

## Como rodar localmente

1. Clone o repositório
2. Pause a sincronização do Google Drive se o projeto estiver no Drive
3. `npm install`
4. Configure o `.env.local` com as variáveis acima
5. `npm run dev`

## Testes

```bash
npm run test
```

## Módulo Esclerometria — mudanças recentes

Arquivos principais: `src/app/(dashboard)/ensaios/esclerometria/page.tsx`, `src/lib/docx/esclerometria.ts`, `src/app/api/ensaios/esclerometria/docx/route.ts`.

### Croqui com N imagens

O campo "Incluir croqui com indicação dos elementos" deixou de aceitar apenas uma imagem — agora o usuário clica em "+ Adicionar imagem(ns)" quantas vezes quiser, cada imagem tem sua própria legenda editável, e no `.docx` gerado elas saem empilhadas (`foto / legenda / foto / legenda / ...`). A numeração de cada legenda usa um campo `SEQ Figura` nativo do Word, então ela se atualiza sozinha conforme fotos são adicionadas/removidas (sem lógica manual de contagem).

- Função `injetarCroquiMultiplo` em `src/lib/docx/esclerometria.ts` faz a injeção (N imagens + N legendas).
- A função antiga `injetarCroqui` (imagem única) foi **mantida** com a mesma assinatura porque o módulo `resistividade` (`src/app/api/ensaios/resistividade/docx/route.ts`) também a usa e ainda só suporta uma imagem — não renomear/alterar essa assinatura sem também migrar o resistividade.
- Cada run de legenda tem `w:rFonts` explícito para a fonte de tema (`asciiTheme`/`hAnsiTheme` = `minorHAnsi`, que no template é Calibri — "Calibri Corpo"). Sem isso, o estilo `Legenda` do Word cai em Times New Roman por padrão.

### Campos de impacto (golpes) — Dados de Campo e Modo Obra

Os 16 campos de impacto aceitam só dígitos, no máximo 2 caracteres (`maxLength={2}`), e o foco pula automaticamente para o campo seguinte assim que o 2º dígito é digitado — sem precisar de Tab, clique ou toque. Tab/Enter continuam funcionando como navegação manual (inclusive Shift+Tab para voltar).

### Memorial fotográfico (fotos por amostra)

- Tamanho fixo das fotos: **8 cm de largura × 6 cm de altura** (antes era altura fixa de 4,5 cm com largura proporcional à foto original).
- Bug corrigido: editar uma amostra já cadastrada (ícone de lápis) recalculava o registro do zero e descartava a foto já anexada (`fotoFile`/`fotoPreview`/`fotoWidth`/`fotoHeight`). Agora esses campos são preservados ao salvar a edição.

### Fotos não são persistidas (decisão deliberada)

Fotos anexadas (croqui e memorial) só existem em memória do navegador durante a sessão atual — não são salvas no `localStorage` nem em nenhum backend. Isso é proposital, para não precisar gerenciar upload/armazenamento de arquivos grandes. Consequências:

- Fechar a aba, dar refresh, ou recarregar após um novo deploy **perde as fotos anexadas** que ainda não foram usadas para gerar o relatório. Só sobrevivem até o clique em "Gerar relatório" (nesse momento são enviadas pro `route.ts` e embutidas no `.docx`).
- `salvarLocal`/`carregarLocal` (autosave do cabeçalho + tabela de amostras) sempre removem os campos de foto das amostras — no save, para não gravar lixo serializado (`File` vira `{}` no JSON); no load, para resetar o ícone da coluna FOTO ao estado "sem foto" e não sugerir visualmente que existe uma foto anexada quando na verdade ela já foi perdida.

## Módulo Aderência (em andamento)

Pacometria está pausado — prioridade atual é o módulo de aderência (`src/app/(dashboard)/ensaios/aderencia/`), que tem mais volume/complexidade (múltiplas "Situações" por relatório, cada uma com tabela de resultados de colunas dinâmicas e anexo fotográfico).

O trabalho anterior neste módulo foi perdido (feito em outro computador, formatado sem push) — retomado do zero em 2026-09-10.

### Planilha de referência

A aba **FLS.** citada originalmente não existe na planilha real fornecida pelo usuário (`RAAC - Resistência de Aderência à tração - REV.09(02-01-26) - 36 pontos (1).xls`, formato legado `.xls`/BIFF8, sem `xl/media` extraível por ferramentas comuns — as imagens embutidas foram recuperadas via parsing manual do stream OLE `Workbook`, procurando assinaturas JPEG/PNG). Abas reais:

- **`DADOS`, `DADOS 2..5`**: motor de cálculo bruto por corpo de prova — geometria (circular `d1/d2/dm` ou retangular `c1/c2`), leitura de carga (kgf/N), Ra circular/retangular calculado, % forma de ruptura por interface, profundidade de ruptura, controle de umidade (Mi/Mu/Ms → fórmula `W = [(Mu-Mi)-Ms]/Ms × 100`), DP/CV/máx/mín. **Não replicado no app** — decisão já tomada de entrada direta de Ra (MPa) e prof. ruptura por CP, sem recalcular a partir de carga/geometria (ver `types.ts`).
- **`IMAGENS`**: fonte dos ícones de croqui reais (ver `svgEsquema.ts` abaixo).
- **`RAAC - SITUAÇÕES`**: a folha de impressão do laudo em si (871 linhas, 5 situações completas de exemplo) — é o que confirma e detalha a estrutura já mapeada abaixo.

### Decisões de arquitetura já confirmadas

- **Situações**: quantidade fixa escolhida no início pelo usuário (não é adicionar/remover dinamicamente) — o formulário gera os blocos conforme a quantidade escolhida.
- **Forma de ruptura (colunas)**: definida por um **modelo pré-configurado de sistema de camadas** (ex: "Parede externa com cerâmica", "Piso com porcelanato"), que já traz as colunas corretas de interface entre camadas. A lista de colunas por modelo é **explícita, não derivada automaticamente** — confirmado na planilha real: a parede com cerâmica tem uma coluna extra `Sub/Emb` (ruptura que pula o chapisco inteiro), que uma regra genérica "camada a camada" não geraria.
- **Disposição do elemento (`piso` vs `parede`)**: cada modelo de camadas tem uma `disposicao` (`ModeloSistemaCamadas.disposicao`). `piso` = elemento horizontal, camadas empilhadas na vertical, disco de tração puxado pra cima. `parede` = elemento vertical, camadas lado a lado na horizontal, disco puxado pro lado. Isso vem do croqui real (aba IMAGENS): dois layouts distintos, não um só genérico.
- **Disco de tração**: o par "Adesivo (Base Epóxi)" + "Placa Metálica" aparece sempre no fim de todo esquema real, mas **não é uma camada configurável** — é um elemento fixo desenhado automaticamente por cima da última camada (acabamento) pela função de SVG, sempre presente independente do modelo.
- **Esquema (croqui)**: gerado dinamicamente em SVG a partir do modelo de camadas escolhido, no mesmo padrão do `svgOpcao`/`SvgSecao` do módulo pacometria (sem upload manual de imagem). Estilo replicado a partir dos ícones reais extraídos da aba IMAGENS: bloco de camadas coloridas + disco metálico hachurado + haste/círculo de tração + "patches" de hachura flanqueando o disco (núcleo cortado).
- Cada CP aceita 1 ou 2 fotos no memorial fotográfico: no relatório `.docx` entra 1 foto se apenas 1 foi anexada, ou as 2 se ambas foram anexadas, sempre com o nº do CP e o nome do ponto da amostra (`localizacao`) na legenda.

### Estrutura do relatório mapeada

1. **Cabeçalho** (uma vez): Nº RLT, Cliente, Obra, Construtora, Endereço, Data de emissão, checkboxes de norma (NBR 13528-1:2019 + Parte 2/3, 13749:2013, 13753:1996, 13754:1996, 13755:2017).
2. **Textos fixos**: Objetivo, Equipamentos Utilizados, Tabela 01 (limites Ra) e Tabela 02 (critérios NBR 13755).
3. **Capítulo 4 — "Sistema de Revestimento"** (repetido para todas as Situações I, II, III... antes do Anexo): cabeçalho da situação (tipo de revestimento, datas, nº de CPs, substrato, idade de ruptura, chapisco/traço, emboço/traço, argamassa colante/revestimento/dimensões), esquema SVG + legenda de camadas coloridas + observações, tabela de resultados por corpo de prova com 10 subcolunas verticais de Forma de Ruptura, destaque vermelho para `Ra < 0,30 MPa`, rodapé bipartido (Média/DP/CV + Umidade média/Espessura média) e notas referente ao ensaio.
4. **Capítulo 5 — "Anexo - Sistema de Revestimento (Imagens)"** (no final do relatório, após todas as situações): grade 2 colunas com 1 ou 2 fotos por CP conforme anexadas no site e caixinha de legenda com nº + ponto da amostra (`001 - <localizacao>`), seguido do quadro final `NOTAS:` + assinatura lado a lado.

### Plano de etapas para retomar

1. ✅ `src/modules/aderencia/types.ts` — tipos (Situação, CP/corpo de prova, modelo de sistema de camadas, cabeçalho).
2. ✅ `src/modules/aderencia/modelosCamadas.ts` — 6 modelos pré-configurados (3 `piso`: sobre contrapiso, com cerâmica sobre contrapiso, cerâmica direto sobre concreto; 3 `parede`: com reboco, com cerâmica, com gesso), cada um com suas colunas de forma de ruptura.
3. ✅ `src/modules/aderencia/svgEsquema.ts` — geração do esquema SVG (`svgPiso`/`svgParede`), validado visualmente contra os ícones reais extraídos da planilha (com `width: 100%; max-width: round(W*1.25)px; height: auto` e margem horizontal simétrica `ox=10` em `svgPiso` para preencher bem os cards sem cortar).
4. ✅ `src/app/(dashboard)/ensaios/aderencia/page.tsx` — tela inicial de configuração: cabeçalho do relatório + stepper de nº de situações (1-10) + seleção de modelo de camadas por situação (cards com thumbnail SVG em grid dentro de `<main style={{ maxWidth: 860 }}>` tipo folha A4 no Word, sem inputs esticados). Segue os padrões visuais/estruturais do módulo esclerometria (`Header` compartilhado, guard de auth via `supabase.auth.getUser()`, constantes de cor, `Campo`).
5. ✅ Formulário por Situação (`SituacaoForm` dentro de `page.tsx`, navegação por abas I/II/III... entre situações): cabeçalho da situação (14 campos), esquema SVG + observações, tabela de corpos de prova com colunas de forma de ruptura dinâmicas por modelo, upload de 2 fotos por CP (`FotoSlot`, comprime via canvas igual pacometria/esclerometria — `MAX 800px`, JPEG q=0.65), e cálculo automático de Ra médio/prof. ruptura média/DP/CV em `src/modules/aderencia/calculos.ts` (`calcularEstatisticasCPs`, DP amostral com n-1, mesmo critério do pacometria). Umidade média e espessura média do revestimento são **campos manuais** (não computados), conforme decisão já registrada de não replicar o motor de cálculo bruto da planilha (`DADOS`).
6. ✅ Autosave em localStorage (`tecomat_aderencia_v1`, padrão `salvarLocal`/`carregarLocal` do pacometria/esclerometria): persiste `etapa`, `numSituacoes`, `modeloPorSituacao`, `situacoes` e `situacaoAtual`, com debounce de 500ms e indicador "Salvo" por 1,8s. Fotos **nunca são persistidas** — removidas antes de gravar e forçadas a `null` ao carregar, mesma decisão já documentada para o esclerometria (não gerenciar upload/armazenamento de arquivos grandes no localStorage).
7. ✅ `public/modelo_aderencia.docx` — gerado programaticamente por `scripts/build-modelo-aderencia.js` (não editado à mão no Word — o XML é frágil demais para isso). O script clona `modelo_esclerometria.docx` para reaproveitar `styles.xml`/tema/logo, remove a mídia antiga não usada (~60 KB no final, era 2,7 MB), e substitui `word/document.xml`, `word/header1.xml` e `word/footer1.xml`. Rodar `node scripts/build-modelo-aderencia.js` para regenerar depois de qualquer edição de conteúdo/layout.
   - **Decisão de arquitetura (confirmada com o usuário)**: manter geração em `.docx` (não `.xlsx`) — reaproveita toda a infraestrutura de `pizzip`/`docxtemplater`/injeção de imagem já validada no esclerometria.
   - **Reformulação visual fiel à aba `RAAC - SITUAÇÕES` (2026-11-09)**:
     - Header (`word/header1.xml`) com logo TECOMAT à esquerda e título `ENSAIO DE RESISTÊNCIA DE ADERÊNCIA À TRAÇÃO EM REVESTIMENTO` + `[[num_rlt]]` à direita; Footer (`word/footer1.xml`) com revisão `RAAC - REV. 09 (02-01-26)`, endereço da TECOMAT e paginação `X/Y`.
     - Página 1 em ficha técnica compacta (borda preta, fundo branco e faixa cinza `#D9D9D9`), com Tabelas 01 e 02 usando mesclagem vertical (`vMerge`), cabendo inteira na 1ª folha.
     - **Ordem dos capítulos**: primeiro vêm **todas as situações** no Capítulo `4. SISTEMA DE REVESTIMENTO` (`4.1 SITUAÇÃO I`, `4.2 SITUAÇÃO II`..., 1 por página), e **no final do relatório** vem o Capítulo `5. ANEXO - SISTEMA DE REVESTIMENTO (IMAGENS)` (`5.1 SITUAÇÃO I`, `5.2 SITUAÇÃO II`...) seguido do quadro final `NOTAS:` + assinatura lado a lado.
     - **Quadro Esquema + Legenda + Observações**: coluna `ESQUEMA` girada 90° (`btLr`), desenho do esquema, **legenda de camadas com quadradinhos coloridos** (`QUAD_COR_<HEX>_END` trocado pós-render por run com `<w:shd>` e `<w:bdr>`) incluindo `ADESIVO (BASE EPÓXI)` e `PLACA METÁLICA`, e coluna `OBSERVAÇÕES:`.
     - **Tabela `RESULTADO DO ENSAIO` com 10 subcolunas verticais fixas (`col1`..`col10` / `v1`..`v10`)**: replica exatamente a grade da planilha (10 subcolunas sob `FORMA DE RUPTURA - (%)` com cabeçalhos girados a 90° via `btLr`; valores `> 0` preenchidos e `0` em branco), eliminando o empilhamento de texto.
     - **Limite de `0,30 MPa` na coluna `Tensão Ra`**: sinal `>` na subcoluna dedicada; valores `< 0,30 MPa` saem em **vermelho negrito** (`#C00000`) e `>= 0,30 MPa` em **preto negrito**.
     - **Anexo de fotos dinâmico (1 ou 2 fotos por CP) com nome do ponto na legenda**: se o CP tiver 1 foto inserida no site, entra só 1; se tiver 2, entram as 2 (agrupadas em pares na grade de 2 colunas). Abaixo de cada foto, a caixinha centralizada com borda exibe `001 - <localizacao>` (nº do CP com 3 dígitos + nome do ponto da amostra).
8. ✅ Geração do DOCX — `src/lib/docx/aderencia.ts` (`montarDadosAderencia`, `injetarImagensAderencia`, formatadores) + `src/app/api/ensaios/aderencia/docx/route.ts` (docxtemplater com `{ paragraphLoop: true, linebreaks: true, delimiters: { start: '[[', end: ']]' }, nullGetter: () => '' }`). Reaproveita `registrarImagem`/`buildDrawingXml`/`injetarAssinatura`/`atualizarSumario` do esclerometria.
   - **Payload da rota**: `{ cabecalho, situacoes[], respNome, respCrea, respAssinaturaUrl }`. Cada situação é a `SituacaoAderencia` + `esquema` (`FotoAnexo` PNG). O **esquema SVG é rasterizado em PNG no navegador** (`src/modules/aderencia/svgParaPng.ts`, canvas, escala 3x) antes de enviar — DOCX não embute SVG de forma confiável e evita depender de `sharp` no servidor.
   - O servidor preenche as 10 subcolunas `col1..col10` e `v1..v10` (a partir de `modelo.colunasFormaRuptura` + `formaRuptura`), `legendaCamadas`, `linhasFotos` (1 ou 2 fotos por CP com legenda `<numero3dig> - <localizacao>`), flags `raBaixo`/`raOk`/`raVazio` (corte em `0,30 MPa`) e recalcula Ra médio/prof. média/DP/CV com `calcularEstatisticasCPs`. Números saem com vírgula decimal (`formatarNumero`); datas `aaaa-mm-dd` viram `dd/mm/aaaa`.
   - **Marcadores de imagem únicos** (`ESQUEMA_PH_<sit>_END`, `FOTO_PH_<sit>_<cp>_<1|2>_END`; o `_END` evita que `_1` case com `_10`) e marcador de cor (`QUAD_COR_<HEX>_END`). `injetarImagensAderencia` troca cada marcador pelo XML correspondente (rId/docPrId a partir de 2000, sem colidir com os 901-9xx do esclerometria). Esquema cabe em 4,4×3,4 cm; fotos de CP cabem em 7,4×5,0 cm **mantendo a proporção**.
   - **Tela (`page.tsx`)**: adicionado formulário de **cabeçalho** (Nº RLT, cliente, obra, construtora, endereço, data de emissão + checkboxes das normas) no topo da etapa de configuração — antes não existia UI para isso — persistido no autosave (`cabecalho`), e botão **"Gerar relatório (.docx)"** na última situação (substituiu o "Finalizar (em breve)"). Responsável/CREA/assinatura vêm do `useUserStore` (sem opção "outro responsável" por enquanto).
   - **Fotos no Supabase Storage (resolve o limite de ~4,5 MB da Vercel)**: ao escolher uma foto de CP, o navegador comprime (800px, JPEG q=0.65) e envia para `POST /api/ensaios/aderencia/foto` (`src/app/api/ensaios/aderencia/foto/route.ts`), que grava no bucket privado `aderencia-fotos` (`src/lib/aderenciaStorage.ts`; criado automaticamente via service role na 1ª chamada, sem SQL/policy manual) em `<userId>/<uuid>.jpg` e devolve o `path` (campo novo `FotoAnexo.path`). Na geração, o front manda as fotos só com `path` (`base64: ''`) e a rota `docx` baixa do Storage (`resolverFotosDoStorage`), exigindo usuário autenticado e path dentro da pasta dele. Remover uma foto na tela chama `DELETE` no mesmo endpoint. Se o upload falhar, a foto segue com base64 (fallback). O esquema SVG→PNG continua indo em base64 (pequeno). Fotos continuam **não** sendo restauradas após refresh (autosave remove `fotos`); arquivos de laudos já gerados ficam no bucket (sem limpeza automática — considerar política de expiração no Supabase se o volume crescer).
9. 🟡 Teste ponta a ponta — `src/app/api/ensaios/aderencia/docx/route.test.ts` (vitest, `npm run test`; alias `@` configurado em `vitest.config.ts`): 3 testes na suíte — (1) chama a rota real com o template real, 3 situações de modelos/colunas diferentes (4, 12 e 6 CPs), verificando sem `[[ ]]`/marcadores sobrando, XML com tags balanceadas, 35 `<w:drawing>` e 35 mídias registradas, escape de `& < > "`, nenhuma `<w:r>` solta em `<w:tr>`/entre `<w:tc>`, colunas de cada modelo presentes, checkboxes ☒/☐; (2) valida o download de fotos enviadas só com `path` do Supabase Storage e bloqueio de `path` de outro usuário; (3) valida a geração de laudo com modelo personalizado (camadas, cores e colunas de ruptura customizadas). Validado `npx next build` limpo e **conferido visualmente no Microsoft Word real** (exportando a PDF via Word COM e comparando página a página com o PDF exportado pelo Excel da aba `RAAC - SITUAÇÕES`). **Pendente**: testar o fluxo completo no site real (rasterização SVG→PNG, upload de fotos no Storage real e download do .docx).
10. ✅ **Modelo de sistema de camadas Personalizado** (`ID_MODELO_PERSONALIZADO = 'personalizado'` em `src/modules/aderencia/modelosCamadas.ts`):
    - Na seleção de modelo de cada Situação (`page.tsx`), além dos 6 modelos pré-configurados, há o card **"Personalizado (montar camadas e cores)"** (`EditorModeloPersonalizado`).
    - Permite escolher entre **Horizontal (Piso)** (`disposicao: 'piso'`) e **Vertical (Parede)** (`disposicao: 'parede'`), adicionar/remover/reordenar os sólidos retangulares (`camadas`), definir o nome de cada camada (com sugestões rápidas) e escolher a cor de cada sólido (`coresCamadas`, via paleta padrão do relatório ou seletor de cor livre `<input type="color">`), com pré-visualização ao vivo no mesmo estilo SVG (`svgEsquemaCamadas`).
    - **Totalmente responsivo para celulares e telas estreitas**: layout adaptativo sem overflow horizontal — cards de camada empilham posição e botões de ação (`↑`, `↓`, `×`) no topo, cor + input de nome flexível no centro e paleta de cores padrão sem recuos fixos; grid de 1 coluna no mobile e 2 colunas no desktop.
    - As colunas de **"Forma de Ruptura (%)"** são geradas automaticamente a partir das camadas escolhidas (`gerarColunasFormaRuptura`: camada + interface adjacente + `Vazios`, até 10 subcolunas), com suporte a edição manual completa (renomear, adicionar, remover colunas e botão para regerar automaticamente pelas camadas).
    - No `.docx` (`montarDadosAderencia` em `src/lib/docx/aderencia.ts`), `resolverModeloSituacao` usa `sit.modeloPersonalizado` e aplica `coresCamadas` nos quadradinhos coloridos da legenda (`QUAD_COR_<HEX>_END`).
