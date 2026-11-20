# Padrão Visual Obrigatório — Planilha Técnica Compacta

Todos os módulos de ensaio — prontos (`aderencia`, `esclerometria`, `resistividade`, `pacometria`) e futuros (`carbonatacao`, `ultrassom`, `potencial-corrosao`) — devem seguir obrigatoriamente esta estética centralizada em `src/components/PlanilhaUI.tsx`.

## Primitivos obrigatórios (`src/components/PlanilhaUI.tsx`)
Usar `PlanilhaStyles`, `EnsaioCabecalho`, `EnsaioTabs`, `PainelPlanilha`, `CelulaFicha`, `InteiroInput`, `fichaInputStyle`, `tabelaHeaderStyle`, `tabelaThTextStyle` e `CORES_PLANILHA`.
Não criar cabeçalhos/abas customizados, cartões com `boxShadow` difuso, `borderRadius: 12` ou cabeçalhos `#002060`.

## Paleta oficial (`CORES_PLANILHA`)
- Barra de título de painel e ações primárias: `#1E3264` (`PRIMARY`)
- Modo Obra: `#2E7D32` (`GREEN`)
- Edição ativa: `#8B6914`
- Destaque / Gerar relatório / Filete / Aba ativa: `#C8A020` (`GOLD`)
- Fundo da página: `#F8F9FA` | Superfície dos painéis: `#FFFFFF`
- Cabeçalhos de tabela e rodapés estatísticos: `#F1F5F9` | Linhas zebradas e blocos secundários: `#F8FAFC`
- Bordas: painel externo e `thead` inferior `1px solid #94A3B8`; divisórias internas `1px solid #E2E8F0`; divisórias de rodapé `1px solid #CBD5E1`; `borderRadius: 8` em todos os painéis.

## Tipografia e layout
- Barra do painel: `11.5px` uppercase `fontWeight: 800` branco (`letterSpacing: 0.06em`).
- Rótulos de célula: `9.5px` uppercase `fontWeight: 800` `#6B7490` (`letterSpacing: 0.04em`).
- Cabeçalhos de tabela: `9.5px` uppercase `fontWeight: 800` `#334155`; texto geral `#1A2340`.
- **Fichas técnicas em grade contínua:** usar `CelulaFicha` (rótulo em cima + `fichaInputStyle` abaixo, `flex-direction: column`, nunca lado a lado) dentro de `.planilha-grid-2`, `.planilha-grid-3` ou `.planilha-grid-rlt`, com foco azul na célula (`.planilha-cell:focus-within`) e colapso automático para 1 coluna sem `border-right` em `<= 720px`.
- **Tabelas de resultado:** sempre dentro de `PainelPlanilha` com contador/badges à direita na barra `#1E3264`, cabeçalho `#F1F5F9` e linhas zebradas `#FFFFFF` / `#F8FAFC`.
- **Cabeçalho de página (`EnsaioCabecalho`):** breadcrumb `Ensaios › <Módulo>`, filete lateral dourado (`borderLeft: 4px solid #C8A020`, `paddingLeft: 14`), eyebrow `ENSAIO`, título `22px` `800`, subtítulo `12px` `#6B7490`, indicador `✓ Salvo`, `Limpar Tudo` (`#FFF0EE` / `#C0392B`) e `Gerar relatório` (`.btn-gold`, fundo `#C8A020`, texto `#1E3264`).
- **Abas (`EnsaioTabs`):** aba ativa usa texto `#1E3264` e borda inferior `#C8A020` (desktop e mobile); apenas `Modo Obra` (`variante: 'obra'`) usa `#2E7D32`. Módulos com etapas (como Aderência) também usam `EnsaioCabecalho` + `EnsaioTabs`.
- **Responsável técnico:** usar sempre `src/components/ResponsavelTecnicoPanel.tsx` (gestor fixo João Ribeiro + engenheiro do ensaio lado a lado, com opção "Outro engenheiro responsável").
- **Ícones do dashboard:** `src/components/EnsaioIcons.tsx`.

## Campos numéricos e mobile
- **Inteiros (`InteiroInput`):** nunca travar valor mínimo/fallback no `onChange` — permitir apagar completamente durante a digitação e aplicar o mínimo apenas no `onBlur`.
- **Teclado numérico mobile:** campos inteiros usam `inputMode="numeric" pattern="[0-9]*"`; decimais usam `inputMode="decimal"` (com vírgula decimal, sem `type="number"`).
- **Anti-zoom iOS/Android:** `src/app/layout.tsx` exporta `viewport` (`maximumScale: 1, userScalable: false`) e `src/app/globals.css` aplica em `@media (max-width: 768px)` `font-size: 16px !important` + `touch-action: manipulation` em `input` (exceto `color`/`checkbox`/`radio`/`file`), `textarea` e `select`, além de `touch-action: pan-y` e `text-size-adjust: 100%` em `html, body`.
- **Header mobile:** toda página que usa `Header` precisa do `@media (max-width: 600px)` com `.header-*`/`.signout-text`/`.sb-u` para evitar overflow horizontal em telas de 320–360px.
