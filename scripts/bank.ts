/**
 * Inspect and curate the question bank.
 *
 *   npm run bank -- stats           # counts per skill, difficulty and status
 *   npm run bank -- show <id>       # print one question with its answer
 *   npm run bank -- approve <id> "Your name" ["edits made"]   # mark verified and record the review
 *   npm run bank -- reject <id> "Your name"
 *   npm run bank -- export > bank.json
 */
import { openDb } from "../src/lib/db/client";
import { addReview, countQuestions, findQuestions, getQuestion, setQuestionStatus } from "../src/lib/db/questions";
import { allSkills, DIFFICULTIES } from "../src/lib/sat/taxonomy";

const [command, arg, reviewer, edits] = process.argv.slice(2);
const { db, close } = await openDb();

try {
  switch (command) {
    case "stats": {
      const counts = await countQuestions(db);
      const get = (skill: string, difficulty: string, status: string) =>
        counts.find((c) => c.skill === skill && c.difficulty === difficulty && c.status === status)?.count ?? 0;
      console.log(`${"skill".padEnd(36)} ${DIFFICULTIES.map((d) => d.padEnd(10)).join(" ")} (verified / needs review)`);
      for (const { skill } of allSkills()) {
        const cells = DIFFICULTIES.map((d) => `${get(skill.id, d, "verified")} / ${get(skill.id, d, "needs-review")}`.padEnd(10));
        console.log(`${skill.id.padEnd(36)} ${cells.join(" ")}`);
      }
      break;
    }
    case "show": {
      const q = arg && (await getQuestion(db, arg));
      if (!q) throw new Error(`No question ${arg}`);
      console.log(JSON.stringify(q, null, 2));
      break;
    }
    case "approve":
    case "reject": {
      const q = arg ? await getQuestion(db, arg) : undefined;
      if (!q) throw new Error(`No question ${arg}`);
      if (!reviewer) throw new Error(`Say who reviewed it: npm run bank -- ${command} <id> "Your name"`);
      if (q.sourceId && command === "approve") {
        throw new Error(
          `${q.sourceId} comes from ${q.provenance.sourceFile}; add your review to its "reviews" in that file and run npm run import.`,
        );
      }
      await setQuestionStatus(db, q.id, command === "approve" ? "verified" : "rejected");
      await addReview(db, q.id, {
        reviewer,
        date: new Date().toISOString().slice(0, 10),
        edits: command === "reject" ? "rejected" : (edits ?? "none"),
      });
      console.log(`${arg} marked ${command === "approve" ? "verified" : "rejected"}; review by ${reviewer} recorded.`);
      break;
    }
    case "export": {
      const rows = await findQuestions(db, { statuses: ["verified"], limit: 100000 });
      console.log(JSON.stringify(rows, null, 2));
      break;
    }
    default:
      console.log('Usage: npm run bank -- stats | show <id> | approve <id> "Your name" ["edits"] | reject <id> "Your name" | export');
  }
} finally {
  await close();
}
