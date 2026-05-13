/**
 * Lista companies + sectors pra ajudar a identificar IDs canônicos antes de
 * cadastrar L1/L2/L3. Útil pra encontrar `companyId` de um tenant e
 * `sectorIds` que um líder deve gerenciar.
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase/lidera-skills-sa.json \
 *     npx tsx scripts/list-tenant-context.ts            # lista TUDO
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=... \
 *     npx tsx scripts/list-tenant-context.ts benditta  # filtra por nome
 *
 * Read-only — não modifica nada.
 */

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const SA_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const FILTER = (process.argv[2] ?? "").trim().toLowerCase();

if (!SA_PATH) {
  console.error("❌ GOOGLE_APPLICATION_CREDENTIALS não setado.");
  console.error("");
  console.error("   1. Firebase Console > Project Settings > Service Accounts");
  console.error("   2. 'Generate new private key' → salvar JSON fora do repo");
  console.error("   3. Rodar com:");
  console.error("      GOOGLE_APPLICATION_CREDENTIALS=/path/sa.json \\");
  console.error("        npx tsx scripts/list-tenant-context.ts [filtro]");
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

interface CompanyDoc {
  name?: string;
  [k: string]: unknown;
}

interface SectorDoc {
  name?: string;
  companyId?: string;
  [k: string]: unknown;
}

function matches(name: string): boolean {
  if (!FILTER) return true;
  return name.toLowerCase().includes(FILTER);
}

async function main() {
  console.log(`\n${FILTER ? `Filtro: "${FILTER}"` : "Sem filtro — todos."}\n`);

  // companies
  const companiesSnap = await db.collection("companies").get();
  const companies: Array<{ id: string; name: string }> = [];
  for (const d of companiesSnap.docs) {
    const data = d.data() as CompanyDoc;
    const name = data.name ?? "(sem nome)";
    if (matches(name)) {
      companies.push({ id: d.id, name });
    }
  }

  console.log("─── COMPANIES ───");
  if (companies.length === 0) {
    console.log("  (nenhuma)");
  } else {
    for (const c of companies) {
      console.log(`  ${c.name}`);
      console.log(`    companyId: ${c.id}`);
    }
  }
  console.log("");

  // sectors (por company encontrada)
  const targetIds = companies.map((c) => c.id);
  if (targetIds.length === 0) {
    console.log("─── SECTORS ───");
    console.log("  (sem companies pra listar)\n");
    return;
  }

  console.log("─── SECTORS ───");
  // Não dá pra usar `where in` com >10 ids em uma só query; faz uma por company.
  for (const c of companies) {
    const sectorsSnap = await db
      .collection("sectors")
      .where("companyId", "==", c.id)
      .get();
    if (sectorsSnap.empty) {
      console.log(`  ${c.name}: (sem setores)`);
      continue;
    }
    console.log(`  ${c.name}:`);
    for (const sd of sectorsSnap.docs) {
      const sec = sd.data() as SectorDoc;
      console.log(`    - ${sec.name ?? "(sem nome)"}  →  sectorId: ${sd.id}`);
    }
  }
  console.log("");
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
