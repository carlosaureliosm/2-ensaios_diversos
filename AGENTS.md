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

## Segurança (auditoria de 2026-11-09)

Auditoria feita com a metodologia `cloudflare/security-audit-skill`. Relatório fora do repositório, em `~/security-audit-skill/ensaios/run-1/REPORT.md`. Correções aplicadas:

- **Papel de admin fica em `app_metadata.role`, nunca em `user_metadata.role`.** O próprio usuário consegue editar `user_metadata` pelo navegador (`supabase.auth.updateUser({ data })` com a anon key pública), então qualquer técnico conseguia virar admin. Sempre usar os helpers `isAdmin`/`roleDe`/`usuarioAtual` de `src/lib/auth.ts`. A criação e a edição de usuários gravam o papel em `app_metadata`.
  - **Migração obrigatória (uma vez):** rodar `node scripts/migrar-roles-app-metadata.js` para listar os usuários e depois `--aplicar --admins email1,email2` informando os admins à mão. A lista atual de "admins" no `user_metadata` não é confiável. Até a migração rodar, ninguém é admin no site.
- **Toda rota em `src/app/api/` precisa checar a autenticação por conta própria** (`usuarioAtual()` → 401). O `middleware.ts` exclui `/api` do matcher. As rotas `docx` (aderência, esclerometria, resistividade) e `/api/maps/static` estavam abertas e agora exigem login.
- **Nunca fazer `fetch` de uma URL vinda do cliente (SSRF).** O campo `respAssinaturaUrl` agora só significa "usar a assinatura do usuário logado": o servidor baixa a imagem do Storage pelo `user_metadata.assinatura_path` (`baixarAssinaturaDoUsuario`) e ignora a URL enviada.
- Um usuário que não é admin não troca mais o próprio e-mail pelo `PATCH /api/users/[id]`, porque a API admin troca sem confirmação.
- `middleware.ts` usa `getUser()` (valida o token) em vez de `getSession()`. O `src/proxy.ts`, que era duplicado e não usado no Next 15, foi removido.
- Removido o `console.log` que imprimia a URL do Google Maps com a chave.
- Migração dos papéis executada em 2026-11-09: 5 admins (rodrigo@, alexandre@, albertramos@ e laudos@ no domínio tecomat.com.br, mais yanntecomat@gmail.com) e 2 usuários comuns. Commit `7c6cac0` na `main`.

### Revisão da auditoria (2026-11-17) — 2 melhorias aplicadas

Revisão do código dos commits `7c6cac0`/`3816818` confirmou que as correções acima são efetivas. Dois pontos de reforço (defesa em profundidade, não vulnerabilidades críticas) foram aplicados:

- **Troca da própria senha agora exige a senha atual.** Antes, `PATCH /api/users/[id]` deixava o próprio usuário (`isSelf`) trocar a senha sem confirmar a atual — uma sessão sequestrada (ex. XSS) travava o acesso da vítima. Novo helper `senhaAtualValida` em `src/lib/auth.ts` reautentica (via `signInWithPassword` com a anon key, sem afetar a sessão da requisição) antes de aceitar a troca quando `isSelf`. Campo novo `currentPassword` no body da rota e no formulário (`src/app/(dashboard)/usuarios/page.tsx`, campo "Senha Atual" exibido só quando o próprio usuário digita uma nova senha). Admin trocando a senha de **outro** usuário não precisa disso (ação administrativa).
- **Fim da URL assinada de 10 anos para a assinatura.** `POST /api/users/[id]/assinatura` gerava e persistia em `user_metadata.assinatura_url` uma URL assinada do Supabase Storage válida por 10 anos, devolvida também por `GET /api/users` — qualquer vazamento dessa URL expunha a imagem "para sempre" mesmo com o bucket privado. Agora só `assinatura_path` é persistido; a URL é sempre gerada sob demanda, com 1h de validade, por um novo `GET /api/users/[id]/assinatura` (guardado por `isAdmin`/`isSelf`, igual ao POST/DELETE). `GET /api/users` devolve `has_assinatura: boolean` em vez da URL. Front-end busca a URL de curta duração quando precisa exibir a prévia, via helper `src/lib/assinatura.ts` (`buscarUrlAssinatura`), usado em `userStore.ts`, `pacometria/page.tsx`, `resistividade/page.tsx` e no modal de `usuarios/page.tsx`.
- Build (`npx next build`) e suíte de testes (`npm run test`, 15 testes) validados após as duas mudanças.

