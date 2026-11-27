// Aplica no Supabase as migrations de supabase/migrations que ainda não
// rodaram, em ordem, cada uma numa transação. Usa a Management API do
// Supabase, então só precisa de um token de acesso (sem senha do banco).
//
// Registra cada migration aplicada em supabase_migrations.schema_migrations,
// a mesma tabela que o painel e o conector do Supabase usam. Uma migration já
// registrada (por este script ou pelo conector, com a mesma versão) é pulada.
//
// Uso:
//   SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... node scripts/aplicar-migrations.mjs
//   node scripts/aplicar-migrations.mjs --dry-run   (só lista o que rodaria)

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
const dryRun = process.argv.includes("--dry-run");
const dir = path.resolve("supabase/migrations");

if (!token || !ref) {
  console.error("Faltam SUPABASE_ACCESS_TOKEN e/ou SUPABASE_PROJECT_REF.");
  process.exit(1);
}

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body}`);
  return body ? JSON.parse(body) : [];
}

const literal = (s) => `'${s.replaceAll("'", "''")}'`;

const arquivos = (await readdir(dir)).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();

// Duas migrations com a mesma versão: a segunda seria pulada em silêncio.
const versoes = new Map();
for (const f of arquivos) {
  const v = f.slice(0, 14);
  if (versoes.has(v)) {
    console.error(`Versão repetida ${v}: ${versoes.get(v)} e ${f}. Troque o número de uma delas.`);
    process.exit(1);
  }
  versoes.set(v, f);
}

if (!dryRun) {
  await query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key, statements text[], name text
    );
  `);
}
const registradas = await query("select version, name from supabase_migrations.schema_migrations");
const aplicadas = new Set(registradas.map((r) => r.version));

// Versão já registrada com outro nome: o arquivo daqui nunca rodaria.
for (const r of registradas) {
  const f = versoes.get(r.version);
  if (f && r.name && f.slice(15, -4) !== r.name) {
    console.error(`${f}: a versão ${r.version} já está no banco como "${r.name}". Troque o número do arquivo.`);
    process.exit(1);
  }
}

const pendentes = arquivos.filter((f) => !aplicadas.has(f.slice(0, 14)));
if (pendentes.length === 0) {
  console.log("Banco em dia: nenhuma migration pendente.");
  process.exit(0);
}

for (const arquivo of pendentes) {
  const version = arquivo.slice(0, 14);
  const name = arquivo.slice(15, -4);
  if (dryRun) {
    console.log(`[dry-run] aplicaria ${arquivo}`);
    continue;
  }
  const sql = await readFile(path.join(dir, arquivo), "utf8");
  if (/^\s*(begin|commit|rollback)\s*;/im.test(sql)) {
    throw new Error(`${arquivo}: não use begin/commit no arquivo; o script já abre uma transação.`);
  }
  console.log(`Aplicando ${arquivo}...`);
  try {
    await query(`begin;
${sql}
;
insert into supabase_migrations.schema_migrations (version, name, statements)
values (${literal(version)}, ${literal(name)}, array[${literal(sql)}]);
commit;`);
  } catch (erro) {
    console.error(`Falhou em ${arquivo} (nada dela ficou no banco):\n${erro.message}`);
    process.exit(1);
  }
  console.log(`  ok`);
}
console.log(`${dryRun ? "Pendentes" : "Aplicadas"}: ${pendentes.length}.`);
