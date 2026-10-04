import { randomUUID } from "node:crypto";
import type { Db } from "../db/client";
import { findQuestions, insertQuestions, type NewQuestion } from "../db/questions";
import type { QuestionContent, QuestionRecord, QuestionStatus, VerificationResult } from "../sat/question";
import { findNearDuplicate } from "../sat/similarity";
import { DIFFICULTIES, getSkill, type Difficulty, type QuestionFormat, type SkillRef } from "../sat/taxonomy";
import { gridInValue, hasErrors, isValidGridInAnswer, validateQuestion } from "../sat/validate";
import type { QuestionModel, SolverResult } from "./claude";
import { pickTopicAreas, PROMPT_VERSION, summarize } from "./prompts";

export interface GenerateOptions {
  skillId: string;
  difficulty: Difficulty;
  format?: QuestionFormat;
  /** Questions per model call. Keep small (1-5) so each gets full attention. */
  count: number;
}

export interface GenerateResult {
  batchId: string;
  saved: QuestionRecord[];
}

/**
 * Generates a batch of questions for one skill and difficulty, checks each one,
 * and saves all of them to the bank with a status:
 *
 * - rejected: failed structural checks (wrong shape, passage length, bad grid-in
 *   answer) or is a near-copy of a question already in the bank.
 * - needs-review: well-formed, but an independent solve disagreed with the key,
 *   raised an issue, or a validator warning fired.
 * - verified: well-formed, and the independent solve matched with no issues.
 */
export async function generateQuestions(db: Db, model: QuestionModel, opts: GenerateOptions): Promise<GenerateResult> {
  const ref = getSkill(opts.skillId);
  const format = opts.format ?? ref.skill.formats[0];
  if (!ref.skill.formats.includes(format)) {
    throw new Error(`${ref.skill.name} questions can't be ${format}.`);
  }
  if (opts.count < 1 || opts.count > 10) throw new Error("count must be between 1 and 10.");

  const existing = await findQuestions(db, {
    skills: [ref.skill.id],
    statuses: ["verified", "needs-review"],
    limit: 500,
  });
  const avoid = existing
    .filter((q) => q.difficulty === opts.difficulty)
    .slice(0, 30)
    .map((q) => summarize(q.content));

  const { questions, servedModel } = await model.generate({
    ref,
    difficulty: opts.difficulty,
    format,
    count: opts.count,
    avoid,
    topicAreas: ref.section === "reading-writing" ? pickTopicAreas(opts.count) : undefined,
  });

  const batchId = randomUUID();
  const createdAt = new Date().toISOString();
  const accepted: { id: string; content: QuestionContent }[] = existing.map((q) => ({ id: q.id, content: q.content }));

  const rows = await Promise.all(
    questions.map(async (content, i): Promise<NewQuestion> => {
      const issues = validateQuestion(content, ref, format);
      const messages = issues.map((x) => `${x.severity}: ${x.message}`);
      let status: QuestionStatus;
      let verification: VerificationResult | null = null;

      // Duplicate check also covers earlier questions in this same batch.
      const dup = findNearDuplicate(content, [
        ...accepted,
        ...questions.slice(0, i).map((c, j) => ({ id: `batch item ${j + 1}`, content: c })),
      ]);
      if (dup) messages.push(`error: Near-duplicate of ${dup.id} (overlap ${dup.score.toFixed(2)}).`);

      if (hasErrors(issues) || dup) {
        status = "rejected";
      } else {
        verification = await verify(model, content, ref, opts.difficulty);
        const clean = verification.matchesKey && verification.issues.length === 0 && issues.length === 0;
        status = clean ? "verified" : "needs-review";
      }

      return {
        sourceId: null,
        section: ref.section,
        domain: ref.domain.id,
        skill: ref.skill.id,
        difficulty: opts.difficulty,
        format,
        content,
        status,
        validationIssues: messages,
        verification,
        provenance: {
          generator: "claude-api",
          requestedModel: model.model,
          servedModel,
          promptVersion: PROMPT_VERSION,
          createdAt,
          batchId,
          publicDomainSource: content.publicDomainSource,
        },
      };
    }),
  );

  const saved = await insertQuestions(db, rows);
  return { batchId, saved };
}

async function verify(
  model: QuestionModel,
  content: QuestionContent,
  ref: SkillRef,
  difficulty: Difficulty,
): Promise<VerificationResult> {
  let result: SolverResult & { servedModel: string };
  try {
    result = await model.solve(content, ref);
  } catch (err) {
    return {
      model: model.model,
      solverAnswer: null,
      matchesKey: false,
      issues: [`Solver failed: ${err instanceof Error ? err.message : String(err)}`],
      difficultyEstimate: null,
      checkedAt: new Date().toISOString(),
    };
  }

  const issues = [...result.issues];
  const gap = Math.abs(DIFFICULTIES.indexOf(result.difficultyEstimate) - DIFFICULTIES.indexOf(difficulty));
  if (gap >= 2) issues.push(`Solver rated this ${result.difficultyEstimate}, not ${difficulty}.`);

  return {
    model: result.servedModel,
    solverAnswer: result.answer,
    matchesKey: answerMatches(content, result.answer),
    issues,
    difficultyEstimate: result.difficultyEstimate,
    checkedAt: new Date().toISOString(),
  };
}

export function answerMatches(content: QuestionContent, answer: string): boolean {
  const a = answer.trim().replace(/^\(?([A-D])\)?[.)]?$/i, "$1").toUpperCase();
  if (content.correctChoice) return a === content.correctChoice;
  const given = answer.trim().replace(/\s+/g, "");
  if (!isValidGridInAnswer(given) && Number.isNaN(Number(given))) return false;
  const value = isValidGridInAnswer(given) ? gridInValue(given) : Number(given);
  return content.acceptedAnswers.some((acc) => isValidGridInAnswer(acc) && Math.abs(gridInValue(acc) - value) < 1e-3);
}