### Pendências de segurança (manuais, a concluir pelo usuário)

1. **Trocar e restringir a `GOOGLE_MAPS_API_KEY`** (a chave antiga pode estar nos logs da Vercel). O site usa **só a Maps Static API**.
   - Situação em 2026-11-09: começou a criar a chave nova, mas o projeto aberto no Google Cloud só tem a **Gemini API** ativada. A chave atual do site deve estar em **outro projeto**.
   - Próximos passos:
     - (a) Em *APIs e serviços → Credenciais*, achar o projeto que tem a chave atual, comparando os últimos 4 caracteres com o `.env.local`.
     - (b) Nesse projeto, conferir em *Biblioteca* se a "Maps Static API" está ativada.
     - (c) Criar a chave nova com restrição de API = só "Maps Static API" e restrição de aplicativo = Nenhum (a Vercel não tem IP fixo).
     - (d) Trocar `GOOGLE_MAPS_API_KEY` na Vercel (*Settings → Environment Variables*), fazer o Redeploy e atualizar o `.env.local`.
     - (e) Testar o mapa num laudo de esclerometria ou resistividade.
     - (f) Excluir a chave antiga.
     - (g) Definir uma cota diária e um alerta de faturamento.
2. **Supabase:** confirmar que "Allow new users to sign up" está **desligado** (*Authentication → Sign In / Providers*). Ainda não confirmado.
- Dependências: Next 15.5.15 → 15.5.29 e vitest → 4.1.12 (`npm audit fix`). Resta o `postcss` embutido no Next 15, usado só no build com o CSS do próprio projeto. Corrigir exige migrar para o Next 16.
- Testes de regressão em `src/lib/auth.test.ts`: o papel é lido só de `app_metadata`, e as rotas docx/maps respondem 401 sem login e não fazem `fetch`.

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
5. ✅ Formulário por Situação (`SituacaoForm` dentro de `page.tsx`, navegação por abas I/II/III... entre situações): cabeçalho da situação fiel à planilha (5 pares de 2 colunas: tipo revestimento/data ensaio, nº CPs/data aplicação, substrato/idade ruptura, chapisco/traço, emboço/traço; seguido de faixa tripla: argamassa colante/revestimento/dimensões), esquema SVG + observações, tabela de corpos de prova com colunas de forma de ruptura dinâmicas por modelo, upload de 2 fotos por CP (`FotoSlot`, comprime via canvas igual pacometria/esclerometria — `MAX 800px`, JPEG q=0.65), e cálculo automático de Ra médio/prof. ruptura média/DP/CV em `src/modules/aderencia/calculos.ts` (`calcularEstatisticasCPs`, DP amostral com n-1, mesmo critério do pacometria). Umidade média e espessura média do revestimento ficam no rodapé da tabela (junto às médias), conforme ordem da planilha real.
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
9. ✅ Teste ponta a ponta — `src/app/api/ensaios/aderencia/docx/route.test.ts` (vitest, `npm run test`; alias `@` configurado em `vitest.config.ts`): 3 testes na suíte — (1) chama a rota real com o template real, 3 situações de modelos/colunas diferentes (4, 12 e 6 CPs), verificando sem `[[ ]]`/marcadores sobrando, XML com tags balanceadas, 35 `<w:drawing>` e 35 mídias registradas, escape de `& < > "`, nenhuma `<w:r>` solta em `<w:tr>`/entre `<w:tc>`, colunas de cada modelo presentes, checkboxes ☒/☐; (2) valida o download de fotos enviadas só com `path` do Supabase Storage e bloqueio de `path` de outro usuário; (3) valida a geração de laudo com modelo personalizado (camadas, cores e colunas de ruptura customizadas). Validado `npx next build` limpo e **conferido visualmente no Microsoft Word real** (exportando a PDF via Word COM e comparando página a página com o PDF exportado pelo Excel da aba `RAAC - SITUAÇÕES`).
   - **Fluxo completo validado no site real em produção (2026-11-17)**: preenchido 1 situação (modelo "Piso sobre contrapiso") com os 6 CPs, upload de 2 fotos reais no CP 1 via `POST /api/ensaios/aderencia/foto` (200, gravadas no bucket `aderencia-fotos` do Storage real) e geração do laudo via `POST /api/ensaios/aderencia/docx` (200). O `.docx` baixado foi inspecionado por script: zip íntegro, sem `[[ ]]`/`_PH_` sobrando, 5 mídias embutidas (esquema SVG→PNG rasterizado no navegador, assinatura real do usuário baixada do Storage, as 2 fotos de CP baixadas do Storage), 4 `<w:drawing>`, e o CP com Ra 0,25 MPa (abaixo de 0,30) saiu destacado em vermelho (`C00000`) como esperado. As 2 fotos de teste foram removidas do Storage depois (`DELETE` 200) para não deixar lixo na conta real.
