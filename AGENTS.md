# TECOMAT — Ensaios Diversos

Sistema web para geração de laudos de ensaios de inspeção predial.

## Regra de sincronização de contexto (OBRIGATÓRIA)

Este projeto é trabalhado em mais de uma ferramenta (Claude Code e Antigravity). Os arquivos `CLAUDE.md` e `AGENTS.md` na raiz devem ter **conteúdo idêntico**. Sempre que algo for registrado (decisões, mudanças, progresso de etapas, bugs, convenções), registre **nos dois arquivos**, com o mesmo texto, na mesma alteração. Ao terminar, confirme que os dois continuam iguais.

## Stack

- Next.js 15 + TypeScript
- Supabase (Auth + Storage)
- Vercel (deploy)
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
- Cada CP tem exatamente 2 fotos no memorial fotográfico (grade "1,2 / 3,4 / 5,6...").

### Estrutura do relatório mapeada

1. **Cabeçalho** (uma vez): Nº RLT, Cliente, Obra, Construtora, Endereço, Data de emissão, checkboxes de norma (NBR 13528-1:2019 + Parte 2/3, 13749:2013, 13753:1996, 13754:1996, 13755:2017).
2. **Textos fixos**: Objetivo, Equipamentos Utilizados, Tabela 01 (limites Ra) e Tabela 02 (critérios NBR 13755).
3. **Bloco "Sistema de Revestimento"** (repetido por Situação I, II, III...): cabeçalho da situação (tipo de revestimento, datas, nº de CPs, substrato, idade de ruptura, chapisco/traço, emboço/traço, argamassa colante/revestimento/dimensões), esquema SVG + observações, tabela de resultados por corpo de prova (Bloco/Junta, Tensão Ra, Prof. de ruptura, % forma de ruptura, Localização), linha de médias (Ra médio, valor mínimo de referência, DP, CV), umidade média, espessura média, e anexo fotográfico (2 fotos por CP).
4. **Notas finais** (fixas).

### Plano de etapas para retomar

