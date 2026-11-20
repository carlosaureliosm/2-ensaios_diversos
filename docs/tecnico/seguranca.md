# Segurança — Regras e Controles

## Autenticação e papéis (`src/lib/auth.ts`)
- Papel de admin vive exclusivamente em `app_metadata.role`, **nunca** em `user_metadata.role` (editável pelo próprio cliente via anon key).
- Sempre usar os helpers `isAdmin`, `roleDe` e `usuarioAtual` de `src/lib/auth.ts`. Criação e edição de usuários gravam o papel em `app_metadata`.
- `src/middleware.ts` usa `getUser()` (valida o token no servidor) em vez de `getSession()`.
- O matcher do `middleware.ts` exclui `/api` — portanto **toda rota em `src/app/api/` precisa validar a sessão por conta própria** (`usuarioAtual()` → `401`).

## Proteção contra SSRF e assinaturas
- Nunca fazer `fetch` de URL vinda do cliente.
- O campo `respAssinaturaUrl` no payload DOCX funciona apenas como flag booleana ("usar assinatura do usuário logado"): o servidor baixa a imagem direto do Storage pelo `user_metadata.assinatura_path` via `baixarAssinaturaDoUsuario` e ignora qualquer URL recebida.
- Quando marcado "Outro engenheiro responsável", o cliente envia a imagem local em base64 (sem URL externa).
- Assinaturas nunca têm URL persistida de longa duração: apenas `assinatura_path` é salvo em `user_metadata`. A prévia no front-end busca URL assinada de **1h** sob demanda em `GET /api/users/[id]/assinatura` (guardado por `isAdmin`/`isSelf`) via `buscarUrlAssinatura` (`src/lib/assinatura.ts`). `GET /api/users` retorna apenas `has_assinatura: boolean`.

## Gestão de usuários (`PATCH /api/users/[id]`)
- Usuário comum não pode alterar o próprio e-mail nessa rota (a API admin altera sem confirmação).
- Troca da própria senha (`isSelf`) exige `currentPassword` no body, validado por `senhaAtualValida` (`src/lib/auth.ts`, via `signInWithPassword` com anon key sem afetar a sessão atual). Na UI (`src/app/(dashboard)/usuarios/page.tsx`), o campo "Senha Atual" aparece apenas quando o próprio usuário digita nova senha. Admin trocando a senha de outro usuário não precisa informar a senha atual.

## Fotos de Aderência no Storage
- Bucket privado `aderencia-fotos` (`src/lib/aderenciaStorage.ts`, criado automaticamente via service role na 1ª chamada) grava em `<userId>/<uuid>.jpg`.
- `resolverFotosDoStorage` valida que o `path` pertence ao `userId` autenticado, bloqueando acesso a fotos de outro usuário.

## Scripts e testes
- Migração de papéis (caso necessário em novo ambiente): `scripts/migrar-roles-app-metadata.js` (`--aplicar --admins email1,email2`).
- Testes de regressão: `src/lib/auth.test.ts` (verifica leitura exclusiva de `app_metadata`, `401` sem login nas rotas docx/maps e ausência de `fetch` externo).
- Nunca logar URLs contendo `GOOGLE_MAPS_API_KEY`.