10. ✅ **Modelo de sistema de camadas Personalizado** (`ID_MODELO_PERSONALIZADO = 'personalizado'` em `src/modules/aderencia/modelosCamadas.ts`):
    - Na seleção de modelo de cada Situação (`page.tsx`), além dos 6 modelos pré-configurados, há o card **"Personalizado (montar camadas e cores)"** (`EditorModeloPersonalizado`).
    - Permite escolher entre **Horizontal (Piso)** (`disposicao: 'piso'`) e **Vertical (Parede)** (`disposicao: 'parede'`), adicionar/remover/reordenar os sólidos retangulares (`camadas`), definir o nome de cada camada (com sugestões rápidas) e escolher a cor de cada sólido (`coresCamadas`, via paleta padrão do relatório ou seletor de cor livre `<input type="color">`), com pré-visualização ao vivo no mesmo estilo SVG (`svgEsquemaCamadas`).
    - **Totalmente responsivo para celulares e telas estreitas**: layout adaptativo sem overflow horizontal — cards de camada empilham posição e botões de ação (`↑`, `↓`, `×`) no topo, cor + input de nome flexível no centro e paleta de cores padrão sem recuos fixos; grid de 1 coluna no mobile e 2 colunas no desktop.
    - As colunas de **"Forma de Ruptura (%)"** são geradas automaticamente a partir das camadas escolhidas (`gerarColunasFormaRuptura`: camada + interface adjacente + `Vazios`, até 10 subcolunas), com suporte a edição manual completa (renomear, adicionar, remover colunas e botão para regerar automaticamente pelas camadas).
    - No `.docx` (`montarDadosAderencia` em `src/lib/docx/aderencia.ts`), `resolverModeloSituacao` usa `sit.modeloPersonalizado` e aplica `coresCamadas` nos quadradinhos coloridos da legenda (`QUAD_COR_<HEX>_END`).
11. ✅ **Layout compacto da Situação fiel à planilha RAAC (`SituacaoForm` em `page.tsx`)**:
    - Disposição dos campos do cabeçalho da situação em 5 pares de 2 colunas fiel à ordem e posições da planilha (Tipo de revestimento/Data ensaio, Nº CPs/Data aplicação, Substrato/Idade ruptura, Chapisco/Traço, Emboço/Traço), seguidos da faixa tripla (Argamassa colante/Revestimento/Dimensões).
    - Design compacto aproximando os campos: `gap: '6px 12px'` nas linhas, rótulos compactos (`fontSize: 10px`, `gap: 2px` com o input), inputs de 31px de altura com `padding: '5px 8px'`, textarea de observações enxuto (68px), tabela e rodapé de médias e umidade/espessura compactados.