1. ✅ `src/modules/aderencia/types.ts` — tipos (Situação, CP/corpo de prova, modelo de sistema de camadas, cabeçalho).
2. ✅ `src/modules/aderencia/modelosCamadas.ts` — 6 modelos pré-configurados (3 `piso`: sobre contrapiso, com cerâmica sobre contrapiso, cerâmica direto sobre concreto; 3 `parede`: com reboco, com cerâmica, com gesso), cada um com suas colunas de forma de ruptura.
3. ✅ `src/modules/aderencia/svgEsquema.ts` — geração do esquema SVG (`svgPiso`/`svgParede`), validado visualmente contra os ícones reais extraídos da planilha (com `max-width: 100%; height: auto` e margem horizontal simétrica em `svgPiso` para caber nos cards sem cortar).
4. ✅ `src/app/(dashboard)/ensaios/aderencia/page.tsx` — tela inicial de configuração: stepper de nº de situações (1-10) + seleção de modelo de camadas por situação (cards com thumbnail SVG), com o resultado confirmado exibido num resumo. Segue os padrões visuais/estruturais do módulo esclerometria (`Header` compartilhado, guard de auth via `supabase.auth.getUser()`, constantes de cor, `Campo`). Ainda não navega para o formulário por Situação (etapa 5) — só valida a configuração e mostra um resumo.
5. ✅ Formulário por Situação (`SituacaoForm` dentro de `page.tsx`, navegação por abas I/II/III... entre situações): cabeçalho da situação (14 campos), esquema SVG + observações, tabela de corpos de prova com colunas de forma de ruptura dinâmicas por modelo, upload de 2 fotos por CP (`FotoSlot`, comprime via canvas igual pacometria/esclerometria — `MAX 800px`, JPEG q=0.65), e cálculo automático de Ra médio/prof. ruptura média/DP/CV em `src/modules/aderencia/calculos.ts` (`calcularEstatisticasCPs`, DP amostral com n-1, mesmo critério do pacometria). Umidade média e espessura média do revestimento são **campos manuais** (não computados), conforme decisão já registrada de não replicar o motor de cálculo bruto da planilha (`DADOS`).
6. ✅ Autosave em localStorage (`tecomat_aderencia_v1`, padrão `salvarLocal`/`carregarLocal` do pacometria/esclerometria): persiste `etapa`, `numSituacoes`, `modeloPorSituacao`, `situacoes` e `situacaoAtual`, com debounce de 500ms e indicador "Salvo" por 1,8s. Fotos **nunca são persistidas** — removidas antes de gravar e forçadas a `null` ao carregar, mesma decisão já documentada para o esclerometria (não gerenciar upload/armazenamento de arquivos grandes no localStorage).
7. ✅ `public/modelo_aderencia.docx` — gerado programaticamente por `scripts/build-modelo-aderencia.js` (não editado à mão no Word — o XML é frágil demais para isso). O script clona `modelo_esclerometria.docx` para reaproveitar `styles.xml`/tema/header-footer com letterhead, remove a mídia antiga não usada (58 KB no final, era 2,7 MB), e substitui só o `word/document.xml`. Rodar `node scripts/build-modelo-aderencia.js` para regenerar depois de qualquer edição de conteúdo/layout.
   - **Decisão de arquitetura (confirmada com o usuário)**: manter geração em `.docx` (não `.xlsx`) — reaproveita toda a infraestrutura de `pizzip`/`docxtemplater`/injeção de imagem já validada no esclerometria; gerar `.xlsx` exigiria uma lib nova (ex. ExcelJS) e duplicar essa infraestrutura só para este módulo.
   - **Colunas de forma de ruptura NÃO viram colunas de tabela dinâmicas.** Testado e descartado: tentar multiplicar `<w:tc>` por linha via loop de célula do docxtemplater sem conseguir verificar visualmente (sem LibreOffice/Word disponível no ambiente) era arriscado demais — um teste real revelou que colchetes dentro de uma única célula apenas concatenam texto (`"001000"` ilegível), não criam células novas. Solução adotada: a célula "Forma de ruptura (%)" lista `[[nome]]: [[valor]]%` em um parágrafo por camada, via `[[#colunas]]...[[/colunas]]` (loop de parágrafo dentro da própria célula — mesma técnica, comprovadamente robusta, do loop `[[#situacoes]]`). Suporta qualquer nº de colunas por modelo sem risco estrutural.
   - **Contrato de dados que a etapa 8 precisa montar**: `situacoes[].corposDeProva[].colunas` deve ser um array achatado `[{ nome, valor }]`, combinando `modelo.colunasFormaRuptura` (nomes, na ordem) com `corpoDeProva.formaRuptura` (valores) — não passar o `Record<string, number>` cru do tipo `CorpoDeProva.formaRuptura`.
   - **Loops usados** (delimitadores `[[ ]]`, iguais ao esclerometria): `[[#situacoes]]` (bloco inteiro "Sistema de Revestimento" + tabela + anexo fotográfico, repetido por situação — números de seção "1.", "2."... vêm do `numId=1` nativo do Word aplicado a cada `Ttulo1`, então se ajustam sozinhos independente de quantas situações existirem), `[[#corposDeProva]]` (linha da tabela de resultados + par de fotos no anexo), `[[#colunas]]` (linhas de forma de ruptura dentro da célula), `[[#campo]]`/`[[^campo]]` (checkbox ☒/☐ condicional das normas).
   - Placeholders de imagem (`esquemaImagem`, `foto1`, `foto2`, `resp_assinatura`) seguem o padrão esclerometria: docxtemplater grava uma string-marcador única (ex. `ESQUEMA_PLACEHOLDER_0`), e uma função `injetarX` faz a troca por `<w:drawing>` real no XML **depois** do `doc.render()` — a implementar na etapa 8.
   - Verificado rodando o `docxtemplater` real do projeto (não só inspeção visual) contra 2 situações fictícias com nº de colunas de forma de ruptura diferentes (4 e 10) — sem erros de template, sem tags `[[...]]` sobrando, sem XML vazado como texto. Sem LibreOffice disponível no ambiente para renderizar a PDF; pedido ao usuário para abrir o `.docx` de exemplo no Word e conferir visualmente.
   - **Bug real encontrado só ao testar no Word de verdade**: `xml.etree`/XML bem-formado **não é suficiente** para garantir que o Word abre o arquivo — um `<w:r>` (a tag de loop `[[#corposDeProva]]`) ficou solto direto dentro de `<w:tr>`, fora de qualquer `<w:tc>`, o que é XML válido mas viola o schema do OOXML (Word recusa abrir, "erro ao abrir o arquivo"). Corrigido embutindo a tag de abertura no `<w:t>` da primeira célula e a de fechamento na última célula — mesmo padrão comprovado do `[[#amostras]]` do esclerometria. Um segundo bug (vírgulas literais soltas entre células, de um `${array}` sem `.join('')` em `trow()`) foi achado e corrigido no mesmo passo. Validação real usada depois disso: `scripts/office/validate.py` da skill `docx` (XSD schema oficial do OOXML) — rodar essa validação sempre que o template for editado, `xml.etree` sozinho não pega esse tipo de erro.
