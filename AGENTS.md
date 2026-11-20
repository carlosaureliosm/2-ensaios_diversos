# TECOMAT — Ensaios Diversos

Sistema web para geração de laudos de ensaios de inspeção predial.

## Como manter este arquivo
`AGENTS.md` é a **fonte única de verdade** do projeto (o `CLAUDE.md` apenas importa `@AGENTS.md` — **nunca edite `CLAUDE.md`** para registrar contexto).

As frases **"registra no contexto"**, **"registra no AGENTS.md"**, **"registra no CLAUDE.md"**, **"registra no agents.md"**, **"registra no claude.md"**, **"registra no agents"** e **"registra no claude"** (ou variações como "registre...") significam exatamente a mesma coisa: atualizar o `AGENTS.md` e/ou a nota técnica correspondente em `docs/tecnico/` seguindo estas regras:
1. Sem changelog, datas, commits ou "validado em". O histórico fica no git.
2. Registrar só: componentes/utilitários reutilizáveis novos (caminho + quando usar), convenções obrigatórias, armadilhas descobertas (1 linha cada) e decisões do usuário que restringem o design (1 linha + motivo curto).
3. Regra substituída: sobrescrever a antiga, sem nota explicando a mudança.
4. Pendência concluída: apagar. Pendência nova: 1 linha em "Pendências abertas".
5. Detalhe longo (regras de módulo, XML/DOCX, investigação, passo a passo): vai para a nota técnica certa em `docs/tecnico/` (mesmas regras, sem changelog); aqui fica só o ponteiro. Assunto novo → criar a nota e acrescentar ao índice. **Nunca usar `@docs/tecnico/...`** (carregaria tudo sempre).
6. Tópicos de 3 a 5 linhas no máximo. Meta: este arquivo abaixo de ~200 linhas.

Commit e push só quando o usuário pedir explicitamente (e **sempre** validar com `npm run test` e `npx next build` antes de qualquer push).

## Notas técnicas (`docs/tecnico/`) — ler antes de mexer na área
| Assunto | Nota |
|---|---|
| Autenticação (`app_metadata.role`), rotas `/api`, SSRF, assinaturas, senha atual | `seguranca.md` |
| Padrão Visual Obrigatório (Planilha Técnica Compacta), paleta, mobile/anti-zoom | `padrao-visual.md` |
| Padrão DOCX: página 1, header/margens, assinatura dupla, templates e scripts | `relatorios-docx.md` |
| Módulo Aderência (RAAC): modelos de camadas, SVG/gráfico, cálculo Ra, Storage, DOCX | `modulo-aderencia.md` |
| Módulo Esclerometria: croqui N imagens, impactos/bigorna, memorial 8×6 cm | `modulo-esclerometria.md` |
| Pendências manuais de segurança, infra e QA pós-módulos | `pendencias.md` |

