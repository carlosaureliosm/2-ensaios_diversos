# Módulo Pacometria

Arquivos principais: `src/app/(dashboard)/ensaios/pacometria/page.tsx`, `src/modules/pacometria/types.ts`, `src/modules/pacometria/components/ModalAmostra.tsx`, `src/modules/pacometria/components/PacometriaSvgs.tsx`, `src/modules/pacometria/svgRelatorio.ts`, `src/lib/docx/pacometria.ts`, `src/app/api/ensaios/pacometria/docx/route.ts`, `scripts/build-modelo-pacometria.js`, `public/modelo_pacometria.docx`, `src/modules/pacometria/calculos.test.ts`, `src/app/api/ensaios/pacometria/docx/route.test.ts`.

## Tipos de elemento e opções
- **Pilar (`tipo: 'pilar'`):** desenho de perfil **vertical** (`SvgPerfilVertical`). Opções `A` (4 faces livres), `B` (1 face: Inferior), `C` (2 faces em L: Inferior + Esquerda), `D` (3 faces: Inferior + Esquerda + Direita, topo obstruído), `E` (Circular).
- **Viga (`tipo: 'viga'`):** desenho de perfil **horizontal** (`SvgPerfilHorizontal`, barras longitudinais horizontais e estribos verticais). Opções `VA` (3 faces sob laje: Fundo + 2 Laterais), `VB` (2 faces em L: Fundo + Lat. Esquerda), `VC` (1 face: Lat. Esquerda), `VD` (1 face: Fundo), `VE` (4 faces livres).
- **Área Livre / Laje (`tipo: 'laje'`):** desenho livre interativo em malha quadrada (`SvgMalhaLaje`, `LajeData` com `larguraX`, `alturaY`, `passoGrid`, `camadaExterna`, `barrasH`, `barrasV`). Opções `LA` (bidirecional X+Y), `LB` (única horizontal H), `LC` (única vertical V).
- **Nomenclatura na interface:** nunca exibir códigos internos `1X`, `2X`, `1Y`, `2Y` para o usuário (mantidos apenas como chaves de objeto para compatibilidade com `localStorage`). Usar sempre `FACE_LABELS` (`Face Inferior`, `Face Superior`, `Face Esquerda`, `Face Direita`, etc.).

## Regra estrutural de cobrimento (NBR 6118)
- O cobrimento do elemento é definido **exclusivamente pela armadura mais externa**:
  - **Pilar e Viga:** somente o cobrimento dos **estribos (`fd.cob`)** entra nas estatísticas (`calcularCobrimentos`). Barras longitudinais ficam atrás dos estribos e não possuem campo de cobrimento na face — apenas espaçamentos (`B1–B2`, ...) e cobrimento perpendicular às bordas (`cobPerpIni`, `cobPerpFim`).
  - **Laje / Área Livre:** somente a **camada mais externa (`camadaExterna`: `'H'` ou `'V'`)** possui campo de cobrimento na face e entra em `calcularCobrimentosLaje`. A camada interna exibe apenas posição, espaçamentos e bordas perpendiculares.
- **Cobrimento perpendicular às bordas:** sempre plotado **na mesma linha de cota** dos espaçamentos (esquerda/direita no Pilar, superior/inferior na Viga, esquerda para H e inferior para V na Laje).

## SVGs dinâmicos, tabelas e responsividade
- **Escala dinâmica:** `SvgPerfilVertical`, `SvgPerfilHorizontal` e `SvgMalhaLaje` calculam o `viewBox` dinamicamente com passo mínimo em pixels (dentro de containers `overflow: auto`), evitando encolhimento com 10–15+ estribos ou muitas barras.
- **Identificação visual da face:** Etapa 2 destaca a face em foco no preview (`SvgSecaoPilar`/`SvgSecaoViga` com `faceDestaque`: aresta grossa + seta + halo); Etapa 3 exibe `SvgIndicadorFace` com seta apontando para a face detalhada em todos os 3 elementos.
- **Tabelas PlanilhaUI:** sem células `—` bloqueadas — vãos de espaçamento (`E1–E2`, `B1–B2`) aparecem apenas quando há >1 elemento; em Laje, espaçamentos ficam no rodapé técnico.
- **Mobile (`<= 640px`):** header do modal em 2 linhas, grids colapsam (`1fr` para tipos/faces/laje, `2 colunas` para opções de pilar/viga e parâmetros da malha) e fontes aumentadas.

