# Pendências Abertas (Ações do Usuário)

## Segurança (painéis Google Cloud / Supabase / Vercel)
1. **Rotacionar e restringir `GOOGLE_MAPS_API_KEY`** (a chave atual pode estar em logs antigos da Vercel; o site usa apenas a **Maps Static API**):
   - Em *Google Cloud → APIs e serviços → Credenciais*, localizar o projeto da chave atual comparando os últimos 4 dígitos com `.env.local` (o projeto aberto anteriormente só tinha Gemini API).
   - Confirmar que *Maps Static API* está ativada em *Biblioteca*.
   - Criar nova chave restrita apenas à API *Maps Static API* e restrição de aplicativo = *Nenhum* (Vercel não tem IP fixo).
   - Atualizar `GOOGLE_MAPS_API_KEY` na Vercel (*Settings → Environment Variables*), fazer Redeploy e atualizar `.env.local`.
   - Testar mapa em um laudo de esclerometria ou resistividade, excluir a chave antiga e configurar cota diária + alerta de faturamento.
2. **Supabase Auth:** confirmar no painel (*Authentication → Sign In / Providers*) que *"Allow new users to sign up"* está **desligado**.

## Banco / Infra / Revisão Visual
3. **Modo Obra de Pacometria em Postgres (Supabase):** avaliar criar tabela relacional + políticas RLS no Supabase para os metadados das obras (mantendo apenas as fotos no Storage), eliminando o risco de sobrescrita (*lost update*) em uploads simultâneos sobre o JSON único no bucket `pacometria-obra`.
4. **Padronizar corpo de texto DOCX em 11 pt (`w:sz="22"`):** atualizar os templates/scripts dos módulos `aderencia`, `esclerometria` e `resistividade` e conferir visualmente no Word eventuais quebras de página (Pacometria já está em 11 pt).
5. **Dependência `postcss` (Next 15):** vulnerabilidade residual só usada no build local com o CSS próprio; correção definitiva exige migração para Next 16 (decisão futura, sem urgência).

## QA pós-módulos
6. **Teste ponta a ponta completo do site:** quando todos os módulos estiverem prontos (`pacometria`, `carbonatacao`, `potencial-corrosao`, `ultrassom`), rodar bateria completa cobrindo login, permissões, usuários/assinatura, autosave e geração/abertura real dos DOCX de todos os ensaios.