## Stack e deploy
- **App:** Next.js 15 + TypeScript + Zustand (estado global) + `pizzip` + `docxtemplater` (geração DOCX).
- **Auth e Storage:** Supabase (Auth + Storage privado).
- **Deploy:** Vercel plano **Hobby** (projeto `2-ensaios-diversos`, equipe `carlosaureliosms-projects`, Node 24.x, deploy automático da `main`, limite de ~4,5 MB por corpo de requisição em Functions).
- **Variáveis de ambiente (`.env.local`):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_MAPS_API_KEY`.
- **Rodar local:** pausar sincronização do Google Drive se estiver no Drive → `npm install` → `npm run dev`.

## Estrutura principal e rotas de API
- `src/app/(dashboard)/ensaios/` — módulos (`aderencia`, `esclerometria`, `resistividade`, `pacometria`; futuros: `carbonatacao`, `ultrassom`, `potencial-corrosao`).
- `src/modules/` — lógica de domínio por módulo (ex: `aderencia/`).
- `src/components/` — `Header.tsx`, `PlanilhaUI.tsx`, `ResponsavelTecnicoPanel.tsx`, `EnsaioIcons.tsx`.
- `src/lib/` — auth, supabase, assinatura, cálculos e geração DOCX (`src/lib/docx/`).
- `public/` — assets e templates `modelo_*.docx`; `scripts/` — scripts de geração/manutenção de templates e migrações.

**Rotas de API (`src/app/api/`) — todas exigem `usuarioAtual()`:**
| Rota | Função |
|---|---|
| `POST /api/ensaios/{aderencia,esclerometria,resistividade}/docx` | Gera laudo `.docx` do módulo |
| `POST / DELETE /api/ensaios/aderencia/foto` | Upload/remoção de foto no bucket `aderencia-fotos` |
| `GET /api/maps/static` | Proxy autenticado para Google Maps Static API |
| `GET / POST /api/users` · `PATCH / DELETE /api/users/[id]` | Gestão de usuários (admin em `app_metadata.role`) |
| `GET / POST / DELETE /api/users/[id]/assinatura` | Upload, remoção e URL assinada de 1h da assinatura |

## Regras invioláveis
1. **Rodar `npm run test` e `npx next build` antes de todo push** — erros de tipo que só o `next build` pega derrubam o deploy na Vercel.
2. **Papel de admin fica só em `app_metadata.role`** (nunca `user_metadata.role`); usar sempre `src/lib/auth.ts`.
3. **Toda rota em `src/app/api/` deve chamar `usuarioAtual()`** (`middleware.ts` exclui `/api` do matcher e usa `getUser()`).
4. **Nunca fazer `fetch` de URL vinda do cliente (SSRF)** — assinatura do usuário logado é baixada no servidor pelo `assinatura_path`.
5. **Assinatura sob demanda (1h):** nunca persistir URL assinada longa; usar `GET /api/users/[id]/assinatura` via `src/lib/assinatura.ts`.
6. **Troca da própria senha (`isSelf`) exige `currentPassword`** validado por `senhaAtualValida`. Usuário comum não altera próprio e-mail em `PATCH /api/users/[id]`.
7. **Padrão visual obrigatório:** todo módulo (pronto ou futuro) usa `PlanilhaUI.tsx` (Planilha Técnica Compacta) e `ResponsavelTecnicoPanel.tsx` (detalhes em `padrao-visual.md`).
8. **Padrão DOCX obrigatório:** página 1 compacta (sem capa nem sumário), header/margens padrão, fonte Calibri (`minorHAnsi`) em runs injetados e quadro final `NOTAS` + assinatura dupla (João Ribeiro de Carvalho + Engenheiro do ensaio).
9. **Nunca editar `public/modelo_aderencia.docx` à mão no Word** — editar `scripts/build-modelo-aderencia.js` e regenerar via Node.
10. **Fotos não são salvas no `localStorage`** (removidas no save e zeradas no load). Em Aderência, fotos sobem para o bucket `aderencia-fotos` para respeitar o limite de 4,5 MB da Vercel.
11. **Campos inteiros com mínimo/fallback (`InteiroInput`):** permitir apagar completamente no `onChange` e aplicar mínimo apenas no `onBlur`.
12. **Nunca logar URLs com `GOOGLE_MAPS_API_KEY`.**

## Componentes e utilitários reutilizáveis
- `src/components/PlanilhaUI.tsx` — `PlanilhaStyles`, `EnsaioCabecalho`, `EnsaioTabs`, `PainelPlanilha`, `CelulaFicha`, `InteiroInput`, `fichaInputStyle`, `tabelaHeaderStyle`, `tabelaThTextStyle`, `CORES_PLANILHA`.
- `src/components/ResponsavelTecnicoPanel.tsx` — painel padronizado de assinatura dupla (gestor fixo + engenheiro do ensaio / outro engenheiro).
- `src/components/Header.tsx` · `src/components/EnsaioIcons.tsx` — barra superior e ícones SVG do dashboard.
- `src/lib/auth.ts` — `usuarioAtual`, `isAdmin`, `roleDe`, `senhaAtualValida`, `baixarAssinaturaDoUsuario`.
- `src/lib/assinatura.ts` — `buscarUrlAssinatura` (busca URL assinada de 1h para prévia no front).
- `src/lib/aderenciaStorage.ts` — upload/download/exclusão no bucket privado `aderencia-fotos` com checagem de dono (`<userId>/`).
- `src/lib/docx/esclerometria.ts` — `registrarImagem`, `buildDrawingXml`, `injetarAssinatura`, `injetarCroqui`, `injetarCroquiMultiplo`.
- `src/modules/aderencia/svgParaPng.ts` — rasteriza SVG em PNG 3x no navegador (usado por esquema e gráfico de aderência).

## Armadilhas conhecidas
- **Não alterar a assinatura de `injetarCroqui`** em `src/lib/docx/esclerometria.ts` — o módulo `resistividade` ainda a usa (imagem única).
- **Marcadores de imagem/cor no DOCX de Aderência** terminam em `_END` (`FOTO_PH_<sit>_<cp>_<1|2>_END`, `QUAD_COR_<HEX>_END`) para `_1` não casar com `_10`; `rId`/`docPrId` começam em `2000` para não colidir com `901–9xx` de esclerometria.
- **Tensão Ra (Aderência)** é calculada a partir de `cargaKgf` e **arredondada em 2 casas** antes de comparar com o limite (decisão do usuário: 60 kgf em placa Ø 5 cm = `0,30 MPa`, passa em `>= 0,30`).
- **Header mobile:** toda página com `Header` precisa do `@media (max-width: 600px)` com `.header-*`/`.signout-text`/`.sb-u` para evitar overflow horizontal em 320–360px.
- **Anti-zoom mobile:** inputs sem `font-size: 16px` no iOS dão zoom automático (coberto globalmente em `globals.css` + `viewport` em `layout.tsx`).
- **Build no Next 15:** `npm run dev` ignora erros de tipo que quebram `npx next build` na Vercel.

## Testes e build
- Suíte Vitest: `npm run test` (alias `@` em `vitest.config.ts`). Principais: `src/lib/auth.test.ts`, `src/lib/esclerometria/calcularAmostra.test.ts`, `src/modules/aderencia/calculos.test.ts`, `src/modules/aderencia/svgGraficoResultado.test.ts`, `src/app/api/ensaios/aderencia/docx/route.test.ts`.
- Validação de build: `npx next build`.

## Pendências abertas (detalhe em `docs/tecnico/pendencias.md`)
- Rotacionar e restringir `GOOGLE_MAPS_API_KEY` (só Maps Static API) no Google Cloud + Vercel + `.env.local`.
- Confirmar no Supabase que "Allow new users to sign up" está desligado.
- Avaliar `export const maxDuration` em `api/ensaios/aderencia/docx/route.ts` no plano Hobby.
- Atualizar menção `NBR 7584:2012` → `2026` na tela/PDF client-side de `esclerometria/page.tsx` (DOCX já está em 2026).
- Teste ponta a ponta completo do site após concluir os módulos restantes (`pacometria`, `carbonatacao`, `potencial-corrosao`, `ultrassom`).
