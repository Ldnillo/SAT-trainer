/**
 * Validate every question file without touching a database. Runs in CI so a
 * malformed or duplicate question can't be merged.
 *
 *   npm run check:questions
 */
import path from "node:path";
import { importQuestionFiles } from "../src/lib/content/import";
import { openDb } from "../src/lib/db/client";

const { db, close } = await openDb("memory://");
try {
  const r = await importQuestionFiles(db, path.join(process.cwd(), "content", "questions"));
  console.log(`${r.added.length} questions OK, ${r.flagged.length} with warnings, ${r.failed.length} failed`);
  for (const f of r.flagged) console.log(`  warning ${f.id}: ${f.warnings.join(" | ")}`);
  for (const f of r.failed) console.log(`  FAILED ${f.id} (${f.file}): ${f.problems.join(" | ")}`);
  if (r.failed.length) process.exitCode = 1;
} finally {
  await close();
}
