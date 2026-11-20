# Módulo Esclerometria

Arquivos principais: `src/app/(dashboard)/ensaios/esclerometria/page.tsx`, `src/lib/docx/esclerometria.ts`, `src/lib/esclerometria/calcularAmostra.ts`, `src/app/api/ensaios/esclerometria/docx/route.ts`.

## Croqui com N imagens
- O usuário pode anexar N imagens de croqui (`+ Adicionar imagem(ns)`), cada uma com legenda editável. No `.docx` saem empilhadas (`foto / legenda / ...`) com numeração automática via campo `SEQ Figura` nativo do Word.
- Função `injetarCroquiMultiplo` em `src/lib/docx/esclerometria.ts` faz a injeção e define `w:rFonts` explícito (`minorHAnsi`, Calibri Corpo) em cada run de legenda.
- **Armadilha:** a função antiga `injetarCroqui` (imagem única) continua em uso pelo módulo `resistividade` (`src/app/api/ensaios/resistividade/docx/route.ts`) — não renomear nem alterar sua assinatura sem migrar resistividade junto.

## Campos de impacto e bigorna
- Os 16 campos de impacto (Dados de Campo e Modo Obra) e os 10 campos da Verificação do Aparelho (Bigorna, `bigornaRefs`) usam `inputMode="numeric" pattern="[0-9]*" maxLength={2}`: aceitam apenas dígitos e avançam o foco automaticamente para o próximo campo ao digitar o 2º dígito. `Tab`/`Shift+Tab`/`Enter` continuam funcionando.

## Memorial fotográfico e persistência
- Tamanho fixo das fotos no `.docx`: **8 cm × 6 cm**.
- Ao editar uma amostra existente (ícone de lápis), preservar `fotoFile`/`fotoPreview`/`fotoWidth`/`fotoHeight` ao recalcular o registro.
- **Fotos não são persistidas (decisão deliberada):** croqui e fotos do memorial ficam apenas em memória durante a sessão (não vão para `localStorage` nem Storage). `salvarLocal`/`carregarLocal` sempre removem os campos de foto para evitar serializar `File` como `{}` e para não exibir ícone de foto anexada após reload.

## Norma
- O template `public/modelo_esclerometria.docx` usa **NBR 7584:2026** (página 1 e corpo). Na tela/PDF client-side de `esclerometria/page.tsx` ainda consta `NBR 7584:2012` (avaliar atualização quando mexer na tela).
