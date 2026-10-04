/**
 * Generate SAT-style questions into the question bank.
 *
 *   npm run generate -- --skill transitions --difficulty medium --count 3
 *   npm run generate -- --skill linear-functions --difficulty hard --format spr
 *   npm run generate -- --all --count 2          # every skill x difficulty
 *   npm run generate -- --list-skills
 */
import { parseArgs } from "node:util";
import { openDb } from "../src/lib/db/client";
import { ClaudeQuestionModel } from "../src/lib/generator/claude";
import { generateQuestions } from "../src/lib/generator/generate";
import { allSkills, DIFFICULTIES, isDifficulty, type Difficulty, type QuestionFormat } from "../src/lib/sat/taxonomy";

const { values } = parseArgs({
  options: {
    skill: { type: "string" },
    difficulty: { type: "string" },
    count: { type: "string", default: "3" },
    format: { type: "string" },
    all: { type: "boolean", default: false },
    "list-skills": { type: "boolean", default: false },
  },
});

if (values["list-skills"]) {
  for (const { section, domain, skill } of allSkills()) {
    console.log(`${skill.id.padEnd(36)} ${section.padEnd(16)} ${domain.name} / ${skill.name}`);
  }
  process.exit(0);
}

const count = Number(values.count);
const format: QuestionFormat | undefined =
  values.format === "spr" ? "student-produced-response" : values.format === "mc" ? "multiple-choice" : undefined;

let jobs: { skillId: string; difficulty: Difficulty }[];
if (values.all) {
  jobs = allSkills().flatMap(({ skill }) => DIFFICULTIES.map((difficulty) => ({ skillId: skill.id, difficulty })));
} else {
  if (!values.skill) throw new Error("Pass --skill <id> (see --list-skills) or --all.");
  const difficulties = values.difficulty ? [values.difficulty] : [...DIFFICULTIES];
  for (const d of difficulties) if (!isDifficulty(d)) throw new Error(`--difficulty must be one of ${DIFFICULTIES.join(", ")}`);
  jobs = (difficulties as Difficulty[]).map((difficulty) => ({ skillId: values.skill!, difficulty }));
}

const { db, close } = await openDb();
const model = new ClaudeQuestionModel();
const totals = { verified: 0, "needs-review": 0, rejected: 0 };

try {
  for (const job of jobs) {
    process.stdout.write(`${job.skillId} / ${job.difficulty}: generating ${count}... `);
    try {
      const { saved } = await generateQuestions(db, model, { ...job, count, format });
      for (const q of saved) totals[q.status]++;
      console.log(saved.map((q) => q.status).join(", "));
      for (const q of saved.filter((q) => q.status !== "verified")) {
        const notes = [...q.validationIssues, ...(q.verification?.issues ?? [])];
        if (q.verification && !q.verification.matchesKey) notes.push(`solver answered ${q.verification.solverAnswer}`);
        console.log(`  ${q.id} ${q.status}: ${notes.join(" | ")}`);
      }
    } catch (err) {
      console.log(`failed: ${err instanceof Error ? err.message : err}`);
    }
  }
} finally {
  await close();
}

console.log(`\nDone. verified ${totals.verified}, needs review ${totals["needs-review"]}, rejected ${totals.rejected}.`);
