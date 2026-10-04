/**
 * Load question files from content/questions into the bank.
 *
 *   npm run import
 *
 * Questions that fail validation are reported and skipped; the rest are added
 * or updated by their stable id. Exits non-zero if any question failed.
 */
import path from "node:path";
import { importQuestionFiles, orphanedSourceIds } from "../src/lib/content/import";
import { openDb } from "../src/lib/db/client";

const dir = path.join(process.cwd(), "content", "questions");
const { db, close } = await openDb();
try {
  const r = await importQuestionFiles(db, dir);
  console.log(`added ${r.added.length}, updated ${r.updated.length}, unchanged ${r.unchanged.length}, failed ${r.failed.length}`);
  for (const f of r.flagged) console.log(`  needs review ${f.id}: ${f.warnings.join(" | ")}`);
  for (const f of r.failed) console.log(`  FAILED ${f.id} (${f.file}): ${f.problems.join(" | ")}`);
  const orphans = await orphanedSourceIds(db, dir);
  if (orphans.length) console.log(`  In the bank but no longer in any file (reject them with npm run bank): ${orphans.join(", ")}`);
  if (r.failed.length) process.exitCode = 1;
} finally {
  await close();
}
