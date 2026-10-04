import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/client";
import { questions } from "../db/schema";
import { AuthorshipSchema, QuestionContentSchema, type QuestionStatus } from "../sat/question";
import { findNearDuplicate } from "../sat/similarity";
import { DIFFICULTIES, getSkill, QUESTION_FORMATS } from "../sat/taxonomy";
import { validateAuthorship, validateQuestion } from "../sat/validate";

/**
 * A question file: content/questions/<skill-id>.json. Questions written by hand
 * (or by Claude in a project session, without the API) live here, are reviewed
 * like code in pull requests, and are loaded into the bank with `npm run import`.
 */
export const QuestionEntrySchema = z.object({
  /** Stable id, unique across all files, e.g. "transitions-001". Never reuse or renumber. */
  id: z.string().regex(/^[a-z0-9-]+-\d{3,}$/, 'ids look like "<skill-id>-001"'),
  difficulty: z.enum(DIFFICULTIES),
  format: z.enum(QUESTION_FORMATS),
  content: QuestionContentSchema,
  /** Required: writer, inputs, passage source and at least one review. */
  authorship: AuthorshipSchema,
});
export type QuestionEntry = z.infer<typeof QuestionEntrySchema>;

/** Entries are checked one at a time, so one bad question doesn't block the rest of its file. */
const QuestionFileSchema = z.object({
  skill: z.string(),
  questions: z.array(z.unknown()),
});

export interface QuestionFile {
  skill: string;
  questions: QuestionEntry[];
  /** Entries that don't match QuestionEntrySchema (for example, missing authorship). */
  invalid: { id: string; problems: string[] }[];
}

export interface ImportReport {
  added: string[];
  updated: string[];
  unchanged: string[];
  /** Questions not loaded, with the reasons. */
  failed: { id: string; file: string; problems: string[] }[];
  /** Loaded, but marked needs-review because a validator warning fired. */
  flagged: { id: string; warnings: string[] }[];
}

export async function readQuestionFiles(dir: string): Promise<{ file: string; data: QuestionFile }[]> {
  const names = (await readdir(dir)).filter((n) => n.endsWith(".json")).sort();
  return Promise.all(
    names.map(async (name) => {
      const file = path.join(dir, name);
      const parsed = QuestionFileSchema.safeParse(JSON.parse(await readFile(file, "utf8")));
      if (!parsed.success) throw new Error(`${name}: ${z.prettifyError(parsed.error)}`);
      if (parsed.data.skill !== name.replace(/\.json$/, "")) {
        throw new Error(`${name}: "skill" is ${parsed.data.skill}, but the file name says ${name}`);
      }
      getSkill(parsed.data.skill); // throws on unknown skills

      const data: QuestionFile = { skill: parsed.data.skill, questions: [], invalid: [] };
      parsed.data.questions.forEach((raw, i) => {
        const entry = QuestionEntrySchema.safeParse(raw);
        if (entry.success) {
          data.questions.push(entry.data);
        } else {
          const id = (raw as { id?: unknown })?.id;
          data.invalid.push({
            id: typeof id === "string" ? id : `entry ${i + 1}`,
            problems: entry.error.issues.map((iss) => `${iss.path.join(".") || "entry"}: ${iss.message}`),
          });
        }
      });
      return { file: name, data };
    }),
  );
}

/** Loads question files into the bank. Safe to re-run: questions are matched by their stable id. */
export async function importQuestionFiles(db: Db, dir: string): Promise<ImportReport> {
  const files = await readQuestionFiles(dir);
  const report: ImportReport = { added: [], updated: [], unchanged: [], failed: [], flagged: [] };

  const seen = new Map<string, string>();
  for (const { file, data } of files) {
    for (const q of data.questions) {
      if (seen.has(q.id)) throw new Error(`Question id ${q.id} appears in both ${seen.get(q.id)} and ${file}`);
      seen.set(q.id, file);
    }
  }

  const existing = await db.select().from(questions);
  const bySourceId = new Map(existing.filter((r) => r.sourceId).map((r) => [r.sourceId!, r]));
  const pool = existing.filter((r) => r.status !== "rejected").map((r) => ({ id: r.sourceId ?? r.id, content: r.content }));

  for (const { file, data } of files) {
    for (const bad of data.invalid) report.failed.push({ ...bad, file });
    const ref = getSkill(data.skill);
    for (const q of data.questions) {
      const issues = [...validateQuestion(q.content, ref, q.format), ...validateAuthorship(q.authorship, q.content)];
      const errors = issues.filter((i) => i.severity === "error").map((i) => i.message);
      const warnings = issues.filter((i) => i.severity === "warning").map((i) => i.message);

      const dup = findNearDuplicate(q.content, pool.filter((p) => p.id !== q.id));
      if (dup) errors.push(`Near-duplicate of ${dup.id} (overlap ${dup.score.toFixed(2)}).`);
      if (errors.length) {
        report.failed.push({ id: q.id, file, problems: errors });
        continue;
      }

      const status: QuestionStatus = warnings.length ? "needs-review" : "verified";
      if (warnings.length) report.flagged.push({ id: q.id, warnings });
      const row = {
        sourceId: q.id,
        section: ref.section,
        domain: ref.domain.id,
        skill: ref.skill.id,
        difficulty: q.difficulty,
        format: q.format,
        content: q.content,
        status,
        validationIssues: warnings.map((w) => `warning: ${w}`),
        verification: null,
        provenance: {
          generator: "authored" as const,
          author: q.authorship.writer.name,
          promptVersion: "n/a",
          createdAt: new Date().toISOString(),
          sourceFile: `content/questions/${file}`,
          authorship: q.authorship,
        },
      };

      const current = bySourceId.get(q.id);
      if (!current) {
        await db.insert(questions).values(row);
        report.added.push(q.id);
      } else if (
        canonical(current.content) === canonical(q.content) &&
        canonical(current.provenance.authorship) === canonical(q.authorship) &&
        current.difficulty === q.difficulty &&
        current.format === q.format &&
        current.skill === ref.skill.id
      ) {
        report.unchanged.push(q.id);
      } else {
        // Keep the original creation time; record the edit.
        await db
          .update(questions)
          .set({ ...row, provenance: { ...row.provenance, createdAt: current.provenance.createdAt } })
          .where(eq(questions.sourceId, q.id));
        report.updated.push(q.id);
      }
      pool.push({ id: q.id, content: q.content });
    }
  }
  return report;
}

/** JSON with sorted keys: Postgres jsonb doesn't keep key order, so plain stringify can't compare. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

/** Ids of imported questions whose files no longer contain them. */
export async function orphanedSourceIds(db: Db, dir: string): Promise<string[]> {
  const ids = new Set((await readQuestionFiles(dir)).flatMap((f) => f.data.questions.map((q) => q.id)));
  const rows = await db.select({ sourceId: questions.sourceId }).from(questions).where(isNotNull(questions.sourceId));
  return rows.map((r) => r.sourceId!).filter((id) => !ids.has(id));
}