## Relatório DOCX e SVGs do laudo
- **Template e geração:** `public/modelo_pacometria.docx` é gerado por `scripts/build-modelo-pacometria.js` (nunca editar à mão no Word). Rota `POST /api/ensaios/pacometria/docx` (`maxDuration = 60`), helpers em `src/lib/docx/pacometria.ts`.
- **Regras de conteúdo e tipografia:**
  - **Sem normas e sem limite/destaque vermelho:** não existe norma específica para o ensaio de pacometria; não incluir quadro `NORMA(S) DE REFERÊNCIA` nem destacar valores em vermelho.
  - **Tamanho 11 pt (`w:sz="22"`):** aplicado em todo o documento (header, footer, tabela de identificação, corpo, tabelas, legendas de figuras e notas/assinaturas); títulos de seção em 12 pt (`w:sz="24"`).
  - **Estrutura:** Seção 1 (Introdução + motivação, mapa, foto geral e múltiplos croquis `croquis[]`), Seção 2 (Metodologia), Seção 3 (`Tabela 1` consolidada), Seção 4 (Detalhamento dinâmico via marcador `BLOCO_ELEMENTOS_PAC_END`), Seção 5 (`Resumo Executivo e Conclusão` opcional com tabela síntese global + texto editável/automático) e quadro final `NOTAS` + assinatura dupla. Numeração automática sequencial de todas as **Figuras** e **Tabelas**.
- **Ficha unificada por elemento (Seção 4):**
  - Renderizada em uma única tabela `[2500, 2500]` (com `gridSpan="2"` nas linhas de largura total) na ordem obrigatória: **Esquema da seção transversal (ou malha) → Perfis de elevação por face → Foto do elemento**.
  - **Sem tabela `Leituras por face`** em Pilar e Viga (dados já legíveis nos perfis visuais); mantida apenas `Leituras da malha` compactada (omite colunas vazias e bordas não preenchidas) em Laje.
  - **Paginação:** tabelas contínuas uma abaixo da outra por padrão (`quebraPaginaPorElemento: false`, configurável na aba Cabeçalho) para evitar espaços vazios; `keepNext` no título da Seção 4 + cabeçalho/estatísticas da ficha garante que `4.1` fique junto ao título.
  - **Layout adaptativo para N perfis:** N=1 → `[Esquema | Perfil 1]` lado a lado + Foto; N=3 → grade 2×2 `[Esquema | P1]` + `[P2 | P3]` + Foto; N=2 ou N=4+ → Esquema largura total + pares `[Pi | Pi+1]` + Foto; perfis de viga com `>= 6` estribos no trecho recebem `larguraTotal: true` (`16,2 × 6,8 cm`).
- **SVGs do relatório (`src/modules/pacometria/svgRelatorio.ts`, rasterizados em `3x` via `svgParaPng`):**
  - **Seção transversal (`490×262`) / Malha (`560×285`):** exibe `Méd / Mín / Máx` por face (sem vermelho) com fontes grandes (`18,5–22 px`).
  - **Perfis de elevação por face (vertical em Pilar, horizontal em Viga):** barras longitudinais e nomes `B1..Bn` em azul (`#2563EB`); estribos, nomes `E1..En` e cobrimentos em vermelho sóbrio (`#A8383B`); todas as linhas e cotas (espaçamentos e cobrimentos às bordas) em amarelo (`#B8890E`); legenda de cores no rodapé do card.
  - **Proteção contra muitos estribos:** `gerarSvgsPerfisPacometria` divide automaticamente faces com `> 8` estribos em trechos (`E1–E8`, `E9–E16`, ...), escala a fonte dinamicamente por `W` e `H` (`fK`) e limita `fCota` ao passo horizontal mínimo (`64–68 px`) para as cotas não encostarem.

## Modo Obra (servidor + multiusuário + imagens)
- **Persistência:** bucket privado `pacometria-obra` no Supabase Storage (`src/lib/pacometriaObraStorage.ts`, auto-criado via `garantirBucketObra`), gravando cada obra em `grupos/<grupoId>.json` e fotos comprimidas em `fotos/<grupoId>/<fotoId>.<jpg|png>`.
- **Rotas de API:** `GET / POST /api/ensaios/pacometria/obra`, `PATCH / DELETE /api/ensaios/pacometria/obra/[id]`, `POST / DELETE /api/ensaios/pacometria/obra/[id]/foto`.
- **Permissões:** todos os usuários autenticados visualizam todas as obras e podem importar qualquer obra em `2. Dados de Campo` (`ModalImportarObra.tsx`), sem apagar os dados do servidor; **somente o criador (`createdBy === user.id`)** pode adicionar, editar ou apagar amostras, fotos ou a obra inteira. Fotos órfãs são removidas automaticamente no `PATCH` e no `DELETE`.
- **Interface compartilhada:** `ListaAmostrasPacometria.tsx` renderiza tabela (desktop) e cards (mobile) tanto em `Dados de Campo` quanto no `Modo Obra` (com `somenteLeitura` para obras de terceiros), reutilizando `ModalAmostra`.
- **Fotos importadas no DOCX:** amostras importadas recebem `fotoPath` + `fotoPreview` (URL assinada de 1h); na geração do DOCX (`POST /api/ensaios/pacometria/docx`), o servidor baixa a foto diretamente de `pacometria-obra` pelo `fotoPath` validado (sem SSRF e independente da expiração da URL assinada). `salvarLocal` remove `fotoPath`, `fotoPreview` e `fotoFile` do `localStorage`.
