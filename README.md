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
