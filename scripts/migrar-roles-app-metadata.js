#!/usr/bin/env node
// scripts/migrar-roles-app-metadata.js
//
// Migração única do papel (admin/user) de `user_metadata.role` para `app_metadata.role`.
// Motivo: `user_metadata` pode ser alterado pelo próprio usuário no navegador
// (supabase.auth.updateUser({ data: { role: 'admin' } })), então não serve para autorização.
//
// Uso:
//   1) Listar (não altera nada):
//        node scripts/migrar-roles-app-metadata.js
//   2) Aplicar, informando EXPLICITAMENTE quem é admin (todos os demais viram 'user'):
//        node scripts/migrar-roles-app-metadata.js --aplicar --admins email1@x.com,email2@y.com
//
// Os admins são passados à mão de propósito: como qualquer usuário podia se autopromover
// pelo user_metadata, a lista atual de "admins" não é confiável — revise-a antes de aplicar.
//
// Lê NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do .env.local (ou do ambiente).

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function carregarEnv() {
  const arq = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(arq)) return;
  for (const linha of fs.readFileSync(arq, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

async function main() {
  carregarEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (.env.local).');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const aplicar = args.includes('--aplicar');
  const iAdmins = args.indexOf('--admins');
  const admins = iAdmins >= 0 && args[iAdmins + 1]
    ? args[iAdmins + 1].split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    : [];

  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const users = data.users;

  console.log('\nE-mail'.padEnd(42) + 'user_metadata.role'.padEnd(20) + 'app_metadata.role');
  for (const u of users) {
    console.log(
      String(u.email).padEnd(41) +
      String(u.user_metadata?.role ?? '-').padEnd(20) +
      String(u.app_metadata?.role ?? '-'),
    );
  }

  if (!aplicar) {
    console.log('\nNada foi alterado. Para aplicar: --aplicar --admins email1,email2');
    return;
  }
  if (admins.length === 0) {
    console.error('\n--aplicar exige --admins com pelo menos um e-mail (para não ficar sem administrador).');
    process.exit(1);
  }
  const emails = new Set(users.map(u => String(u.email).toLowerCase()));
  const faltando = admins.filter(e => !emails.has(e));
  if (faltando.length) {
    console.error(`\nE-mails não encontrados: ${faltando.join(', ')}. Nada foi alterado.`);
    process.exit(1);
  }

  for (const u of users) {
    const role = admins.includes(String(u.email).toLowerCase()) ? 'admin' : 'user';
    const userMeta = { ...(u.user_metadata ?? {}) };
    delete userMeta.role;
    const { error: e } = await sb.auth.admin.updateUserById(u.id, {
      app_metadata: { ...(u.app_metadata ?? {}), role },
      user_metadata: userMeta,
    });
    console.log(`${e ? 'ERRO ' : 'ok   '} ${u.email} -> ${role}${e ? ' (' + e.message + ')' : ''}`);
  }
  console.log('\nMigração concluída. Peça para os usuários saírem e entrarem de novo.');
}

main().catch(err => { console.error(err); process.exit(1); });