8. ✅ Geração do DOCX — `src/lib/docx/aderencia.ts` (`montarDadosAderencia`, `injetarImagensAderencia`, formatadores) + `src/app/api/ensaios/aderencia/docx/route.ts` (docxtemplater com `{ paragraphLoop: true, linebreaks: true, delimiters: { start: '[[', end: ']]' }, nullGetter: () => '' }`). Reaproveita `registrarImagem`/`buildDrawingXml`/`injetarAssinatura`/`atualizarSumario` do esclerometria.
   - **Payload da rota**: `{ cabecalho, situacoes[], respNome, respCrea, respAssinaturaUrl }`. Cada situação é a `SituacaoAderencia` + `esquema` (`FotoAnexo` PNG). O **esquema SVG é rasterizado em PNG no navegador** (`src/modules/aderencia/svgParaPng.ts`, canvas, escala 3x) antes de enviar — DOCX não embute SVG de forma confiável e evita depender de `sharp` no servidor.
   - O servidor monta o contrato `colunas: [{ nome, valor }]` (a partir de `modelo.colunasFormaRuptura` + `formaRuptura`) e recalcula Ra médio/prof. média/DP/CV com `calcularEstatisticasCPs`. Números saem com vírgula decimal (`formatarNumero`); datas `aaaa-mm-dd` viram `dd/mm/aaaa`.
   - **Marcadores de imagem únicos** (`ESQUEMA_PH_<sit>_END`, `FOTO_PH_<sit>_<cp>_<1|2>_END`; o `_END` evita que `_1` case com `_10`). `injetarImagensAderencia` troca o `<w:t>` inteiro pelo `<w:drawing>` (rId/docPrId a partir de 2000, sem colidir com os 901-9xx do esclerometria). Esquema cabe em 4,6×6 cm; fotos de CP cabem em 8×6 cm **mantendo a proporção** (diferente do memorial do esclerometria, que é 8×6 fixo e distorce).
   - **Tela (`page.tsx`)**: adicionado formulário de **cabeçalho** (Nº RLT, cliente, obra, construtora, endereço, data de emissão + checkboxes das normas) no topo da etapa de configuração — antes não existia UI para isso — persistido no autosave (`cabecalho`), e botão **"Gerar relatório (.docx)"** na última situação (substituiu o "Finalizar (em breve)"). Responsável/CREA/assinatura vêm do `useUserStore` (sem opção "outro responsável" por enquanto).
   - **Fotos no Supabase Storage (resolve o limite de ~4,5 MB da Vercel)**: ao escolher uma foto de CP, o navegador comprime (800px, JPEG q=0.65) e envia para `POST /api/ensaios/aderencia/foto` (`src/app/api/ensaios/aderencia/foto/route.ts`), que grava no bucket privado `aderencia-fotos` (`src/lib/aderenciaStorage.ts`; criado automaticamente via service role na 1ª chamada, sem SQL/policy manual) em `<userId>/<uuid>.jpg` e devolve o `path` (campo novo `FotoAnexo.path`). Na geração, o front manda as fotos só com `path` (`base64: ''`) e a rota `docx` baixa do Storage (`resolverFotosDoStorage`), exigindo usuário autenticado e path dentro da pasta dele. Remover uma foto na tela chama `DELETE` no mesmo endpoint. Se o upload falhar, a foto segue com base64 (fallback). O esquema SVG→PNG continua indo em base64 (pequeno). Fotos continuam **não** sendo restauradas após refresh (autosave remove `fotos`); arquivos de laudos já gerados ficam no bucket (sem limpeza automática — considerar política de expiração no Supabase se o volume crescer).
9. 🟡 Teste ponta a ponta — `src/app/api/ensaios/aderencia/docx/route.test.ts` (vitest, `npm run test`; alias `@` configurado em `vitest.config.ts`): chama a rota real com o template real, 3 situações de modelos/colunas diferentes (4, 12 e 6 CPs), e verifica: sem `[[ ]]`/marcadores sobrando, XML com tags balanceadas, 35 `<w:drawing>` e 35 mídias registradas, escape de `& < > "`, nenhuma `<w:r>` solta em `<w:tr>`/entre `<w:tc>`, colunas de cada modelo presentes, checkboxes ☒/☐. Para gerar o arquivo e abrir no Word: `ADERENCIA_SAIDA=caminho.docx npx vitest run src/app/api/ensaios/aderencia`. **Pendente**: (a) abrir o .docx no Word de verdade e conferir layout/imagens; (b) o `scripts/office/validate.py` (XSD OOXML) citado na etapa 7 **não existe neste repositório nem há Python no ambiente** — a validação de schema não foi rodada, só as checagens estruturais acima; (c) testar o fluxo no navegador (rasterização SVG→PNG, upload de fotos reais e download).