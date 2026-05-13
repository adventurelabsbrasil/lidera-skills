/**
 * Migração one-shot: popula o campo `level` em `user_roles` baseado no `role` legado.
 *
 *   role === 'master'  → level = 'L0'
 *   role === 'company' → level = 'L1'   (assume owner do tenant)
 *
 * Outros valores de `role` (`admin`, `gestor`, `lider`, `colaborador`) NÃO são
 * migrados automaticamente — esses são rótulos funcionais (papel em avaliações),
 * não níveis de acesso. Listados como ambíguos pra decisão manual.
 *
 * Usa Admin SDK pra burlar as regras (rules só permitem L0 escrever em user_roles).
 * Requer service account JSON exportado pelo Firebase Console:
 *   Project Settings > Service Accounts > Generate new private key
 *
 * Uso:
 *   # Dry-run (recomendado primeiro)
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json npx tsx scripts/migrate-user-roles-to-levels.ts --dry-run
 *
 *   # Execução real
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json npx tsx scripts/migrate-user-roles-to-levels.ts
 */

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const DRY_RUN = process.argv.includes("--dry-run") || process.argv.includes("-n");
const SA_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!SA_PATH) {
  console.error("❌ GOOGLE_APPLICATION_CREDENTIALS não setado.");
  console.error("");
  console.error("   1. Firebase Console > Project Settings > Service Accounts");
  console.error("   2. 'Generate new private key' → salvar o JSON em local seguro (NÃO commitar)");
  console.error("   3. Rodar com:");
  console.error("      GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \\");
  console.error("        npx tsx scripts/migrate-user-roles-to-levels.ts --dry-run");
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

interface UserRoleDoc {
  userId?: string;
  email?: string;
  role?: string;
  companyId?: string;
  level?: string;
  sectorIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

async function main() {
  console.log(`\nProjeto: ${process.env.GCLOUD_PROJECT ?? "(do service account)"}\n`);
  console.log(
    DRY_RUN
      ? "🧪 DRY RUN — nenhum doc será gravado."
      : "⚠️  EXECUÇÃO REAL — docs serão atualizados."
  );
  console.log("");

  const snapshot = await db.collection("user_roles").get();
  console.log(`Encontrados ${snapshot.size} doc(s) em user_roles.\n`);

  const stats = { migrated: 0, alreadyMigrated: 0, ambiguous: 0, errors: 0 };
  const ambiguous: Array<{ id: string; role: string; email: string }> = [];

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() as UserRoleDoc;
    const uid = docSnap.id;
    const email = data.email ?? "(sem email)";
    const role = data.role ?? "(sem role)";

    if (data.level) {
      console.log(`✓ ${uid} (${email}): já tem level=${data.level}, pulando.`);
      stats.alreadyMigrated++;
      continue;
    }

    let newLevel: "L0" | "L1" | null = null;
    if (role === "master") newLevel = "L0";
    else if (role === "company") newLevel = "L1";

    if (!newLevel) {
      console.warn(
        `⚠️  ${uid} (${email}): role='${role}' não migrável automaticamente. Ação manual necessária.`
      );
      ambiguous.push({ id: uid, role, email });
      stats.ambiguous++;
      continue;
    }

    console.log(`→ ${uid} (${email}): role='${role}' → level='${newLevel}'`);

    if (DRY_RUN) {
      stats.migrated++;
      continue;
    }

    try {
      await docSnap.ref.update({
        level: newLevel,
        updatedAt: new Date().toISOString(),
      });
      stats.migrated++;
    } catch (err) {
      console.error(`❌ falha em ${uid}:`, err);
      stats.errors++;
    }
  }

  console.log("\n─── Resumo ───");
  console.log(`Migrados: ${stats.migrated}${DRY_RUN ? " (simulado)" : ""}`);
  console.log(`Já migrados: ${stats.alreadyMigrated}`);
  console.log(`Ambíguos (ação manual): ${stats.ambiguous}`);
  console.log(`Erros: ${stats.errors}`);

  if (ambiguous.length) {
    console.log("\n─── Ambíguos (ação manual via Firebase Console ou GUI nova) ───");
    ambiguous.forEach((a) =>
      console.log(`  ${a.email} (uid=${a.id}, role=${a.role})`)
    );
    console.log(
      "\n  Esses precisam de classificação L0/L1/L2/L3 manual antes da janela legada fechar."
    );
  }

  if (DRY_RUN) {
    console.log("\n💡 Rerun sem --dry-run para aplicar.");
  }
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
