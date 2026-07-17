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

## Módulo Aderência (em andamento)

Pacometria está pausado — prioridade atual é o módulo de aderência (`src/app/(dashboard)/ensaios/aderencia/`), que tem mais volume/complexidade (múltiplas "Situações" por relatório, cada uma com tabela de resultados de colunas dinâmicas e anexo fotográfico).

Fonte de referência para o mapeamento de campos: planilha `RAAC - Resistência de Aderência à Tração - RLT.LAU-365.26-00.xlsx`, aba **FLS.** (demais abas do arquivo são dados históricos reaproveitados e devem ser ignoradas).

### Decisões de arquitetura já confirmadas

- **Situações**: quantidade fixa escolhida no início pelo usuário (não é adicionar/remover dinamicamente) — o formulário gera os blocos conforme a quantidade escolhida.
- **Forma de ruptura (colunas)**: definida por um **modelo pré-configurado de sistema de camadas** (ex: "Parede externa com cerâmica", "Piso com porcelanato"), que já traz as colunas corretas de interface entre camadas (Sub, Chapisco, Emboço, Arg.Colante, Cerâmica, Contrapiso, Gesso, Tela, Membrana, Vazios etc).
- **Esquema (croqui)**: gerado dinamicamente em SVG a partir do modelo de camadas escolhido, no mesmo padrão do `svgOpcao`/`SvgSecao` do módulo pacometria (sem upload manual de imagem).

### Estrutura do relatório mapeada

1. **Cabeçalho** (uma vez): Nº RLT, Cliente, Obra, Construtora, Endereço, Data de emissão, checkboxes de norma (NBR 13528-1:2019 + Parte 2/3, 13749:2013, 13753:1996, 13754:1996, 13755:2017).
2. **Textos fixos**: Objetivo, Equipamentos Utilizados, Tabela 01 (limites Ra) e Tabela 02 (critérios NBR 13755).
3. **Bloco "Sistema de Revestimento"** (repetido por Situação I, II, III...): cabeçalho da situação (tipo de revestimento, datas, nº de CPs, substrato, idade de ruptura, chapisco/traço, emboço/traço, argamassa colante/revestimento/dimensões), esquema SVG + observações, tabela de resultados por corpo de prova (Bloco/Junta, Tensão Ra, Prof. de ruptura, % forma de ruptura, Localização), linha de médias (Ra médio, valor mínimo de referência, DP, CV), umidade média, espessura média, e anexo fotográfico (2 fotos por CP).
4. **Notas finais** (fixas).

### Plano de etapas para retomar

1. Criar `src/modules/aderencia/types.ts` com os tipos (Situação, CP/corpo de prova, modelo de sistema de camadas, cabeçalho).
2. Definir a lista de **modelos de sistema de camadas** pré-configurados (com suas colunas de forma de ruptura associadas).
3. Construir a função de geração do **SVG do esquema** por modelo de camadas (baseada no `svgOpcao`/`SvgSecao` do pacometria).
4. Implementar a tela inicial de configuração (nº de situações + modelo de camadas por situação).
5. Implementar o formulário por Situação: cabeçalho da situação + tabela de corpos de prova (entrada de dados + cálculo automático de médias, DP, CV) + upload de fotos por CP.
6. Implementar autosave em localStorage (padrão `salvarLocal`/`carregarLocal` do pacometria).
7. Criar `public/modelo_aderencia.docx` a partir do modelo atual em Excel (repaginado).
8. Criar `src/lib/docx/aderencia.ts` e `src/app/api/ensaios/aderencia/docx/route.ts`, reaproveitando o padrão do módulo esclerometria (memorial fotográfico em grade, injeção de imagens/assinatura, placeholders `[[...]]`).
9. Testar geração do DOCX ponta a ponta com um relatório de exemplo (múltiplas situações).
