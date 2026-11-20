# Pendências Abertas

## Segurança (ações manuais do usuário)
1. **Rotacionar e restringir `GOOGLE_MAPS_API_KEY`** (a chave atual pode estar em logs antigos da Vercel; o site usa apenas a **Maps Static API**):
   - Em *Google Cloud → APIs e serviços → Credenciais*, localizar o projeto da chave atual comparando os últimos 4 dígitos com `.env.local` (o projeto aberto anteriormente só tinha Gemini API).
   - Confirmar que *Maps Static API* está ativada em *Biblioteca*.
   - Criar nova chave restrita apenas à API *Maps Static API* e restrição de aplicativo = *Nenhum* (Vercel não tem IP fixo).
   - Atualizar `GOOGLE_MAPS_API_KEY` na Vercel (*Settings → Environment Variables*), fazer Redeploy e atualizar `.env.local`.
   - Testar mapa em um laudo de esclerometria ou resistividade, excluir a chave antiga e configurar cota diária + alerta de faturamento.
2. **Supabase Auth:** confirmar no painel (*Authentication → Sign In / Providers*) que *"Allow new users to sign up"* está **desligado**.

## Técnicas / Infra
3. **Vercel `maxDuration` em Aderência:** avaliar adicionar `export const maxDuration` em `src/app/api/ensaios/aderencia/docx/route.ts` (resistividade usa `60`), verificando o limite atual do plano Hobby, já que aderência baixa várias fotos do Storage.
4. **Atualização `NBR 7584:2026` na tela de Esclerometria:** o DOCX já foi atualizado para `NBR 7584:2026`, mas o texto de tela/PDF client-side em `src/app/(dashboard)/ensaios/esclerometria/page.tsx` ainda exibe `NBR 7584:2012`.
5. **Dependência `postcss` (Next 15):** vulnerabilidade residual só usada no build local com o CSS próprio; correção definitiva exige migração para Next 16 (sem urgência).

## QA pós-módulos
6. **Teste ponta a ponta completo do site:** quando todos os módulos estiverem prontos (`pacometria`, `carbonatacao`, `potencial-corrosao`, `ultrassom`), rodar bateria completa cobrindo login, permissões, usuários/assinatura, autosave e geração/abertura real dos DOCX de todos os ensaios.