12. ✅ **Ajustes de UX da tabela de resultados da Situação (2026-11-17/18, feitos no Claude Code; commits  c01437, 76705b9, merge do PR #1 2027949)** — só em src/app/(dashboard)/ensaios/aderencia/page.tsx:
    - **Sem rolagem horizontal**: a tabela de CPs usa 	ableLayout: 'fixed' + <colgroup> (larguras: nº 30, Ra/Prof 44/44, 54/54, colunas de forma de ruptura 36 cada, localização minWidth: 90, fotos 80); o minWidth: 760 foi removido. As colunas de ruptura foram de 28 para 36 px para não cortar números de 3 dígitos (ex: 100).
    - **Campos numéricos com vírgula decimal**: novo componente NumeroInput (texto com inputMode="decimal", só dígitos e uma vírgula, sem setas do 	ype="number", mantém texto local para não perder a vírgula digitada). Usado em Tensão Ra, Prof. ruptura, colunas de forma de ruptura e nos campos de umidade/espessura do rodapé. Valor continua 
umber | null no estado.
    - **FotoSlot menor** (36×36 px, antes 54×54) e botão de remover reduzido, para caber sem rolagem.
13. ✅ **Limites nos campos numéricos (2026-11-18)**: NumeroInput ganhou as props maxDecimais (padrão 2 casas após a vírgula) e maxInteiros. Todos os campos numéricos decimais (Ra, prof. ruptura, umidade, espessura) aceitam no máximo 2 casas decimais. Os campos de % de forma de ruptura usam maxDecimais={0} + maxInteiros={3}: só inteiros de até 3 dígitos.
    - Atualização: NumeroInput ganhou maxValor; os campos de % de forma de ruptura usam maxValor={100} e, se o usuário digitar acima de 100, o valor é limitado a 100.
14. ✅ **Modo celular (2026-11-18)**: (a) removida a rolagem lateral da página (grids com `minmax(min(100%, Npx), 1fr)`, bloco esquema+observações empilhado em ≤640px, `overflow-x` cortado em `html, body` e `.aderencia-main`); (b) a tabela RESULTADO DO ENSAIO, em telas ≤720px (hook `useIsMobile` em `page.tsx`), vira **um CP por vez**: setas ‹ ›, bolinhas de progresso (verde = Ra preenchido), campos grandes, forma de ruptura em grade de 3 colunas, fotos 64px e botão "Próximo CP". No desktop a tabela continua igual. O rodapé (médias, umidade, espessura) é o mesmo nos dois modos.
    - Reforço (2026-11-18): como `overflow-x: hidden` sozinho não impedia o arrastar lateral no celular, em ≤720px foram adicionados `touch-action: pan-y pinch-zoom` e `overscroll-behavior-x: none` em `html, body`, `overflow-x: clip`/`max-width: 100vw` no contêiner raiz da página e `min-width: 0` nos filhos de `.aderencia-main`. Causa exata do estouro de largura não foi medida (sem navegador no ambiente); se voltar a ocorrer, inspecionar no DevTools qual elemento tem `scrollWidth` maior que a tela.
    - Causa real do conteúdo cortado no celular (2026-11-18, achada com navegador em 360px): o `Header` compartilhado passava da largura da tela (`Sair` em ~359px numa tela de ~345px) porque a página Aderência não tinha o CSS mobile do cabeçalho que as outras páginas têm. Adicionado `@media (max-width: 600px)` com `.header-*`/`.signout-text`/`.sb-u` ao `<style>` de `aderencia/page.tsx` (mesmo padrão da esclerometria). Verificado em 360 e 320px: nenhum elemento passa da largura. Observação: em telas muito estreitas o link "Usuários" do menu fica parcialmente escondido atrás do avatar (igual às outras páginas). Para medir layout no navegador: `page.evaluate` é bloqueado no sandbox do subagente de browser; usar `boundingBox` dos elementos.
    - Validação final mobile (2026-11-18): testado no navegador em 440×956 (iPhone 16 Pro Max, todas as seções: configuração, topo, esquema, stepper, rodapé) com 0 overflows (largura `html` 424,8px), além de 390px, 375px, 360px e 320px, e validado pelo usuário no iPhone 14 físico e no DevTools após recarregamento forçado.

## Fluxo de entrega (registrado em 2026-11-18)

- Sempre que uma mudança no código for concluída e validada (
pm run test e 
px next build), fazer **commit e push direto para a main** sem precisar esperar confirmação separada.

15. ✅ **Croquis SVG, 8 modelos e construtor personalizado (2026-11-18, commits `cffb595`..`667511b`)** — `src/modules/aderencia/svgEsquema.ts`, `modelosCamadas.ts`, `types.ts`, `src/app/(dashboard)/ensaios/aderencia/page.tsx`:
    - **Croquis SVG (`svgEsquema.ts`)**: placa sempre na face externa da última camada com hachura perpendicular nas duas orientações (`hxMetal` no Piso, `hxMetalV` na Parede); cortes paralelos finos (`3 px`) ao lado da placa atravessando 0 camadas (superficial), 1 camada (Gesso, ou Contrapiso/Emboço com corte) ou 2 camadas (até o fundo da Argamassa Colante); nomes das camadas em chamadas externas (à direita no Piso, em escada abaixo na Parede) com largura dinâmica do `viewBox`.
    - **8 modelos pré-configurados (`types.ts`, `modelosCamadas.ts`)**: adicionado `profundidadeCorte?: number` em `ModeloSistemaCamadas` e os modelos `piso-contrapiso-corte` e `parede-reboco-corte` (`profundidadeCorte: 1`), mantendo `piso-contrapiso` e `parede-reboco` como superficiais (`0`).
    - **Construtor personalizado (`EditorModeloPersonalizado` em `page.tsx`)**: seletor **Superficial (sem corte) / Profundo (com corte)** quando o acabamento for `contrapiso`/`emboço`/`emboco`; lista suspensa (`<select>`) em ordem alfabética + campo livre por camada; `<input type="color">` em `42×40 px` e paleta de 9 cores em linha única no mobile; seção **Colunas de "Forma de Ruptura (%)"** em lista vertical com botões `↑` / `↓` / `×` e barra de adição no rodapé.
    - **Mobile sem auto-zoom**: em `<=720px`, campos (`input:not([type="color"]):not([type="checkbox"])`, `select`, `textarea`) usam `font-size: 16px !important` e `touch-action: pan-y`.
16. ✅ **Refinamentos de UX, estética e regras normativas (2026-11-18, commits `7ec8627`..`3fc0630`)** — `src/app/(dashboard)/ensaios/aderencia/page.tsx`, `src/modules/aderencia/types.ts`, `utils.ts`, `src/lib/docx/aderencia.ts`:
    - **Campos numéricos, máscara de data e JPEG 85% (`7ec8627`)**: `Nº RLT`, `Nº de corpos de prova` e `Idade de ruptura (dias)` restritos a dígitos; `Data do ensaio` e `Data de aplicação` com máscara progressiva `DD/MM/AAAA`; `comprimirImagem` ajustado de `0.65` para `0.85` (JPEG 85%, máx. 800 px).
    - **Estética "Opção 2 — Planilha Técnica Compacta" (`d308737`, `b682949`)**: grade contínua sem bordas individuais de input (foco azul via `.aderencia-grid-cell:focus-within`) aplicada na ficha **DADOS DA SITUAÇÃO** (5 pares de 2 colunas + faixa tripla + esquema/observações) e na tabela **RESULTADO DO ENSAIO** (agrupador `FORMA DE RUPTURA (%)`, badge `Soma` por linha e rodapé em faixa única `.aderencia-rodape-unico`).
    - **Espessura média automática (`47519b1`)**: calculada automaticamente a partir da média da coluna `Prof. (mm)` (`stats.profRupturaMedia`), tanto no rodapé da tela quanto no `.docx`.
    - **Nome do arquivo RLT e critério normativo de `Ra` (`3fc0630`)**: `formatarRltAderencia` movido para `src/modules/aderencia/utils.ts` gerando `RLT.LAU-XXX.AA-00` com ano dinâmico (aplicado no cabeçalho do `.docx` e no nome do arquivo baixado); adicionado `CriterioRa` (`'0.20' | '0.30' | 'nbr13755'`) com sugestão automática por normas + modelo + tipo (`sugerirCriterioRa`), seletor por situação, avaliação ao vivo do pano (`avaliarPanoRa`), destaque vermelho/âmbar na tabela e corte dinâmico no `.docx`.

### Cálculo da tensão Ra (2026-11-18)

O usuário **não digita Ra**: digita a **carga de ruptura em kgf** (`CorpoDeProva.cargaKgf`) e escolhe o **formato da placa** por situação (`SituacaoAderencia.formatoPlaca`: `circular` Ø 5 cm, padrão, ou `quadrada` 10×10 cm). `tensaoRa` (MPa) é calculada = `kgf × 9,80665 ÷ área(m²) ÷ 10⁶`, arredondada em 2 casas (decisão do usuário, 2026-11-18: assim 60 kgf na circular dá 0,30 e passa no limite ≥ 0,30) (`calcularTensaoRa`/`recalcularTensoes` em `src/modules/aderencia/calculos.ts`) e continua sendo o campo lido por estatísticas e DOCX. Trocar o formato recalcula todos os CPs. CPs antigos sem carga mantêm o `tensaoRa` já salvo. Teste: `src/modules/aderencia/calculos.test.ts`.

17. ✅ **Tela de configuração no padrão "planilha técnica" (2026-11-18)** — `aderencia/page.tsx`: os blocos *Cabeçalho do relatório*, *Número de situações* e *Situação N — Modelo de sistema de camadas* agora usam o componente `PainelPlanilha` (barra azul-escura de título + corpo em grade contínua, igual à ficha DADOS DA SITUAÇÃO). O cabeçalho usa `CelulaFicha` em 3 colunas (`.aderencia-cab-grid`, 1 coluna no celular) e as normas ficam em faixa cinza em 2 colunas (`.aderencia-normas-grid`).

## Padrão Visual Obrigatório dos Módulos (Planilha Técnica Compacta — registrado em 2026-11-19)

Todos os módulos de ensaio — os já prontos (`aderencia`, `esclerometria`, `resistividade`, `pacometria`) e **todos os próximos módulos** (`carbonatacao`, `ultrassom`, `potencial-corrosao` e futuros) — devem seguir obrigatoriamente a estética "Planilha Técnica Compacta" definida a partir do módulo de Aderência e centralizada em `src/components/PlanilhaUI.tsx`:

- **Primitivos compartilhados (`src/components/PlanilhaUI.tsx`)**: usar `PlanilhaStyles`, `PainelPlanilha`, `CelulaFicha`, `fichaInputStyle`, `tabelaHeaderStyle`, `tabelaThTextStyle` e `CORES_PLANILHA` em vez de criar seções com sombras difusas (`boxShadow`), `borderRadius: 12` ou cabeçalhos `EXCEL_BLUE` (`#002060`).
- **Paleta oficial**:
  - Barra de título de painel e ações primárias: `#1E3264` (`PRIMARY`); Modo Obra: `#2E7D32` (`GREEN`); edição ativa: `#8B6914`; destaque/gerar relatório: `#C8A020` (`GOLD`).
  - Fundo da página: `#F8F9FA`; superfície dos painéis: `#FFFFFF`; cabeçalhos de tabela e rodapés estatísticos: `#F1F5F9`; linhas zebradas e blocos secundários: `#F8FAFC`.
  - Bordas: painel externo e `thead` inferior `1px solid #94A3B8`; divisórias internas de células `1px solid #E2E8F0`; divisórias de rodapé estatístico `1px solid #CBD5E1`; `borderRadius: 8` em todos os painéis.
  - Tipografia: título da barra do painel `11.5px` uppercase `fontWeight: 800` branco (`letterSpacing: 0.06em`); rótulos de célula `9.5px` uppercase `fontWeight: 800` `#6B7490` (`letterSpacing: 0.04em`); cabeçalhos de tabela `9.5px` uppercase `fontWeight: 800` `#334155`; textos de página `#1A2340`.
- **Fichas técnicas em grade contínua**: usar `CelulaFicha` (título em cima + input limpo `fichaInputStyle` abaixo, `flex-direction: column`, nunca lado a lado com risco de colisão) dentro das classes `.planilha-grid-2`, `.planilha-grid-3` ou `.planilha-grid-rlt`, com foco azul na célula inteira (`.planilha-cell:focus-within`) e colapso automático para 1 coluna sem `border-right` em `<= 720px`.
- **Tabelas de resultado**: sempre dentro de `PainelPlanilha` com contador/badges à direita na barra `#1E3264`, cabeçalho `#F1F5F9` (`borderBottom: 1px solid #94A3B8`) e linhas zebradas `#FFFFFF` / `#F8FAFC`.
- **Cabeçalho de página**: filete lateral dourado (`borderLeft: 4px solid #C8A020`, `paddingLeft: 12`), título `19px` `fontWeight: 800` e subtítulo `12.5px` `#6B7490`.
### Atualizações registradas em 2026-11-19 (commits `9431b50`, `78e4767`, `1982ef8`, `ea0dec2`)

- **Dashboard (`src/components/EnsaioIcons.tsx`, `9431b50`)**: atualizados os ícones SVG de `pacometria` (aparelho emitindo ondas identificando aço atrás da parede), `carbonatacao` (borrifador aspergindo líquido em um pilar) e `aderencia` (camadas em perfil com cortes laterais, placa metálica e haste de tração).
- **Aderência — alinhamento e rodapé (`78e4767`)**: corrigida a sobreposição de rótulos e textos em `CelulaFicha` (removido `display: flex` residual de `.ficha-celula`), alinhados os seletores `Critério Ra` e `Placa` no cabeçalho de `DADOS DA SITUAÇÃO`, reorganizada a entrada de `RESULTADO DO ENSAIO` no mobile (sem campo órfão, badge `Soma`, fotos simétricas) e removida a métrica duplicada `Prof. média` mantendo apenas `Espessura média` (somente leitura, média automática das profundidades inseridas) em rodapé de 5 colunas.
- **Aderência — usabilidade da tabela e nº de CPs (`1982ef8`)**: `Nº de corpos de prova` agora permite apagar completamente durante a edição e assume `1` automaticamente no `onBlur` se ficar vazio; na tabela `RESULTADO DO ENSAIO`, `Enter` avança para a linha de baixo na mesma coluna em `Bloco`, `Junta`, `Carga`, `Prof.` e `Localização`, e avança para o item ao lado nas colunas de `Forma de Ruptura (%)` (passando para a primeira coluna da linha seguinte após a última).
- **Padronização visual (`ea0dec2`)**: criado `src/components/PlanilhaUI.tsx` e aplicada a estética Planilha Técnica Compacta em `esclerometria`, `resistividade` e `pacometria`.
- **Aderência — gráficos de resultado por situação (2026-11-19)**: adicionado src/modules/aderencia/svgGraficoResultado.ts (barras horizontais azuis #5B9BD5 com identificação das amostras no eixo Y e tensão Ra em [MPa] no eixo X, escala automática a partir de  ,00 até  ,50 ou teto dinâmico, e título editável opcional SituacaoAderencia.tituloGrafico). Exibido ao vivo em SituacaoForm (derencia/page.tsx) e rasterizado em PNG 3x (svgParaPng) no gerarRelatorio(). No relatório .docx (scripts/build-modelo-aderencia.js, public/modelo_aderencia.docx, src/lib/docx/aderencia.ts), entra no novo Capítulo **6. GRÁFICOS DE RESULTADO** (6.1 SITUAÇÃO I, 6.2 SITUAÇÃO II, ...) logo após o Capítulo 5 (Anexo de Fotos) e antes do quadro final NOTAS: + assinatura. Testes em src/modules/aderencia/svgGraficoResultado.test.ts e src/app/api/ensaios/aderencia/docx/route.test.ts.
- **Aderência — linha de limite normativa no gráfico (2026-11-19)**: svgGraficoResultado agora desenha linha(s) vertical(is) vermelha(s) (#C00000) com rótulo no topo variando conforme a norma/critério da situação (criterioRa explícito ou sugerido via sugerirCriterioRa(normas, modeloCamadasId, tipoRevestimento)): Limite 0,20 MPa (Tabela 01 — NBR 13749 parede interna/teto), Limite 0,30 MPa (Tabela 01 — NBR 13749 externa/cerâmica, NBR 13753, NBR 13754) ou duas linhas na NBR 13755 (Mín. 0,30 MPa sólida e Aprov. 0,50 MPa tracejada).
