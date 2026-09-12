# TECOMAT — Ensaios Diversos

Sistema web para geração de laudos de ensaios de inspeção predial.

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
3. ✅ `src/modules/aderencia/svgEsquema.ts` — geração do esquema SVG (`svgPiso`/`svgParede`), validado visualmente contra os ícones reais extraídos da planilha.
4. ✅ `src/app/(dashboard)/ensaios/aderencia/page.tsx` — tela inicial de configuração: stepper de nº de situações (1-10) + seleção de modelo de camadas por situação (cards com thumbnail SVG), com o resultado confirmado exibido num resumo. Segue os padrões visuais/estruturais do módulo esclerometria (`Header` compartilhado, guard de auth via `supabase.auth.getUser()`, constantes de cor, `Campo`). Ainda não navega para o formulário por Situação (etapa 5) — só valida a configuração e mostra um resumo.
5. ⬜ Implementar o formulário por Situação: cabeçalho da situação + tabela de corpos de prova (entrada de dados + cálculo automático de médias, DP, CV) + upload de fotos por CP.
6. ⬜ Implementar autosave em localStorage (padrão `salvarLocal`/`carregarLocal` do pacometria).
7. ⬜ Criar `public/modelo_aderencia.docx` a partir do modelo atual em Excel (repaginado).
8. ⬜ Criar `src/lib/docx/aderencia.ts` e `src/app/api/ensaios/aderencia/docx/route.ts`, reaproveitando o padrão do módulo esclerometria (memorial fotográfico em grade, injeção de imagens/assinatura, placeholders `[[...]]`).
9. ⬜ Testar geração do DOCX ponta a ponta com um relatório de exemplo (múltiplas situações).
