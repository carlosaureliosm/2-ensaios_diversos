# Módulo Pacometria

Arquivos principais: `src/app/(dashboard)/ensaios/pacometria/page.tsx`, `src/modules/pacometria/types.ts`, `src/modules/pacometria/components/ModalAmostra.tsx`, `src/modules/pacometria/components/PacometriaSvgs.tsx`, `src/modules/pacometria/calculos.test.ts`.

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

## Pendências do módulo
- Implementar **Modo Obra** (aba 3) e rota de geração **DOCX** (`POST /api/ensaios/pacometria/docx`).
